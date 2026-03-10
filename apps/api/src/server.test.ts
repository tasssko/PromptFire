import { describe, expect, it } from 'vitest';
import { handleHttpRequest } from './server';

describe('API vertical slice', () => {
  it('returns health with required meta block', async () => {
    const response = await handleHttpRequest({ method: 'GET', path: '/v1/health' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.meta.version).toBe('0.1');
    expect(typeof body.meta.requestId).toBe('string');
    expect(typeof body.meta.latencyMs).toBe('number');
    expect(['mock', 'real']).toContain(body.meta.providerMode);
  });

  it('validates analyze-and-rewrite response shape and role/mode handling', async () => {
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
    expect(Array.isArray(body.analysis.detectedIssueCodes)).toBe(true);
    expect(body.meta.version).toBe('0.1');
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
    expect(body.meta.version).toBe('0.1');
  });
});
