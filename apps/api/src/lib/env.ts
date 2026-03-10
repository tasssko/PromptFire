import { ProviderModeSchema, type ProviderMode } from '@promptfire/shared';

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function getAuthBypassEnabled(): boolean {
  return readBoolean(process.env.API_AUTH_BYPASS, true);
}

export function getStaticApiKey(): string {
  return process.env.API_STATIC_KEY ?? 'dev-key';
}

export function getProviderMode(): ProviderMode {
  const parsed = ProviderModeSchema.safeParse(process.env.REWRITE_PROVIDER_MODE ?? 'mock');
  return parsed.success ? parsed.data : 'mock';
}
