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

function decideSemanticState(context: ContextInventory): DecisionState['semanticState'] {
  if (context.contradictions.present) {
    return 'weak';
  }

  const { taskClass } = context.taskShape;
  if (!context.boundedness.isBounded) {
    return 'weak';
  }

  if (taskClass === 'implementation') {
    const strongEnoughForLowImprovement =
      context.executionContext.present &&
      context.ioContext.successFailure.length > 0 &&
      context.validationContext.present &&
      context.boundaryContext.present;
    return strongEnoughForLowImprovement ? 'strong' : 'usable';
  }

  if (taskClass === 'comparison') {
    const strongEnoughForLowImprovement =
      context.comparisonContext.objects.length > 0 &&
      context.comparisonContext.tradeoffFrame &&
      (context.audienceContext.present || context.contextBlock.relevant) &&
      (context.exampleContext.present || context.decisionContext.criteria.length > 0) &&
      context.boundaryContext.groundedFraming.length > 0;
    return strongEnoughForLowImprovement ? 'strong' : 'usable';
  }

  if (taskClass === 'analysis') {
    const strongEnoughForLowImprovement =
      context.analysisContext.present &&
      (context.audienceContext.present || context.contextBlock.relevant) &&
      context.analysisContext.criteria.length > 0 &&
      (context.boundaryContext.present || context.boundaryContext.groundedFraming.length > 0);
    return strongEnoughForLowImprovement ? 'strong' : 'usable';
  }

  if (taskClass === 'decision_support') {
    const strongEnoughForLowImprovement =
      context.decisionContext.present &&
      (context.exampleContext.present || context.contextBlock.relevant) &&
      (context.decisionContext.criteria.length > 0 || context.comparisonContext.tradeoffFrame) &&
      (context.boundaryContext.present || context.boundaryContext.groundedFraming.length > 0);
    return strongEnoughForLowImprovement ? 'strong' : 'usable';
  }

  if (taskClass === 'context_first') {
    const strongEnoughForLowImprovement =
      context.taskShape.outputRequestPresent &&
      context.contextBlock.relevant &&
      (context.decisionContext.criteria.length > 0 || context.comparisonContext.axes.length > 0 || context.audienceContext.present);
    return strongEnoughForLowImprovement ? 'strong' : 'usable';
  }

  if (taskClass === 'few_shot') {
    const strongEnoughForLowImprovement =
      context.exampleContext.present &&
      context.taskShape.outputRequestPresent &&
      context.exampleContext.transferInstruction &&
      (context.exampleContext.styleReference || context.exampleContext.formatReference) &&
      (context.boundaryContext.present || context.boundaryContext.groundedFraming.length > 0);
    return strongEnoughForLowImprovement ? 'strong' : 'usable';
  }

  return 'weak';
}

function decideRewriteRisk(context: ContextInventory, semanticState: DecisionState['semanticState']): DecisionState['rewriteRisk'] {
  if (semanticState === 'weak') {
    return 'low';
  }

  if (context.taskShape.taskClass === 'few_shot') {
    return semanticState === 'strong' ? 'high' : 'medium';
  }

  if (context.taskShape.taskClass === 'context_first') {
    return semanticState === 'strong' ? 'medium' : 'low';
  }

  if (context.taskShape.taskClass === 'analysis') {
    return semanticState === 'strong' ? 'medium' : 'low';
  }

  return semanticState === 'strong' ? 'medium' : 'low';
}

export function buildDecisionState(context: ContextInventory, rewritePreference: RewritePreference): DecisionState {
  const semanticState = decideSemanticState(context);
  const expectedImprovement: DecisionState['expectedImprovement'] =
    semanticState === 'strong' ? 'low' : semanticState === 'usable' ? 'medium' : 'high';
  const majorBlockingIssues = semanticState === 'weak';
  const missingContextType = semanticState === 'weak' ? 'constraints_missing' : null;
  const rewriteRisk = decideRewriteRisk(context, semanticState);

  let rewriteRecommendation: DecisionState['rewriteRecommendation'];
  if (rewritePreference === 'force') {
    rewriteRecommendation = semanticState === 'weak' ? 'rewrite_recommended' : 'rewrite_optional';
  } else if (semanticState === 'strong' && expectedImprovement === 'low') {
    rewriteRecommendation = 'no_rewrite_needed';
  } else if (semanticState === 'usable' && !majorBlockingIssues) {
    rewriteRecommendation = 'rewrite_optional';
  } else if (context.taskShape.taskClass === 'few_shot' && context.exampleContext.present) {
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
