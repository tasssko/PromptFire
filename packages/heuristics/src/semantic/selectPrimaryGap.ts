import type { DecisionState } from './buildDecision';
import type { ContextInventory } from './buildInventory';

export type PrimaryGap =
  | 'criteria'
  | 'boundary'
  | 'execution'
  | 'io'
  | 'audience'
  | 'source'
  | 'context_linkage'
  | 'example_transfer'
  | 'deliverable'
  | 'unknown';

function hasBoundary(context: ContextInventory): boolean {
  return context.boundaryContext.present || context.boundaryContext.groundedFraming.length > 0;
}

function implementationGap(context: ContextInventory): PrimaryGap {
  if (!context.executionContext.present) {
    return 'execution';
  }
  if (!context.ioContext.present || context.ioContext.successFailure.length === 0) {
    return 'io';
  }
  if (!hasBoundary(context)) {
    return 'boundary';
  }
  return 'unknown';
}

function comparisonGap(context: ContextInventory): PrimaryGap {
  if (context.comparisonContext.axes.length === 0) {
    return 'criteria';
  }
  if (!hasBoundary(context)) {
    return 'boundary';
  }
  if (!context.audienceContext.present && !context.contextBlock.relevant) {
    return 'audience';
  }
  return 'unknown';
}

function decisionSupportGap(context: ContextInventory): PrimaryGap {
  if (context.decisionContext.criteria.length === 0 && !context.comparisonContext.tradeoffFrame) {
    return 'criteria';
  }
  if (!hasBoundary(context)) {
    return 'boundary';
  }
  if (!context.audienceContext.present && !context.contextBlock.relevant) {
    return 'audience';
  }
  return 'unknown';
}

function contextFirstGap(context: ContextInventory): PrimaryGap {
  if (!context.contextBlock.relevant) {
    return 'context_linkage';
  }
  if (!context.taskShape.outputRequestPresent) {
    return 'deliverable';
  }
  if (!hasBoundary(context)) {
    return 'boundary';
  }
  return 'unknown';
}

function fewShotGap(context: ContextInventory): PrimaryGap {
  if (!context.exampleContext.transferInstruction) {
    return 'example_transfer';
  }
  if (!context.taskShape.outputRequestPresent) {
    return 'deliverable';
  }
  if (!hasBoundary(context)) {
    return 'boundary';
  }
  return 'unknown';
}

function analysisGap(context: ContextInventory): PrimaryGap {
  if (context.analysisContext.criteria.length === 0) {
    return 'criteria';
  }
  if (!context.contextBlock.relevant && !hasBoundary(context)) {
    return 'source';
  }
  if (!hasBoundary(context)) {
    return 'boundary';
  }
  return 'unknown';
}

export function selectPrimaryGap(context: ContextInventory, _decision: DecisionState): PrimaryGap {
  switch (context.taskShape.taskClass) {
    case 'implementation':
      return implementationGap(context);
    case 'comparison':
      return comparisonGap(context);
    case 'decision_support':
      return decisionSupportGap(context);
    case 'context_first':
      return contextFirstGap(context);
    case 'few_shot':
      return fewShotGap(context);
    case 'analysis':
      return analysisGap(context);
    default:
      return 'unknown';
  }
}
