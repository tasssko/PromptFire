import { describe, expect, it } from 'vitest';
import type { Analysis } from '@promptfire/shared';
import { evaluateRewrite } from './evaluateRewrite';

function analysisWithScores(
  scores: Analysis['scores'],
  overrides?: Partial<Analysis>,
): Analysis {
  return {
    scores,
    issues: [],
    detectedIssueCodes: [],
    signals: [],
    summary: 'test',
    ...overrides,
  };
}

describe('evaluateRewrite', () => {
  it('returns material_improvement for large weighted gain', () => {
    const originalAnalysis = analysisWithScores({
      scope: 3,
      contrast: 3,
      clarity: 5,
      constraintQuality: 2,
      genericOutputRisk: 8,
      tokenWasteRisk: 7,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 7,
      contrast: 7,
      clarity: 7,
      constraintQuality: 6,
      genericOutputRisk: 4,
      tokenWasteRisk: 4,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write copy',
      rewrittenPrompt: 'Write landing page copy for CTO audience. Avoid buzzwords.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).toBe('material_improvement');
    expect(evaluation.improvement.overallDelta).toBeGreaterThanOrEqual(4);
    expect(evaluation.improvement.expectedUsefulness).toBe('higher');
  });

  it('returns already_strong and low expected improvement signal for strong prompt', () => {
    const originalAnalysis = analysisWithScores({
      scope: 8,
      contrast: 7,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 3,
      tokenWasteRisk: 3,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 8,
      contrast: 7,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 3,
      tokenWasteRisk: 3,
    });

    const evaluation = evaluateRewrite({
      originalPrompt:
        'Write copy for enterprise CTO audience. Must focus on audit readiness. Avoid buzzwords.',
      rewrittenPrompt:
        'Draft copy for enterprise CTOs. Must focus on audit readiness. Avoid generic buzzwords.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).toBe('already_strong');
    expect(evaluation.signals).toContain('LOW_EXPECTED_IMPROVEMENT');
    expect(evaluation.signals).toContain('PROMPT_ALREADY_OPTIMIZED');
  });

  it('returns possible_regression when weighted delta is negative enough', () => {
    const originalAnalysis = analysisWithScores({
      scope: 8,
      contrast: 7,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 2,
      tokenWasteRisk: 2,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 5,
      contrast: 5,
      clarity: 6,
      constraintQuality: 4,
      genericOutputRisk: 5,
      tokenWasteRisk: 4,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write for CTOs with strict constraints and explicit exclusions.',
      rewrittenPrompt: 'Write something about security for companies.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).toBe('possible_regression');
    expect(evaluation.signals).toContain('REWRITE_POSSIBLE_REGRESSION');
    expect(evaluation.improvement.expectedUsefulness).toBe('lower');
  });

  it('treats the microservices calibration prompt as already strong when rewrite adds little', () => {
    const originalAnalysis = analysisWithScores({
      scope: 8,
      contrast: 8,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 3,
      tokenWasteRisk: 2,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 8,
      contrast: 8,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 3,
      tokenWasteRisk: 2,
    });

    const evaluation = evaluateRewrite({
      originalPrompt:
        'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.',
      rewrittenPrompt:
        'Write a grounded blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create operational overhead. Use one startup example and one mature-organization example, and avoid hype.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).toBe('already_strong');
    expect(evaluation.signals).toContain('LOW_EXPECTED_IMPROVEMENT');
  });
});
