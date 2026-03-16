import { describe, expect, it } from 'vitest';
import type { Analysis, EvaluationV2, Rewrite } from '@promptfire/shared';
import { buildGuidedCompletion, selectRewritePresentationMode } from './rewritePresentation';

function analysis(overrides?: Partial<Analysis>): Analysis {
  return {
    scores: {
      scope: 3,
      contrast: 3,
      clarity: 5,
      constraintQuality: 2,
      genericOutputRisk: 7,
      tokenWasteRisk: 4,
    },
    issues: [
      {
        code: 'CONSTRAINTS_MISSING',
        severity: 'high',
        message: 'Constraints are missing.',
      },
    ],
    detectedIssueCodes: ['CONSTRAINTS_MISSING'],
    signals: [],
    summary: 'Weak prompt.',
    ...overrides,
  };
}

function rewrite(): Rewrite {
  return {
    role: 'developer',
    mode: 'balanced',
    rewrittenPrompt: 'Rewrite candidate text',
  };
}

function evaluation(status: EvaluationV2['status'], overallDelta = 0): EvaluationV2 {
  return {
    status,
    overallDelta,
    signals: status === 'possible_regression' ? ['REWRITE_POSSIBLE_REGRESSION'] : [],
    scoreComparison: {
      original: { scope: 3, contrast: 3, clarity: 5 },
      rewrite: { scope: 3, contrast: 3, clarity: 5 },
    },
  };
}

describe('rewrite presentation fallback', () => {
  it('A: uses guided completion for thin developer prompts with regression-prone rewrite', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('possible_regression', -1.5),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'weak',
      prompt: 'Write a webhook handler.',
      effectiveAnalysisContext: {
        role: 'developer',
        canonicalTaskType: 'implementation_code',
        canonicalDeliverableType: 'code',
        missingContextType: 'execution',
      },
    });
    expect(mode).toBe('template_with_example');

    const guided = buildGuidedCompletion({
      prompt: 'Write a webhook handler.',
      role: 'developer',
      mode: 'template_with_example',
      analysis: analysis(),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'developer',
        canonicalTaskType: 'implementation_code',
        canonicalDeliverableType: 'code',
        missingContextType: 'execution',
      },
    });
    expect(guided?.questions?.join(' ').toLowerCase()).toMatch(/runtime|input|validation|success|failure/);
    expect(guided?.template).toContain('[runtime/framework]');
    expect(guided?.example).toContain('Example of a stronger prompt:');
  });

  it('B: falls back to questions-only for speculative thin non-developer prompts', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('possible_regression', -1),
      analysis: analysis({
        scores: {
          scope: 2,
          contrast: 2,
          clarity: 3,
          constraintQuality: 1,
          genericOutputRisk: 8,
          tokenWasteRisk: 4,
        },
        issues: [],
        detectedIssueCodes: [],
      }),
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Speculative rewrite',
      },
      scoreBand: 'poor',
      prompt: 'Write better copy.',
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: null,
      },
    });
    expect(mode).toBe('questions_only');
  });

  it('C: keeps full rewrite when evaluation is material improvement', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('material_improvement', 8),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'weak',
      prompt: 'Write a webhook handler.',
    });
    expect(mode).toBe('full_rewrite');
  });

  it('D: suppresses rewrite for already strong path', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'no_rewrite_needed',
      rewritePreference: 'auto',
      evaluation: evaluation('already_strong', 0),
      analysis: analysis({
        scores: {
          scope: 8,
          contrast: 8,
          clarity: 8,
          constraintQuality: 8,
          genericOutputRisk: 2,
          tokenWasteRisk: 2,
        },
        issues: [],
        detectedIssueCodes: [],
      }),
      rewrite: rewrite(),
      scoreBand: 'strong',
      prompt: 'Strong prompt',
    });
    expect(mode).toBe('suppressed');
  });

  it('E: prefers template_with_example for weak/usable no-significant-change cases', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_optional',
      rewritePreference: 'auto',
      evaluation: evaluation('no_significant_change', 0.4),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'usable',
      prompt: 'Write a webhook handler.',
      effectiveAnalysisContext: {
        role: 'developer',
        missingContextType: 'execution',
      },
    });
    expect(mode).toBe('template_with_example');
  });
});
