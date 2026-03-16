import { describe, expect, it } from 'vitest';
import { findDiscouragedDefaultLanguage } from '@promptfire/shared';
import { analyzePrompt } from './analyzePrompt';
import { generateImprovementSuggestions } from './improvementSuggestions';

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

function suggestionsFor(input: Parameters<typeof analyzePrompt>[0], rewriteRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed') {
  const analysis = analyzePrompt(input);
  const total = overallScore(analysis.scores);

  return generateImprovementSuggestions({
    input,
    analysis,
    overallScore: total,
    scoreBand: scoreBand(total),
    rewriteRecommendation,
  });
}

describe('generateImprovementSuggestions', () => {
  it('returns audience, constraints, or exclusion suggestions for weak prompts with missing structure', () => {
    const suggestions = suggestionsFor(
      {
        prompt: 'Write a blog post about DevOps.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(
      suggestions.some((suggestion) =>
        ['audience', 'boundary', 'exclusion', 'structure'].includes(suggestion.category),
      ),
    ).toBe(true);
  });

  it('returns 2-5 suggestions for mid-quality prompts tied to lower-value dimensions', () => {
    const suggestions = suggestionsFor(
      {
        prompt:
          'Write a blog post for engineering managers about CI/CD mistakes teams make when they grow quickly. Use a practical tone and include examples.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_optional',
    );

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(suggestions.some((suggestion) => suggestion.targetScores.includes('contrast'))).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.targetScores.includes('genericOutputRisk'))).toBe(true);
  });

  it('allows 0-2 optional suggestions for strong prompts with no rewrite needed', () => {
    const suggestions = suggestionsFor(
      {
        prompt:
          'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.',
        role: 'general',
        mode: 'balanced',
      },
      'no_rewrite_needed',
    );

    expect(suggestions.length).toBeLessThanOrEqual(2);
    expect(suggestions.every((suggestion) => suggestion.impact === 'low')).toBe(true);
  });

  it('may return an empty array for a strong marketer prompt', () => {
    const suggestions = suggestionsFor(
      {
        prompt:
          'Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.',
        role: 'marketer',
        mode: 'high_contrast',
      },
      'no_rewrite_needed',
    );

    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('keeps strong prompt suggestions low-pressure rather than rewrite-like', () => {
    const suggestions = suggestionsFor(
      {
        prompt:
          'Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.',
        role: 'general',
        mode: 'balanced',
      },
      'no_rewrite_needed',
    );

    expect(suggestions.every((suggestion) => suggestion.title.startsWith('Optional:') || suggestion.impact === 'low')).toBe(
      true,
    );
  });

  it('prefers buyer, pain, proof, and exclusion suggestions for landing page prompts', () => {
    const suggestions = suggestionsFor(
      {
        prompt: 'Write a landing page for our IAM platform aimed at IT leaders. Mention security, compliance, and ease of use.',
        role: 'marketer',
        mode: 'balanced',
      },
      'rewrite_optional',
    );

    expect(suggestions.some((suggestion) => suggestion.id === 'add_business_pain')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.category === 'proof' || suggestion.category === 'exclusion')).toBe(
      true,
    );
  });

  it('prefers audience, tension, examples, and framing suggestions for blog prompts', () => {
    const suggestions = suggestionsFor(
      {
        prompt: 'Write a blog post about DevOps.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    expect(suggestions.some((suggestion) => suggestion.category === 'audience')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.id === 'add_core_tension')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.id === 'require_examples')).toBe(true);
    expect(suggestions.some((suggestion) => suggestion.category === 'framing')).toBe(true);
  });

  it('includes targetScores and avoids generic writing-advice phrasing', () => {
    const suggestions = suggestionsFor(
      {
        prompt: 'Write a blog post about DevOps.',
        role: 'general',
        mode: 'balanced',
      },
      'rewrite_recommended',
    );

    for (const suggestion of suggestions) {
      expect(suggestion.targetScores.length).toBeGreaterThan(0);
      expect(`${suggestion.title} ${suggestion.reason}`.toLowerCase()).not.toMatch(
        /more engaging|more compelling|stronger wording|more professional/,
      );
      expect(findDiscouragedDefaultLanguage(`${suggestion.title} ${suggestion.reason} ${suggestion.exampleChange ?? ''}`)).toEqual([]);
    }
  });
});
