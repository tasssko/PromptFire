import { describe, expect, it } from 'vitest';
import { normalizePreferences } from '@promptfire/shared';
import { analyzePrompt } from './analyzePrompt';
import { detectPatternFit } from './patternFit';

function fitFor(input: { prompt: string; role?: 'general' | 'developer' | 'marketer' }) {
  const role = input.role ?? 'general';
  const analysis = analyzePrompt({
    prompt: input.prompt,
    role,
    mode: 'balanced',
    preferences: normalizePreferences(),
  });

  return detectPatternFit({
    prompt: input.prompt,
    role,
    mode: 'balanced',
    analysis,
  });
}

describe('detectPatternFit', () => {
  it('detects few_shot for house-style rewrite tasks', () => {
    const fit = fitFor({ prompt: 'Rewrite these support replies in our house style.' });
    expect(fit.primary).toBe('few_shot');
  });

  it('detects stepwise_reasoning for decision prompts', () => {
    const fit = fitFor({ prompt: 'Help me decide whether to split this monolith into services.' });
    expect(fit.primary).toBe('stepwise_reasoning');
  });

  it('detects decomposition for overloaded multi-deliverable asks', () => {
    const fit = fitFor({ prompt: 'Create a strategy, roadmap, launch plan, and messaging for our new product.' });
    expect(fit.primary).toBe('decomposition');
  });

  it('detects decision_rubric for scoring and ranking tasks', () => {
    const fit = fitFor({ prompt: 'Score these landing page drafts and rank them from strongest to weakest.' });
    expect(fit.primary).toBe('decision_rubric');
  });

  it('detects context_first when specificity is requested without source context', () => {
    const fit = fitFor({
      prompt: 'Write a detailed case study about our customer migration and include measurable business outcomes.',
      role: 'marketer',
    });
    expect(fit.primary).toBe('context_first');
  });

  it('keeps strong direct prompts on direct_instruction or stepwise_reasoning without escalation-only patterns', () => {
    const prompt =
      'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.';
    const fit = fitFor({ prompt, role: 'marketer' });
    expect(['direct_instruction', 'stepwise_reasoning']).toContain(fit.primary);
    expect(fit.primary).not.toBe('decomposition');
    expect(fit.primary).not.toBe('few_shot');
  });
});
