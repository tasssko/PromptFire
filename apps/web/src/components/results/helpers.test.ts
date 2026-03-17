import { describe, expect, it } from 'vitest';
import { heroCopy, methodFitLabel, resolvePrimarySurface } from './helpers';

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

  it('suppresses full rewrite surfaces when the rewrite is not materially better', () => {
    const surface = resolvePrimarySurface({
      id: 'par_test',
      overallScore: 58,
      scoreBand: 'usable',
      rewriteRecommendation: 'rewrite_optional',
      analysis: {
        scores: {
          scope: 6,
          contrast: 6,
          clarity: 6,
          constraintQuality: 5,
          genericOutputRisk: 4,
          tokenWasteRisk: 4,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Usable prompt.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'low',
        majorBlockingIssues: false,
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Refined prompt',
      },
      evaluation: {
        status: 'no_significant_change',
        overallDelta: 0,
        signals: [],
        scoreComparison: {
          original: { scope: 6, contrast: 6, clarity: 6 },
          rewrite: { scope: 6, contrast: 6, clarity: 6 },
        },
      },
      rewritePresentationMode: 'full_rewrite',
      guidedCompletion: null,
      meta: {
        version: '2',
        requestId: 'req_2',
        latencyMs: 1,
        providerMode: 'mock',
      },
    });

    expect(surface).toBe('guided-completion');
  });

  it('keeps a full rewrite as the primary surface only when it is materially better', () => {
    const surface = resolvePrimarySurface({
      id: 'par_test',
      overallScore: 52,
      scoreBand: 'weak',
      rewriteRecommendation: 'rewrite_recommended',
      analysis: {
        scores: {
          scope: 4,
          contrast: 5,
          clarity: 5,
          constraintQuality: 3,
          genericOutputRisk: 6,
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
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Materially improved prompt',
      },
      evaluation: {
        status: 'material_improvement',
        overallDelta: 11,
        signals: [],
        scoreComparison: {
          original: { scope: 4, contrast: 5, clarity: 5 },
          rewrite: { scope: 8, contrast: 8, clarity: 8 },
        },
      },
      rewritePresentationMode: 'full_rewrite',
      guidedCompletion: null,
      meta: {
        version: '2',
        requestId: 'req_3',
        latencyMs: 1,
        providerMode: 'mock',
      },
    });

    expect(surface).toBe('full-rewrite');
  });
});
