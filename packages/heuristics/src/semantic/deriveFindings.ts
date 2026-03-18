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

function familyGapMessage(context: ContextInventory): string {
  switch (context.taskShape.taskClass) {
    case 'analysis':
      return 'Add the analysis lens, one specific scenario, or one grounded boundary so the diagnostic findings stay specific.';
    case 'comparison':
      return 'Add explicit comparison criteria, scenario context, or one specific case so the trade-off stays grounded.';
    case 'decision_support':
      return 'Add decision criteria, one specific scenario, or one grounded example so the recommendation is less generic.';
    case 'context_first':
      return 'Clarify the requested deliverable and tie the supplied context to the decision criteria the output should use.';
    case 'few_shot':
      return 'Clarify what the examples should preserve, what should change, and the target output shape.';
    case 'implementation':
    default: {
      const missing: string[] = [];
      if (!context.executionContext.present) {
        missing.push('runtime');
      }
      if (!context.validationContext.present) {
        missing.push('request contract');
      }
      if (!context.ioContext.present || context.ioContext.successFailure.length === 0) {
        missing.push('response behavior');
      }
      if (!context.boundaryContext.present) {
        missing.push('scope boundaries');
      }

      const missingSummary = missing.length > 0 ? missing.join(', ') : 'implementation detail';
      return `Add ${missingSummary} so the handler request is bounded.`;
    }
  }
}

function familySummary(context: ContextInventory, decision: DecisionState): string {
  if (decision.semanticState === 'strong') {
    switch (context.taskShape.taskClass) {
      case 'analysis':
        return 'Prompt already frames a clear analysis target with enough diagnostic criteria and context to use safely without a rewrite.';
      case 'comparison':
        return 'Prompt already frames the comparison with enough context and trade-off guidance to use safely without a rewrite.';
      case 'decision_support':
        return 'Prompt already gives a strong decision frame with grounded criteria or examples, so a rewrite is optional at most.';
      case 'context_first':
        return 'Prompt already supplies relevant context and a clear task, so the core value is present without a rewrite.';
      case 'few_shot':
        return 'Prompt already uses examples and transfer instructions clearly enough that rewriting would add limited value.';
      case 'implementation':
      default:
        return 'Prompt is well scoped and already bounded enough to use safely without a rewrite.';
    }
  }

  if (decision.semanticState === 'usable') {
    switch (context.taskShape.taskClass) {
      case 'analysis':
        return 'Prompt is usable now; the next gain is one sharper analysis lens, scenario, or grounded boundary.';
      case 'comparison':
        return 'Prompt is usable now; the next gain is sharper criteria, scenario context, or one specific comparison case.';
      case 'decision_support':
        return 'Prompt is usable now; the next gain is one stronger criterion, example, or grounded boundary.';
      case 'context_first':
        return 'Prompt is usable now; the next gain is clarifying which part of the context should drive the answer.';
      case 'few_shot':
        return 'Prompt is usable now; the next gain is clarifying what to preserve from the examples and what to adapt.';
      case 'implementation':
      default:
        return 'Prompt is well scoped enough to use; the next gain is one more contract detail.';
    }
  }

  switch (context.taskShape.taskClass) {
    case 'analysis':
      return 'Prompt asks for diagnosis, but it still lacks enough analysis criteria, scenario context, or grounded boundaries to keep the findings specific.';
    case 'comparison':
      return 'Prompt names a comparison, but it still lacks enough evaluation frame or scenario context to avoid generic trade-off output.';
    case 'decision_support':
      return 'Prompt asks for judgment, but it still lacks enough criteria, context, or grounded framing to guide the decision.';
    case 'context_first':
      return 'Prompt includes context, but it still does not connect that context clearly enough to the requested output.';
    case 'few_shot':
      return 'Prompt includes examples, but it still does not define clearly enough what the new output should preserve or change.';
    case 'implementation':
    default:
      return 'Prompt is still weakly bounded for an implementation request and needs more contract detail.';
  }
}

