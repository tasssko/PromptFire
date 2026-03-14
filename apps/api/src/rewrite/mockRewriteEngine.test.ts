import { describe, expect, it } from 'vitest';
import { analyzePrompt } from '@promptfire/heuristics';
import { normalizePreferences } from '@promptfire/shared';
import { MockRewriteEngine } from './mockRewriteEngine';

describe('MockRewriteEngine marketer behavior', () => {
  it('preserves valid audience phrases in marketer rewrites', async () => {
    const prompt =
      'Write landing page copy for IT decision-makers in mid-sized enterprises. Include testimonials and measurable results.';
    const analysis = analyzePrompt({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
      analysis,
    });

    expect(rewrite.rewrittenPrompt).toContain('for IT decision-makers in mid-sized enterprises');
  });

  it('adds contrast-oriented constraints for IAM regression prompt', async () => {
    const prompt =
      'Develop targeted landing page copy for our Identity and Access Management (IAM) service, specifically aimed at IT decision-makers in mid-sized enterprises. Emphasize the distinct advantages of our solution, including robust security features, compliance assistance, and seamless integration processes. Incorporate specific customer testimonials and quantifiable results to enhance credibility and demonstrate effectiveness.';
    const analysis = analyzePrompt({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
      analysis,
    });

    expect(rewrite.rewrittenPrompt).toContain('Anchor the opening in one concrete operational condition');
    expect(rewrite.rewrittenPrompt).toContain('concrete proof artifact');
    expect(rewrite.rewrittenPrompt).toContain('Ban generic claims');
    expect(rewrite.rewrittenPrompt).toContain('Keep the same deliverable and audience');
  });
});
