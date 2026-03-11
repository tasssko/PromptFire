import { describe, expect, it } from 'vitest';
import {
  API_VERSION,
  AnalyzeAndRewriteRequestSchema,
  AnalyzeAndRewriteResponseSchema,
  normalizePreferences,
} from './contracts';

describe('shared contracts', () => {
  it('applies preference defaults', () => {
    const defaults = normalizePreferences();
    expect(defaults.includeScores).toBe(true);
    expect(defaults.includeExplanation).toBe(true);
    expect(defaults.includeAlternatives).toBe(false);
    expect(defaults.preserveTone).toBe(false);
  });

  it('validates prompt upper bound', () => {
    const tooLongPrompt = 'a'.repeat(6001);
    const parsed = AnalyzeAndRewriteRequestSchema.safeParse({
      prompt: tooLongPrompt,
      role: 'general',
      mode: 'balanced',
    });
    expect(parsed.success).toBe(false);
  });

  it('validates analyze-and-rewrite response with evaluation block', () => {
    const parsed = AnalyzeAndRewriteResponseSchema.safeParse({
      id: 'par_test',
      analysis: {
        scores: {
          scope: 6,
          contrast: 6,
          clarity: 7,
          constraintQuality: 6,
          genericOutputRisk: 4,
          tokenWasteRisk: 3,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'ok',
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Rewrite',
      },
      evaluation: {
        originalScore: {
          scope: 6,
          contrast: 6,
          clarity: 7,
          constraintQuality: 6,
          genericOutputRisk: 4,
          tokenWasteRisk: 3,
        },
        rewriteScore: {
          scope: 7,
          contrast: 7,
          clarity: 7,
          constraintQuality: 7,
          genericOutputRisk: 3,
          tokenWasteRisk: 3,
        },
        improvement: {
          status: 'minor_improvement',
          scoreDeltas: {
            scope: 1,
            contrast: 1,
            clarity: 0,
            constraintQuality: 1,
            genericOutputRisk: -1,
            tokenWasteRisk: 0,
          },
          overallDelta: 2.75,
          expectedUsefulness: 'slightly_higher',
          notes: ['Improved'],
        },
        signals: [],
      },
      meta: {
        version: API_VERSION,
        requestId: 'req_1',
        latencyMs: 0,
        providerMode: 'mock',
      },
    });

    expect(parsed.success).toBe(true);
  });
});
