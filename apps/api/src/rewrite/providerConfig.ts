import { getProviderMode } from '../lib/env';

export interface ProviderConfig {
  mode: 'mock' | 'real';
  model?: string;
  apiKey?: string;
  endpoint: string;
  timeoutMs: number;
}

export function getProviderConfig(): ProviderConfig {
  return {
    mode: getProviderMode(),
    model: process.env.REWRITE_PROVIDER_MODEL,
    apiKey: process.env.REWRITE_PROVIDER_API_KEY,
    endpoint: process.env.REWRITE_PROVIDER_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions',
    timeoutMs: Number(process.env.REWRITE_PROVIDER_TIMEOUT_MS ?? 15000),
  };
}
