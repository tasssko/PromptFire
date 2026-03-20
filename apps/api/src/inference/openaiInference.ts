import type { Mode, Role } from '@promptfire/shared';
import type { ProviderConfig } from '../rewrite/providerConfig';
import { ProviderNotConfiguredError, UpstreamRewriteError } from '../rewrite/errors';
import { parseInferenceMetadata, type InferenceMetadata } from './types';

interface OpenAIChoice {
  message?: {
    content?: string;
  };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

function buildSystemInstruction(): string {
  return [
    'You infer prompt metadata only.',
    'Return only JSON that matches the schema exactly.',
    'Do not return scores, verdicts, rewrite recommendations, or rewritten prompts.',
    'Use null when unknown.',
  ].join(' ');
}

function buildUserInstruction(input: { prompt: string; role: Role; mode: Mode }): string {
  return [
    'Infer metadata for this prompt shape.',
    `Role: ${input.role}`,
    `Mode: ${input.mode}`,
    `Prompt: ${input.prompt}`,
  ].join('\n');
}

function responseFormatSchema() {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'inference_metadata',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          promptPattern: { type: ['string', 'null'] },
          taskType: { type: ['string', 'null'] },
          deliverableType: { type: ['string', 'null'] },
          missingContextType: {
            type: ['string', 'null'],
            enum: ['audience', 'operating', 'execution', 'io', 'comparison', 'source', 'boundary', null],
          },
          roleHint: {
            type: ['string', 'null'],
            enum: ['general', 'developer', 'marketer', null],
          },
          noveltyCandidate: { type: 'boolean' },
          lookupKeys: {
            type: 'array',
            items: { type: 'string' },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          notes: { type: ['string', 'null'] },
        },
        required: [
          'promptPattern',
          'taskType',
          'deliverableType',
          'missingContextType',
          'roleHint',
          'noveltyCandidate',
          'lookupKeys',
          'confidence',
          'notes',
        ],
      },
    },
  };
}

export class OpenAIInferenceClient {
  constructor(
    private readonly config: ProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async inferMetadata(input: { prompt: string; role: Role; mode: Mode }): Promise<InferenceMetadata> {
    if (!this.config.apiKey) {
      throw new ProviderNotConfiguredError('REWRITE_PROVIDER_API_KEY is required for inference fallback.');
    }

    if (!this.config.model) {
      throw new ProviderNotConfiguredError('REWRITE_PROVIDER_MODEL is required for inference fallback.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(this.config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          messages: [
            { role: 'system', content: buildSystemInstruction() },
            { role: 'user', content: buildUserInstruction(input) },
          ],
          response_format: responseFormatSchema(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new UpstreamRewriteError(`Inference request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as OpenAIResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new UpstreamRewriteError('Inference response did not include message content.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new UpstreamRewriteError('Inference response is not valid JSON.');
      }

      const metadata = parseInferenceMetadata(parsed);
      if (!metadata) {
        throw new UpstreamRewriteError('Inference JSON failed schema validation.');
      }

      return metadata;
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError || error instanceof UpstreamRewriteError) {
        throw error;
      }

      throw new UpstreamRewriteError(error instanceof Error ? error.message : 'Unknown inference provider error.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async composeGuidedPrompt(input: { internalSynthesisPrompt: string }): Promise<string> {
    if (!this.config.apiKey) {
      throw new ProviderNotConfiguredError('REWRITE_PROVIDER_API_KEY is required for guided prompt composition.');
    }

    if (!this.config.model) {
      throw new ProviderNotConfiguredError('REWRITE_PROVIDER_MODEL is required for guided prompt composition.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(this.config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: 'Return only the final rewritten prompt text. Do not return labels, headings, bullets, JSON, or explanations.',
            },
            { role: 'user', content: input.internalSynthesisPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new UpstreamRewriteError(`Guided composition request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as OpenAIResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new UpstreamRewriteError('Guided composition response did not include message content.');
      }

      return content.trim();
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError || error instanceof UpstreamRewriteError) {
        throw error;
      }

      throw new UpstreamRewriteError(error instanceof Error ? error.message : 'Unknown guided composition provider error.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
