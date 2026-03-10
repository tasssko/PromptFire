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
    expect(body.meta.version).toBe('0.3');
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
    expect(body.rewriteScore).toBeTruthy();
    expect(body.improvement).toBeTruthy();
    expect(typeof body.improvement.overallDelta).toBe('number');
    expect(Array.isArray(body.analysis.detectedIssueCodes)).toBe(true);
    expect(body.meta.version).toBe('0.3');
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
    expect(body.meta.version).toBe('0.3');
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
    expect(body.rewriteScore.scope).toBeGreaterThanOrEqual(0);
    expect(body.improvement.status).toBeTruthy();
    expect(body.meta.providerMode).toBe('real');
    expect(body.meta.providerModel).toBe('gpt-4o-mini');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
