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

export function createMeta(requestId: string, startedAtMs: number, providerMode: ProviderMode): Meta {
  return {
    version: API_VERSION,
    requestId,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
    providerMode,
  };
}

export function jsonResponse(statusCode: number, payload: unknown): HttpResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

export function errorResponse(
  statusCode: number,
  code: ErrorCode,
  message: string,
  meta: Meta,
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

  return jsonResponse(statusCode, payload);
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
