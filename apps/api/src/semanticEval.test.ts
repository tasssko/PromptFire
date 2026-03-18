import { describe, expect, it } from 'vitest';
import { classifySemanticPrompt } from '@promptfire/heuristics';
import { semanticEvalFixtures } from '@promptfire/shared/src/semanticEvalFixtures';
import type { AnalyzeAndRewriteV2Response } from '@promptfire/shared';
import { handleHttpRequest } from './server';

async function analyzeV2(prompt: string, role: 'general' | 'developer' | 'marketer'): Promise<AnalyzeAndRewriteV2Response> {
  process.env.REWRITE_PROVIDER_MODE = 'mock';

  const response = await handleHttpRequest({
    method: 'POST',
    path: '/v2/analyze-and-rewrite',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      role,
      mode: 'balanced',
      rewritePreference: 'auto',
    }),
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body);
}

function expectVisibleCopyToAvoidSnippets(text: string, forbidden: string[]): void {
  const lowered = text.toLowerCase();
  for (const snippet of forbidden) {
    expect(lowered).not.toContain(snippet.toLowerCase());
  }
}

describe('semantic eval suite', () => {
  for (const fixture of semanticEvalFixtures) {
    it(fixture.id, async () => {
      const classification = classifySemanticPrompt(fixture.prompt, fixture.role);
      const body = await analyzeV2(fixture.prompt, fixture.role);
      const visibleCopy = [
        body.analysis.summary,
        ...body.analysis.issues.map((issue) => issue.message),
        body.bestNextMove?.title ?? '',
        body.bestNextMove?.rationale ?? '',
      ].join(' ');

      expect(classification.extraction.inScope).toBe(true);
      expect(classification.extraction.taskClass).toBe(fixture.expectedTaskClass);
      expect(body.rewriteRecommendation).toBe(fixture.expectedRecommendation);
      expect(fixture.acceptableScoreBands).toContain(body.scoreBand);
      expectVisibleCopyToAvoidSnippets(visibleCopy, fixture.forbiddenLegacyPhrases);

      if (fixture.expectedRecommendation === 'no_rewrite_needed') {
        expect(body.bestNextMove).toBeNull();
      }
    });
  }
});
