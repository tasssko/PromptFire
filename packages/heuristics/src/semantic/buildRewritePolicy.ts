import type { TaskClass } from './extractTags';
import type { DecisionState } from './buildDecision';
import type { ContextInventory } from './buildInventory';
import { selectPrimaryGap, type PrimaryGap } from './selectPrimaryGap';

export interface SemanticRewritePolicy {
  semanticOwned: boolean;
  allowedPresentationModes: Array<'suppressed' | 'full_rewrite' | 'template_with_example' | 'questions_only'>;
  primaryGap: PrimaryGap;
  family: TaskClass;
  semanticState: DecisionState['semanticState'];
  rewriteRecommendation: DecisionState['rewriteRecommendation'];
  rewriteRisk: DecisionState['rewriteRisk'];
}

function allowedPresentationModes(decision: DecisionState): SemanticRewritePolicy['allowedPresentationModes'] {
  if (decision.rewriteRecommendation === 'no_rewrite_needed') {
    return ['suppressed'];
  }

  if (decision.rewriteRecommendation === 'rewrite_optional') {
    return ['suppressed', 'template_with_example', 'questions_only'];
  }

  return ['full_rewrite', 'template_with_example', 'questions_only'];
}

export function buildRewritePolicy(context: ContextInventory, decision: DecisionState): SemanticRewritePolicy {
  return {
    semanticOwned: context.taskShape.taskClass !== 'other',
    allowedPresentationModes: allowedPresentationModes(decision),
    primaryGap: selectPrimaryGap(context, decision),
    family: context.taskShape.taskClass,
    semanticState: decision.semanticState,
    rewriteRecommendation: decision.rewriteRecommendation,
    rewriteRisk: decision.rewriteRisk,
  };
}
