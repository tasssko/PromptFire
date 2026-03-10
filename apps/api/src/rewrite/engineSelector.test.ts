import { describe, expect, it } from 'vitest';
import { selectRewriteEngine } from './engineSelector';

describe('selectRewriteEngine', () => {
  it('selects mock engine in mock mode', () => {
    const engine = selectRewriteEngine({
      mode: 'mock',
      endpoint: 'https://example.com',
      timeoutMs: 1000,
    });

    expect(engine.constructor.name).toBe('MockRewriteEngine');
  });

  it('selects real engine in real mode', () => {
    const engine = selectRewriteEngine({
      mode: 'real',
      model: 'gpt-4o-mini',
      apiKey: 'key',
      endpoint: 'https://example.com',
      timeoutMs: 1000,
    });

    expect(engine.constructor.name).toBe('RealRewriteEngine');
  });
});
