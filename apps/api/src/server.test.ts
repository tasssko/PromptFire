import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleHttpRequest } from './server';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API vertical slice', () => {
  const strongV2Prompt =
    'Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.';
  const microservicesCalibrationPrompt =
    'Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.';

  it('handles CORS preflight and returns allow headers', async () => {
    const response = await handleHttpRequest({
      method: 'OPTIONS',
      path: '/v1/analyze-and-rewrite',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('content-type');
  });

  it('returns health with required meta block', async () => {
    const response = await handleHttpRequest({ method: 'GET', path: '/v1/health' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(body.status).toBe('ok');
    expect(body.meta.version).toBe('0.4');
    expect(typeof body.meta.requestId).toBe('string');
    expect(typeof body.meta.latencyMs).toBe('number');
    expect(['mock', 'real']).toContain(body.meta.providerMode);
  });

  it('returns v2 health with required meta block', async () => {
    const response = await handleHttpRequest({ method: 'GET', path: '/v2/health' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.meta.version).toBe('2');
  });

  it('validates analyze-and-rewrite response shape and role/mode handling', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write landing page copy for our IAM platform.',
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.id.startsWith('par_')).toBe(true);
    expect(body.rewrite.role).toBe('marketer');
    expect(body.rewrite.mode).toBe('high_contrast');
    expect(typeof body.rewrite.explanation).toBe('string');
    expect(body.evaluation).toBeTruthy();
    expect(body.evaluation.originalScore).toEqual(body.analysis.scores);
    expect(body.evaluation.rewriteScore).toBeTruthy();
    expect(body.evaluation.improvement).toBeTruthy();
    expect(typeof body.evaluation.improvement.overallDelta).toBe('number');
    expect(Array.isArray(body.analysis.detectedIssueCodes)).toBe(true);
    expect(body.meta.version).toBe('0.4');
    expect(body.meta.providerMode).toBe('mock');
  });

  it('returns structured error for invalid input', async () => {
    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: 'marketer', mode: 'balanced' }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(400);
    expect(body.error.code).toBe('INVALID_REQUEST');
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(body.meta.version).toBe('0.4');
  });

  it('returns PROVIDER_NOT_CONFIGURED in real mode without required vars', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'real';
    delete process.env.REWRITE_PROVIDER_API_KEY;
    process.env.REWRITE_PROVIDER_MODEL = 'gpt-4o-mini';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a webhook handler',
        role: 'developer',
        mode: 'balanced',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(500);
    expect(body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect(body.meta.providerMode).toBe('real');
    expect(body.meta.providerModel).toBe('gpt-4o-mini');
  });

  it('supports real mode with provider mocked at network boundary', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'real';
    process.env.REWRITE_PROVIDER_API_KEY = 'test-key';
    process.env.REWRITE_PROVIDER_MODEL = 'gpt-4o-mini';

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rewrittenPrompt: 'Write only request validation for a Node.js Lambda webhook with idempotency.',
                  explanation: 'Narrowed to one deliverable and added runtime constraints.',
                  changes: ['Narrowed scope', 'Added constraints'],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a webhook handler',
        role: 'developer',
        mode: 'tight_scope',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.rewrite.rewrittenPrompt).toContain('Node.js Lambda webhook');
    expect(body.rewrite.explanation).toBeTruthy();
    expect(body.evaluation.rewriteScore.scope).toBeGreaterThanOrEqual(0);
    expect(body.evaluation.improvement.status).toBeTruthy();
    expect(body.meta.providerMode).toBe('real');
    expect(body.meta.providerModel).toBe('gpt-4o-mini');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps IAM marketer regression fixed in analyze-and-rewrite', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Develop targeted landing page copy for our Identity and Access Management (IAM) service, specifically aimed at IT decision-makers in mid-sized enterprises. Emphasize the distinct advantages of our solution, including robust security features, compliance assistance, and seamless integration processes. Incorporate specific customer testimonials and quantifiable results to enhance credibility and demonstrate effectiveness.',
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.analysis.detectedIssueCodes).not.toContain('AUDIENCE_MISSING');
    expect(body.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(body.analysis.detectedIssueCodes).not.toContain('TASK_OVERLOADED');
    expect(body.analysis.detectedIssueCodes).toContain('EXCLUSIONS_MISSING');
    expect(body.rewrite.rewrittenPrompt).toContain('IT decision-makers in mid-sized enterprises');
    expect(body.rewrite.rewrittenPrompt).toContain('Lead with operational tension');
  });

  it('does not lower contrast for generic IAM prompt after high_contrast rewrite when audience+tension+proof are added', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write landing page copy for our IAM service.',
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);

    const originalContrast = body.evaluation.originalScore.contrast;
    const rewriteContrast = body.evaluation.rewriteScore.contrast;
    const rewriteText = String(body.rewrite.rewrittenPrompt).toLowerCase();
    const hasAudience = /\bfor ctos\b|\bfor it directors\b|\bfor it decision-makers\b/.test(rewriteText);
    const hasTension = /\baudit pressure\b|\bidentity sprawl\b|\badmin overhead\b|\boperational tension\b/.test(
      rewriteText,
    );
    const hasProof = /\bproof point\b|\bmeasurable outcome\b|\bquantifiable\b/.test(rewriteText);
    const clearlyMoreGeneric = /\bgeneric copy|vague|general audience|broad messaging\b/.test(rewriteText);

    if (hasAudience && hasTension && hasProof && !clearlyMoreGeneric) {
      expect(rewriteContrast).toBeGreaterThanOrEqual(originalContrast);
    }
  });

  it('returns v2 strong prompt without rewrite by default', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: strongV2Prompt,
        role: 'marketer',
        mode: 'high_contrast',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.meta.version).toBe('2');
    expect(body.overallScore).toBeGreaterThanOrEqual(80);
    expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
    expect(body.gating.expectedImprovement).toBe('low');
    expect(body.gating.majorBlockingIssues).toBe(false);
    expect(body.rewrite).toBeNull();
    expect(body.evaluation).toBeNull();
  });

  it('returns v2 forced rewrite for strong prompt', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: strongV2Prompt,
        role: 'marketer',
        mode: 'high_contrast',
        rewritePreference: 'force',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.rewriteRecommendation).toBe('rewrite_optional');
    expect(body.gating.rewritePreference).toBe('force');
    expect(body.rewrite).toBeTruthy();
    expect(body.evaluation).toBeTruthy();
  });

  it('treats the microservices calibration prompt as no-rewrite-needed in v2 auto mode', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: microservicesCalibrationPrompt,
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(body.gating.majorBlockingIssues).toBe(false);
    expect(body.gating.expectedImprovement).toBe('low');
    expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
    expect(body.rewrite).toBeNull();
    expect(body.evaluation).toBeNull();
  });

  it('returns v2 suppressed response without rewrite for weak prompt', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write landing page copy for our IAM service.',
        role: 'marketer',
        mode: 'high_contrast',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.gating.rewritePreference).toBe('suppress');
    expect(body.rewrite).toBeNull();
    expect(body.evaluation).toBeNull();
  });

  describe('v2 calibration fixtures', () => {
    const fixtures = [
      {
        name: 'low prompt',
        request: {
          prompt: 'Write a blog post about DevOps.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          minScore: 0,
          maxScore: 54,
          scoreBands: ['weak', 'poor'],
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: true,
          rewritePresent: true,
          evaluationPresent: true,
          mustIncludeIssueCodes: ['AUDIENCE_MISSING', 'CONSTRAINTS_MISSING'],
        },
      },
      {
        name: 'medium prompt',
        request: {
          prompt:
            'Write a blog post for engineering managers about CI/CD mistakes teams make when they grow quickly. Use a practical tone and include examples.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          minScore: 55,
          maxScore: 79,
          scoreBands: ['usable'],
          rewriteRecommendation: 'rewrite_optional' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: false,
          rewritePresent: true,
          evaluationPresent: true,
          mustNotIncludeIssueCodes: ['AUDIENCE_MISSING'],
        },
      },
      {
        name: 'high marketer prompt',
        request: {
          prompt: strongV2Prompt,
          role: 'marketer' as const,
          mode: 'high_contrast' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          minScore: 80,
          maxScore: 100,
          scoreBands: ['strong', 'excellent'],
          rewriteRecommendation: 'no_rewrite_needed' as const,
          expectedImprovement: 'low' as const,
          majorBlockingIssues: false,
          rewritePresent: false,
          evaluationPresent: false,
        },
      },
      {
        name: 'high microservices prompt',
        request: {
          prompt: microservicesCalibrationPrompt,
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          // v2 scope remapping keeps this prompt in the usable band, while low expected
          // improvement and no blocking issues still suppress rewrite generation.
          minScore: 70,
          maxScore: 79,
          scoreBands: ['usable'],
          rewriteRecommendation: 'no_rewrite_needed' as const,
          expectedImprovement: 'low' as const,
          majorBlockingIssues: false,
          rewritePresent: false,
          evaluationPresent: false,
          mustNotIncludeIssueCodes: ['CONSTRAINTS_MISSING'],
        },
      },
    ] as const;

    for (const fixture of fixtures) {
      it(fixture.name, async () => {
        process.env.REWRITE_PROVIDER_MODE = 'mock';

        const response = await handleHttpRequest({
          method: 'POST',
          path: '/v2/analyze-and-rewrite',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(fixture.request),
        });

        const body = JSON.parse(response.body);

        expect(response.statusCode).toBe(200);
        expect(body.meta.version).toBe('2');
        expect(body.overallScore).toBeGreaterThanOrEqual(fixture.expected.minScore);
        expect(body.overallScore).toBeLessThanOrEqual(fixture.expected.maxScore);
        expect(fixture.expected.scoreBands).toContain(body.scoreBand);
        expect(body.rewriteRecommendation).toBe(fixture.expected.rewriteRecommendation);
        expect(body.gating.rewritePreference).toBe('auto');
        expect(body.gating.expectedImprovement).toBe(fixture.expected.expectedImprovement);
        expect(body.gating.majorBlockingIssues).toBe(fixture.expected.majorBlockingIssues);

        for (const code of fixture.expected.mustIncludeIssueCodes ?? []) {
          expect(body.analysis.detectedIssueCodes).toContain(code);
        }

        for (const code of fixture.expected.mustNotIncludeIssueCodes ?? []) {
          expect(body.analysis.detectedIssueCodes).not.toContain(code);
        }

        if (fixture.expected.rewritePresent) {
          expect(body.rewrite).toBeTruthy();
        } else {
          expect(body.rewrite).toBeNull();
        }

        if (fixture.expected.evaluationPresent) {
          expect(body.evaluation).toBeTruthy();
        } else {
          expect(body.evaluation).toBeNull();
        }
      });
    }
  });
});
