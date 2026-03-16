import { describe, expect, it } from 'vitest';
import { heroCopy, methodFitLabel } from './helpers';

describe('methodFitLabel', () => {
  it('renders public method-fit projections as plain language', () => {
    expect(methodFitLabel('break_into_steps')).toBe('break the reasoning into steps');
    expect(methodFitLabel('supply_missing_context')).toBe('supply the missing context');
  });

  it('uses template-copy hero action for guided completion fallback', () => {
    const hero = heroCopy({
      id: 'par_test',
      overallScore: 45,
      scoreBand: 'weak',
      rewriteRecommendation: 'rewrite_recommended',
      analysis: {
        scores: {
          scope: 3,
          contrast: 4,
          clarity: 5,
          constraintQuality: 2,
          genericOutputRisk: 7,
          tokenWasteRisk: 4,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Weak prompt.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'high',
        majorBlockingIssues: true,
      },
      rewrite: null,
      evaluation: {
        status: 'no_significant_change',
        overallDelta: 0,
        signals: [],
        scoreComparison: {
          original: { scope: 3, contrast: 4, clarity: 5 },
          rewrite: { scope: 3, contrast: 4, clarity: 5 },
        },
      },
      rewritePresentationMode: 'template_with_example',
      guidedCompletion: {
        mode: 'template_with_example',
        title: 'Fill in the missing details',
        summary: 'Add boundaries first.',
        template: 'Write [deliverable].',
      },
      meta: {
        version: '2',
        requestId: 'req_1',
        latencyMs: 1,
        providerMode: 'mock',
      },
    });

    expect(hero.primaryAction).toBe('Copy template');
  });
});
