import { describe, expect, it } from 'vitest';
import { deriveRewriteLadderState, validateLadderStep, ladderRungFromOverallScore } from './rewriteLadder';

describe('rewrite ladder', () => {
  it('maps overall score bands to ladder rungs', () => {
    expect(ladderRungFromOverallScore(10)).toBe('poor');
    expect(ladderRungFromOverallScore(40)).toBe('weak');
    expect(ladderRungFromOverallScore(70)).toBe('good');
    expect(ladderRungFromOverallScore(80)).toBe('strong');
    expect(ladderRungFromOverallScore(95)).toBe('excellent');
  });

  it('defaults weak prompts to a one-step target', () => {
    expect(
      deriveRewriteLadderState({
        overallScore: 45,
        rewriteRecommendation: 'rewrite_recommended',
        rewritePreference: 'auto',
        expectedImprovement: 'high',
      }),
    ).toEqual({
      current: 'weak',
      target: 'good',
      next: 'good',
      maxSafeTarget: 'strong',
      stopReason: null,
    });
  });

  it('stops strong prompts by default and allows a forced refinement step', () => {
    expect(
      deriveRewriteLadderState({
        overallScore: 82,
        rewriteRecommendation: 'no_rewrite_needed',
        rewritePreference: 'auto',
        expectedImprovement: 'low',
      }),
    ).toEqual({
      current: 'strong',
      target: null,
      next: 'excellent',
      maxSafeTarget: 'strong',
      stopReason: 'already_strong',
    });

    expect(
      deriveRewriteLadderState({
        overallScore: 82,
        rewriteRecommendation: 'rewrite_optional',
        rewritePreference: 'force',
        expectedImprovement: 'low',
      }),
    ).toEqual({
      current: 'strong',
      target: 'excellent',
      next: 'excellent',
      maxSafeTarget: 'excellent',
      stopReason: null,
    });
  });

  it('rejects ladder progress when grounded improvements are insufficient or rubric-heavy', () => {
    expect(
      validateLadderStep({
        from: 'weak',
        to: 'good',
        evaluationStatus: 'no_significant_change',
        diagnostics: {
          groundedImprovementCount: 1,
          rubricEchoRisk: 'low',
          intentPreservation: 'high',
          significantChange: true,
          deliverableDrift: false,
        },
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'insufficient_grounded_improvement',
    });

    expect(
      validateLadderStep({
        from: 'good',
        to: 'strong',
        evaluationStatus: 'possible_regression',
        diagnostics: {
          groundedImprovementCount: 3,
          rubricEchoRisk: 'high',
          intentPreservation: 'high',
          significantChange: true,
          deliverableDrift: false,
        },
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'rubric_echo_risk',
    });
  });

  it('accepts weak to good when two grounded improvements exist', () => {
    expect(
      validateLadderStep({
        from: 'weak',
        to: 'good',
        evaluationStatus: 'minor_improvement',
        diagnostics: {
          groundedImprovementCount: 2,
          rubricEchoRisk: 'low',
          intentPreservation: 'high',
          significantChange: true,
          deliverableDrift: false,
        },
      }),
    ).toMatchObject({
      accepted: true,
      reason: 'grounded_improvement_sufficient',
    });
  });

  it('rejects strong to excellent as already strong when change is negligible', () => {
    expect(
      validateLadderStep({
        from: 'strong',
        to: 'excellent',
        evaluationStatus: 'already_strong',
        diagnostics: {
          groundedImprovementCount: 0,
          rubricEchoRisk: 'low',
          intentPreservation: 'high',
          significantChange: false,
          deliverableDrift: false,
        },
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'already_strong',
    });
  });

  it('keeps rung boundaries stable at 54/55, 74/75, and 89/90', () => {
    expect(
      deriveRewriteLadderState({
        overallScore: 54,
        rewriteRecommendation: 'rewrite_recommended',
        rewritePreference: 'auto',
        expectedImprovement: 'high',
      }),
    ).toMatchObject({
      current: 'weak',
      target: 'good',
    });
    expect(
      deriveRewriteLadderState({
        overallScore: 55,
        rewriteRecommendation: 'rewrite_optional',
        rewritePreference: 'auto',
        expectedImprovement: 'high',
      }),
    ).toMatchObject({
      current: 'good',
      target: 'strong',
    });

    expect(
      deriveRewriteLadderState({
        overallScore: 74,
        rewriteRecommendation: 'rewrite_optional',
        rewritePreference: 'auto',
        expectedImprovement: 'high',
      }),
    ).toMatchObject({
      current: 'good',
      target: 'strong',
    });
    expect(
      deriveRewriteLadderState({
        overallScore: 75,
        rewriteRecommendation: 'no_rewrite_needed',
        rewritePreference: 'auto',
        expectedImprovement: 'low',
      }),
    ).toMatchObject({
      current: 'strong',
      target: null,
      stopReason: 'already_strong',
    });

    expect(
      deriveRewriteLadderState({
        overallScore: 89,
        rewriteRecommendation: 'no_rewrite_needed',
        rewritePreference: 'auto',
        expectedImprovement: 'low',
      }),
    ).toMatchObject({
      current: 'strong',
      target: null,
    });
    expect(
      deriveRewriteLadderState({
        overallScore: 90,
        rewriteRecommendation: 'no_rewrite_needed',
        rewritePreference: 'auto',
        expectedImprovement: 'low',
      }),
    ).toMatchObject({
      current: 'excellent',
      target: null,
      stopReason: 'already_excellent',
    });
  });
});
