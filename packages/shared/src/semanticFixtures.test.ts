import { describe, expect, it } from 'vitest';
import { semanticBoundaryFixtures, semanticConsistencyCases, semanticEquivalenceFamilies, semanticFindingCases } from './semanticFixtures';
import { semanticEvalFixtures } from './semanticEvalFixtures';

describe('semantic fixtures', () => {
  it('keeps at least one consistency fixture per covered family', () => {
    expect(new Set(semanticConsistencyCases.map((fixture) => fixture.family))).toEqual(
      new Set(['analysis', 'comparison', 'decision_support', 'context_first', 'few_shot']),
    );
  });

  it('keeps at least one finding fixture per covered family', () => {
    expect(new Set(semanticFindingCases.map((fixture) => fixture.family))).toEqual(
      new Set(['analysis', 'comparison', 'decision_support', 'context_first', 'few_shot']),
    );
  });

  it('keeps three semantic-equivalence variants per family', () => {
    for (const family of semanticEquivalenceFamilies) {
      expect(family.variants).toHaveLength(3);
    }
  });

  it('keeps one shared boundary fixture per family including implementation', () => {
    expect(new Set(semanticBoundaryFixtures.map((fixture) => fixture.family))).toEqual(
      new Set(['analysis', 'comparison', 'decision_support', 'context_first', 'few_shot', 'implementation']),
    );
  });

  it('keeps a compact semantic eval suite across covered families', () => {
    expect(semanticEvalFixtures.length).toBeGreaterThanOrEqual(20);
    expect(semanticEvalFixtures.length).toBeLessThanOrEqual(35);
    expect(new Set(semanticEvalFixtures.map((fixture) => fixture.family))).toEqual(
      new Set(['analysis', 'comparison', 'decision_support', 'context_first', 'few_shot', 'implementation']),
    );
  });
});
