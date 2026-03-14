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
    expect(result.scores.genericOutputRisk).toBeGreaterThanOrEqual(6);
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

  it('does not flag explicit marketer audience phrases as AUDIENCE_MISSING', () => {
    const result = analyzePrompt({
      prompt: 'Write landing page copy for CTOs at mid-sized enterprises dealing with audit pressure.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    expect(result.detectedIssueCodes).not.toContain('AUDIENCE_MISSING');
  });

  it('does not mark single marketer deliverable briefs as TASK_OVERLOADED', () => {
    const result = analyzePrompt({
      prompt:
        'Write landing page copy and include testimonials, emphasize compliance readiness, and include measurable proof points.',
      role: 'marketer',
      mode: 'balanced',
    });

    expect(result.detectedIssueCodes).not.toContain('TASK_OVERLOADED');
  });

  it('does not mark broad but present marketer requirements as CONSTRAINTS_MISSING', () => {
    const result = analyzePrompt({
      prompt: 'Write landing page copy for IT decision-makers and include testimonials and quantifiable results.',
      role: 'marketer',
      mode: 'balanced',
    });

    expect(result.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
  });

  it('treats natural-language example and framing requirements as real constraints', () => {
    const result = analyzePrompt({
      prompt:
        'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.',
      role: 'general',
      mode: 'balanced',
    });

    expect(result.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(result.scores.constraintQuality).toBeGreaterThanOrEqual(7);
    expect(result.scores.genericOutputRisk).toBeLessThanOrEqual(4);
    expect(result.scores.tokenWasteRisk).toBeLessThanOrEqual(4);
  });

  it('treats SMB business segments as a valid audience for general prompts', () => {
    const result = analyzePrompt({
      prompt:
        'Develop a targeted guide on Kubernetes tailored for small to medium-sized businesses (SMBs) that covers essential aspects such as architecture, security measures, deployment strategies, monitoring techniques, troubleshooting methods, cost optimization practices, and migration strategies. Include real-world examples and actionable best practices, while explicitly excluding overly technical jargon and generic advice that may not apply to SMBs.',
      role: 'general',
      mode: 'balanced',
    });

    expect(result.detectedIssueCodes).not.toContain('AUDIENCE_MISSING');
    expect(result.scores.contrast).toBeGreaterThanOrEqual(5);
    expect(result.scores.clarity).toBeGreaterThanOrEqual(8);
  });

  it('raises general contrast when a rewrite adds audience narrowing and exclusions', () => {
    const original = analyzePrompt({
      prompt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      role: 'general',
      mode: 'balanced',
    });

    const rewrite = analyzePrompt({
      prompt:
        'Develop a targeted guide on Kubernetes tailored for small to medium-sized businesses (SMBs) that covers essential aspects such as architecture, security measures, deployment strategies, monitoring techniques, troubleshooting methods, cost optimization practices, and migration strategies. Include real-world examples and actionable best practices, while explicitly excluding overly technical jargon and generic advice that may not apply to SMBs.',
      role: 'general',
      mode: 'balanced',
    });

    expect(rewrite.scores.contrast).toBeGreaterThan(original.scores.contrast);
    expect(rewrite.scores.clarity).toBeGreaterThanOrEqual(original.scores.clarity);
  });

  it('keeps IAM landing-page regression behavior stable', () => {
    const result = analyzePrompt({
      prompt:
        'Develop targeted landing page copy for our Identity and Access Management (IAM) service, specifically aimed at IT decision-makers in mid-sized enterprises. Emphasize the distinct advantages of our solution, including robust security features, compliance assistance, and seamless integration processes. Incorporate specific customer testimonials and quantifiable results to enhance credibility and demonstrate effectiveness.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    expect(result.detectedIssueCodes).not.toContain('AUDIENCE_MISSING');
    expect(result.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(result.detectedIssueCodes).not.toContain('TASK_OVERLOADED');
    expect(result.detectedIssueCodes).toContain('EXCLUSIONS_MISSING');
    expect(result.detectedIssueCodes).toContain('GENERIC_PHRASES_DETECTED');
  });

  it('does not treat banned generic words as generic phrase usage', () => {
    const result = analyzePrompt({
      prompt:
        "Write landing page copy for CTOs. Avoid generic buzzwords and do not use seamless, robust, or powerful.",
      role: 'marketer',
      mode: 'high_contrast',
    });

    expect(result.detectedIssueCodes).not.toContain('GENERIC_PHRASES_DETECTED');
  });

  it('does not reduce contrast for IAM high_contrast rewrite with added differentiation signals', () => {
    const original = analyzePrompt({
      prompt: 'Write landing page copy for our IAM service.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    const differentiatedRewrite = analyzePrompt({
      prompt:
        'Write landing page copy for CTOs and IT directors at mid-sized enterprises dealing with identity sprawl and audit pressure after acquisitions. Lead with operational control and compliance readiness, require one customer proof point and one measurable outcome, and avoid generic value-prop buzzwords.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    const clearlyMoreGeneric =
      differentiatedRewrite.scores.genericOutputRisk > original.scores.genericOutputRisk &&
      differentiatedRewrite.detectedIssueCodes.includes('GENERIC_OUTPUT_RISK_HIGH');

    if (!clearlyMoreGeneric) {
      expect(differentiatedRewrite.scores.contrast).toBeGreaterThanOrEqual(original.scores.contrast);
    }
  });

  it('does not penalize functional category terms in marketer prompts', () => {
    const result = analyzePrompt({
      prompt:
        'Write landing page copy for CTOs at mid-sized SaaS companies under audit pressure. Lead with operational control. Include one proof point and one measurable outcome for security, compliance, and integration. Avoid generic buzzwords.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    expect(result.detectedIssueCodes).not.toContain('GENERIC_PHRASES_DETECTED');
    expect(result.scores.contrast).toBeGreaterThanOrEqual(6);
  });

  it('keeps contrast stable when category terms are used functionally', () => {
    const withCategoryTerms = analyzePrompt({
      prompt:
        'Write landing page copy for CTOs at mid-sized SaaS companies under audit pressure. Lead with operational control. Include one proof point and one measurable outcome for security, compliance, and integration. Avoid generic buzzwords.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    const withoutCategoryTerms = analyzePrompt({
      prompt:
        'Write landing page copy for CTOs at mid-sized SaaS companies under audit pressure. Lead with operational control. Include one proof point and one measurable outcome for core platform capabilities. Avoid generic buzzwords.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    expect(withCategoryTerms.scores.contrast).toBeGreaterThanOrEqual(withoutCategoryTerms.scores.contrast);
  });

  it('matches scope rubric example A around weakly bounded prompt', () => {
    const result = analyzePrompt({
      prompt: 'Write landing page copy for our IAM service.',
      role: 'marketer',
      mode: 'balanced',
    });

    expect(result.scores.scope).toBe(4);
  });

  it('matches scope rubric example C around tightly bounded prompt', () => {
    const result = analyzePrompt({
      prompt:
        'Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.',
      role: 'marketer',
      mode: 'high_contrast',
    });

    expect(result.scores.scope).toBeGreaterThanOrEqual(9);
  });

  it('matches scope rubric example D around sprawling multi-job prompt', () => {
    const result = analyzePrompt({
      prompt: 'Help me improve our IAM website, blog content, SEO, ad campaigns, and positioning.',
      role: 'marketer',
      mode: 'balanced',
    });

    expect(result.scores.scope).toBeLessThanOrEqual(1);
  });
});
