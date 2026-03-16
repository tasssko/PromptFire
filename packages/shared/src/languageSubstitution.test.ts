import { describe, expect, it } from 'vitest';
import {
  findDiscouragedDefaultLanguage,
  hasDiscouragedDefaultLanguage,
  languageSubstitutionRegistry,
  substitutePreferredLanguage,
} from './languageSubstitution';

describe('language substitution', () => {
  it('registers discouraged default terms', () => {
    expect(languageSubstitutionRegistry.map((entry) => entry.term)).toEqual(expect.arrayContaining(['concrete', 'concretely']));
  });

  it('applies intent-aware phrase substitutions', () => {
    expect(substitutePreferredLanguage('Add one concrete example.', 'specificity')).toBe('Add one specific example.');
    expect(substitutePreferredLanguage('Use a concrete comparison.', 'realism')).toBe('Use a real comparison.');
    expect(substitutePreferredLanguage('Add one concrete outcome.', 'measurement')).toBe('Add one measurable outcome.');
  });

  it('does not blindly rewrite unrelated language', () => {
    expect(substitutePreferredLanguage('Keep the output practical and direct.', 'specificity')).toBe(
      'Keep the output practical and direct.',
    );
  });

  it('detects discouraged default language in visible text', () => {
    expect(findDiscouragedDefaultLanguage('Add one concrete example and concretely explain why.')).toEqual(
      expect.arrayContaining(['concrete', 'concretely']),
    );
    expect(hasDiscouragedDefaultLanguage('Add one specific example.')).toBe(false);
  });
});
