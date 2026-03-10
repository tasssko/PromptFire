import { MockRewriteEngine } from './mockRewriteEngine';
import { RealRewriteEngine } from './realRewriteEngine';
import type { ProviderConfig } from './providerConfig';
import type { RewriteEngine } from './types';

export function selectRewriteEngine(config: ProviderConfig, fetchImpl?: typeof fetch): RewriteEngine {
  if (config.mode === 'real') {
    return new RealRewriteEngine(config, fetchImpl);
  }

  return new MockRewriteEngine();
}
