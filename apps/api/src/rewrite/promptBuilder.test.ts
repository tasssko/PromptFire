import { describe, expect, it } from 'vitest';
import { buildRewriteInstructions } from './promptBuilder';

describe('buildRewriteInstructions', () => {
  it('includes role and mode guidance', () => {
    const instructions = buildRewriteInstructions({
      prompt: 'Write a webhook handler',
      role: 'developer',
      mode: 'tight_scope',
      preferences: {
        includeScores: true,
        includeExplanation: true,
        includeAlternatives: false,
        preserveTone: false,
      },
      analysis: {
        scores: {
          scope: 2,
          contrast: 4,
          clarity: 3,
          constraintQuality: 1,
          genericOutputRisk: 8,
          tokenWasteRisk: 7,
        },
        issues: [
          {
            code: 'CONSTRAINTS_MISSING',
            severity: 'high',
            message: 'Missing constraints',
          },
        ],
        detectedIssueCodes: ['CONSTRAINTS_MISSING'],
        signals: ['No constraints'],
        summary: 'Too broad',
      },
    });

    expect(instructions.system).toContain('implementation boundaries');
    expect(instructions.system).toContain('Narrow to one clear deliverable');
    expect(instructions.user).toContain('CONSTRAINTS_MISSING');
  });

  it('includes marketer anti-paraphrase guidance', () => {
    const instructions = buildRewriteInstructions({
      prompt: 'Write landing page copy for IT decision-makers.',
      role: 'marketer',
      mode: 'high_contrast',
      preferences: {
        includeScores: true,
        includeExplanation: true,
        includeAlternatives: false,
        preserveTone: false,
      },
    });

    expect(instructions.system).toContain('Preserve valid audience details when present');
    expect(instructions.system).toContain('keep the same deliverable');
    expect(instructions.system).toContain('grounded context');
    expect(instructions.system).toContain('keep the rewrite minimal and specific');
  });

  it('includes pattern-fit guidance when available', () => {
    const instructions = buildRewriteInstructions({
      prompt: 'Score these options and rank them.',
      role: 'general',
      mode: 'balanced',
      preferences: {
        includeScores: true,
        includeExplanation: true,
        includeAlternatives: false,
        preserveTone: false,
      },
      patternFit: {
        primary: 'decision_rubric',
        confidence: 'high',
        reasons: ['Prompt requests scoring.'],
      },
    });

    expect(instructions.system).toContain('Pattern fit: decision_rubric');
    expect(instructions.user).toContain('"primary": "decision_rubric"');
  });

  it.each([
    ['direct_instruction', 'Pattern fit: direct_instruction'],
    ['few_shot', 'Pattern fit: few_shot'],
    ['stepwise_reasoning', 'Pattern fit: stepwise_reasoning'],
    ['decomposition', 'Pattern fit: decomposition'],
    ['decision_rubric', 'Pattern fit: decision_rubric'],
    ['context_first', 'Pattern fit: context_first'],
  ] as const)('covers the %s guidance branch', (primary, expected) => {
    const instructions = buildRewriteInstructions({
      prompt: 'Placeholder prompt',
      role: 'general',
      mode: 'balanced',
      preferences: {
        includeScores: true,
        includeExplanation: true,
        includeAlternatives: false,
        preserveTone: false,
      },
      patternFit: {
        primary,
        confidence: 'high',
        reasons: ['Test reason.'],
      },
    });

    expect(instructions.system).toContain(expected);
  });
});
