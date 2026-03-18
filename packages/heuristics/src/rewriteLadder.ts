import type { RewritePreference, RewriteRecommendation } from '@promptfire/shared';

export type RewriteLadderRung = 'poor' | 'weak' | 'good' | 'strong' | 'excellent';

export interface RewriteLadderState {
  current: RewriteLadderRung;
  target: RewriteLadderRung | null;
  next: RewriteLadderRung | null;
  maxSafeTarget: RewriteLadderRung;
  stopReason:
    | 'already_strong'
    | 'already_excellent'
    | 'rewrite_not_recommended'
    | 'force_required_for_further_rewrite'
    | null;
}

export interface RewriteLadderStep {
  from: RewriteLadderRung;
  to: RewriteLadderRung;
  rewrittenPrompt: string;
  explanation: string;
  groundedAdditions: string[];
  rejectedAbstractAdditions: string[];
}

export interface LadderEvaluation {
  claimedStep: { from: RewriteLadderRung; to: RewriteLadderRung };
  accepted: boolean;
  reason:
    | 'grounded_improvement_sufficient'
    | 'insufficient_grounded_improvement'
    | 'rubric_echo_risk'
    | 'intent_drift'
    | 'already_strong'
    | 'no_significant_change';
  groundedImprovementCount: number;
  rubricEchoRisk: 'low' | 'medium' | 'high';
  intentPreservation: 'low' | 'medium' | 'high';
}

const RUNG_ORDER: RewriteLadderRung[] = ['poor', 'weak', 'good', 'strong', 'excellent'];

function nextRung(rung: RewriteLadderRung): RewriteLadderRung | null {
  const index = RUNG_ORDER.indexOf(rung);
  return index >= 0 && index < RUNG_ORDER.length - 1 ? RUNG_ORDER[index + 1] ?? null : null;
}

function rungAtOffset(rung: RewriteLadderRung, offset: number): RewriteLadderRung {
  const index = RUNG_ORDER.indexOf(rung);
  return RUNG_ORDER[Math.min(index + offset, RUNG_ORDER.length - 1)] ?? rung;
}

export function ladderRungFromOverallScore(overallScore: number): RewriteLadderRung {
  if (overallScore <= 34) {
    return 'poor';
  }
  if (overallScore <= 54) {
    return 'weak';
  }
  if (overallScore <= 74) {
    return 'good';
  }
  if (overallScore <= 89) {
    return 'strong';
  }
  return 'excellent';
}

function maxSafeTargetForRung(
  rung: RewriteLadderRung,
  rewritePreference: RewritePreference,
): RewriteLadderRung {
  if (rung === 'poor' || rung === 'weak') {
    return rungAtOffset(rung, 2);
  }
  if (rung === 'strong') {
    return rewritePreference === 'force' ? 'excellent' : 'strong';
  }
  if (rung === 'excellent') {
    return 'excellent';
  }
  return rung;
}

export function deriveRewriteLadderState(input: {
  overallScore: number;
  rewriteRecommendation: RewriteRecommendation;
  rewritePreference: RewritePreference;
  expectedImprovement: 'low' | 'high';
}): RewriteLadderState {
  const current = ladderRungFromOverallScore(input.overallScore);
  const next = nextRung(current);
  const maxSafeTarget = maxSafeTargetForRung(current, input.rewritePreference);

  if (input.rewritePreference === 'suppress') {
    return {
      current,
      target: null,
      next,
      maxSafeTarget,
      stopReason: 'rewrite_not_recommended',
    };
  }

  if (current === 'excellent') {
    if (input.rewritePreference === 'force') {
      return {
        current,
        target: 'excellent',
        next: null,
        maxSafeTarget,
        stopReason: null,
      };
    }

    return {
      current,
      target: null,
      next: null,
      maxSafeTarget,
      stopReason: 'already_excellent',
    };
  }

  if (current === 'strong') {
    if (input.rewritePreference === 'force') {
      return {
        current,
        target: 'excellent',
        next: 'excellent',
        maxSafeTarget,
        stopReason: null,
      };
    }

    return {
      current,
      target: null,
      next,
      maxSafeTarget,
      stopReason:
        input.rewriteRecommendation === 'no_rewrite_needed' || input.expectedImprovement === 'low'
          ? 'already_strong'
          : 'force_required_for_further_rewrite',
    };
  }

  if (input.rewriteRecommendation === 'no_rewrite_needed' && input.expectedImprovement === 'low') {
    return {
      current,
      target: null,
      next,
      maxSafeTarget,
      stopReason: 'rewrite_not_recommended',
    };
  }

  return {
    current,
    target: next,
    next,
    maxSafeTarget,
    stopReason: null,
  };
}

function minimumGroundedImprovements(from: RewriteLadderRung, to: RewriteLadderRung): number {
  if (from === 'poor' && to === 'weak') {
    return 1;
  }
  if (from === 'strong' && to === 'excellent') {
    return 1;
  }
  return 2;
}

export function validateLadderStep(input: {
  from: RewriteLadderRung;
  to: RewriteLadderRung;
  evaluationStatus: 'material_improvement' | 'minor_improvement' | 'no_significant_change' | 'possible_regression' | 'already_strong';
  diagnostics: {
    groundedImprovementCount: number;
    rubricEchoRisk: 'low' | 'medium' | 'high';
    intentPreservation: 'low' | 'medium' | 'high';
    significantChange: boolean;
    deliverableDrift: boolean;
  };
}): LadderEvaluation {
  const result = (accepted: boolean, reason: LadderEvaluation['reason']): LadderEvaluation => ({
    claimedStep: { from: input.from, to: input.to },
    accepted,
    reason,
    groundedImprovementCount: input.diagnostics.groundedImprovementCount,
    rubricEchoRisk: input.diagnostics.rubricEchoRisk,
    intentPreservation: input.diagnostics.intentPreservation,
  });

  if (input.diagnostics.deliverableDrift || input.diagnostics.intentPreservation === 'low') {
    return result(false, 'intent_drift');
  }

  if (input.diagnostics.rubricEchoRisk === 'high') {
    return result(false, 'rubric_echo_risk');
  }

  if ((input.from === 'strong' || input.from === 'excellent') && input.evaluationStatus === 'already_strong') {
    return result(false, 'already_strong');
  }

  if (!input.diagnostics.significantChange) {
    return result(false, input.from === 'strong' || input.from === 'excellent' ? 'already_strong' : 'no_significant_change');
  }

  if (input.diagnostics.groundedImprovementCount < minimumGroundedImprovements(input.from, input.to)) {
    if (input.from === 'strong' || input.from === 'excellent') {
      return result(false, 'already_strong');
    }
    return {
      claimedStep: { from: input.from, to: input.to },
      accepted: false,
      reason: 'insufficient_grounded_improvement',
      groundedImprovementCount: input.diagnostics.groundedImprovementCount,
      rubricEchoRisk: input.diagnostics.rubricEchoRisk,
      intentPreservation: input.diagnostics.intentPreservation,
    };
  }

  return result(true, 'grounded_improvement_sufficient');
}

export const evaluateLadderStep = validateLadderStep;
