import { describe, expect, it } from 'vitest';
import { fixtures, modes, roles } from './config';

describe('web config', () => {
  it('exposes expected roles and modes', () => {
    expect(roles).toEqual(['general', 'developer', 'marketer']);
    expect(modes).toEqual(['balanced', 'tight_scope', 'high_contrast', 'low_token_cost']);
  });

  it('ships baseline fixtures', () => {
    expect(fixtures.marketer.length).toBeGreaterThan(10);
    expect(fixtures.developer.length).toBeGreaterThan(10);
  });
});