function buildBestNextMove(context: ContextInventory, decision: DecisionState): BestNextMove | null {
  if (decision.semanticState === 'strong' && decision.rewriteRecommendation === 'no_rewrite_needed') {
    return null;
  }

  switch (context.taskShape.taskClass) {
    case 'analysis':
      return {
        id: 'add_analysis_criteria',
        type: 'add_analysis_criteria',
        title: decision.semanticState === 'weak' ? 'Add an analysis lens and one scenario' : 'Sharpen the diagnostic criteria',
        rationale:
          'The next gain is to state what the analysis should examine and under which specific scenario, so the output diagnoses the right causes instead of drifting into generic advice.',
        expectedImpact: 'high',
        targetScores: ['contrast', 'constraintQuality', 'genericOutputRisk'],
        methodFit: {
          currentPattern: 'stepwise_reasoning',
          recommendedPattern: 'break_into_steps',
          confidence: 'medium',
        },
        exampleChange: 'Name the failure modes, bottlenecks, or risks to analyze, plus one specific scenario or boundary.',
      };
    case 'comparison':
      return {
        id: 'add_decision_criteria',
        type: 'add_decision_criteria',
        title: decision.semanticState === 'weak' ? 'Add comparison criteria and trade-offs' : 'Sharpen the comparison criteria',
        rationale:
          'The biggest gain is to make the evaluation frame explicit so the output compares the options against the right trade-offs instead of drifting into broad summary.',
        expectedImpact: 'high',
        targetScores: ['contrast', 'constraintQuality', 'genericOutputRisk'],
        methodFit: {
          currentPattern: 'stepwise_reasoning',
          recommendedPattern: 'break_into_steps',
          confidence: 'high',
        },
        exampleChange: 'List the criteria, trade-offs, or cases the comparison must use.',
      };
    case 'decision_support':
      return {
        id: 'add_decision_criteria',
        type: 'add_decision_criteria',
        title: decision.semanticState === 'weak' ? 'Add decision criteria and one scenario' : 'Add one stronger decision criterion',
        rationale:
          'The next gain is to tell the model what should drive the judgment, ideally with one specific scenario or case so the recommendation stays grounded.',
        expectedImpact: 'high',
        targetScores: ['contrast', 'constraintQuality', 'genericOutputRisk'],
        methodFit: {
          currentPattern: 'stepwise_reasoning',
          recommendedPattern: 'break_into_steps',
          confidence: 'medium',
        },
        exampleChange: 'Name the criteria, one scenario, or one example that should guide the decision.',
      };
    case 'context_first':
      return {
        id: 'clarify_output_structure',
        type: 'clarify_output_structure',
        title: decision.semanticState === 'weak' ? 'Clarify the requested deliverable' : 'Clarify how the context should drive the answer',
        rationale:
          'The prompt already carries context, so the next gain is to specify the decision output or the evaluation frame rather than rewriting the whole request.',
        expectedImpact: 'high',
        targetScores: ['scope', 'constraintQuality', 'clarity'],
        methodFit: {
          currentPattern: 'context_first',
          recommendedPattern: 'supply_missing_context',
          confidence: 'medium',
        },
        exampleChange: 'State the exact recommendation format, verdict shape, or criteria the supplied context should drive.',
      };
    case 'few_shot':
      return {
        id: 'require_examples',
        type: 'require_examples',
        title: decision.semanticState === 'weak' ? 'Clarify how the examples should be used' : 'Clarify what to preserve from the examples',
        rationale:
          'The prompt already leans on examples, so the next gain is to define what the examples control and what should change in the new output.',
        expectedImpact: 'high',
        targetScores: ['clarity', 'constraintQuality', 'genericOutputRisk'],
        methodFit: {
          currentPattern: 'few_shot',
          recommendedPattern: 'add_examples',
          confidence: 'high',
        },
        exampleChange: 'State what to preserve from the examples, what to adapt, and the target output shape.',
      };
    case 'implementation':
    default:
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
}

export function deriveFindings(analysis: Analysis, context: ContextInventory, decision: DecisionState): SemanticFindings {
  const issues = analysis.issues.filter((issue) => {
    if (
      context.taskShape.taskClass === 'implementation' &&
      context.executionContext.present &&
      /\b(runtime|language)\b/i.test(issue.message)
    ) {
      return false;
    }

    if (!context.boundedness.isBounded) {
      return true;
    }

    if (issue.code === 'CONSTRAINTS_MISSING') {
      return false;
    }

    if (
      /\b(runtime|input|validation|failure constraints are missing|too open-ended|needs more detail)\b/i.test(issue.message) &&
      context.taskShape.taskClass !== 'implementation'
    ) {
      return false;
    }

    return true;
  });

  if (!context.boundedness.isBounded) {
    issues.unshift({
      code: 'CONSTRAINTS_MISSING',
      severity: 'high',
      message: familyGapMessage(context),
    });
  } else {
    issues.unshift({
      code: 'LOW_EXPECTED_IMPROVEMENT',
      severity: 'low',
      message: familyGapMessage(context),
    });
  }

  const signals = analysis.signals.filter((signal) => {
    if (context.taskShape.taskClass !== 'implementation') {
      return !/\b(runtime|language)\b/i.test(signal);
    }
    return true;
  });

  if (context.boundedness.isBounded) {
    signals.push(`Semantic path: bounded ${context.taskShape.taskClass.replace('_', ' ')} prompt detected.`);
  }
  if (context.comparisonContext.tradeoffFrame) {
    signals.push('Useful trade-off framing is already present.');
  }
  if (context.analysisContext.present) {
    signals.push('Diagnostic analysis framing is already present.');
  }
  if (context.contextBlock.relevant) {
    signals.push('Relevant situational context is already present.');
  }
  if (context.exampleContext.transferInstruction) {
    signals.push('Examples are linked to the target behavior through transfer instructions.');
  }
  if (context.boundaryContext.groundedFraming.length > 0) {
    signals.push('Grounded framing reduces generic-output risk.');
  }

  return {
    issues: dedupeIssues(issues).slice(0, 12),
    signals: uniqueSignals(signals).slice(0, 12),
    summary: familySummary(context, decision),
    bestNextMove: buildBestNextMove(context, decision),
  };
}

function uniqueSignals(signals: string[]): string[] {
  return [...new Set(signals)];
}
