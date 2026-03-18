import type { ScoreSet } from '@promptfire/shared';
import type { DecisionState } from './buildDecision';
import type { ContextInventory } from './buildInventory';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function projectImplementationScores(next: ScoreSet, context: ContextInventory, decision: DecisionState): void {
  if (context.boundedness.isBounded) {
    next.constraintQuality = Math.max(next.constraintQuality, context.boundedness.satisfiedGroups + 3);
    next.contrast = Math.max(next.contrast, context.boundaryContext.present ? 3 : 2);
    next.genericOutputRisk = Math.min(next.genericOutputRisk, decision.semanticState === 'strong' ? 3 : 4);
    next.tokenWasteRisk = Math.min(next.tokenWasteRisk, 4);
    if (context.executionContext.present && context.ioContext.successFailure.length > 0) {
      next.scope = Math.max(next.scope, 7);
    }
    return;
  }

  if (context.executionContext.present || context.ioContext.present) {
    next.scope = Math.max(next.scope, 5);
    next.constraintQuality = Math.max(next.constraintQuality, 2);
  }
}

function projectPhase2Scores(next: ScoreSet, context: ContextInventory, decision: DecisionState): void {
  const bounded = context.boundedness.isBounded;
  const strong = decision.semanticState === 'strong';
  const hasUsefulCriteria = context.comparisonContext.axes.length > 0 || context.decisionContext.criteria.length > 0;
  const hasUsefulExamples = context.exampleContext.present;
  const hasUsefulContext = context.contextBlock.relevant || context.audienceContext.present;
  const hasGrounding = context.boundaryContext.present || context.boundaryContext.groundedFraming.length > 0;

  if (bounded) {
    next.scope = Math.max(next.scope, strong ? 8 : 7);
    next.constraintQuality = Math.max(next.constraintQuality, strong ? 8 : 7);
    next.contrast = Math.max(next.contrast, hasUsefulCriteria || context.comparisonContext.tradeoffFrame || hasGrounding ? 7 : 6);
    next.genericOutputRisk = Math.min(next.genericOutputRisk, strong ? 3 : 4);
    next.tokenWasteRisk = Math.min(next.tokenWasteRisk, 5);
    if (hasUsefulExamples || hasUsefulContext) {
      next.clarity = Math.max(next.clarity, 7);
    }
    return;
  }

  if (hasUsefulCriteria || hasUsefulExamples || hasUsefulContext) {
    next.scope = Math.max(next.scope, 5);
    next.constraintQuality = Math.max(next.constraintQuality, 5);
    next.contrast = Math.max(next.contrast, 5);
    next.genericOutputRisk = Math.min(next.genericOutputRisk, 6);
  }
}

export function projectScores(scores: ScoreSet, context: ContextInventory, decision: DecisionState): ScoreSet {
  const next = { ...scores };

  if (context.taskShape.taskClass === 'implementation' && context.deliverable.handlerLike && context.deliverable.codeLike) {
    projectImplementationScores(next, context, decision);
  } else if (context.taskShape.taskClass !== 'other') {
    projectPhase2Scores(next, context, decision);
  }

  return {
    scope: clamp(next.scope, 0, 10),
    contrast: clamp(next.contrast, 0, 10),
    clarity: clamp(next.clarity, 0, 10),
    constraintQuality: clamp(next.constraintQuality, 0, 10),
    genericOutputRisk: clamp(next.genericOutputRisk, 0, 10),
    tokenWasteRisk: clamp(next.tokenWasteRisk, 0, 10),
  };
}
