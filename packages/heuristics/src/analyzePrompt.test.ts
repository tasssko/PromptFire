import { describe, expect, it } from 'vitest';
import { analyzePrompt } from './analyzePrompt';

const strongMarketerPrompt =
  'Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.';

const microservicesCalibrationPrompt =
  'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.';

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
      prompt: strongMarketerPrompt,
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

  describe('calibration fixtures', () => {
    const scoreBandFromOverallScore = (overallScore: number) => {
      if (overallScore >= 90) {
        return 'excellent';
      }
      if (overallScore >= 75) {
        return 'strong';
      }
      if (overallScore >= 55) {
        return 'usable';
      }
      if (overallScore >= 35) {
        return 'weak';
      }
      return 'poor';
    };

    const computeOverallScore = (scores: ReturnType<typeof analyzePrompt>['scores']) => {
      const rawOverallScore =
        2.5 * scores.scope +
        2.0 * scores.contrast +
        2.0 * scores.clarity +
        1.5 * scores.constraintQuality +
        1.0 * (10 - scores.genericOutputRisk) +
        1.0 * (10 - scores.tokenWasteRisk);

      return Math.round(Math.max(0, Math.min(100, rawOverallScore)));
    };

    const normalizeCodes = (input: string[] | string) =>
      [...new Set((Array.isArray(input) ? input : input ? input.split('|') : []).filter(Boolean))].sort();

    const fixtures = [
      {
        id: 'p1',
        input: {
          prompt: 'Write a blog post about DevOps.',
          role: 'general' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 4,
          contrast: 0,
          clarity: 6,
          constraintQuality: 2,
          genericOutputRisk: 8,
          tokenWasteRisk: 4,
          overallScore: 33,
          scoreBand: 'poor',
          issueCodes: 'AUDIENCE_MISSING|CONSTRAINTS_MISSING|EXCLUSIONS_MISSING|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p2',
        input: {
          prompt:
            'Write an amazing, compelling, innovative blog post about cloud security that really stands out and feels modern and professional.',
          role: 'general' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 4,
          contrast: 0,
          clarity: 6,
          constraintQuality: 2,
          genericOutputRisk: 10,
          tokenWasteRisk: 4,
          overallScore: 31,
          scoreBand: 'poor',
          issueCodes:
            'AUDIENCE_MISSING|CONSTRAINTS_MISSING|EXCLUSIONS_MISSING|GENERIC_PHRASES_DETECTED|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p3',
        input: {
          prompt:
            'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
          role: 'general' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 5,
          contrast: 3,
          clarity: 6,
          constraintQuality: 2,
          genericOutputRisk: 6,
          tokenWasteRisk: 4,
          overallScore: 44,
          scoreBand: 'weak',
          issueCodes: 'CONSTRAINTS_MISSING|EXCLUSIONS_MISSING',
        },
      },
      {
        id: 'p4',
        input: {
          prompt: 'Write a landing page for our IAM platform aimed at IT leaders. Mention security, compliance, and ease of use.',
          role: 'marketer' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 5,
          contrast: 4,
          clarity: 8,
          constraintQuality: 2,
          genericOutputRisk: 6,
          tokenWasteRisk: 2,
          overallScore: 52,
          scoreBand: 'weak',
          issueCodes: 'CONSTRAINTS_MISSING|EXCLUSIONS_MISSING|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p5',
        input: {
          prompt:
            'Write a blog post for engineering managers about CI/CD mistakes teams make when they grow quickly. Use a practical tone and include examples.',
          role: 'general' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 6,
          contrast: 4,
          clarity: 8,
          constraintQuality: 7,
          genericOutputRisk: 4,
          tokenWasteRisk: 4,
          overallScore: 62,
          scoreBand: 'usable',
          issueCodes: 'EXCLUSIONS_MISSING',
        },
      },
      {
        id: 'p6',
        input: {
          prompt:
            'Write an email to CTOs at SaaS companies explaining why platform engineering improves developer productivity. Keep it concise and persuasive.',
          role: 'marketer' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 4,
          contrast: 3,
          clarity: 8,
          constraintQuality: 2,
          genericOutputRisk: 6,
          tokenWasteRisk: 2,
          overallScore: 47,
          scoreBand: 'weak',
          issueCodes: 'AUDIENCE_MISSING|CONSTRAINTS_MISSING|EXCLUSIONS_MISSING|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p7',
        input: {
          prompt:
            'Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.',
          role: 'general' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 10,
          contrast: 7,
          clarity: 8,
          constraintQuality: 7,
          genericOutputRisk: 3,
          tokenWasteRisk: 4,
          overallScore: 79,
          scoreBand: 'strong',
          issueCodes: '',
        },
      },
      {
        id: 'p8',
        input: {
          prompt: strongMarketerPrompt,
          role: 'marketer' as const,
          mode: 'high_contrast' as const,
        },
        expected: {
          scope: 10,
          contrast: 10,
          clarity: 8,
          constraintQuality: 7,
          genericOutputRisk: 3,
          tokenWasteRisk: 2,
          overallScore: 87,
          scoreBand: 'strong',
          issueCodes: '',
        },
      },
      {
        id: 'p9',
        input: {
          prompt: microservicesCalibrationPrompt,
          role: 'general' as const,
          mode: 'balanced' as const,
        },
        expected: {
          scope: 10,
          contrast: 7,
          clarity: 8,
          constraintQuality: 7,
          genericOutputRisk: 3,
          tokenWasteRisk: 4,
          overallScore: 79,
          scoreBand: 'strong',
          issueCodes: '',
        },
      },
    ] as const;

    for (const fixture of fixtures) {
      it(fixture.id, () => {
        const result = analyzePrompt(fixture.input);
        const overallScore = computeOverallScore(result.scores);
        const scoreBand = scoreBandFromOverallScore(overallScore);

        expect(result.scores.scope).toBe(fixture.expected.scope);
        expect(result.scores.contrast).toBe(fixture.expected.contrast);
        expect(result.scores.clarity).toBe(fixture.expected.clarity);
        expect(result.scores.constraintQuality).toBe(fixture.expected.constraintQuality);
        expect(result.scores.genericOutputRisk).toBe(fixture.expected.genericOutputRisk);
        expect(result.scores.tokenWasteRisk).toBe(fixture.expected.tokenWasteRisk);
        expect(overallScore).toBe(fixture.expected.overallScore);
        expect(scoreBand).toBe(fixture.expected.scoreBand);
        expect(normalizeCodes(result.detectedIssueCodes)).toEqual(normalizeCodes(fixture.expected.issueCodes));
      });
    }
  });
});
