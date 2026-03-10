import { Api, StackContext } from 'sst/constructs';

export function PromptFireStack({ stack }: StackContext) {
  const runtime = process.env.LAMBDA_RUNTIME ?? 'nodejs22.x';

  const api = new Api(stack, 'PromptFireApi', {
    defaults: {
      function: {
        runtime: runtime as any,
        architecture: 'arm_64',
        environment: {
          API_AUTH_BYPASS: process.env.API_AUTH_BYPASS ?? 'true',
          API_STATIC_KEY: process.env.API_STATIC_KEY ?? 'dev-key',
          REWRITE_PROVIDER_MODE: process.env.REWRITE_PROVIDER_MODE ?? 'mock',
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
