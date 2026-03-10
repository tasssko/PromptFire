import { describe, expect, it } from 'vitest';
import { analyzePrompt } from './analyzePrompt';

describe('analyzePrompt', () => {
  it('returns stable issue codes for vague prompt', () => {
    const result = analyzePrompt({
      prompt: 'Write landing page copy for our product',
      role: 'marketer',
      mode: 'balanced',
    });

    expect(result.detectedIssueCodes).toContain('AUDIENCE_MISSING');
    expect(result.detectedIssueCodes).toContain('CONSTRAINTS_MISSING');
    expect(result.detectedIssueCodes).toContain('EXCLUSIONS_MISSING');
    expect(result.scores.genericOutputRisk).toBeGreaterThanOrEqual(7);
  });

  it('keeps scores in 0..10 range', () => {
    const result = analyzePrompt({
      prompt: 'Write only validation for a Node.js Lambda webhook. Avoid buzzwords.',
      role: 'developer',
      mode: 'tight_scope',
      context: { audienceHint: 'backend engineers', mustInclude: ['idempotency'] },
    });

    Object.values(result.scores).forEach((score) => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });
  });
});
