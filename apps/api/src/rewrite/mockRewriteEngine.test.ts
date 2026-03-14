import { describe, expect, it } from 'vitest';
import { analyzePrompt } from '@promptfire/heuristics';
import type { ImprovementSuggestion } from '@promptfire/shared';
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

  it('adds concrete fills for IAM prompt without rubric scaffolding', async () => {
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

    expect(rewrite.rewrittenPrompt).toContain('Avoid vendor-marketing language and unsupported superlatives.');
    expect(rewrite.rewrittenPrompt).toContain('Include one clear comparison to an alternative approach.');
    expect(rewrite.rewrittenPrompt).not.toContain('Require one concrete proof artifact');
    expect(rewrite.rewrittenPrompt).not.toContain('Keep the same deliverable and audience');
  });

  it('addresses missing audience before lower-priority Kubernetes opportunities', async () => {
    const prompt =
      'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.';
    const analysis = analyzePrompt({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const improvementSuggestions: ImprovementSuggestion[] = [
      {
        id: 'add_audience',
        title: 'add a specific audience',
        reason: 'Scope is broad without an audience.',
        impact: 'high',
        targetScores: ['scope', 'contrast', 'genericOutputRisk'],
        category: 'audience',
      },
      {
        id: 'clarify_output_structure',
        title: 'specify the output structure',
        reason: 'Structure is broad.',
        impact: 'medium',
        targetScores: ['clarity', 'constraintQuality'],
        category: 'structure',
      },
      {
        id: 'add_exclusion',
        title: 'add one exclusion',
        reason: 'Output can drift into generic language.',
        impact: 'medium',
        targetScores: ['constraintQuality', 'genericOutputRisk'],
        category: 'exclusion',
      },
      {
        id: 'reduce_task_load',
        title: 'split or narrow the task load',
        reason: 'Prompt is overloaded.',
        impact: 'high',
        targetScores: ['scope', 'tokenWasteRisk'],
        category: 'task_load',
      },
    ];
    const rewrite = await engine.rewrite({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
      analysis,
      improvementSuggestions,
    });

    const changes = rewrite.changes ?? [];
    expect(changes[0]?.toLowerCase()).toMatch(/\bfor\b/);
    expect(changes[0]?.toLowerCase()).toMatch(/ctos|technical decision-makers|engineering managers/);
    const structureIndex = changes.findIndex((change) => /structure the (guide|output)|use three sections/i.test(change));
    expect(structureIndex).toBeGreaterThan(0);
    expect(rewrite.rewrittenPrompt).not.toMatch(/\.\s*for\b/i);
  });

  it('adds structure, trade-off frame, and exclusion for broad technical guides', async () => {
    const prompt =
      'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, and a conclusion for different kinds of businesses.';
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

    expect(rewrite.rewrittenPrompt).toContain('Structure the guide in sections covering architecture');
    expect(rewrite.rewrittenPrompt).toContain(
      'Explain when Kubernetes is worth the operational complexity and when simpler options are better.',
    );
    expect(rewrite.rewrittenPrompt).toContain('Avoid vendor-marketing language and unsupported superlatives.');
    const structureIndex = rewrite.rewrittenPrompt.indexOf('Structure the guide in sections covering architecture');
    const boundaryIndex = rewrite.rewrittenPrompt.indexOf(
      'Explain when Kubernetes is worth the operational complexity and when simpler options are better.',
    );
    const exclusionIndex = rewrite.rewrittenPrompt.indexOf(
      'Avoid vendor-marketing language and unsupported superlatives.',
    );
    expect(structureIndex).toBeGreaterThan(-1);
    expect(boundaryIndex).toBeGreaterThan(structureIndex);
    expect(exclusionIndex).toBeGreaterThan(boundaryIndex);
  });

  it('maps example/comparison opportunities to direct example framing', async () => {
    const prompt = 'Compare two approaches for deploying Kubernetes in growing companies.';
    const analysis = analyzePrompt({
      prompt,
      role: 'developer',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'developer',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      improvementSuggestions: [
        {
          id: 'require_examples',
          title: 'require concrete examples',
          reason: 'Add direct examples.',
          impact: 'medium',
          targetScores: ['contrast', 'constraintQuality'],
          category: 'proof',
        },
      ],
    });

    expect(rewrite.rewrittenPrompt).toContain('Include one direct comparison example showing where each option is a better fit.');
  });

  it('does not emit banned meta-instruction scaffolding phrases', async () => {
    const prompt = 'Write a practical guide about Kubernetes deployment options for businesses.';
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

    const lowered = rewrite.rewrittenPrompt.toLowerCase();
    expect(lowered).not.toContain('improve clarity, scope, and contrast');
    expect(lowered).not.toContain('tighten to a clear deliverable');
    expect(lowered).not.toContain('add one concrete requirement');
    expect(lowered).not.toContain('add one concrete exclusion');
    expect(lowered).not.toContain('require one concrete proof artifact');
    expect(lowered).not.toContain('keep the same deliverable and audience');
  });

  it('does not emit dangling fragment inserts', async () => {
    const prompt =
      'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.';
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

    expect(rewrite.rewrittenPrompt).not.toMatch(/\.\s*for\b/);
    expect(rewrite.rewrittenPrompt).not.toMatch(/\.\s*include\b/);
    expect(rewrite.rewrittenPrompt).not.toMatch(/\.\s*avoid\b/);
  });

  it('keeps strong prompts mild under forced rewrite inputs without inventing new audience framing', async () => {
    const prompt =
      'Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.';
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
      improvementSuggestions: [],
    });

    expect(rewrite.rewrittenPrompt).toBe(prompt);
    expect(rewrite.rewrittenPrompt).not.toContain('Add one concrete requirement');
    expect(rewrite.rewrittenPrompt).not.toContain('Add one concrete exclusion');
    expect(rewrite.rewrittenPrompt).not.toContain('Require one concrete proof artifact');
    expect(rewrite.rewrittenPrompt).not.toContain('for CTOs and platform leaders evaluating adoption');
  });

  it('under-writes when no concrete additions are inferable', async () => {
    const prompt = 'Summarize this in one sentence. Avoid extra commentary.';
    const analysis = analyzePrompt({
      prompt,
      role: 'general',
      mode: 'low_token_cost',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'general',
      mode: 'low_token_cost',
      preferences: normalizePreferences(),
      analysis,
    });

    expect(rewrite.rewrittenPrompt).toBe(prompt);
    expect(rewrite.changes).toEqual(['Kept rewrite minimal to avoid abstract scaffolding.']);
  });
});
