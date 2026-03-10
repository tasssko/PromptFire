import { analyzePrompt } from '@promptfire/heuristics';
import {
  AnalyzeAndRewriteRequestSchema,
  API_VERSION,
  normalizePreferences,
  type AnalyzeAndRewriteResponse,
} from '@promptfire/shared';
import { getAuthBypassEnabled, getProviderMode, getStaticApiKey } from './lib/env';
import {
  createMeta,
  errorResponse,
  jsonResponse,
  normalizeHeaders,
  requestIdFromHeaders,
  type HttpRequest,
  type HttpResponse,
} from './lib/http';
import { MockRewriteEngine } from './rewrite/mockRewriteEngine';
import type { RewriteEngine } from './rewrite/types';

const rewriteEngine: RewriteEngine = new MockRewriteEngine();

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
}): void {
  console.info(JSON.stringify(params));
}

export async function handleHttpRequest(request: HttpRequest): Promise<HttpResponse> {
  const startedAtMs = performance.now();
  const headers = normalizeHeaders(request.headers);
  const requestId = requestIdFromHeaders(request.headers);
  const providerMode = getProviderMode();

  if (request.method === 'GET' && request.path === '/v1/health') {
    const meta = createMeta(requestId, startedAtMs, providerMode);
    const response = jsonResponse(200, { status: 'ok', meta });
    logRequest({
      requestId,
      endpoint: '/v1/health',
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
    });
    return response;
  }

  if (!isAuthorized(headers)) {
    const meta = createMeta(requestId, startedAtMs, providerMode);
    const response = errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta);
    logRequest({
      requestId,
      endpoint: request.path,
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
    });
    return response;
  }

  if (request.method === 'POST' && request.path === '/v1/analyze-and-rewrite') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode);
      const response = errorResponse(
        415,
        'UNSUPPORTED_CONTENT_TYPE',
        'Content-Type must be application/json.',
        meta,
      );
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
      });
      return response;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.body ? JSON.parse(request.body) : {};
    } catch {
      const meta = createMeta(requestId, startedAtMs, providerMode);
      const response = errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta);
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
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

      const meta = createMeta(requestId, startedAtMs, providerMode);
      const response = errorResponse(400, code, firstIssue?.message ?? 'Invalid request.', meta, {
        issues: parsed.error.issues,
      });
      logRequest({
        requestId,
        endpoint: request.path,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
      });
      return response;
    }

    const input = parsed.data;
    const preferences = normalizePreferences(input.preferences);
    const analysis = analyzePrompt({ ...input, preferences });
    const rewrite = await rewriteEngine.rewrite({
      prompt: input.prompt,
      role: input.role,
      mode: input.mode,
      context: input.context,
      preferences,
      analysis,
    });

    const meta = createMeta(requestId, startedAtMs, providerMode);

    const payload: AnalyzeAndRewriteResponse = {
      id: `par_${requestId}`,
      analysis,
      rewrite,
      meta,
    };

    const response = jsonResponse(200, payload);
    logRequest({
      requestId,
      endpoint: request.path,
      method: request.method,
      role: input.role,
      mode: input.mode,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
    });
    return response;
  }

  const meta = createMeta(requestId, startedAtMs, providerMode);
  return errorResponse(404, 'INVALID_REQUEST', `Route not found for ${request.method} ${request.path}.`, meta);
}

export function version(): string {
  return API_VERSION;
}
