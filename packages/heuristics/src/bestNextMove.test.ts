import { describe, expect, it } from 'vitest';
import { findDiscouragedDefaultLanguage } from '@promptfire/shared';
import { analyzePrompt } from './analyzePrompt';
import { generateBestNextMove } from './bestNextMove';

function overallScore(scores: ReturnType<typeof analyzePrompt>['scores']): number {
  const raw =
    2.75 * scores.scope +
    2.25 * scores.contrast +
    1.25 * scores.clarity +
    2.0 * scores.constraintQuality +
    1.5 * (10 - scores.genericOutputRisk) +
    0.5 * (10 - scores.tokenWasteRisk);

  return Math.round(Math.max(0, Math.min(100, raw)));
}

function scoreBand(score: number): 'poor' | 'weak' | 'usable' | 'strong' | 'excellent' {
  if (score >= 85) {
    return 'excellent';
  }
  if (score >= 75) {
    return 'strong';
  }
  if (score >= 60) {
    return 'usable';
  }
  if (score >= 40) {
    return 'weak';
  }
  return 'poor';
}

function moveFor(
  input: Parameters<typeof analyzePrompt>[0],
  rewriteRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed',
) {
  const analysis = analyzePrompt(input);
  const total = overallScore(analysis.scores);

  return generateBestNextMove({
    input,
    analysis,
    overallScore: total,
    scoreBand: scoreBand(total),
    rewriteRecommendation,
  });
}

describe('generateBestNextMove', () => {
  it('prefers task-load narrowing for broad guide prompts', () => {
    const move = moveFor(
      {
        prompt:
          'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(move?.type).toBe('reduce_task_load');
    expect(move?.targetScores).toContain('tokenWasteRisk');
  });

  it('prefers audience context over proof for weak landing-page prompts without a clear buyer', () => {
    const move = moveFor(
      {
        prompt: 'Write landing page copy for our IAM platform.',
        role: 'marketer',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(move?.type).toBe('shift_to_audience_outcome_pattern');
    expect(move?.rationale.toLowerCase()).not.toMatch(/more compelling|stronger wording|more professional/);
  });

  it('returns decision-criteria moves for comparison-like prompts without criteria', () => {
    const move = moveFor(
      {
        prompt: 'Compare Kubernetes and ECS for platform teams.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_optional',
    );

    expect(['shift_to_comparison_pattern', 'add_decision_criteria']).toContain(move?.type);
    expect(move?.targetScores).toEqual(expect.arrayContaining(['contrast', 'constraintQuality']));
  });

  it('prefers a pattern shift for weak role-based comparison tasks', () => {
    const move = moveFor(
      {
        prompt: 'Act as a senior engineer and explain when TypeScript is better than JavaScript.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(['shift_to_decision_frame', 'shift_to_comparison_pattern']).toContain(move?.type);
    expect(move?.methodFit?.recommendedPattern).toBe('break_into_steps');
  });

  it('projects canonical pattern guidance into methodFit for missing-context prompts', () => {
    const move = moveFor(
      {
        prompt: 'Write a detailed case study about our customer migration and include measurable business outcomes.',
        role: 'marketer',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(move?.methodFit?.recommendedPattern).toBe('supply_missing_context');
    expect(move?.title.toLowerCase()).toContain('context');
  });

  it('allows null for already-strong prompts', () => {
    const move = moveFor(
      {
        prompt:
          'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.',
        role: 'general',
        mode: 'balanced',
      },
      'no_rewrite_needed',
    );

    expect(move).toBeNull();
  });

  it('keeps best-next-move copy free of discouraged default language', () => {
    const move = moveFor(
      {
        prompt: 'Write landing page copy for our IAM platform.',
        role: 'marketer',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(move).toBeTruthy();
    expect(findDiscouragedDefaultLanguage(`${move?.title ?? ''} ${move?.rationale ?? ''} ${move?.exampleChange ?? ''}`)).toEqual([]);
  });
});
