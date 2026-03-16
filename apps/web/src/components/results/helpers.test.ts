import { describe, expect, it } from 'vitest';
import { methodFitLabel } from './helpers';

describe('methodFitLabel', () => {
  it('renders public method-fit projections as plain language', () => {
    expect(methodFitLabel('break_into_steps')).toBe('break the reasoning into steps');
    expect(methodFitLabel('supply_missing_context')).toBe('supply the missing context');
  });
});
