import { describe, expect, it } from 'vitest';
import { semanticParaphraseEvalFamilies } from './semanticParaphraseEvalFixtures';

describe('semanticParaphraseEvalFamilies', () => {
  it('ships five covered semantic families with the expected prompt counts', () => {
    expect(semanticParaphraseEvalFamilies).toHaveLength(5);

    for (const family of semanticParaphraseEvalFamilies) {
      expect(family.strongPositives).toHaveLength(3);
      expect(family.nearMisses).toHaveLength(3);
      expect(family.rationale.length).toBeGreaterThan(20);

      for (const positive of family.strongPositives) {
        expect(positive.paraphrases).toHaveLength(3);
      }
    }
  });
});
