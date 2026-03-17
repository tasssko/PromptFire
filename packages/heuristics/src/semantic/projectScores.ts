import type { ScoreSet } from '@promptfire/shared';
import type { DecisionState } from './buildDecision';
import type { ContextInventory } from './buildInventory';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function projectScores(scores: ScoreSet, context: ContextInventory, decision: DecisionState): ScoreSet {
  if (!context.deliverable.handlerLike || !context.deliverable.codeLike) {
    return scores;
  }

  const next = { ...scores };
  if (context.boundedness.isBounded) {
    next.constraintQuality = Math.max(next.constraintQuality, context.boundedness.satisfiedGroups + 3);
    next.contrast = Math.max(next.contrast, context.boundaryContext.present ? 3 : 2);
    next.genericOutputRisk = Math.min(next.genericOutputRisk, decision.semanticState === 'strong' ? 3 : 4);
    next.tokenWasteRisk = Math.min(next.tokenWasteRisk, 4);
    if (context.executionContext.present && context.ioContext.successFailure.length > 0) {
      next.scope = Math.max(next.scope, 7);
    }
  } else if (context.executionContext.present || context.ioContext.present) {
    next.scope = Math.max(next.scope, 5);
    next.constraintQuality = Math.max(next.constraintQuality, 2);
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
