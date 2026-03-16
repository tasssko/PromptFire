import { describe, expect, it } from 'vitest';
import { findDiscouragedDefaultLanguage, type Analysis } from '@promptfire/shared';
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

  it('blocks Kubernetes scorer-language-only rewrites from material improvement', () => {
    const originalAnalysis = analysisWithScores({
      scope: 3,
      contrast: 0,
      clarity: 6,
      constraintQuality: 2,
      genericOutputRisk: 7,
      tokenWasteRisk: 5,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 4,
      contrast: 5,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 5,
      tokenWasteRisk: 5,
    });

    const evaluation = evaluateRewrite({
      originalPrompt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      rewrittenPrompt:
        'Develop a targeted guide on Kubernetes tailored for small to medium-sized businesses (SMBs) that covers essential aspects such as architecture, security measures, deployment strategies, monitoring techniques, troubleshooting methods, cost optimization practices, and migration strategies. Include real-world examples and actionable best practices, while explicitly excluding overly technical jargon and generic advice that may not apply to SMBs.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).not.toBe('material_improvement');
  });

  it('does not treat polish-only high_contrast rewrites as meaningful improvement', () => {
    const originalAnalysis = analysisWithScores({
      scope: 5,
      contrast: 3,
      clarity: 7,
      constraintQuality: 3,
      genericOutputRisk: 7,
      tokenWasteRisk: 4,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 5,
      contrast: 3,
      clarity: 8,
      constraintQuality: 3,
      genericOutputRisk: 7,
      tokenWasteRisk: 4,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write a landing page for our IAM platform for IT leaders. Mention security and compliance.',
      rewrittenPrompt:
        'Create polished landing page copy for our IAM platform for IT leaders. Highlight security and compliance in a modern, compelling way.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(['no_significant_change', 'possible_regression']).toContain(evaluation.improvement.status);
    expect(evaluation.improvement.overallDelta).toBeLessThan(4);
    expect(evaluation.improvement.expectedUsefulness).not.toBe('higher');
  });

  it('downgrades rubric-heavy Kubernetes rewrite inflation to non-material improvement', () => {
    const originalAnalysis = analysisWithScores({
      scope: 5,
      contrast: 3,
      clarity: 6,
      constraintQuality: 2,
      genericOutputRisk: 6,
      tokenWasteRisk: 4,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 7,
      contrast: 7,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 4,
      tokenWasteRisk: 4,
    });

    const evaluation = evaluateRewrite({
      originalPrompt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      rewrittenPrompt:
        'Create a complete Kubernetes guide and improve clarity, scope, and contrast. Add constraints, include explicit exclusions, use a specific lead angle, include one proof point, require a measurable outcome, and enforce differentiated positioning.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).not.toBe('material_improvement');
    expect(evaluation.signals).toContain('REWRITE_RUBRIC_ECHO');
  });

  it('does not classify rubric-heavy marketer rewrites as material without specific detail', () => {
    const originalAnalysis = analysisWithScores({
      scope: 5,
      contrast: 4,
      clarity: 7,
      constraintQuality: 4,
      genericOutputRisk: 6,
      tokenWasteRisk: 3,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 8,
      contrast: 8,
      clarity: 8,
      constraintQuality: 8,
      genericOutputRisk: 3,
      tokenWasteRisk: 3,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write landing page copy for our IAM platform for IT leaders.',
      rewrittenPrompt:
        'Write landing page copy for our IAM platform and improve clarity, contrast, and scope. Add constraints, include exclusions, use a specific lead angle, include one proof point, require a measurable outcome, and enforce differentiated positioning.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).not.toBe('material_improvement');
    expect(evaluation.signals).toContain('REWRITE_RUBRIC_ECHO');
  });

  it('flags intent drift when rewrite imports a new framing not latent in the original task', () => {
    const originalAnalysis = analysisWithScores({
      scope: 4,
      contrast: 3,
      clarity: 6,
      constraintQuality: 2,
      genericOutputRisk: 7,
      tokenWasteRisk: 4,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 7,
      contrast: 7,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 4,
      tokenWasteRisk: 4,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write a practical guide to Kubernetes deployment trade-offs for engineering teams.',
      rewrittenPrompt:
        'Write a practical guide to Kubernetes deployment trade-offs. Lead with audit pressure, identity sprawl, and admin overhead, and emphasize compliance readiness with differentiated positioning.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).not.toBe('material_improvement');
    expect(evaluation.signals).toContain('REWRITE_INTENT_DRIFT_RISK');
  });

  it('still allows material improvement for specific task-grounded rewrites', () => {
    const originalAnalysis = analysisWithScores({
      scope: 3,
      contrast: 2,
      clarity: 5,
      constraintQuality: 2,
      genericOutputRisk: 8,
      tokenWasteRisk: 6,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 8,
      contrast: 7,
      clarity: 7,
      constraintQuality: 7,
      genericOutputRisk: 4,
      tokenWasteRisk: 4,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write about cloud cost optimization.',
      rewrittenPrompt:
        'Write a step-by-step blog post for engineering managers at mid-sized SaaS companies about cloud cost optimization. Use exactly three sections: quick wins, trade-offs, and measurement plan. Include one startup vs enterprise comparison and one clear exclusion: avoid vendor marketing claims.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).toBe('material_improvement');
    expect(evaluation.improvement.expectedUsefulness).toBe('higher');
    expect(evaluation.signals).not.toContain('REWRITE_RUBRIC_ECHO');
  });

  it('keeps high-contrast grounded differentiation eligible for material improvement', () => {
    const originalAnalysis = analysisWithScores({
      scope: 4,
      contrast: 3,
      clarity: 6,
      constraintQuality: 3,
      genericOutputRisk: 7,
      tokenWasteRisk: 4,
    });
    const rewriteAnalysis = analysisWithScores({
      scope: 8,
      contrast: 8,
      clarity: 8,
      constraintQuality: 7,
      genericOutputRisk: 4,
      tokenWasteRisk: 3,
    });

    const evaluation = evaluateRewrite({
      originalPrompt: 'Write landing page copy for our IAM platform.',
      rewrittenPrompt:
        'Write landing page copy for CTOs at mid-sized SaaS companies adopting IAM after acquisitions. Use exactly three sections: operational condition, proof artifact, and rollout boundary. Include one quantified proof metric and one exclusion: avoid fear-based compliance claims.',
      originalAnalysis,
      rewriteAnalysis,
    });

    expect(evaluation.improvement.status).toBe('material_improvement');
    expect(evaluation.signals).not.toContain('REWRITE_RUBRIC_ECHO');
  });

  it('keeps rewrite notes free of discouraged default language', () => {
    const originalAnalysis = analysisWithScores({
      scope: 3,
      contrast: 3,
      clarity: 5,
      constraintQuality: 2,
      genericOutputRisk: 8,
      tokenWasteRisk: 6,
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
      originalPrompt: 'Write about cloud cost optimization.',
      rewrittenPrompt:
        'Write a step-by-step blog post for engineering managers at mid-sized SaaS companies about cloud cost optimization. Use exactly three sections: quick wins, trade-offs, and measurement plan. Include one startup vs enterprise comparison and one clear exclusion: avoid vendor marketing claims.',
      originalAnalysis,
      rewriteAnalysis,
    });

    for (const note of evaluation.improvement.notes) {
      expect(findDiscouragedDefaultLanguage(note)).toEqual([]);
    }
  });
});
