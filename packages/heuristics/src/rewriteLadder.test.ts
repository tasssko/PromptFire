import { describe, expect, it } from 'vitest';
import { deriveRewriteLadderState, evaluateLadderStep, ladderRungFromOverallScore } from './rewriteLadder';

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
      evaluateLadderStep({
        from: 'weak',
        to: 'good',
        groundedImprovementCount: 1,
        rubricEchoRisk: 'low',
        intentPreservation: 'high',
        significantChange: true,
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'insufficient_grounded_improvement',
    });

    expect(
      evaluateLadderStep({
        from: 'good',
        to: 'strong',
        groundedImprovementCount: 3,
        rubricEchoRisk: 'high',
        intentPreservation: 'high',
        significantChange: true,
      }),
    ).toMatchObject({
      accepted: false,
      reason: 'rubric_echo_risk',
    });
  });
});
