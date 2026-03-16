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

  it('supports magic-link login, session lookup, and logout', async () => {
    process.env.AUTH_INCLUDE_DEBUG_TOKEN = 'true';

    const requestResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/magic-link/request',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    });
    const requestBody = JSON.parse(requestResponse.body);
    expect(requestResponse.statusCode).toBe(200);
    expect(typeof requestBody.debugToken).toBe('string');

    const verifyResponse = await handleHttpRequest({
      method: 'GET',
      path: `/v1/auth/magic-link/verify?token=${encodeURIComponent(requestBody.debugToken)}`,
    });
    const verifyBody = JSON.parse(verifyResponse.body);
    const cookie = verifyResponse.headers['set-cookie'];

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyBody.authenticated).toBe(true);
    expect(verifyBody.user.email).toBe('user@example.com');
    expect(cookie).toContain('pf_session=');

    const sessionResponse = await handleHttpRequest({
      method: 'GET',
      path: '/v1/auth/session',
      headers: { cookie },
    });
    const sessionBody = JSON.parse(sessionResponse.body);
    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionBody.authenticated).toBe(true);
    expect(sessionBody.user.email).toBe('user@example.com');

    const logoutResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/logout',
      headers: { cookie, 'content-type': 'application/json' },
    });
    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.headers['set-cookie']).toContain('Max-Age=0');

    const postLogoutSessionResponse = await handleHttpRequest({
      method: 'GET',
      path: '/v1/auth/session',
      headers: { cookie },
    });
    const postLogoutSessionBody = JSON.parse(postLogoutSessionResponse.body);
    expect(postLogoutSessionBody.authenticated).toBe(false);
  });

  it('supports passkey registration and passkey authentication', async () => {
    process.env.AUTH_INCLUDE_DEBUG_TOKEN = 'true';

    const requestResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/magic-link/request',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'passkey-user@example.com' }),
    });
    const requestBody = JSON.parse(requestResponse.body);

    const verifyResponse = await handleHttpRequest({
      method: 'GET',
      path: `/v1/auth/magic-link/verify?token=${encodeURIComponent(requestBody.debugToken)}`,
    });
    const cookie = verifyResponse.headers['set-cookie'];

    const registerOptionsResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/passkey/register/options',
      headers: { cookie, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(registerOptionsResponse.statusCode).toBe(200);

    const registerVerifyResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/passkey/register/verify',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ credentialId: 'cred_1', label: 'Laptop' }),
    });
    expect(registerVerifyResponse.statusCode).toBe(200);

    await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/logout',
      headers: { cookie, 'content-type': 'application/json' },
    });

    const authOptionsResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/passkey/authenticate/options',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'passkey-user@example.com' }),
    });
    const authOptionsBody = JSON.parse(authOptionsResponse.body);
    expect(authOptionsResponse.statusCode).toBe(200);
    expect(authOptionsBody.allowCredentials).toContain('cred_1');

    const authVerifyResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/passkey/authenticate/verify',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'passkey-user@example.com', credentialId: 'cred_1' }),
    });
    const authVerifyBody = JSON.parse(authVerifyResponse.body);
    expect(authVerifyResponse.statusCode).toBe(200);
    expect(authVerifyBody.authenticated).toBe(true);
    expect(authVerifyResponse.headers['set-cookie']).toContain('pf_session=');
  });

  it('authorizes analyze endpoint with a session cookie when static API auth is enforced', async () => {
    process.env.API_AUTH_BYPASS = 'false';
    process.env.AUTH_INCLUDE_DEBUG_TOKEN = 'true';
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const unauthorizedResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write landing page copy for our IAM platform.',
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    const requestResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/auth/magic-link/request',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'session-user@example.com' }),
    });
    const requestBody = JSON.parse(requestResponse.body);

    const verifyResponse = await handleHttpRequest({
      method: 'GET',
      path: `/v1/auth/magic-link/verify?token=${encodeURIComponent(requestBody.debugToken)}`,
    });
    const cookie = verifyResponse.headers['set-cookie'];

    const authorizedResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        prompt: 'Write landing page copy for our IAM platform.',
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });

    expect(authorizedResponse.statusCode).toBe(200);
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
    expect(body.rewrite.rewrittenPrompt).toContain('Include one clear comparison to an alternative approach.');
    expect(body.rewrite.rewrittenPrompt).toContain('Avoid vendor-marketing language and unsupported superlatives.');
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
    const hasProof = /\bproof artifact\b|\bmetric\b|\bcomparison\b|\bquantifiable\b/.test(rewriteText);
    const clearlyMoreGeneric = /\bgeneric copy|vague|general audience|broad messaging|scorer-facing rubric\b/.test(
      rewriteText,
    );

    if (hasAudience && hasTension && hasProof && !clearlyMoreGeneric) {
      expect(rewriteContrast).toBeGreaterThanOrEqual(originalContrast);
    }
  });

  it('recovers contrast for low-contrast marketer prompts without changing deliverable or audience', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const prompt =
      'Write landing page copy for IT decision-makers in mid-sized enterprises about our IAM platform. Highlight security, compliance, and ease of use.';
    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });

    const body = JSON.parse(response.body);
    const rewrittenPrompt = String(body.rewrite.rewrittenPrompt);

    expect(response.statusCode).toBe(200);
    expect(rewrittenPrompt).toContain('landing page copy');
    expect(rewrittenPrompt).toContain('for IT decision-makers in mid-sized enterprises');
    expect(rewrittenPrompt).toMatch(/\bcomparison\b|\balternative approach\b/i);
    expect(rewrittenPrompt).toMatch(/\bavoid generic marketing claims\b|\bunsupported superlatives\b/i);
    expect(body.evaluation.rewriteScore.contrast).toBeGreaterThanOrEqual(body.evaluation.originalScore.contrast);
  });

  it('improves low-contrast general prompts without inventing specific business context or drifting task type', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a blog post about cloud cost optimization. Keep it practical.',
        role: 'general',
        mode: 'balanced',
      }),
    });

    const body = JSON.parse(response.body);
    const rewrittenPrompt = String(body.rewrite.rewrittenPrompt);

    expect(response.statusCode).toBe(200);
    expect(rewrittenPrompt).toContain('Write a blog post');
    expect(rewrittenPrompt).not.toMatch(/\blanding page\b|\bemail\b|\bad campaign\b|\bsales deck\b/i);
    expect(rewrittenPrompt).not.toMatch(/\bSeries [ABC]\b|\bhealthcare\b|\bfintech\b|\bprocurement teams\b/i);
    expect(body.evaluation.rewriteScore.contrast).toBeGreaterThanOrEqual(body.evaluation.originalScore.contrast);
  });

  it('safely narrows broad themed prompts without fabricating niche buyer details', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Write a guide about Kubernetes security, deployment, monitoring, troubleshooting, cost optimization, and migration for businesses. Include examples and practical advice.',
        role: 'general',
        mode: 'balanced',
      }),
    });

    const body = JSON.parse(response.body);
    const rewrittenPrompt = String(body.rewrite.rewrittenPrompt);

    expect(response.statusCode).toBe(200);
    expect(rewrittenPrompt).toContain('guide');
    expect(rewrittenPrompt).not.toMatch(/\bprocurement directors\b|\bB2B SaaS founders\b|\bhealthcare compliance\b/i);
    expect(body.evaluation.rewriteScore.genericOutputRisk).toBeLessThanOrEqual(
      body.evaluation.originalScore.genericOutputRisk,
    );
    expect(body.evaluation.rewriteScore.scope).toBeGreaterThanOrEqual(body.evaluation.originalScore.scope);
  });

  it('adds contrast without broadening audience or adding extra jobs', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v1/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Write landing page copy for CTOs at SaaS companies about our platform engineering service. Keep the tone practical.',
        role: 'marketer',
        mode: 'high_contrast',
      }),
    });

    const body = JSON.parse(response.body);
    const rewrittenPrompt = String(body.rewrite.rewrittenPrompt);

    expect(response.statusCode).toBe(200);
    expect(rewrittenPrompt).toContain('landing page copy');
    expect(rewrittenPrompt).toContain('for CTOs at SaaS companies');
    expect(rewrittenPrompt).toMatch(/\bcomparison\b|\balternative approach\b/i);
    expect(rewrittenPrompt).not.toMatch(/\bfor CEOs\b|\bfor developers\b|\bblog post\b|\bemail\b|\bad campaign\b/i);
    expect(body.evaluation.rewriteScore.contrast).toBeGreaterThanOrEqual(body.evaluation.originalScore.contrast);
    expect(body.evaluation.rewriteScore.scope).toBeGreaterThanOrEqual(body.evaluation.originalScore.scope);
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
    expect(Array.isArray(body.improvementSuggestions)).toBe(true);
    expect(body.improvementSuggestions.length).toBeLessThanOrEqual(2);
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
    expect(body.evaluation.status).not.toBe('material_improvement');
    expect(String(body.rewrite.rewrittenPrompt).toLowerCase()).not.toContain('improve clarity, scope, and contrast');
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
    expect(Array.isArray(body.improvementSuggestions)).toBe(true);
    expect(body.improvementSuggestions.length).toBeGreaterThanOrEqual(2);
  });

  it('returns landing page opportunities tied to buyer, pain, proof, and exclusions', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a landing page for our IAM platform aimed at IT leaders. Mention security, compliance, and ease of use.',
        role: 'marketer',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.improvementSuggestions.some((suggestion: { id: string }) => suggestion.id === 'add_business_pain')).toBe(
      true,
    );
    expect(
      body.improvementSuggestions.some(
        (suggestion: { category: string }) => suggestion.category === 'proof' || suggestion.category === 'exclusion',
      ),
    ).toBe(true);
  });

  it('keeps opportunities presentable when rewrite is null for a strong general prompt', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.rewrite).toBeNull();
    expect(Array.isArray(body.improvementSuggestions)).toBe(true);
    expect(body.improvementSuggestions.length).toBeLessThanOrEqual(2);
    expect(
      body.improvementSuggestions.every(
        (suggestion: { title: string; impact: string }) =>
          suggestion.title.startsWith('Optional:') || suggestion.impact === 'low',
      ),
    ).toBe(true);
  });

  describe('v2 calibration fixtures', () => {
    const normalizeCodes = (input: string[] | string) =>
      [...new Set((Array.isArray(input) ? input : input ? input.split('|') : []).filter(Boolean))].sort();

    const fixtures = [
      {
        id: 'p1',
        request: {
          prompt: 'Write a blog post about DevOps.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 5,
            contrast: 0,
<<<<<<< present-or-zero
            clarity: 8,
            constraintQuality: 0,
            genericOutputRisk: 8,
            tokenWasteRisk: 4,
          },
          overallScore: 30,
=======
            clarity: 10,
            constraintQuality: 2,
            genericOutputRisk: 8,
            tokenWasteRisk: 4,
          },
          overallScore: 36,
>>>>>>> main
          scoreBand: 'poor',
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: true,
          rewritePresent: true,
          evaluationPresent: true,
          issueCodes: 'AUDIENCE_MISSING|CONSTRAINTS_MISSING|EXCLUSIONS_MISSING|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p2',
        request: {
          prompt:
            'Write an amazing, compelling, innovative blog post about cloud security that really stands out and feels modern and professional.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 5,
            contrast: 0,
<<<<<<< present-or-zero
            clarity: 7,
            constraintQuality: 0,
            genericOutputRisk: 10,
            tokenWasteRisk: 4,
          },
          overallScore: 26,
=======
            clarity: 8,
            constraintQuality: 2,
            genericOutputRisk: 10,
            tokenWasteRisk: 4,
          },
          overallScore: 31,
>>>>>>> main
          scoreBand: 'poor',
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: true,
          rewritePresent: true,
          evaluationPresent: true,
          issueCodes:
            'AUDIENCE_MISSING|CONSTRAINTS_MISSING|EXCLUSIONS_MISSING|GENERIC_PHRASES_DETECTED|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p3',
        request: {
          prompt:
            'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 5,
<<<<<<< present-or-zero
            contrast: 1,
            clarity: 8,
            constraintQuality: 6,
=======
            contrast: 2,
            clarity: 10,
            constraintQuality: 5,
>>>>>>> main
            genericOutputRisk: 4,
            tokenWasteRisk: 4,
          },
          overallScore: 53,
          scoreBand: 'weak',
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: false,
          rewritePresent: true,
          evaluationPresent: true,
          issueCodes: 'EXCLUSIONS_MISSING',
        },
      },
      {
        id: 'p4',
        request: {
          prompt: 'Write a landing page for our IAM platform aimed at IT leaders. Mention security, compliance, and ease of use.',
          role: 'marketer' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 7,
<<<<<<< present-or-zero
            contrast: 2,
            clarity: 8,
=======
            contrast: 3,
            clarity: 10,
>>>>>>> main
            constraintQuality: 2,
            genericOutputRisk: 6,
            tokenWasteRisk: 2,
          },
<<<<<<< present-or-zero
          overallScore: 48,
=======
          overallScore: 53,
>>>>>>> main
          scoreBand: 'weak',
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: true,
          rewritePresent: true,
          evaluationPresent: true,
          issueCodes: 'EXCLUSIONS_MISSING|GENERIC_OUTPUT_RISK_HIGH',
        },
      },
      {
        id: 'p5',
        request: {
          prompt:
            'Write a blog post for engineering managers about CI/CD mistakes teams make when they grow quickly. Use a practical tone and include examples.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 5,
<<<<<<< present-or-zero
            contrast: 1,
            clarity: 8,
=======
            contrast: 2,
            clarity: 10,
>>>>>>> main
            constraintQuality: 5,
            genericOutputRisk: 4,
            tokenWasteRisk: 4,
          },
<<<<<<< present-or-zero
          overallScore: 48,
=======
          overallScore: 53,
>>>>>>> main
          scoreBand: 'weak',
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: false,
          rewritePresent: true,
          evaluationPresent: true,
          issueCodes: 'EXCLUSIONS_MISSING',
        },
      },
      {
        id: 'p6',
        request: {
          prompt:
            'Write an email to CTOs at SaaS companies explaining why platform engineering improves developer productivity. Keep it concise and persuasive.',
          role: 'marketer' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 6,
<<<<<<< present-or-zero
            contrast: 1,
            clarity: 8,
=======
            contrast: 2,
            clarity: 10,
>>>>>>> main
            constraintQuality: 2,
            genericOutputRisk: 5,
            tokenWasteRisk: 2,
          },
<<<<<<< present-or-zero
          overallScore: 44,
=======
          overallScore: 49,
>>>>>>> main
          scoreBand: 'weak',
          rewriteRecommendation: 'rewrite_recommended' as const,
          expectedImprovement: 'high' as const,
          majorBlockingIssues: false,
          rewritePresent: true,
          evaluationPresent: true,
          issueCodes: 'EXCLUSIONS_MISSING',
        },
      },
      {
        id: 'p7',
        request: {
          prompt:
            'Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.',
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 7,
<<<<<<< present-or-zero
            contrast: 7,
            clarity: 8,
            constraintQuality: 8,
=======
            contrast: 8,
            clarity: 10,
            constraintQuality: 7,
>>>>>>> main
            genericOutputRisk: 3,
            tokenWasteRisk: 4,
          },
          overallScore: 77,
          scoreBand: 'strong',
          rewriteRecommendation: 'no_rewrite_needed' as const,
          expectedImprovement: 'low' as const,
          majorBlockingIssues: false,
          rewritePresent: false,
          evaluationPresent: false,
          issueCodes: '',
        },
      },
      {
        id: 'p8',
        request: {
          prompt: strongV2Prompt,
          role: 'marketer' as const,
          mode: 'high_contrast' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 10,
            contrast: 10,
<<<<<<< present-or-zero
            clarity: 8,
            constraintQuality: 10,
            genericOutputRisk: 3,
            tokenWasteRisk: 2,
          },
          overallScore: 95,
=======
            clarity: 10,
            constraintQuality: 8,
            genericOutputRisk: 3,
            tokenWasteRisk: 2,
          },
          overallScore: 93,
