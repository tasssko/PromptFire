import { handleHttpRequest } from './server';

interface ApiGatewayEvent {
  rawPath: string;
  requestContext: {
    http: {
      method: string;
    };
  };
  headers?: Record<string, string | undefined>;
  body?: string | null;
}

export async function handler(event: ApiGatewayEvent) {
  return handleHttpRequest({
    method: event.requestContext.http.method,
    path: event.rawPath,
    headers: event.headers,
    body: event.body,
  });
}
