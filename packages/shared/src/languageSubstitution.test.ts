import { describe, expect, it } from 'vitest';
import {
  languageSubstitutionRegistry,
  substitutePreferredLanguage,
} from './languageSubstitution';

describe('language substitution', () => {
  it('registers discouraged default terms', () => {
    expect(languageSubstitutionRegistry.map((entry) => entry.term)).toEqual(expect.arrayContaining(['specific', 'specifically']));
  });

  it('applies intent-aware phrase substitutions', () => {
    expect(substitutePreferredLanguage('Add one specific example.', 'specificity')).toBe('Add one specific example.');
    expect(substitutePreferredLanguage('Use a specific comparison.', 'realism')).toBe('Use a real comparison.');
    expect(substitutePreferredLanguage('Add one specific outcome.', 'measurement')).toBe('Add one measurable outcome.');
  });

  it('does not blindly rewrite unrelated language', () => {
    expect(substitutePreferredLanguage('Keep the output practical and direct.', 'specificity')).toBe(
      'Keep the output practical and direct.',
    );
  });
});
