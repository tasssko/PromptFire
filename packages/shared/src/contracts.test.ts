import { describe, expect, it } from 'vitest';
import { AnalyzeAndRewriteRequestSchema, normalizePreferences } from './contracts';

describe('shared contracts', () => {
  it('applies preference defaults', () => {
    const defaults = normalizePreferences();
    expect(defaults.includeScores).toBe(true);
    expect(defaults.includeExplanation).toBe(true);
    expect(defaults.includeAlternatives).toBe(false);
    expect(defaults.preserveTone).toBe(false);
  });

  it('validates prompt upper bound', () => {
    const tooLongPrompt = 'a'.repeat(6001);
    const parsed = AnalyzeAndRewriteRequestSchema.safeParse({
      prompt: tooLongPrompt,
      role: 'general',
      mode: 'balanced',
    });
    expect(parsed.success).toBe(false);
  });
});
