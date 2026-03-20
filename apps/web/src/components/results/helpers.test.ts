import { describe, expect, it } from 'vitest';
import type { AnalyzeAndRewriteV2Response } from '@promptfire/shared';
import {
  getVisibleRewritePrompt,
  resolveActionModule,
  resolveFindingIds,
  resolvePrimarySurface,
  resolveResultsPresentation,
  resolveVerdictId,
} from './helpers';

function buildResult(overrides: Partial<AnalyzeAndRewriteV2Response> = {}): AnalyzeAndRewriteV2Response {
  return {
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
    rewrite: null,
    evaluation: null,
    rewritePresentationMode: 'template_with_example',
    guidedCompletion: {
      mode: 'template_with_example',
      title: 'Fill in the missing details',
      summary: 'Add boundaries first.',
      template: 'Write [deliverable].',
    },
    guidedCompletionForm: null,
    meta: {
      version: '2',
      requestId: 'req_1',
      latencyMs: 1,
      providerMode: 'mock',
    },
    ...overrides,
  };
}

describe('results presentation resolvers', () => {
  it('resolves hero copy from config for strong prompts', () => {
    const presentation = resolveResultsPresentation(
      buildResult({
        scoreBand: 'excellent',
        rewriteRecommendation: 'no_rewrite_needed',
        gating: { rewritePreference: 'auto', expectedImprovement: 'low', majorBlockingIssues: false },
      }),
      'general',
    );

    expect(presentation.hero.headline).toBe('Excellent prompt');
    expect(presentation.actionCard.lead).toBe('Keep the original prompt');
  });

  it('uses config-driven action labels for usable prompts', () => {
    const presentation = resolveResultsPresentation(buildResult(), 'general');
    expect(presentation.actionCard.primaryActionLabel).toBe('Copy template');
  });

  it('uses the configured rewrite panel title for weak prompts', () => {
    const presentation = resolveResultsPresentation(
      buildResult({
        rewriteRecommendation: 'rewrite_recommended',
        rewrite: {
          role: 'general',
          mode: 'balanced',
          rewrittenPrompt: 'Materially improved prompt',
        },
        evaluation: {
          status: 'material_improvement',
          overallDelta: 8,
          signals: [],
          scoreComparison: {
            original: { scope: 4, contrast: 5, clarity: 5 },
            rewrite: { scope: 8, contrast: 8, clarity: 8 },
          },
        },
        rewritePresentationMode: 'full_rewrite',
      }),
      'general',
    );

    expect(presentation.rewritePanel.title).toBe('Recommended rewrite');
  });

  it('resolves suppressed-state verdict copy from config', () => {
    const presentation = resolveResultsPresentation(
      buildResult({
        rewriteRecommendation: 'no_rewrite_needed',
        gating: { rewritePreference: 'suppress', expectedImprovement: 'low', majorBlockingIssues: false },
      }),
      'general',
    );

    expect(resolveVerdictId(buildResult({
      rewriteRecommendation: 'no_rewrite_needed',
      gating: { rewritePreference: 'suppress', expectedImprovement: 'low', majorBlockingIssues: false },
    }))).toBe('strong_suppressed');
    expect(presentation.actionCard.lead).toBe('Keep the original prompt');
  });

  it('resolves forced strong verdicts when a rewrite exists', () => {
    const result = buildResult({
      rewriteRecommendation: 'no_rewrite_needed',
      gating: { rewritePreference: 'force', expectedImprovement: 'low', majorBlockingIssues: false },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Forced rewrite',
      },
      evaluation: {
        status: 'no_significant_change',
        overallDelta: 0,
        signals: [],
        scoreComparison: {
          original: { scope: 8, contrast: 8, clarity: 8 },
          rewrite: { scope: 8, contrast: 8, clarity: 8 },
        },
      },
    });

    expect(resolveVerdictId(result)).toBe('strong_forced');
    expect(resolveResultsPresentation(result, 'general').hero.headline).toBe('Strong prompt, forced rewrite available');
  });

  it('gives evaluation-specific verdict ids precedence', () => {
    expect(
      resolveVerdictId(
        buildResult({
          rewriteRecommendation: 'rewrite_recommended',
          rewrite: { role: 'general', mode: 'balanced', rewrittenPrompt: 'Improved' },
          evaluation: {
            status: 'material_improvement',
            overallDelta: 9,
            signals: [],
            scoreComparison: {
              original: { scope: 3, contrast: 4, clarity: 5 },
              rewrite: { scope: 8, contrast: 8, clarity: 8 },
            },
          },
          rewritePresentationMode: 'full_rewrite',
        }),
      ),
    ).toBe('rewrite_material_improvement');

    expect(
      resolveVerdictId(
        buildResult({
          rewrite: { role: 'general', mode: 'balanced', rewrittenPrompt: 'Regression' },
          evaluation: {
            status: 'possible_regression',
            overallDelta: -2,
            signals: [],
            scoreComparison: {
              original: { scope: 6, contrast: 6, clarity: 6 },
              rewrite: { scope: 5, contrast: 5, clarity: 5 },
            },
          },
        }),
      ),
    ).toBe('rewrite_possible_regression');

    expect(
      resolveVerdictId(
        buildResult({
          rewriteRecommendation: 'no_rewrite_needed',
          rewrite: { role: 'general', mode: 'balanced', rewrittenPrompt: 'Unneeded rewrite' },
          evaluation: {
            status: 'already_strong',
            overallDelta: 0,
            signals: [],
            scoreComparison: {
              original: { scope: 8, contrast: 8, clarity: 8 },
              rewrite: { scope: 8, contrast: 8, clarity: 8 },
            },
          },
        }),
      ),
    ).toBe('rewrite_already_strong');
  });

  it('resolves findings through stable ids before rendering text', () => {
    const result = buildResult({
      analysis: {
        scores: {
          scope: 8,
          contrast: 8,
          clarity: 8,
          constraintQuality: 3,
          genericOutputRisk: 8,
          tokenWasteRisk: 2,
        },
        issues: [{ code: 'CONSTRAINTS_MISSING', severity: 'high', message: 'Need runtime and payload boundaries.' }],
        detectedIssueCodes: ['CONSTRAINTS_MISSING', 'GENERIC_OUTPUT_RISK_HIGH'],
        signals: [],
        summary: 'Needs more structure.',
      },
    });

    expect(resolveFindingIds(result)).toEqual(
      expect.arrayContaining(['clear_scope', 'strong_contrast', 'clear_instruction', 'constraints_missing', 'high_generic_risk']),
    );
    expect(resolveResultsPresentation(result, 'general').findings).toContain('Missing constraints');
  });

  it('changes section visibility by verdict', () => {
    const strong = resolveResultsPresentation(
      buildResult({
        rewriteRecommendation: 'no_rewrite_needed',
        gating: { rewritePreference: 'auto', expectedImprovement: 'low', majorBlockingIssues: false },
      }),
      'general',
    );
    const weak = resolveResultsPresentation(buildResult({ rewriteRecommendation: 'rewrite_recommended' }), 'general');

    expect(strong.visibleSectionIds).toContain('action_card');
    expect(strong.visibleSectionIds).not.toContain('rewrite_panel');
    expect(weak.visibleSectionIds).toContain('action_card');
  });

  it('applies developer wording overrides without changing surface logic', () => {
    const result = buildResult({
      rewriteRecommendation: 'rewrite_recommended',
      analysis: {
        scores: {
          scope: 3,
          contrast: 4,
          clarity: 5,
          constraintQuality: 2,
          genericOutputRisk: 7,
          tokenWasteRisk: 3,
        },
        issues: [{ code: 'CONSTRAINTS_MISSING', severity: 'high', message: 'Need runtime and payload boundaries.' }],
        detectedIssueCodes: ['CONSTRAINTS_MISSING'],
        signals: [],
        summary: 'Weak prompt.',
      },
    });

    const developerPresentation = resolveResultsPresentation(result, 'developer');
    expect(developerPresentation.hero.supporting).toContain('boundaries');
    expect(resolvePrimarySurface(result)).toBe('guided-completion-legacy');
  });

  it('keeps guided-completion actions aligned with the available payload', () => {
    const result = buildResult({
      rewriteRecommendation: 'rewrite_recommended',
      guidedCompletion: {
        mode: 'template_with_example',
        title: 'Fill in the missing details',
        summary: 'Add boundaries first.',
        example: 'Example prompt',
      },
    });

    const module = resolveActionModule(result, 'general');
    expect(module.primaryActionLabel).toBe('Copy example');
    expect(module.example).toBe('Example prompt');
  });

  it('suppresses full rewrite surfaces when the rewrite is not materially better', () => {
    const surface = resolvePrimarySurface(
      buildResult({
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
      }),
    );

    expect(surface).toBe('guided-completion-legacy');
  });

  it('keeps a full rewrite as the primary surface only when it is materially better', () => {
    const surface = resolvePrimarySurface(
      buildResult({
        rewriteRecommendation: 'rewrite_recommended',
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
      }),
    );

    expect(surface).toBe('full-rewrite');
  });

  it('shows guided-submit rewrites as the primary surface even when evaluation is not material', () => {
    const result = buildResult({
      requestSource: 'guided_submit',
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Built stronger prompt',
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
      guidedCompletionForm: null,
    });

    const presentation = resolveResultsPresentation(result, 'general');
    expect(resolvePrimarySurface(result)).toBe('full-rewrite');
    expect(presentation.hero.headline).toBe('Stronger prompt');
    expect(presentation.hero.supporting).toBe('Built from your answers.');
    expect(presentation.visibleSectionIds).toContain('rewrite_panel');
    expect(presentation.rewritePanel.title).toBe('Stronger prompt');
    expect(presentation.rewritePanel.verdictLabel).toBe('Built from your answers');
  });

  it('suppresses scaffold-shaped rewrites from the visible prompt helper', () => {
    const result = buildResult({
      requestSource: 'guided_submit',
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: `Original request:
Write better copy.

Additional constraints:
- Primary goal: persuade

Create a stronger, more specific version of the prompt that preserves the user’s intent while adding these boundaries.`,
      },
      rewritePresentationMode: 'full_rewrite',
    });

    expect(getVisibleRewritePrompt(result)).toBeNull();
  });

  it('prefers the guided completion form over legacy guided completion text', () => {
    const result = buildResult({
      rewriteRecommendation: 'rewrite_recommended',
      guidedCompletionForm: {
        enabled: true,
        title: 'Complete the missing details',
        summary: 'PeakPrompt will build a better version once the prompt has stronger boundaries.',
        submitLabel: 'Build stronger prompt',
        skipLabel: 'Skip and rewrite anyway',
        blocks: [
          {
            id: 'goal',
            kind: 'radio',
            label: 'What should the output mainly do?',
            required: true,
            mapsTo: 'goal',
            options: [{ id: 'explain', label: 'Explain', value: 'explain' }],
          },
        ],
      },
    });

    const presentation = resolveResultsPresentation(result, 'general');
    expect(resolvePrimarySurface(result)).toBe('guided-completion-form');
    expect(presentation.hero.primaryAction).toBe('Complete missing details');
    expect(presentation.hero.secondaryAction).toBe('Rewrite anyway');
    expect(presentation.actionCard.formSubmitLabel).toBe('Build stronger prompt');
    expect(presentation.actionCard.formSkipLabel).toBe('Skip and rewrite anyway');
  });
});
