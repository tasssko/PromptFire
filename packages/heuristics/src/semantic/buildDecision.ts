import type { RewritePreference } from '@promptfire/shared';
import type { ContextInventory } from './buildInventory';

export interface DecisionState {
  semanticState: 'weak' | 'usable' | 'strong';
  missingContextType: 'constraints_missing' | null;
  majorBlockingIssues: boolean;
  expectedImprovement: 'low' | 'medium' | 'high';
  rewriteRisk: 'low' | 'medium' | 'high';
  rewriteRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed';
}

export function buildDecisionState(context: ContextInventory, rewritePreference: RewritePreference): DecisionState {
  const strongEnoughForLowImprovement =
    context.boundedness.isBounded &&
    context.executionContext.present &&
    context.ioContext.successFailure.length > 0 &&
    context.validationContext.present &&
    context.boundaryContext.present;

  const expectedImprovement: DecisionState['expectedImprovement'] = !context.boundedness.isBounded
    ? 'high'
    : strongEnoughForLowImprovement
      ? 'low'
      : 'medium';

  const semanticState: DecisionState['semanticState'] = !context.boundedness.isBounded || context.contradictions.present
    ? 'weak'
    : expectedImprovement === 'low'
      ? 'strong'
      : 'usable';

  const majorBlockingIssues = semanticState === 'weak';
  const missingContextType = context.boundedness.isBounded ? null : 'constraints_missing';

  const rewriteRisk: DecisionState['rewriteRisk'] =
    context.boundedness.isBounded && context.boundaryContext.present && context.ioContext.successFailure.length > 0
      ? 'medium'
      : semanticState === 'weak'
        ? 'low'
        : 'medium';

  let rewriteRecommendation: DecisionState['rewriteRecommendation'];
  if (rewritePreference === 'force') {
    rewriteRecommendation = semanticState === 'weak' ? 'rewrite_recommended' : 'rewrite_optional';
  } else if (semanticState === 'strong' && expectedImprovement === 'low') {
    rewriteRecommendation = 'no_rewrite_needed';
  } else if (semanticState === 'usable' && !majorBlockingIssues) {
    rewriteRecommendation = 'rewrite_optional';
  } else {
    rewriteRecommendation = 'rewrite_recommended';
  }

  return {
    semanticState,
    missingContextType,
    majorBlockingIssues,
    expectedImprovement,
    rewriteRisk,
    rewriteRecommendation,
  };
}