>>>>>>> main
          scoreBand: 'excellent',
          rewriteRecommendation: 'no_rewrite_needed' as const,
          expectedImprovement: 'low' as const,
          majorBlockingIssues: false,
          rewritePresent: false,
          evaluationPresent: false,
          issueCodes: '',
        },
      },
      {
        id: 'p9',
        request: {
          prompt: microservicesCalibrationPrompt,
          role: 'general' as const,
          mode: 'balanced' as const,
          rewritePreference: 'auto' as const,
        },
        expected: {
          scores: {
            scope: 7,
            contrast: 10,
<<<<<<< present-or-zero
            clarity: 8,
            constraintQuality: 10,
            genericOutputRisk: 3,
            tokenWasteRisk: 4,
          },
          overallScore: 85,
=======
            clarity: 10,
            constraintQuality: 9,
            genericOutputRisk: 3,
            tokenWasteRisk: 4,
          },
          overallScore: 86,
>>>>>>> main
          scoreBand: 'excellent',
          rewriteRecommendation: 'no_rewrite_needed' as const,
          expectedImprovement: 'low' as const,
          majorBlockingIssues: false,
          rewritePresent: false,
          evaluationPresent: false,
          issueCodes: '',
        },
      },
    ] as const;

    for (const fixture of fixtures) {
      it(fixture.id, async () => {
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
        expect(body.analysis.scores.scope).toBe(fixture.expected.scores.scope);
        expect(body.analysis.scores.contrast).toBe(fixture.expected.scores.contrast);
        expect(body.analysis.scores.clarity).toBe(fixture.expected.scores.clarity);
        expect(body.analysis.scores.constraintQuality).toBe(fixture.expected.scores.constraintQuality);
        expect(body.analysis.scores.genericOutputRisk).toBe(fixture.expected.scores.genericOutputRisk);
        expect(body.analysis.scores.tokenWasteRisk).toBe(fixture.expected.scores.tokenWasteRisk);
        expect(body.overallScore).toBe(fixture.expected.overallScore);
        expect(body.scoreBand).toBe(fixture.expected.scoreBand);
        expect(body.rewriteRecommendation).toBe(fixture.expected.rewriteRecommendation);
        expect(Array.isArray(body.improvementSuggestions)).toBe(true);
        expect(body.gating.rewritePreference).toBe('auto');
        expect(body.gating.expectedImprovement).toBe(fixture.expected.expectedImprovement);
        expect(body.gating.majorBlockingIssues).toBe(fixture.expected.majorBlockingIssues);
        expect(normalizeCodes(body.analysis.detectedIssueCodes)).toEqual(normalizeCodes(fixture.expected.issueCodes));

        if (fixture.expected.rewriteRecommendation === 'no_rewrite_needed') {
          expect(body.improvementSuggestions.length).toBeLessThanOrEqual(2);
        } else if (fixture.expected.scoreBand === 'usable') {
          expect(body.improvementSuggestions.length).toBeGreaterThanOrEqual(2);
          expect(body.improvementSuggestions.length).toBeLessThanOrEqual(4);
        } else {
          expect(body.improvementSuggestions.length).toBeGreaterThanOrEqual(2);
          expect(body.improvementSuggestions.length).toBeLessThanOrEqual(5);
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
