import type { Analysis, BestNextMove, Issue } from '@promptfire/shared';
import type { DecisionState } from './buildDecision';
import type { ContextInventory } from './buildInventory';

export interface SemanticFindings {
  issues: Issue[];
  signals: string[];
  summary: string;
  bestNextMove: BestNextMove | null;
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildBestNextMove(context: ContextInventory, decision: DecisionState): BestNextMove | null {
  if (decision.semanticState === 'strong') {
    return {
      id: 'define_contract_detail',
      type: 'clarify_output_structure',
      title: 'Define the remaining contract detail',
      rationale:
        'The prompt is already bounded. The next gain is to specify exact schema properties, error payload shape, or auth/idempotency boundaries rather than rewriting the whole request.',
      expectedImpact: 'medium',
      targetScores: ['constraintQuality', 'clarity'],
      methodFit: {
        currentPattern: 'direct_instruction',
        recommendedPattern: 'supply_missing_context',
        confidence: 'medium',
      },
      exampleChange: 'Add the exact schema fields, error response JSON shape, or whether auth/signature handling should stay out of scope.',
    };
  }

  if (context.boundedness.isBounded) {
    return {
      id: 'define_contract_detail',
      type: 'clarify_output_structure',
      title: 'Add the next contract detail',
      rationale:
        'The prompt already has enough technical structure to use. The next improvement is to define the exact schema, error payload shape, or auth/idempotency scope.',
      expectedImpact: 'high',
      targetScores: ['constraintQuality', 'clarity', 'genericOutputRisk'],
      methodFit: {
        currentPattern: 'direct_instruction',
        recommendedPattern: 'supply_missing_context',
        confidence: 'high',
      },
      exampleChange: 'Specify the required payload fields or the exact 400 response payload for validation failures.',
    };
  }

  return {
    id: 'add_contract_and_runtime_detail',
    type: 'clarify_output_structure',
    title: 'Add runtime, contract, and response detail',
    rationale:
      'The handler request is still too open. Add the runtime, payload contract, response behavior, and exclusions so the implementation is bounded.',
    expectedImpact: 'high',
    targetScores: ['scope', 'constraintQuality', 'genericOutputRisk'],
    methodFit: {
      currentPattern: 'direct_instruction',
      recommendedPattern: 'supply_missing_context',
      confidence: 'high',
    },
    exampleChange: 'State the runtime, input shape, validation rule, 200/400 behavior, and what should stay out of scope.',
  };
}

export function deriveFindings(analysis: Analysis, context: ContextInventory, decision: DecisionState): SemanticFindings {
  const issues = analysis.issues.filter((issue) => {
    if (context.boundedness.isBounded && issue.code === 'CONSTRAINTS_MISSING') {
      return false;
    }
    if (
      context.boundedness.isBounded &&
      /\b(runtime|input|validation|failure constraints are missing|too open-ended)\b/i.test(issue.message)
    ) {
      return false;
    }
    return true;
  });

  if (!context.boundedness.isBounded) {
    issues.unshift({
      code: 'CONSTRAINTS_MISSING',
      severity: 'high',
      message: 'Add runtime, request contract, response behavior, or scope boundaries so the handler request is bounded.',
    });
  } else if (decision.semanticState === 'strong') {
    issues.unshift({
      code: 'LOW_EXPECTED_IMPROVEMENT',
      severity: 'low',
      message: 'The prompt is already bounded enough to use safely without a full rewrite.',
    });
  } else {
    issues.unshift({
      code: 'LOW_EXPECTED_IMPROVEMENT',
      severity: 'low',
      message: 'The prompt is usable now; the main improvement is to define one more contract detail.',
    });
  }

  const signals = analysis.signals.filter((signal) => !/\b(runtime|language)\b/i.test(signal) || !context.boundedness.isBounded);
  if (context.boundedness.isBounded) {
    signals.push('Semantic path: bounded prompt detected.');
  }
  if (context.executionContext.present && context.validationContext.present) {
    signals.push('Useful runtime and validation constraints are included.');
  }
  if (decision.semanticState === 'strong') {
    signals.push('Semantic path: validation, response behavior, and exclusions are explicit.');
  }

  const summary =
    decision.semanticState === 'strong'
      ? 'Prompt is well scoped and already bounded enough to use safely without a rewrite.'
      : decision.semanticState === 'usable'
        ? 'Prompt is well scoped enough to use; the next gain is one more contract detail.'
        : 'Prompt is still weakly bounded for an implementation request and needs more contract detail.';

  return {
    issues: dedupeIssues(issues).slice(0, 12),
    signals: [...new Set(signals)].slice(0, 12),
    summary,
    bestNextMove: buildBestNextMove(context, decision),
  };
}
