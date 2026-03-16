import type { BestNextMove } from '@promptfire/shared';
import { generateBestNextMoveFromCandidates, generateOpportunityCandidates, type OpportunityParams } from './opportunityEngine';

export function generateBestNextMove(params: OpportunityParams): BestNextMove | null {
  return generateBestNextMoveFromCandidates(params.scoreBand, params.rewriteRecommendation, generateOpportunityCandidates(params));
}
