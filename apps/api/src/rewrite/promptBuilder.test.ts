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
    expect(instructions.system).toContain('keep the rewrite minimal and concrete');
  });
});
