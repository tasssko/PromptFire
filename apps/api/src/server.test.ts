import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleHttpRequest } from './server';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API vertical slice', () => {
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
});
