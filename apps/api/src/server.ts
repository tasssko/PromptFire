import { analyzePrompt, evaluateRewrite, generateImprovementSuggestions } from '@promptfire/heuristics';
import {
  AnalyzeAndRewriteV2RequestSchema,
  AnalyzeAndRewriteRequestSchema,
  API_VERSION,
  normalizePreferences,
  type AnalyzeAndRewriteResponse,
  type AnalyzeAndRewriteV2Request,
  type AnalyzeAndRewriteV2Response,
  type Analysis,
  type Issue,
  type RewriteRecommendation,
  type RewritePreference,
  type ScoreBand,
  type ScoreSet,
} from '@promptfire/shared';
import { getAuthBypassEnabled, getProviderMode, getStaticApiKey } from './lib/env';
import {
  createMeta,
  createMetaV2,
  emptyResponse,
  errorResponse,
  jsonResponse,
  normalizeHeaders,
  requestIdFromHeaders,
  type HttpRequest,
  type HttpResponse,
} from './lib/http';
import { ProviderNotConfiguredError, UpstreamRewriteError } from './rewrite/errors';
import { selectRewriteEngine } from './rewrite/engineSelector';
import { getProviderConfig } from './rewrite/providerConfig';

function isAuthorized(headers: Record<string, string>): boolean {
  if (getAuthBypassEnabled()) {
    return true;
  }

  const authorization = headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token === getStaticApiKey();
}

function contentTypeIsJson(headers: Record<string, string>): boolean {
  return (headers['content-type'] ?? '').toLowerCase().includes('application/json');
}

function logRequest(params: {
  requestId: string;
  endpoint: string;
  method: string;
  role?: string;
  mode?: string;
  statusCode: number;
  latencyMs: number;
  providerMode: string;
  providerModel?: string;
  evaluationStatus?: string;
  overallDelta?: number;
  alreadyStrong?: boolean;
  errorCode?: string;
}): void {
  console.info(JSON.stringify(params));
}

function hasAudience(prompt: string, context?: Record<string, unknown>): boolean {
  const audienceHint = context?.audienceHint;
  if (audienceHint) {
    return true;
  }

  return /\b(audience|for\s+[a-z]|target\s+user|aimed at|target(?:ing|ed at)?)\b/i.test(prompt);
}

function hasConstraintsV2(prompt: string, context?: Record<string, unknown>): boolean {
  return (
    Boolean(context?.mustInclude || context?.systemGoals) ||
    /\b(must|should|exactly|limit|only|at least|at most)\b/i.test(prompt) ||
    /\b(use one|use two|include one|include two|avoid|keep the tone|focus on|rather than|lead with)\b/i.test(prompt)
  );
}

function hasExclusions(prompt: string, context?: Record<string, unknown>): boolean {
  return Boolean(context?.mustAvoid || context?.forbiddenPhrases) || /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt);
}

function hasClearDeliverableV2(prompt: string): 0 | 1 | 2 | 3 {
  const actionVerb = /\b(write|draft|create|build|design|implement|analyze|optimize|summarize|generate)\b/i.test(prompt);
  const deliverableType =
    /\b(landing page|copy|email|ad copy|blog|article|webhook|handler|api|report|plan|outline|strategy|cta|headline|post)\b/i.test(
      prompt,
    );

  if (actionVerb && deliverableType) {
    return 3;
  }
  if (actionVerb || deliverableType) {
    return 2;
  }
  return 0;
}

function audienceOrContextSpecificityV2(prompt: string, context?: Record<string, unknown>): 0 | 1 | 2 | 3 {
  const hasAudienceSignal = hasAudience(prompt, context);
  if (!hasAudienceSignal) {
    return 0;
  }

  const broadAudience = /\b(it decision-makers?|decision-makers?|enterprise buyers?|audience|users?)\b/i.test(prompt);
  const specificAudience = /\b(cto|vp|director|architect|administrator|manager|engineering managers?)\b/i.test(prompt);
  const concreteContext = /\b(mid-sized|enterprise|regulated|audit|sprawl|acquisition|overhead|governance|saas)\b/i.test(
    prompt,
  );

  if (specificAudience || concreteContext) {
    return 3;
  }
  if (broadAudience) {
    return 1;
  }
  return 2;
}

