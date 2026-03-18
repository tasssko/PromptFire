import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AnalyzeAndRewriteV2Response,
  type ScoreSet,
} from '@promptfire/shared';
import {
  semanticBoundaryFixtures,
  semanticConsistencyCases,
  semanticEquivalenceFamilies,
  semanticFindingCases,
} from '@promptfire/shared/src/semanticFixtures';
import { handleHttpRequest } from './server';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('API vertical slice', () => {
  function computeOverallScore(scores: ScoreSet): number {
    const raw =
      2.75 * scores.scope +
      2.25 * scores.contrast +
      1.25 * scores.clarity +
      2.0 * scores.constraintQuality +
      1.5 * (10 - scores.genericOutputRisk) +
      0.5 * (10 - scores.tokenWasteRisk);

    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  async function analyzeV2(prompt: string, role: 'general' | 'developer' | 'marketer'): Promise<AnalyzeAndRewriteV2Response> {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        role,
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    expect(response.statusCode).toBe(200);
    return JSON.parse(response.body);
  }

  function expectTextToAvoidSnippets(text: string, forbidden: string[]): void {
    const lowered = text.toLowerCase();
    for (const snippet of forbidden) {
      expect(lowered).not.toContain(snippet.toLowerCase());
    }
  }

  // Equivalent covered-family prompts should stay within a narrow enough range
  // that the score-first UI reads them as the same practical judgment.
  function expectScoreStability(a: number, b: number, maxDelta = 6): void {
    expect(Math.abs(a - b)).toBeLessThanOrEqual(maxDelta);
  }

  function expectSubscoreStability(a: ScoreSet, b: ScoreSet, keys: (keyof ScoreSet)[], maxDelta = 2): void {
    for (const key of keys) {
      expect(Math.abs(a[key] - b[key])).toBeLessThanOrEqual(maxDelta);
    }
  }

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

  describe('final response consistency for covered families', () => {
    for (const fixture of semanticConsistencyCases) {
      it(fixture.name, async () => {
        const body = await analyzeV2(fixture.prompt, fixture.role);
        const visibleFindings = body.analysis.issues.map((issue) => issue.message).join(' ');
        const bestNextMoveText = `${body.bestNextMove?.title ?? ''} ${body.bestNextMove?.rationale ?? ''}`;

        expect(body.rewriteRecommendation).toBe(fixture.expectedRecommendation);
        if (fixture.expectedBestNextMoveTypes) {
          expect(fixture.expectedBestNextMoveTypes).toContain(body.bestNextMove?.type as typeof fixture.expectedBestNextMoveTypes[number]);
        } else {
          expect(body.bestNextMove?.type ?? null).toBeNull();
        }

        if (fixture.forbiddenScoreBands) {
          expect(fixture.forbiddenScoreBands).not.toContain(body.scoreBand);
        }
        if (fixture.forbiddenSummarySnippets) {
          expectTextToAvoidSnippets(body.analysis.summary, fixture.forbiddenSummarySnippets);
        }
        if (fixture.forbiddenFindingSnippets) {
          expectTextToAvoidSnippets(visibleFindings, fixture.forbiddenFindingSnippets);
        }
        if (fixture.forbiddenBestNextMoveSnippets) {
          expectTextToAvoidSnippets(bestNextMoveText, fixture.forbiddenBestNextMoveSnippets);
        }
      });
    }
  });

  describe('no stale fallback findings for covered families', () => {
    for (const fixture of semanticFindingCases) {
      it(fixture.name, async () => {
        const body = await analyzeV2(fixture.prompt, fixture.role);
        const visibleFindingText = [
          body.analysis.summary,
          ...body.analysis.issues.map((issue) => issue.message),
          body.bestNextMove?.title ?? '',
          body.bestNextMove?.rationale ?? '',
        ].join(' ');

        expect(body.rewriteRecommendation).toBe(fixture.expectedRecommendation);
        expectTextToAvoidSnippets(visibleFindingText, fixture.forbiddenFindingSnippets);
        expect(fixture.allowedFindingSnippets.some((snippet) => visibleFindingText.toLowerCase().includes(snippet.toLowerCase()))).toBe(
          true,
        );
      });
    }
  });

  describe('semantic equivalence holds in API output', () => {
    for (const family of semanticEquivalenceFamilies) {
      it(`${family.family} variants keep stable API recommendations and scores`, async () => {
        const baselineVariant = family.variants[0]!;
        const baseline = await analyzeV2(baselineVariant.prompt, family.role);

        expect(baseline.rewriteRecommendation).toBe(family.expectedRecommendation);
        expect(baseline.gating.majorBlockingIssues).toBe(family.expectedMajorBlockingIssues);

        for (const variant of family.variants.slice(1)) {
          const current = await analyzeV2(variant.prompt, family.role);

          expect(current.rewriteRecommendation).toBe(baseline.rewriteRecommendation);
          expect(current.gating.majorBlockingIssues).toBe(baseline.gating.majorBlockingIssues);
          expect(current.bestNextMove?.type ?? null).toBe(baseline.bestNextMove?.type ?? null);
          expect(current.scoreBand).toBe(baseline.scoreBand);
          expectScoreStability(computeOverallScore(baseline.analysis.scores), computeOverallScore(current.analysis.scores));
          expectSubscoreStability(baseline.analysis.scores, current.analysis.scores, family.importantSubscores);
        }
      });
    }
  });

  describe('family thin-vs-bounded boundary behavior', () => {
    for (const fixture of semanticBoundaryFixtures) {
      it(fixture.name, async () => {
        const thin = await analyzeV2(fixture.thinPrompt, fixture.role);
        const bounded = await analyzeV2(fixture.boundedPrompt, fixture.role);
        const boundedText = [
          bounded.analysis.summary,
          ...bounded.analysis.issues.map((issue) => issue.message),
          bounded.bestNextMove?.title ?? '',
          bounded.bestNextMove?.rationale ?? '',
        ].join(' ');

        expect(thin.rewriteRecommendation).toBe(fixture.thinRecommendation);
        if (fixture.thinAllowedScoreBands) {
          expect(fixture.thinAllowedScoreBands).toContain(thin.scoreBand);
        }

        expect(bounded.rewriteRecommendation).toBe(fixture.boundedRecommendation);
        expect(bounded.overallScore).toBeGreaterThanOrEqual(thin.overallScore);
        expectTextToAvoidSnippets(boundedText, fixture.boundedForbiddenSnippets);
        expect(bounded.bestNextMove?.type ?? null).toBe(fixture.expectedBoundedBestNextMoveType ?? null);

        if (fixture.family === 'implementation') {
          const partial = await analyzeV2(fixture.partialPrompt!, fixture.role);
          const synonym = await analyzeV2(fixture.synonymBoundedPrompt!, fixture.role);

          expect(partial.rewriteRecommendation).toBe(fixture.partialRecommendation);
          expect(partial.bestNextMove?.type ?? null).toBe('clarify_output_structure');
          expect(partial.overallScore).toBeGreaterThanOrEqual(thin.overallScore);
          expect(partial.overallScore).toBeLessThanOrEqual(bounded.overallScore);

          expect(synonym.rewriteRecommendation).toBe(fixture.boundedRecommendation);
          expect(synonym.gating.majorBlockingIssues).toBe(false);
          expect(synonym.bestNextMove?.type ?? null).toBe(fixture.expectedBoundedBestNextMoveType ?? null);
        } else {
          expect(bounded.rewriteRecommendation).not.toBe(thin.rewriteRecommendation);
        }
      });
    }
  });

  describe('semantic routing ownership', () => {
    it('keeps thin explicit decision-support prompts on the local semantic route', async () => {
      const body = await analyzeV2('Help engineering managers decide whether to adopt TypeScript.', 'general');

      expect(body.rewriteRecommendation).toBe('rewrite_recommended');
      expect(body.inferenceFallbackUsed).toBe(false);
      expect(body.resolutionSource).toBe('local');
      expect(body.bestNextMove?.type).toBe('add_decision_criteria');
    });

    it('keeps target-only analysis prompts on the local semantic route', async () => {
      const body = await analyzeV2(
        'What drives stalled incident response handoffs for a mid-sized SaaS team? Use ownership ambiguity, escalation gaps, and on-call load as the criteria. Include one startup case and one enterprise case.',
        'general',
      );

      expect(body.rewriteRecommendation).toBe('rewrite_optional');
      expect(body.inferenceFallbackUsed).toBe(false);
      expect(body.resolutionSource).toBe('local');
      expect(body.bestNextMove?.type).toBe('add_analysis_criteria');
    });

    it('does not broaden routing ownership for topic-only prompts', async () => {
      const body = await analyzeV2('Write about TypeScript adoption for engineering managers.', 'general');

      expect(body.inferenceFallbackUsed).toBe(true);
      expect(body.resolutionSource).toBe('local');
    });

    it('keeps strong semantically owned prompts suppressed even when a rewrite exists', async () => {
      const body = await analyzeV2(
        'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
        'developer',
      );

      expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
      expect(body.rewritePresentationMode).toBe('suppressed');
      expect(body.guidedCompletion).toBeNull();
    });

    it('uses semantic family gaps for guided completion on owned prompts', async () => {
      const body = await analyzeV2(
        'Given this situation, recommend whether to adopt service mesh.',
        'general',
      );

      expect(['rewrite_recommended', 'rewrite_optional']).toContain(body.rewriteRecommendation);
      expect(['template_with_example', 'questions_only']).toContain(body.rewritePresentationMode ?? 'suppressed');
      expect(body.guidedCompletion).toBeTruthy();
      const questionText = (body.guidedCompletion?.questions ?? []).join(' ').toLowerCase();
      expect(questionText).toMatch(/deliverable|context|criteria/);
      expect(questionText).not.toMatch(/who is the exact audience|format or structure should the response follow/);
    });
  });

  describe('late-branch cleanup', () => {
    it('keeps semantically owned optional prompts out of full rewrite even with material improvement eval', async () => {
      const body = await analyzeV2(
        'Compare Kubernetes and ECS for a mid-sized SaaS team. Include one startup case and one enterprise case.',
        'general',
      );

      expect(body.rewriteRecommendation).toBe('rewrite_optional');
      expect(body.rewritePresentationMode).not.toBe('full_rewrite');
      expect(['suppressed', 'template_with_example', 'questions_only']).toContain(body.rewritePresentationMode);
    });

    it('keeps semantically strong owned prompts suppressed despite late evaluation machinery', async () => {
      const body = await analyzeV2(
        'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
        'developer',
      );

      expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
      expect(body.rewritePresentationMode).toBe('suppressed');
      expect(body.guidedCompletion).toBeNull();
    });
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

  it('does not report buyer context as missing for IAM landing-page prompts that already define the audience', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          "Create a compelling landing page copy for our Identity and Access Management (IAM) service specifically designed for IT decision-makers in mid-sized companies. The copy should clearly emphasize our advanced security features, seamless integration process, and compliance benefits with industry standards. Additionally, detail how our service effectively streamlines user access while ensuring the protection of sensitive data. Please avoid generic phrases and focus on specific examples or statistics that demonstrate our service's effectiveness.",
        role: 'marketer',
        mode: 'high_contrast',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.analysis.detectedIssueCodes).not.toContain('AUDIENCE_MISSING');
    expect(body.bestNextMove).toBeTruthy();
    expect(body.bestNextMove?.id).not.toBe('add_buyer_context');
    expect(body.bestNextMove?.type).not.toBe('shift_to_audience_outcome_pattern');
    expect(String(body.bestNextMove?.title ?? '').toLowerCase()).not.toMatch(/buyer context|audience/);
    expect(String(body.bestNextMove?.rationale ?? '').toLowerCase()).not.toMatch(/buyer context|audience.*missing|lacks clear buyer/);
    expect(['add_framing_boundary', 'clarify_output_structure', 'add_proof_requirement', 'add_exclusion', 'add_decision_criteria']).toContain(
      body.bestNextMove?.type,
    );
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
    expect(body.bestNextMove).toBeNull();
  });

  it('keeps the AI-agents uncertainty framing prompt at semantic score 78 for marketer role', async () => {
    const body = await analyzeV2(
      'Write a technical blog post for DevOps engineers explaining why AI agents are not infallible, using determinism versus probabilistic behavior as the core frame. Show how infrastructure, automation, guardrails, and operational processes are designed to manage that uncertainty in real systems. Keep the tone practical rather than philosophical. Include one specific delivery example and avoid generic hype about autonomous agents.',
      'marketer',
    );

    expect(body.overallScore).toBe(78);
  });

  it('does not call inference when local pattern match is strong', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'real';
    process.env.REWRITE_PROVIDER_API_KEY = 'test-key';
    process.env.REWRITE_PROVIDER_MODEL = 'gpt-4o-mini';

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Write a blog post for engineering managers at SaaS companies about TypeScript maintainability. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(body.inferenceFallbackUsed).toBe(false);
    expect(body.resolutionSource).toBe('local');
  });

  it('does not call inference for covered semantic families even when local pattern fit is shaky', async () => {
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
                  promptPattern: 'context_first',
                  taskType: 'recommendation',
                  deliverableType: 'analysis',
                  missingContextType: null,
                  roleHint: 'general',
                  noveltyCandidate: false,
                  lookupKeys: ['context', 'decision'],
                  confidence: 0.91,
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Given this situation: a 20-person B2B SaaS team, two product squads, limited SRE support, and a compliance requirement, advise whether to adopt service mesh now or later. Base the answer on operational cost, team autonomy, and compliance impact.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(body.inferenceFallbackUsed).toBe(false);
    expect(body.resolutionSource).toBe('local');
    expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
  });

  it('calls inference once for unfamiliar prompt shapes', async () => {
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
                  promptPattern: 'stepwise_reasoning',
                  taskType: 'comparison',
                  deliverableType: 'recommendation',
                  missingContextType: 'comparison',
                  roleHint: 'general',
                  noveltyCandidate: false,
                  lookupKeys: ['comparison', 'tradeoff'],
                  confidence: 0.82,
                  notes: 'Needs explicit trade-off framing.',
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Can you help me decide this?',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.inferenceFallbackUsed).toBe(true);
    expect(body.resolutionSource).toBe('inference');
  });

  it('ignores invalid inference schema output and keeps local resolution', async () => {
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
                  promptPattern: 42,
                  notes: 'invalid payload',
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Can you help me decide this?',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.inferenceFallbackUsed).toBe(true);
    expect(body.resolutionSource).toBe('local');
  });

  it('returns local best result when inference request fails', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'real';
    process.env.REWRITE_PROVIDER_API_KEY = 'test-key';
    process.env.REWRITE_PROVIDER_MODEL = 'gpt-4o-mini';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'upstream failure' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Can you help me decide this?',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.inferenceFallbackUsed).toBe(true);
    expect(body.resolutionSource).toBe('local');
    expect(typeof body.overallScore).toBe('number');

    const inferenceLogLine = infoSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('"event":"inference_fallback_review"'));
    expect(inferenceLogLine).toBeTruthy();
    const inferenceLog = JSON.parse(inferenceLogLine as string);
    expect(inferenceLog.inference_error).toBeTruthy();
    expect(inferenceLog.inference_metadata_applied).toBe(false);
  });

  it('keeps thin developer webhook prompts weak and direct-instruction oriented', async () => {
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
                  promptPattern: 'implementation request',
                  taskType: 'coding',
                  deliverableType: 'code',
                  missingContextType: 'execution',
                  roleHint: 'developer',
                  noveltyCandidate: false,
                  lookupKeys: ['webhook'],
                  confidence: 0.76,
                  notes: 'Thin implementation prompt needs execution context.',
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a webhook handler.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(body.inferenceFallbackUsed).toBe(false);
    expect(body.resolutionSource).toBe('local');
    expect(['poor', 'weak']).toContain(body.scoreBand);
    expect(body.analysis.detectedIssueCodes).toContain('CONSTRAINTS_MISSING');
    expect(body.bestNextMove?.methodFit?.recommendedPattern).not.toBe('add_examples');
    expect(String(body.bestNextMove?.title ?? '').toLowerCase()).toMatch(/runtime|execution|input|output|structure/);
  });

  it('keeps bounded developer webhook prompt on the local semantic path and avoids stale runtime/example advice', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'real';
    process.env.REWRITE_PROVIDER_API_KEY = 'test-key';
    process.env.REWRITE_PROVIDER_MODEL = 'gpt-4o-mini';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  promptPattern: 'direct_instruction',
                  taskType: 'implementation',
                  deliverableType: 'code',
                  missingContextType: null,
                  roleHint: 'developer',
                  noveltyCandidate: false,
                  lookupKeys: ['webhook', 'nodejs', 'json-schema'],
                  confidence: 0.86,
                  notes: 'Developer implementation request with explicit constraints.',
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Implement a webhook handler in Node.js using Express that accepts JSON payloads. The handler should validate the incoming request against a predefined JSON schema for input-output contract compliance. Respond with a 200 status code for successful processing and a 400 status code for validation errors. Log any errors encountered during processing to the console. Ensure that the handler can handle unexpected input gracefully without crashing the server.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(body.inferenceFallbackUsed).toBe(false);
    expect(body.resolutionSource).toBe('local');
    expect(['weak', 'usable', 'strong', 'excellent']).toContain(body.scoreBand);
    expect(
      body.analysis.issues.some((issue: { message: string }) => /\b(runtime|language)\b/i.test(issue.message)),
    ).toBe(false);
    if (body.bestNextMove) {
      expect(String(body.bestNextMove.title ?? '').toLowerCase()).not.toMatch(/runtime|language/);
      expect(String(body.bestNextMove.title ?? '').toLowerCase()).not.toContain('examples');
      expect(String(body.bestNextMove.rationale ?? '').toLowerCase()).toMatch(
        /schema|contract|auth|signature|retry|idempot|config|bootstrap|payload|test/,
      );
    } else {
      expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
    }

    const inferenceLogLine = infoSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('"event":"inference_fallback_review"'));
    expect(inferenceLogLine).toBeFalsy();
  });

  it('keeps stronger bounded Express/JSON-schema prompts out of poor and dedupes findings', async () => {
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
                  promptPattern: 'direct_instruction',
                  taskType: 'development',
                  deliverableType: 'code',
                  missingContextType: null,
                  roleHint: 'developer',
                  noveltyCandidate: false,
                  lookupKeys: ['express', 'json-schema', 'idempotency'],
                  confidence: 0.9,
                  notes: 'Bounded implementation task.',
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Implement a Node.js webhook handler using Express.js that exclusively processes POST requests with JSON payloads. The handler must validate the incoming request against a specified input/output contract, which should be defined as a JSON schema. On successful validation, it should return a 200 status code with a success message. If validation fails, it should return a 400 status code along with a descriptive error message detailing the validation errors. Ensure that the handler includes middleware for JSON parsing and is set up to listen on a specified port.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.analysis.scores.constraintQuality).toBeGreaterThanOrEqual(5);
    expect(['weak', 'usable', 'strong', 'excellent']).toContain(body.scoreBand);
    expect(body.bestNextMove?.type).not.toBe('require_examples');
    expect(String(body.bestNextMove?.title ?? '').toLowerCase()).not.toMatch(/runtime|language/);
    const dedupeKeySet = new Set(body.analysis.issues.map((issue: { code: string; message: string }) => `${issue.code}:${issue.message}`));
    expect(dedupeKeySet.size).toBe(body.analysis.issues.length);
  });

  it('removes duplicated issues from effective analysis output', async () => {
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
                  promptPattern: 'direct_instruction',
                  taskType: 'coding',
                  deliverableType: 'code',
                  missingContextType: null,
                  roleHint: 'developer',
                  noveltyCandidate: false,
                  lookupKeys: ['webhook', 'api'],
                  confidence: 0.75,
                  notes: null,
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
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Need help with webhook handling in Node.js with schema validation and explicit status codes.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    const dedupeKeySet = new Set(body.analysis.issues.map((issue: { code: string; message: string }) => `${issue.code}:${issue.message}`));
    expect(dedupeKeySet.size).toBe(body.analysis.issues.length);
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

  it('keeps equivalent comparison prompts in the same semantic recommendation state without stale missing-constraints findings', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const compareResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy, operational load, and scaling complexity. Include one startup case and one enterprise case. Avoid hype and focus on real trade-offs.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const worthItResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Explain when Kubernetes is worth the overhead and when ECS is the better choice for a mid-sized SaaS engineering org. Use a startup example and an enterprise example, and keep the tone grounded in real trade-offs.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const compareBody = JSON.parse(compareResponse.body);
    const worthItBody = JSON.parse(worthItResponse.body);

    expect(compareResponse.statusCode).toBe(200);
    expect(worthItResponse.statusCode).toBe(200);
    expect(compareBody.rewriteRecommendation).toBe(worthItBody.rewriteRecommendation);
    expect(compareBody.gating.majorBlockingIssues).toBe(false);
    expect(worthItBody.gating.majorBlockingIssues).toBe(false);
    expect(String(compareBody.analysis.summary).toLowerCase()).toContain('comparison');
    expect(String(worthItBody.analysis.summary).toLowerCase()).toContain('comparison');
    expect(compareBody.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(worthItBody.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    if (compareBody.bestNextMove || worthItBody.bestNextMove) {
      expect(compareBody.bestNextMove?.type).toBe('add_decision_criteria');
      expect(worthItBody.bestNextMove?.type).toBe('add_decision_criteria');
    } else {
      expect(compareBody.rewriteRecommendation).toBe('no_rewrite_needed');
      expect(worthItBody.rewriteRecommendation).toBe('no_rewrite_needed');
    }
    expect(Math.abs(Number(compareBody.overallScore) - Number(worthItBody.overallScore))).toBeLessThanOrEqual(10);
  });

  it('keeps context-first prompts focused on deliverable shaping instead of generic missing-detail copy', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement.\nGiven this situation, advise whether service mesh is worth the operational cost now or later.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.gating.majorBlockingIssues).toBe(false);
    expect(body.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(String(body.analysis.summary).toLowerCase()).toContain('context');
    if (body.bestNextMove) {
      expect(String(body.bestNextMove.title ?? '').toLowerCase()).toMatch(/deliverable|context/);
      expect(String(body.bestNextMove.rationale ?? '').toLowerCase()).not.toMatch(/runtime|language|example/);
    } else {
      expect(body.rewriteRecommendation).toBe('no_rewrite_needed');
    }
  });

  it('keeps bounded webhook implementation prompts out of blocking rewrite state', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(body.gating.majorBlockingIssues).toBe(false);
    expect(body.analysis.scores.contrast).toBeGreaterThan(0);
    expect(['rewrite_optional', 'no_rewrite_needed']).toContain(body.rewriteRecommendation);
    expect(String(body.analysis.summary)).toContain('well scoped');
    expect(String(body.analysis.signals.join(' '))).toContain('Direct implementation instructions are present.');
    expect(String(body.analysis.signals.join(' '))).toContain('Clear implementation boundaries are defined.');
    expect(String(body.analysis.signals.join(' '))).toMatch(
      /Useful runtime and validation constraints are included\.|Slice A semantic path: validation, response behavior, and exclusions are explicit\./,
    );
  });

  it('keeps synonym-bounded webhook implementation prompts in the same non-blocking state', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const canonicalResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const synonymResponse = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Build a small Node.js endpoint in TypeScript for receiving webhook events as JSON. Check the body against a defined contract before processing it. Return HTTP 200 when the payload is accepted and HTTP 400 when the contract check fails. Log failures for debugging. Leave auth, signature checks, and business-rule enforcement out of scope.',
        role: 'developer',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const canonicalBody = JSON.parse(canonicalResponse.body);
    const synonymBody = JSON.parse(synonymResponse.body);

    expect(canonicalResponse.statusCode).toBe(200);
    expect(synonymResponse.statusCode).toBe(200);
    expect(canonicalBody.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(synonymBody.analysis.detectedIssueCodes).not.toContain('CONSTRAINTS_MISSING');
    expect(canonicalBody.gating.majorBlockingIssues).toBe(false);
    expect(synonymBody.gating.majorBlockingIssues).toBe(false);
    expect(synonymBody.rewriteRecommendation).toBe(canonicalBody.rewriteRecommendation);
    if (synonymBody.bestNextMove) {
      expect(String(synonymBody.bestNextMove.title ?? '').toLowerCase()).not.toMatch(/runtime|language/);
      expect(String(synonymBody.bestNextMove.rationale ?? '').toLowerCase()).toMatch(/schema|contract|auth|signature|idempot|payload/);
    } else {
      expect(synonymBody.rewriteRecommendation).toBe('no_rewrite_needed');
    }
    expect(Math.abs(Number(synonymBody.overallScore) - Number(canonicalBody.overallScore))).toBeLessThanOrEqual(10);
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
    expect(body.bestNextMove).toBeTruthy();
    expect(['shift_to_audience_outcome_pattern', 'add_framing_boundary']).toContain(body.bestNextMove.type);
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
    expect(['shift_to_audience_outcome_pattern', 'add_framing_boundary']).toContain(body.bestNextMove.type);
  });

  it('returns pattern-shift best-next-move for role-based comparison prompts', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Act as a senior engineer and explain when TypeScript is better than JavaScript.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(['shift_to_decision_frame', 'shift_to_comparison_pattern', 'add_decision_criteria']).toContain(body.bestNextMove.type);
    expect(body.bestNextMove.methodFit.recommendedPattern).toBe('break_into_steps');
  });

  it('projects canonical pattern guidance into methodFit for missing-context prompts', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Write a detailed case study about our customer migration and include measurable business outcomes.',
        role: 'marketer',
        mode: 'balanced',
        rewritePreference: 'suppress',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.bestNextMove.methodFit.recommendedPattern).toBe('supply_missing_context');
    expect(body.bestNextMove.title.toLowerCase()).toContain('context');
  });

  it('treats broad business-segment phrasing as audience in v2 marketer scoring', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const response = await handleHttpRequest({
      method: 'POST',
      path: '/v2/analyze-and-rewrite',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt:
          'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
        role: 'marketer',
        mode: 'balanced',
        rewritePreference: 'auto',
      }),
    });

    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.analysis.detectedIssueCodes).not.toContain('AUDIENCE_MISSING');
    expect(body.analysis.scores.scope).toBeGreaterThanOrEqual(5);
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
            clarity: 8,
            constraintQuality: 0,
            genericOutputRisk: 8,
            tokenWasteRisk: 4,
          },
          overallScore: 30,
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
            clarity: 7,
            constraintQuality: 0,
            genericOutputRisk: 10,
            tokenWasteRisk: 4,
          },
          overallScore: 26,
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
            contrast: 1,
            clarity: 8,
            constraintQuality: 6,
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
            contrast: 2,
            clarity: 8,
            constraintQuality: 2,
            genericOutputRisk: 6,
            tokenWasteRisk: 2,
          },
          overallScore: 48,
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
            contrast: 1,
            clarity: 8,
            constraintQuality: 5,
            genericOutputRisk: 4,
            tokenWasteRisk: 4,
          },
          overallScore: 48,
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
            contrast: 1,
            clarity: 8,
            constraintQuality: 2,
            genericOutputRisk: 5,
            tokenWasteRisk: 2,
          },
          overallScore: 44,
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
            contrast: 7,
            clarity: 8,
            constraintQuality: 8,
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
            clarity: 8,
            constraintQuality: 10,
            genericOutputRisk: 3,
            tokenWasteRisk: 2,
          },
          overallScore: 95,
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
            clarity: 8,
            constraintQuality: 10,
            genericOutputRisk: 3,
            tokenWasteRisk: 4,
          },
          overallScore: 85,
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
        expect(body.analysis.scores.scope).toBeGreaterThanOrEqual(Math.max(0, fixture.expected.scores.scope - 3));
        expect(body.analysis.scores.scope).toBeLessThanOrEqual(Math.min(10, fixture.expected.scores.scope + 3));
        expect(body.analysis.scores.contrast).toBeGreaterThanOrEqual(Math.max(0, fixture.expected.scores.contrast - 2));
        expect(body.analysis.scores.contrast).toBeLessThanOrEqual(Math.min(10, fixture.expected.scores.contrast + 2));
        expect(body.analysis.scores.clarity).toBeGreaterThanOrEqual(Math.max(0, fixture.expected.scores.clarity - 2));
        expect(body.analysis.scores.clarity).toBeLessThanOrEqual(Math.min(10, fixture.expected.scores.clarity + 2));
        expect(body.analysis.scores.constraintQuality).toBeGreaterThanOrEqual(
          Math.max(0, fixture.expected.scores.constraintQuality - 3),
        );
        expect(body.analysis.scores.constraintQuality).toBeLessThanOrEqual(
          Math.min(10, fixture.expected.scores.constraintQuality + 3),
        );
        expect(body.analysis.scores.genericOutputRisk).toBeGreaterThanOrEqual(
          Math.max(0, fixture.expected.scores.genericOutputRisk - 2),
        );
        expect(body.analysis.scores.genericOutputRisk).toBeLessThanOrEqual(
          Math.min(10, fixture.expected.scores.genericOutputRisk + 2),
        );
        expect(body.analysis.scores.tokenWasteRisk).toBeGreaterThanOrEqual(
          Math.max(0, fixture.expected.scores.tokenWasteRisk - 2),
        );
        expect(body.analysis.scores.tokenWasteRisk).toBeLessThanOrEqual(
          Math.min(10, fixture.expected.scores.tokenWasteRisk + 2),
        );
        expect(body.overallScore).toBeGreaterThanOrEqual(Math.max(0, fixture.expected.overallScore - 12));
        expect(body.overallScore).toBeLessThanOrEqual(Math.min(100, fixture.expected.overallScore + 12));
        expect(['poor', 'weak', 'usable', 'strong', 'excellent']).toContain(body.scoreBand);
        expect(body.rewriteRecommendation).toBe(fixture.expected.rewriteRecommendation);
        expect(Array.isArray(body.improvementSuggestions)).toBe(true);
        expect(body.gating.rewritePreference).toBe('auto');
        expect(['low', 'medium', 'high']).toContain(body.gating.expectedImprovement);
        expect(body.gating.majorBlockingIssues).toBe(fixture.expected.majorBlockingIssues);
        const actualIssueCodes = normalizeCodes(body.analysis.detectedIssueCodes);
        const expectedIssueCodes = normalizeCodes(fixture.expected.issueCodes);
        if (fixture.expected.rewriteRecommendation === 'no_rewrite_needed' && expectedIssueCodes.length === 0) {
          expect(actualIssueCodes.every((code) => code === 'LOW_EXPECTED_IMPROVEMENT')).toBe(true);
        } else {
          expect(actualIssueCodes).toEqual(expectedIssueCodes);
        }

        if (fixture.expected.rewriteRecommendation === 'no_rewrite_needed') {
          expect(body.improvementSuggestions.length).toBeLessThanOrEqual(2);
        } else {
          expect(body.improvementSuggestions.length).toBeGreaterThanOrEqual(1);
          expect(body.improvementSuggestions.length).toBeLessThanOrEqual(5);
        }

        if (fixture.expected.rewritePresent) {
          const allowsGuidedFallback =
            body.rewritePresentationMode === 'template_with_example' ||
            body.rewritePresentationMode === 'questions_only';
          if (allowsGuidedFallback) {
            expect(body.rewrite).toBeNull();
            expect(body.guidedCompletion).toBeTruthy();
          } else {
            expect(body.rewrite).toBeTruthy();
          }
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
