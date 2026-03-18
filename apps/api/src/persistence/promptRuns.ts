import { randomUUID } from 'node:crypto';
import { getDb, hasDatabaseUrl, promptRewrites, promptRuns } from '@promptfire/db';
import type {
  AnalyzeAndRewriteResponse,
  AnalyzeAndRewriteV2Request,
  AnalyzeAndRewriteV2Response,
  AnalyzeAndRewriteRequest,
  Evaluation,
  Rewrite,
} from '@promptfire/shared';

type PersistableRequest = AnalyzeAndRewriteRequest | AnalyzeAndRewriteV2Request;
type PersistableResponse = AnalyzeAndRewriteResponse | AnalyzeAndRewriteV2Response;

interface PersistPromptRunParams {
  endpoint: '/v1/analyze-and-rewrite' | '/v2/analyze-and-rewrite';
  requestId: string;
  sessionId?: string;
  userId?: string;
  input: PersistableRequest;
  response: PersistableResponse;
  inferenceData: Record<string, unknown>;
}

interface PersistedRewriteRecord {
  rewrite: Rewrite;
  evaluation: Evaluation | AnalyzeAndRewriteV2Response['evaluation'] | null;
  kind: 'primary' | 'alternative';
  position: number;
  isPrimary: boolean;
}

function isV2Response(response: PersistableResponse): response is AnalyzeAndRewriteV2Response {
  return response.meta.version === '2';
}

function buildRewriteRecords(response: PersistableResponse): PersistedRewriteRecord[] {
  if (!response.rewrite) {
    return [];
  }

  return [
    {
      rewrite: response.rewrite,
      evaluation: response.evaluation,
      kind: 'primary',
      position: 0,
      isPrimary: true,
    },
  ];
}

export async function persistPromptRun(params: PersistPromptRunParams): Promise<void> {
  if (!hasDatabaseUrl() || !params.userId) {
    return;
  }

  const timestamp = new Date();
  const runId = `prn_${randomUUID()}`;
  const rewrites = buildRewriteRecords(params.response);
  const overallScore = isV2Response(params.response) ? params.response.overallScore : null;
  const scoreBand = isV2Response(params.response) ? params.response.scoreBand : null;
  const rewriteRecommendation = isV2Response(params.response) ? params.response.rewriteRecommendation : null;
  const rewritePreference = 'rewritePreference' in params.input ? params.input.rewritePreference : null;

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(promptRuns).values({
      id: runId,
      userId: params.userId,
      sessionId: params.sessionId ?? null,
      requestId: params.requestId,
      endpoint: params.endpoint,
      originalPrompt: params.input.prompt,
      normalizedPrompt: null,
      role: params.input.role,
      mode: params.input.mode,
      rewritePreference,
      overallScore,
      scoreBand,
      rewriteRecommendation,
      inferenceData: params.inferenceData,
      responseData: params.response,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (rewrites.length === 0) {
      return;
    }

    await tx.insert(promptRewrites).values(
      rewrites.map((entry) => ({
        id: `prw_${randomUUID()}`,
        promptRunId: runId,
        kind: entry.kind,
        position: entry.position,
        role: entry.rewrite.role,
        mode: entry.rewrite.mode,
        rewrittenPrompt: entry.rewrite.rewrittenPrompt,
        explanation: entry.rewrite.explanation ?? null,
        changes: entry.rewrite.changes ?? null,
        evaluationData: entry.evaluation,
        isPrimary: entry.isPrimary,
        createdAt: timestamp,
      })),
    );
  });
}