function taskBoundariesV2(prompt: string, context?: Record<string, unknown>): 0 | 1 | 2 {
  const exclusionsPresent = hasExclusions(prompt, context);
  const strongBoundary =
    exclusionsPresent ||
    /\b(lead with|focus on|rather than|in scope|out of scope|avoid fear-based|do not use|keep the tone|only)\b/i.test(
      prompt,
    );
  const weakBoundary = /\b(focus on|highlight|emphasize|keep)\b/i.test(prompt);

  if (strongBoundary) {
    return 2;
  }
  if (weakBoundary) {
    return 1;
  }
  return 0;
}

function taskLoadScoreV2(prompt: string, overloaded: boolean): 0 | 1 | 2 {
  if (overloaded) {
    return 0;
  }
  if (/\b(and also|plus|as well as|in addition)\b/i.test(prompt)) {
    return 1;
  }
  return 2;
}

function computeScopeScoreV2(analysis: Analysis, prompt: string, context?: Record<string, unknown>): number {
  const overloaded = analysis.detectedIssueCodes.includes('TASK_OVERLOADED');
  return (
    hasClearDeliverableV2(prompt) +
    audienceOrContextSpecificityV2(prompt, context) +
    taskBoundariesV2(prompt, context) +
    taskLoadScoreV2(prompt, overloaded)
  );
}

function withV2Scores(analysis: Analysis, prompt: string, context?: Record<string, unknown>): Analysis {
  return {
    ...analysis,
    scores: {
      ...analysis.scores,
      scope: computeScopeScoreV2(analysis, prompt, context),
    },
  };
}

