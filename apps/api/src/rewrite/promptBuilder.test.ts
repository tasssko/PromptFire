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
});
