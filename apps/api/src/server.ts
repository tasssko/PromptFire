import { analyzePrompt, evaluateRewrite } from '@promptfire/heuristics';
import {
  AnalyzeAndRewriteRequestSchema,
  API_VERSION,
  normalizePreferences,
  type AnalyzeAndRewriteResponse,
} from '@promptfire/shared';
import { getAuthBypassEnabled, getProviderMode, getStaticApiKey } from './lib/env';
import {
  createMeta,
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
