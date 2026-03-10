import { randomUUID } from 'node:crypto';
import { API_VERSION, type ErrorCode, type ErrorResponse, type Meta, type ProviderMode } from '@promptfire/shared';

export interface HttpRequest {
  method: string;
  path: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_ALLOW_HEADERS = 'content-type,authorization,x-request-id';
const CORS_ALLOW_METHODS = 'GET,POST,OPTIONS';

function parseAllowedOrigins(): string[] {
  const raw = process.env.API_CORS_ALLOW_ORIGIN ?? '*';
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveAllowedOrigin(requestHeaders?: Record<string, string>): string {
  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.includes('*')) {
    return '*';
  }

  const requestOrigin = requestHeaders?.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? '*';
}

export function corsHeaders(requestHeaders?: Record<string, string>): Record<string, string> {
  return {
    'access-control-allow-origin': resolveAllowedOrigin(requestHeaders),
    'access-control-allow-methods': CORS_ALLOW_METHODS,
    'access-control-allow-headers': CORS_ALLOW_HEADERS,
    'access-control-max-age': '86400',
  };
}

export function createMeta(
  requestId: string,
  startedAtMs: number,
  providerMode: ProviderMode,
  providerModel?: string,
): Meta {
  return {
    version: API_VERSION,
    requestId,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
    providerMode,
    providerModel,
  };
}

export function jsonResponse(
  statusCode: number,
  payload: unknown,
  requestHeaders?: Record<string, string>,
): HttpResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders(requestHeaders),
    },
    body: JSON.stringify(payload),
  };
}

export function emptyResponse(
  statusCode: number,
  requestHeaders?: Record<string, string>,
): HttpResponse {
  return {
    statusCode,
    headers: {
      ...corsHeaders(requestHeaders),
    },
    body: '',
  };
}

export function errorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  meta: Meta,
  requestHeaders?: Record<string, string>,
  details?: Record<string, unknown>,
): HttpResponse {
  const payload: ErrorResponse = {
    error: {
      code,
      message,
      details,
    },
    meta,
  };

  return jsonResponse(statusCode, payload, requestHeaders);
}

export function requestIdFromHeaders(headers?: Record<string, string | undefined>): string {
  return headers?.['x-request-id'] ?? headers?.['X-Request-Id'] ?? randomUUID();
}

export function normalizeHeaders(headers?: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) {
      out[key.toLowerCase()] = value;
    }
  }
  return out;
}
