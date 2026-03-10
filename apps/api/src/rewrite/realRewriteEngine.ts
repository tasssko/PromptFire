import type { Rewrite } from '@promptfire/shared';
import { buildRewriteInstructions } from './promptBuilder';
import type { ProviderConfig } from './providerConfig';
import { ProviderNotConfiguredError, UpstreamRewriteError } from './errors';
import type { RewriteEngine, RewriteInput } from './types';

interface OpenAIChoice {
  message?: {
    content?: string;
  };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

export class RealRewriteEngine implements RewriteEngine {
  constructor(
    private readonly config: ProviderConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async rewrite(input: RewriteInput): Promise<Rewrite> {
    if (!this.config.apiKey) {
      throw new ProviderNotConfiguredError('REWRITE_PROVIDER_API_KEY is required for real mode.');
    }

    if (!this.config.model) {
      throw new ProviderNotConfiguredError('REWRITE_PROVIDER_MODEL is required for real mode.');
    }

    const instructions = buildRewriteInstructions(input);
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
            { role: 'system', content: instructions.system },
            { role: 'user', content: instructions.user },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new UpstreamRewriteError(`Provider request failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as OpenAIResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new UpstreamRewriteError('Provider response did not include message content.');
      }

      const parsed = this.parseRewriteJson(content);
      return {
        role: input.role,
        mode: input.mode,
        rewrittenPrompt: parsed.rewrittenPrompt,
        explanation: parsed.explanation,
        changes: parsed.changes,
      };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError || error instanceof UpstreamRewriteError) {
        throw error;
      }

      throw new UpstreamRewriteError(
        error instanceof Error ? error.message : 'Unknown upstream provider error.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseRewriteJson(content: string): {
    rewrittenPrompt: string;
    explanation?: string;
    changes?: string[];
  } {
    const direct = this.tryParse(content);
    if (direct) {
      return direct;
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = this.tryParse(jsonMatch[0]);
      if (extracted) {
        return extracted;
      }
    }

    throw new UpstreamRewriteError('Provider output could not be parsed into rewrite JSON.');
  }

  private tryParse(value: string): { rewrittenPrompt: string; explanation?: string; changes?: string[] } | null {
    try {
      const parsed = JSON.parse(value) as {
        rewrittenPrompt?: unknown;
        explanation?: unknown;
        changes?: unknown;
      };

      if (typeof parsed.rewrittenPrompt !== 'string' || parsed.rewrittenPrompt.trim().length === 0) {
        return null;
      }

      const explanation = typeof parsed.explanation === 'string' ? parsed.explanation : undefined;
      const changes = Array.isArray(parsed.changes)
        ? parsed.changes.filter((item): item is string => typeof item === 'string')
        : undefined;

      return {
        rewrittenPrompt: parsed.rewrittenPrompt,
        explanation,
        changes,
      };
    } catch {
      return null;
    }
  }
}
