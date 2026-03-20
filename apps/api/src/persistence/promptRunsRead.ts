import { and, eq } from 'drizzle-orm';
import { getDb, hasDatabaseUrl, promptRuns } from '@promptfire/db';
import type { PromptRunDetail, PromptRunListItem } from '@promptfire/shared';

export async function listPromptRunsForUser(userId: string, limit: number): Promise<PromptRunListItem[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }

  const db = getDb();
  const runs = await db.query.promptRuns.findMany({
    where: eq(promptRuns.userId, userId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit,
    with: {
      rewrites: {
        columns: {
          id: true,
        },
      },
    },
  });

  return runs.map((run) => ({
    id: run.id,
    createdAt: run.createdAt.toISOString(),
    originalPrompt: run.originalPrompt,
    role: run.role as PromptRunListItem['role'],
    mode: run.mode as PromptRunListItem['mode'],
    overallScore: run.overallScore,
    scoreBand: run.scoreBand as PromptRunListItem['scoreBand'],
    rewriteRecommendation: run.rewriteRecommendation as PromptRunListItem['rewriteRecommendation'],
    hasRewrite: run.rewrites.length > 0,
  }));
}

export async function getPromptRunDetailForUser(userId: string, runId: string): Promise<PromptRunDetail | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const db = getDb();
  const run = await db.query.promptRuns.findFirst({
    where: and(eq(promptRuns.id, runId), eq(promptRuns.userId, userId)),
    with: { rewrites: true },
  });

  if (!run) {
    return null;
  }

  const orderedRewrites = [...run.rewrites].sort((left, right) => left.position - right.position);

  return {
    id: run.id,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    endpoint: run.endpoint,
    requestId: run.requestId,
    originalPrompt: run.originalPrompt,
    role: run.role as PromptRunDetail['role'],
    mode: run.mode as PromptRunDetail['mode'],
    rewritePreference: run.rewritePreference as PromptRunDetail['rewritePreference'],
    overallScore: run.overallScore,
    scoreBand: run.scoreBand as PromptRunDetail['scoreBand'],
    rewriteRecommendation: run.rewriteRecommendation as PromptRunDetail['rewriteRecommendation'],
    inferenceData: run.inferenceData,
    responseData: run.responseData,
    rewrites: orderedRewrites.map((rewrite) => ({
      id: rewrite.id,
      kind: rewrite.kind,
      position: rewrite.position,
      role: rewrite.role as PromptRunDetail['rewrites'][number]['role'],
      mode: rewrite.mode as PromptRunDetail['rewrites'][number]['mode'],
      rewrittenPrompt: rewrite.rewrittenPrompt,
      explanation: rewrite.explanation,
      changes: Array.isArray(rewrite.changes) ? (rewrite.changes as string[]) : null,
      evaluationData: rewrite.evaluationData,
      isPrimary: rewrite.isPrimary,
      createdAt: rewrite.createdAt.toISOString(),
    })),
  };
}
