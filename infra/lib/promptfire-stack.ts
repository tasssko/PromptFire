import { Api, StackContext } from 'sst/constructs';

export function PromptFireStack({ stack }: StackContext) {
  const runtime = process.env.LAMBDA_RUNTIME ?? 'nodejs22.x';

  const api = new Api(stack, 'PromptFireApi', {
    cors: {
      allowOrigins: ['*'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization', 'x-request-id'],
    },
    defaults: {
      function: {
        runtime: runtime as any,
        architecture: 'arm_64',
        environment: {
          API_AUTH_BYPASS: process.env.API_AUTH_BYPASS ?? 'true',
          API_STATIC_KEY: process.env.API_STATIC_KEY ?? 'dev-key',
          API_CORS_ALLOW_ORIGIN: process.env.API_CORS_ALLOW_ORIGIN ?? '*',
          REWRITE_PROVIDER_MODE: process.env.REWRITE_PROVIDER_MODE ?? 'mock',
          REWRITE_PROVIDER_MODEL: process.env.REWRITE_PROVIDER_MODEL ?? 'gpt-4o-mini',
          REWRITE_PROVIDER_API_KEY: process.env.REWRITE_PROVIDER_API_KEY ?? '',
          REWRITE_PROVIDER_ENDPOINT:
            process.env.REWRITE_PROVIDER_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions',
          REWRITE_PROVIDER_TIMEOUT_MS: process.env.REWRITE_PROVIDER_TIMEOUT_MS ?? '15000',
        },
      },
    },
    routes: {
      'GET /v1/health': '../apps/api/src/lambda.handler',
      'POST /v1/analyze-and-rewrite': '../apps/api/src/lambda.handler',
    },
  });

  stack.addOutputs({
    ApiBaseUrl: api.url,
  });
}
