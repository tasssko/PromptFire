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

  it('adds specific fills for IAM prompt without rubric scaffolding', async () => {
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
    expect(rewrite.rewrittenPrompt).not.toContain('Require one evidence-backed proof point');
    expect(rewrite.rewrittenPrompt).not.toContain('Keep the same deliverable and audience');
  });

  it('keeps Kubernetes rewrite ordering aligned to the strongest inferred context, not rigid audience-first ordering', async () => {
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
    const combined = changes.join(' ').toLowerCase();
    expect(combined).toMatch(/ctos|technical decision-makers|engineering managers|avoid vendor-marketing/);
    const structureIndex = changes.findIndex((change) => /structure the (guide|output)|use three sections/i.test(change));
    expect(structureIndex).toBeGreaterThanOrEqual(0);
    expect(rewrite.rewrittenPrompt).not.toMatch(/\.\s*for\b/i);
  });

  it('adds trade-off frame and exclusion for broad technical guides with present topical constraints', async () => {
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

    expect(rewrite.rewrittenPrompt).toContain(
      'Explain when Kubernetes is worth the operational complexity and when simpler options are better.',
    );
    expect(rewrite.rewrittenPrompt).toContain('Avoid vendor-marketing language and unsupported superlatives.');
    const boundaryIndex = rewrite.rewrittenPrompt.indexOf(
      'Explain when Kubernetes is worth the operational complexity and when simpler options are better.',
    );
    const exclusionIndex = rewrite.rewrittenPrompt.indexOf(
      'Avoid vendor-marketing language and unsupported superlatives.',
    );
    expect(boundaryIndex).toBeGreaterThan(-1);
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
          title: 'require specific examples',
          reason: 'Add direct examples.',
          impact: 'medium',
          targetScores: ['contrast', 'constraintQuality'],
          category: 'proof',
        },
      ],
    });

    expect(rewrite.rewrittenPrompt).toContain('Include one direct comparison example showing where each option is a better fit.');
  });

  it('prioritizes runtime and IO constraints for thin developer implementation rewrites', async () => {
    const prompt = 'Write a webhook handler.';
    const analysis = analyzePrompt({
      prompt,
      role: 'developer',
      mode: 'tight_scope',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'developer',
      mode: 'tight_scope',
      preferences: normalizePreferences(),
      analysis,
    });

    const text = rewrite.rewrittenPrompt.toLowerCase();
    expect(text).toMatch(/section|runtime|structure|output|response|handler/);
    expect(text).not.toMatch(/\bfor cto\b|\bfor buyer\b|\baudience\b/);
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
    expect(lowered).not.toContain('add one specific requirement');
    expect(lowered).not.toContain('add one clear exclusion');
    expect(lowered).not.toContain('require one evidence-backed proof point');
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
    expect(rewrite.rewrittenPrompt).not.toContain('Add one specific requirement');
    expect(rewrite.rewrittenPrompt).not.toContain('Add one clear exclusion');
    expect(rewrite.rewrittenPrompt).not.toContain('Require one evidence-backed proof point');
    expect(rewrite.rewrittenPrompt).not.toContain('for CTOs and platform leaders evaluating adoption');
  });

  it('under-writes when no specific additions are inferable', async () => {
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

  it('respects ladder stop states by skipping rewrite generation', async () => {
    const prompt =
      'Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.';

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'marketer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
      ladder: {
        current: 'strong',
        next: 'excellent',
        target: null,
        maxSafeTarget: 'strong',
        stopReason: 'already_strong',
      },
    });

    expect(rewrite.rewrittenPrompt).toBe(prompt);
    expect(rewrite.changes).toEqual(['No bounded next-rung rewrite was justified.']);
  });

  it('keeps poor to weak rewrites bounded to a small set of concrete additions', async () => {
    const prompt = 'Write about AI agents.';
    const analysis = analyzePrompt({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      ladder: {
        current: 'poor',
        next: 'weak',
        target: 'weak',
        maxSafeTarget: 'good',
        stopReason: null,
      },
    });

    expect((rewrite.changes ?? []).length).toBeLessThanOrEqual(2);
    expect(rewrite.explanation).toContain('poor to weak step');
  });

  it('branches rewrite style for stepwise_reasoning pattern', async () => {
    const prompt = 'Compare monolith and microservices options for our platform migration.';
    const analysis = analyzePrompt({
      prompt,
      role: 'developer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'developer',
      mode: 'high_contrast',
      preferences: normalizePreferences(),
      analysis,
      patternFit: {
        primary: 'stepwise_reasoning',
        confidence: 'high',
        reasons: ['Comparison-heavy prompt.'],
      },
      improvementSuggestions: [
        {
          id: 'comparison_frame',
          title: 'add comparison framing',
          reason: 'Need explicit trade-off flow.',
          impact: 'high',
          targetScores: ['contrast', 'constraintQuality'],
          category: 'proof',
        },
      ],
    });

    expect(rewrite.rewrittenPrompt).toContain('Use three steps: identify decision dimensions');
    expect(rewrite.explanation).toContain('stepwise_reasoning');
  });

  it('keeps decision_rubric structure under ladder control', async () => {
    const prompt = 'Score these deployment options and rank them.';
    const analysis = analyzePrompt({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      patternFit: {
        primary: 'decision_rubric',
        confidence: 'high',
        reasons: ['Prompt requests ranking.'],
      },
      ladder: {
        current: 'weak',
        next: 'good',
        target: 'good',
        maxSafeTarget: 'strong',
        stopReason: null,
      },
    });

    expect(rewrite.rewrittenPrompt).toContain('Define criteria first, then score each option against those criteria, and finish with a ranked verdict.');
  });

  it('keeps decomposition structure under ladder control', async () => {
    const prompt = 'Create a complete guide to Kubernetes, migration strategy, cost optimization, and troubleshooting.';
    const analysis = analyzePrompt({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      patternFit: {
        primary: 'decomposition',
        confidence: 'high',
        reasons: ['Task is overloaded.'],
      },
      ladder: {
        current: 'poor',
        next: 'weak',
        target: 'weak',
        maxSafeTarget: 'good',
        stopReason: null,
      },
    });

    expect(rewrite.rewrittenPrompt).toContain('Break the work into phases and start with the first phase output.');
  });

  it('branches rewrite style for context_first pattern', async () => {
    const prompt = 'Write a detailed case study about our customer migration with measurable outcomes.';
    const analysis = analyzePrompt({
      prompt,
      role: 'marketer',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'marketer',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      patternFit: {
        primary: 'context_first',
        confidence: 'high',
        reasons: ['Specific outcomes requested without source material.'],
      },
      improvementSuggestions: [
        {
          id: 'clarify_output_structure',
          title: 'specify the output structure',
          reason: 'Structure is broad.',
          impact: 'medium',
          targetScores: ['clarity', 'constraintQuality'],
          category: 'structure',
        },
      ],
    });

    expect(rewrite.rewrittenPrompt).toContain('request the missing source context');
    expect(rewrite.rewrittenPrompt).toContain('grounded only in supplied source material');
  });

  it('keeps context_first requests grounded under ladder control', async () => {
    const prompt = 'Write a case study about our migration outcomes.';
    const analysis = analyzePrompt({
      prompt,
      role: 'marketer',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'marketer',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      patternFit: {
        primary: 'context_first',
        confidence: 'high',
        reasons: ['Needs source material.'],
      },
      ladder: {
        current: 'good',
        next: 'strong',
        target: 'strong',
        maxSafeTarget: 'strong',
        stopReason: null,
      },
    });

    expect(rewrite.rewrittenPrompt).toContain('request the missing source context');
    expect(rewrite.rewrittenPrompt).not.toContain('audit pressure');
  });

  it('keeps stepwise_reasoning trade-off flow under ladder control', async () => {
    const prompt = 'Compare monolith and microservices.';
    const analysis = analyzePrompt({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
    });

    const engine = new MockRewriteEngine();
    const rewrite = await engine.rewrite({
      prompt,
      role: 'general',
      mode: 'balanced',
      preferences: normalizePreferences(),
      analysis,
      patternFit: {
        primary: 'stepwise_reasoning',
        confidence: 'high',
        reasons: ['Comparison prompt.'],
      },
      ladder: {
        current: 'good',
        next: 'strong',
        target: 'strong',
        maxSafeTarget: 'strong',
        stopReason: null,
      },
    });

    expect(rewrite.rewrittenPrompt).toContain('Use three steps: identify decision dimensions, compare options across those dimensions, then provide a final recommendation with trade-offs.');
  });
});