function computeOverallScore(scores: ScoreSet): number {
  const raw =
    2.5 * scores.scope +
    2.0 * scores.contrast +
    2.0 * scores.clarity +
    1.5 * scores.constraintQuality +
    (10 - scores.genericOutputRisk) +
    (10 - scores.tokenWasteRisk);

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function scoreBandFromOverallScore(overallScore: number): ScoreBand {
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
}

function hasLowExpectedImprovementV2(scores: ScoreSet, prompt: string, context?: Record<string, unknown>): boolean {
  const baselineHigh =
    scores.scope >= 7 &&
    scores.clarity >= 7 &&
    scores.genericOutputRisk <= 4 &&
    scores.tokenWasteRisk <= 4;

  const structureSignals = [
    hasAudience(prompt, context),
    /\b(outcome|deliverable|output|result|goal|objective|generate|draft|write|build|design|create)\b/i.test(prompt),
    hasConstraintsV2(prompt, context),
    hasExclusions(prompt, context),
  ];

  return baselineHigh && structureSignals.some(Boolean);
}

function hasMajorBlockingIssues(issues: Issue[]): boolean {
  const highSeverityIssues = issues.filter((issue) => issue.severity === 'high');
  if (highSeverityIssues.length >= 2) {
    return true;
  }

  const blockingCodes = new Set(['AUDIENCE_MISSING', 'CONSTRAINTS_MISSING', 'GENERIC_OUTPUT_RISK_HIGH']);
  return highSeverityIssues.some((issue) => blockingCodes.has(issue.code));
}

function recommendationFromState(params: {
  overallScore: number;
  rewritePreference: RewritePreference;
  shouldSuppress: boolean;
  expectedImprovementLow: boolean;
}): RewriteRecommendation {
  if (params.shouldSuppress) {
    return 'no_rewrite_needed';
  }
  if (params.overallScore <= 54) {
    return params.rewritePreference === 'suppress' ? 'rewrite_optional' : 'rewrite_recommended';
  }
  if (params.overallScore <= 79) {
    return 'rewrite_optional';
  }
  return params.expectedImprovementLow ? 'rewrite_optional' : 'no_rewrite_needed';
}

function summaryForV2(params: {
  recommendation: RewriteRecommendation;
  rewritePreference: RewritePreference;
  generatedRewrite: boolean;
}): string {
  if (params.rewritePreference === 'suppress') {
    return 'Rewrite generation was suppressed by request.';
  }
  if (params.rewritePreference === 'force' && params.generatedRewrite) {
    return 'Strong prompt. Rewrite was generated because it was explicitly requested.';
  }
  if (params.recommendation === 'no_rewrite_needed') {
    return 'Strong prompt. It is already well scoped and well directed.';
  }
  if (params.recommendation === 'rewrite_recommended') {
    return 'Prompt is weakly bounded and likely to produce generic output.';
  }
  return 'Prompt is usable but may benefit from a targeted rewrite.';
}

export async function handleHttpRequest(request: HttpRequest): Promise<HttpResponse> {
  const startedAtMs = performance.now();
  const headers = normalizeHeaders(request.headers);
  const requestId = requestIdFromHeaders(request.headers);
  const providerMode = getProviderMode();
  const providerConfig = getProviderConfig();

  if (request.method === 'OPTIONS') {
    return emptyResponse(204, headers);
  }

  if (request.method === 'GET' && request.path === '/v1/health') {
    const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
    const response = jsonResponse(200, { status: 'ok', meta }, headers);
    logRequest({
      requestId,
      endpoint: '/v1/health',
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
    });
    return response;
  }

  if (request.method === 'GET' && request.path === '/v2/health') {
    const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
    const response = jsonResponse(200, { status: 'ok', meta }, headers);
    logRequest({
      requestId,
      endpoint: '/v2/health',
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
    });
    return response;
  }

  if (!isAuthorized(headers)) {
    const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
    const response = errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    logRequest({
      requestId,
      endpoint: request.path,
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
      errorCode: 'UNAUTHORIZED',
    });
    return response;
  }

  if (request.method === 'POST' && request.path === '/v1/analyze-and-rewrite') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(
        415,
        'UNSUPPORTED_CONTENT_TYPE',
        'Content-Type must be application/json.',
        meta,
        headers,
      );
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      });
      return response;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.body ? JSON.parse(request.body) : {};
    } catch {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INVALID_REQUEST',
      });
      return response;
    }

    const parsed = AnalyzeAndRewriteRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const code =
        firstIssue?.path.includes('role')
          ? 'INVALID_ROLE'
          : firstIssue?.path.includes('mode')
            ? 'INVALID_MODE'
            : firstIssue?.message === 'Prompt too long.'
              ? 'PROMPT_TOO_LONG'
              : firstIssue?.message === 'Prompt is required.'
                ? 'PROMPT_REQUIRED'
                : 'INVALID_REQUEST';

      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(
        400,
        code,
        firstIssue?.message ?? 'Invalid request.',
        meta,
        headers,
        {
          issues: parsed.error.issues,
        },
      );
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: code,
      });
      return response;
    }

    const input = parsed.data;
    const preferences = normalizePreferences(input.preferences);
    const analysis = analyzePrompt({ ...input, preferences });

    try {
      const rewriteEngine = selectRewriteEngine(providerConfig);
      const rewrite = await rewriteEngine.rewrite({
        prompt: input.prompt,
        role: input.role,
        mode: input.mode,
        context: input.context,
        preferences,
        analysis,
      });

      const rewriteAnalysis = analyzePrompt({
        prompt: rewrite.rewrittenPrompt,
        role: input.role,
        mode: input.mode,
        context: input.context,
        preferences,
      });
      const evaluation = evaluateRewrite({
        originalPrompt: input.prompt,
        rewrittenPrompt: rewrite.rewrittenPrompt,
        originalAnalysis: analysis,
        rewriteAnalysis,
        context: input.context,
      });

      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);

      const payload: AnalyzeAndRewriteResponse = {
        id: `par_${requestId}`,
        analysis,
        rewrite,
        evaluation: {
          originalScore: analysis.scores,
          rewriteScore: rewriteAnalysis.scores,
          improvement: evaluation.improvement,
          signals: evaluation.signals,
        },
        meta,
      };

      const response = jsonResponse(200, payload, headers);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        evaluationStatus: evaluation.improvement.status,
        overallDelta: evaluation.improvement.overallDelta,
        alreadyStrong: evaluation.improvement.status === 'already_strong',
      });
      return response;
    } catch (error) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);

      if (error instanceof ProviderNotConfiguredError) {
        const response = errorResponse(
          500,
          'PROVIDER_NOT_CONFIGURED',
          'Rewrite provider is not configured for real mode.',
          meta,
          headers,
        );
        logRequest({
          requestId,
          endpoint: request.path,
          method: request.method,
          role: input.role,
          mode: input.mode,
          statusCode: response.statusCode,
          latencyMs: meta.latencyMs,
          providerMode,
          providerModel: providerConfig.model,
          errorCode: 'PROVIDER_NOT_CONFIGURED',
        });
        return response;
      }

      if (error instanceof UpstreamRewriteError) {
        const response = errorResponse(
          502,
          'UPSTREAM_MODEL_ERROR',
          'Rewrite provider failed. Please try again.',
          meta,
          headers,
        );
        logRequest({
          requestId,
          endpoint: request.path,
          method: request.method,
          role: input.role,
          mode: input.mode,
          statusCode: response.statusCode,
          latencyMs: meta.latencyMs,
          providerMode,
          providerModel: providerConfig.model,
          errorCode: 'UPSTREAM_MODEL_ERROR',
        });
        return response;
      }

      const response = errorResponse(500, 'INTERNAL_ERROR', 'Internal server error.', meta, headers);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INTERNAL_ERROR',
      });
      return response;
    }
  }

  if (request.method === 'POST' && request.path === '/v2/analyze-and-rewrite') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(
        415,
        'UNSUPPORTED_CONTENT_TYPE',
        'Content-Type must be application/json.',
        meta,
        headers,
      );
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      });
      return response;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.body ? JSON.parse(request.body) : {};
    } catch {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INVALID_REQUEST',
      });
      return response;
    }

    const parsed = AnalyzeAndRewriteV2RequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const code =
        firstIssue?.path.includes('role')
          ? 'INVALID_ROLE'
          : firstIssue?.path.includes('mode')
            ? 'INVALID_MODE'
            : firstIssue?.message === 'Prompt too long.'
              ? 'PROMPT_TOO_LONG'
              : firstIssue?.message === 'Prompt is required.'
                ? 'PROMPT_REQUIRED'
                : 'INVALID_REQUEST';

      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, code, firstIssue?.message ?? 'Invalid request.', meta, headers, {
        issues: parsed.error.issues,
      });
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: code,
      });
      return response;
    }

    const input: AnalyzeAndRewriteV2Request = parsed.data;
    const preferences = normalizePreferences(input.preferences);
    const originalAnalysis = withV2Scores(analyzePrompt({ ...input, preferences }), input.prompt, input.context);
    const overallScore = computeOverallScore(originalAnalysis.scores);
    const scoreBand = scoreBandFromOverallScore(overallScore);
    const expectedImprovement = hasLowExpectedImprovementV2(originalAnalysis.scores, input.prompt, input.context)
      ? 'low'
      : 'high';
    const majorBlockingIssues = hasMajorBlockingIssues(originalAnalysis.issues);
    const cleanStrongPrompt = expectedImprovement === 'low' && originalAnalysis.issues.length === 0;
    const shouldSuppressByStrength =
      (overallScore >= 80 || cleanStrongPrompt) &&
      !majorBlockingIssues &&
      expectedImprovement === 'low' &&
      input.rewritePreference !== 'force';
    const shouldSuppress = input.rewritePreference === 'suppress' || shouldSuppressByStrength;
    const rewriteRecommendation = recommendationFromState({
      overallScore,
      rewritePreference: input.rewritePreference,
      shouldSuppress,
      expectedImprovementLow: expectedImprovement === 'low',
    });
    const improvementSuggestions = generateImprovementSuggestions({
      input,
      analysis: originalAnalysis,
      overallScore,
      scoreBand,
      rewriteRecommendation,
    });

    try {
      let rewrite: AnalyzeAndRewriteV2Response['rewrite'] = null;
      let evaluation: AnalyzeAndRewriteV2Response['evaluation'] = null;

      if (!shouldSuppress) {
        const rewriteEngine = selectRewriteEngine(providerConfig);
        const generatedRewrite = await rewriteEngine.rewrite({
          prompt: input.prompt,
          role: input.role,
          mode: input.mode,
          context: input.context,
          preferences,
          analysis: originalAnalysis,
        });

        const rewriteAnalysis = withV2Scores(
          analyzePrompt({
            prompt: generatedRewrite.rewrittenPrompt,
            role: input.role,
            mode: input.mode,
            context: input.context,
            preferences,
          }),
          generatedRewrite.rewrittenPrompt,
          input.context,
        );
        const rewriteEvaluation = evaluateRewrite({
          originalPrompt: input.prompt,
          rewrittenPrompt: generatedRewrite.rewrittenPrompt,
          originalAnalysis,
          rewriteAnalysis,
          context: input.context,
        });

        rewrite = generatedRewrite;
        evaluation = {
          status: rewriteEvaluation.improvement.status,
          overallDelta: rewriteEvaluation.improvement.overallDelta,
          signals: rewriteEvaluation.signals,
          scoreComparison: {
            original: {
              scope: originalAnalysis.scores.scope,
              contrast: originalAnalysis.scores.contrast,
              clarity: originalAnalysis.scores.clarity,
            },
            rewrite: {
              scope: rewriteAnalysis.scores.scope,
              contrast: rewriteAnalysis.scores.contrast,
              clarity: rewriteAnalysis.scores.clarity,
            },
          },
        };
      }

      const analysis: Analysis = {
        ...originalAnalysis,
        signals:
          expectedImprovement === 'low' && !originalAnalysis.signals.includes('Low expected improvement.')
            ? [...originalAnalysis.signals, 'Low expected improvement.']
            : originalAnalysis.signals,
        summary: summaryForV2({
          recommendation: rewriteRecommendation,
          rewritePreference: input.rewritePreference,
          generatedRewrite: rewrite !== null,
        }),
      };
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const payload: AnalyzeAndRewriteV2Response = {
        id: `par_${requestId}`,
        overallScore,
        scoreBand,
        rewriteRecommendation,
        analysis,
        improvementSuggestions,
        gating: {
          rewritePreference: input.rewritePreference,
          expectedImprovement,
          majorBlockingIssues,
        },
        rewrite,
        evaluation,
        meta,
      };

      const response = jsonResponse(200, payload, headers);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        evaluationStatus: evaluation?.status,
        overallDelta: evaluation?.overallDelta,
        alreadyStrong: rewriteRecommendation === 'no_rewrite_needed',
      });
      return response;
    } catch (error) {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);

      if (error instanceof ProviderNotConfiguredError) {
        const response = errorResponse(
          500,
          'PROVIDER_NOT_CONFIGURED',
          'Rewrite provider is not configured for real mode.',
          meta,
          headers,
        );
        logRequest({
          requestId,
          endpoint: request.path,
          method: request.method,
          role: input.role,
          mode: input.mode,
          statusCode: response.statusCode,
          latencyMs: meta.latencyMs,
          providerMode,
          providerModel: providerConfig.model,
          errorCode: 'PROVIDER_NOT_CONFIGURED',
        });
        return response;
      }

      if (error instanceof UpstreamRewriteError) {
        const response = errorResponse(
          502,
          'UPSTREAM_MODEL_ERROR',
          'Rewrite provider failed. Please try again.',
          meta,
          headers,
        );
        logRequest({
          requestId,
          endpoint: request.path,
          method: request.method,
          role: input.role,
          mode: input.mode,
          statusCode: response.statusCode,
          latencyMs: meta.latencyMs,
          providerMode,
          providerModel: providerConfig.model,
          errorCode: 'UPSTREAM_MODEL_ERROR',
        });
        return response;
      }

      const response = errorResponse(500, 'INTERNAL_ERROR', 'Internal server error.', meta, headers);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INTERNAL_ERROR',
      });
      return response;
    }
  }

  const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
  return errorResponse(
    404,
    'INVALID_REQUEST',
    `Route not found for ${request.method} ${request.path}.`,
    meta,
    headers,
  );
}

export function version(): string {
  return API_VERSION;
}
