import type { ImprovementSuggestion } from '@promptfire/shared';
import {
  generateImprovementSuggestionsFromCandidates,
  generateOpportunityCandidates,
  type OpportunityParams,
} from './opportunityEngine';

export function generateImprovementSuggestions(params: OpportunityParams): ImprovementSuggestion[] {
  return generateImprovementSuggestionsFromCandidates(
    params.analysis,
    params.scoreBand,
    generateOpportunityCandidates(params),
  );
}
