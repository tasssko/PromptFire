import type { Role } from '@promptfire/shared';
import { extractSemanticTags, type SemanticTag, type SemanticTagExtraction, type TaskClass } from './extractTags';

export interface ContextInventory {
  taskShape: {
    taskClass: TaskClass;
    outputRequestPresent: boolean;
  };
  deliverable: {
    handlerLike: boolean;
    codeLike: boolean;
  };
  executionContext: {
    present: boolean;
    runtime: string[];
    framework: string[];
    language: string[];
  };
  ioContext: {
    present: boolean;
    input: string[];
    successFailure: string[];
  };
  validationContext: {
    present: boolean;
    contractSignals: string[];
  };
  boundaryContext: {
    present: boolean;
    exclusions: string[];
    groundedFraming: string[];
  };
  operationalContext: {
    present: boolean;
    logging: boolean;
    retryOrIdempotency: boolean;
  };
  audienceContext: {
    present: boolean;
    audience: string[];
    orgContext: string[];
  };
  comparisonContext: {
    present: boolean;
    objects: string[];
    axes: string[];
    tradeoffFrame: boolean;
  };
  decisionContext: {
    present: boolean;
    decisionObject: string[];
    criteria: string[];
    groundedFraming: string[];
  };
  contextBlock: {
    present: boolean;
    relevant: boolean;
    signals: string[];
  };
  exampleContext: {
    present: boolean;
    examples: string[];
    styleReference: boolean;
    formatReference: boolean;
    transferInstruction: boolean;
  };
  contradictions: {
    present: boolean;
    reasons: string[];
  };
  boundedness: {
    satisfiedGroups: number;
    isBounded: boolean;
    family: TaskClass;
    boundedSignals: string[];
  };
}

export interface SemanticClassification {
  extraction: SemanticTagExtraction;
  inventory: ContextInventory;
}

function hasTag(tags: SemanticTag[], tag: SemanticTag): boolean {
  return tags.includes(tag);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function countPresent(values: boolean[]): number {
  return values.filter(Boolean).length;
}

function boundednessForFamily(taskClass: TaskClass, inventory: Omit<ContextInventory, 'boundedness'>): ContextInventory['boundedness'] {
  const contradictionPresent = inventory.contradictions.present;

  if (taskClass === 'implementation') {
    const executionPresent = inventory.executionContext.present;
    const ioPresent = inventory.ioContext.present;
    const validationPresent = inventory.validationContext.present;
    const boundaryPresent = inventory.boundaryContext.present;
    const operationalPresent = inventory.operationalContext.present;
    const satisfiedGroups = countPresent([executionPresent, ioPresent, validationPresent, boundaryPresent, operationalPresent]);
    const boundedSignals = unique(
      [
        executionPresent ? 'execution context' : '',
        ioPresent ? 'io behavior' : '',
        validationPresent ? 'validation contract' : '',
        boundaryPresent ? 'boundaries' : '',
        operationalPresent ? 'operational details' : '',
      ].filter(Boolean),
    );

    return {
      satisfiedGroups,
      isBounded:
        inventory.deliverable.handlerLike &&
        inventory.deliverable.codeLike &&
        satisfiedGroups >= 3 &&
        !contradictionPresent,
      family: taskClass,
      boundedSignals,
    };
  }

  if (taskClass === 'comparison') {
    const hasComparisonObject = inventory.comparisonContext.objects.length > 0;
    const secondaryCount = countPresent([
      inventory.comparisonContext.axes.length > 0,
      inventory.audienceContext.present || inventory.contextBlock.relevant,
      inventory.exampleContext.present,
      inventory.boundaryContext.present || inventory.boundaryContext.groundedFraming.length > 0,
    ]);
    const boundedSignals = unique(
      [
        hasComparisonObject ? 'comparison object' : '',
        inventory.comparisonContext.axes.length > 0 ? 'evaluation axes' : '',
        inventory.audienceContext.present || inventory.contextBlock.relevant ? 'scenario context' : '',
        inventory.exampleContext.present ? 'examples' : '',
        inventory.boundaryContext.present || inventory.boundaryContext.groundedFraming.length > 0 ? 'grounded framing' : '',
      ].filter(Boolean),
    );

    return {
      satisfiedGroups: Number(hasComparisonObject) + secondaryCount,
      isBounded: hasComparisonObject && secondaryCount >= 2 && !contradictionPresent,
      family: taskClass,
      boundedSignals,
    };
  }

  if (taskClass === 'decision_support') {
    const hasDecisionObject = inventory.decisionContext.decisionObject.length > 0 || inventory.decisionContext.criteria.length > 0;
    const secondaryCount = countPresent([
      inventory.audienceContext.present || inventory.contextBlock.relevant,
      inventory.exampleContext.present,
      inventory.comparisonContext.axes.length > 0 || inventory.decisionContext.criteria.length > 0,
      inventory.boundaryContext.present || inventory.boundaryContext.groundedFraming.length > 0,
    ]);
    const boundedSignals = unique(
      [
        hasDecisionObject ? 'decision object' : '',
        inventory.audienceContext.present || inventory.contextBlock.relevant ? 'scenario context' : '',
        inventory.exampleContext.present ? 'examples' : '',
        inventory.comparisonContext.axes.length > 0 || inventory.decisionContext.criteria.length > 0 ? 'criteria' : '',
        inventory.boundaryContext.present || inventory.boundaryContext.groundedFraming.length > 0 ? 'grounded framing' : '',
      ].filter(Boolean),
    );

    return {
      satisfiedGroups: Number(hasDecisionObject) + secondaryCount,
      isBounded: hasDecisionObject && secondaryCount >= 2 && !contradictionPresent,
      family: taskClass,
      boundedSignals,
    };
  }

  if (taskClass === 'context_first') {
    const outputRequestPresent = inventory.taskShape.outputRequestPresent;
    const contextRelevant = inventory.contextBlock.relevant;
    const narrowingPresent = inventory.comparisonContext.axes.length > 0 || inventory.decisionContext.criteria.length > 0 || inventory.audienceContext.present;
    const boundedSignals = unique(
      [
        outputRequestPresent ? 'output request' : '',
        contextRelevant ? 'relevant context block' : '',
        narrowingPresent ? 'narrowing signal' : '',
      ].filter(Boolean),
    );

    return {
      satisfiedGroups: countPresent([outputRequestPresent, contextRelevant, narrowingPresent]),
      isBounded: outputRequestPresent && contextRelevant && narrowingPresent && !contradictionPresent,
      family: taskClass,
      boundedSignals,
    };
  }

  if (taskClass === 'few_shot') {
    const examplesPresent = inventory.exampleContext.present;
    const outputRequestPresent = inventory.taskShape.outputRequestPresent;
    const adaptationPresent =
      inventory.exampleContext.transferInstruction || inventory.boundaryContext.present || inventory.boundaryContext.groundedFraming.length > 0;
    const boundedSignals = unique(
      [
        examplesPresent ? 'usable examples' : '',
        outputRequestPresent ? 'target output' : '',
        adaptationPresent ? 'adaptation instruction' : '',
      ].filter(Boolean),
    );

    return {
      satisfiedGroups: countPresent([examplesPresent, outputRequestPresent, adaptationPresent]),
      isBounded: examplesPresent && outputRequestPresent && adaptationPresent && !contradictionPresent,
      family: taskClass,
      boundedSignals,
    };
  }

  return {
    satisfiedGroups: 0,
    isBounded: false,
    family: taskClass,
    boundedSignals: [],
  };
}

export function buildContextInventory(extraction: SemanticTagExtraction): ContextInventory {
  const { evidence, tags, taskClass } = extraction;
  const executionPresent =
    hasTag(tags, 'has_runtime_context') || hasTag(tags, 'has_framework_context') || hasTag(tags, 'has_language_context');
  const ioPresent = hasTag(tags, 'has_input_shape') || hasTag(tags, 'has_output_behavior') || hasTag(tags, 'has_success_failure_behavior');
  const validationPresent = hasTag(tags, 'has_validation_contract');
  const exclusionPresent = hasTag(tags, 'has_boundary_exclusion');
  const groundedPresent = hasTag(tags, 'has_grounding_exclusion');
  const operationalPresent = hasTag(tags, 'has_operational_logging') || hasTag(tags, 'has_operational_retry_or_idempotency');
  const contradictionPresent = hasTag(tags, 'has_internal_contradiction');
  const outputRequestPresent = hasTag(tags, 'has_output_request');
  const audiencePresent = hasTag(tags, 'has_audience') || hasTag(tags, 'has_org_context');
  const comparisonPresent =
    hasTag(tags, 'has_comparison_object') || hasTag(tags, 'has_tradeoff_frame') || hasTag(tags, 'has_decision_criteria');
  const decisionPresent = hasTag(tags, 'has_decision_frame') || hasTag(tags, 'has_decision_criteria') || hasTag(tags, 'has_tradeoff_frame');
  const contextPresent = hasTag(tags, 'has_context_block');
  const examplePresent = hasTag(tags, 'has_examples');

  const baseInventory: Omit<ContextInventory, 'boundedness'> = {
    taskShape: {
      taskClass,
      outputRequestPresent,
    },
    deliverable: {
      handlerLike: hasTag(tags, 'has_handler_deliverable'),
      codeLike: hasTag(tags, 'has_code_deliverable'),
    },
    executionContext: {
      present: executionPresent,
      runtime: evidence.has_runtime_context ?? [],
      framework: evidence.has_framework_context ?? [],
      language: evidence.has_language_context ?? [],
    },
    ioContext: {
      present: ioPresent,
      input: unique([...(evidence.has_input_shape ?? []), ...(evidence.has_output_request ?? [])]),
      successFailure: unique([...(evidence.has_output_behavior ?? []), ...(evidence.has_success_failure_behavior ?? [])]),
    },
    validationContext: {
      present: validationPresent,
      contractSignals: evidence.has_validation_contract ?? [],
    },
    boundaryContext: {
      present: exclusionPresent || groundedPresent,
      exclusions: evidence.has_boundary_exclusion ?? [],
      groundedFraming: evidence.has_grounding_exclusion ?? [],
    },
    operationalContext: {
      present: operationalPresent,
      logging: hasTag(tags, 'has_operational_logging'),
      retryOrIdempotency: hasTag(tags, 'has_operational_retry_or_idempotency'),
    },
    audienceContext: {
      present: audiencePresent,
      audience: evidence.has_audience ?? [],
      orgContext: evidence.has_org_context ?? [],
    },
    comparisonContext: {
      present: comparisonPresent,
      objects: evidence.has_comparison_object ?? [],
      axes: unique([...(evidence.has_decision_criteria ?? []), ...(evidence.has_scenario_context ?? [])]),
      tradeoffFrame: hasTag(tags, 'has_tradeoff_frame'),
    },
    decisionContext: {
      present: decisionPresent,
      decisionObject: evidence.has_decision_frame ?? [],
      criteria: evidence.has_decision_criteria ?? [],
      groundedFraming: evidence.has_grounding_exclusion ?? [],
    },
    contextBlock: {
      present: contextPresent,
      relevant: contextPresent && (outputRequestPresent || audiencePresent || comparisonPresent || decisionPresent),
      signals: evidence.has_context_block ?? [],
    },
    exampleContext: {
      present: examplePresent,
      examples: evidence.has_examples ?? [],
      styleReference: hasTag(tags, 'has_style_reference'),
      formatReference: hasTag(tags, 'has_format_reference'),
      transferInstruction: hasTag(tags, 'has_example_transfer_instruction'),
    },
    contradictions: {
      present: contradictionPresent,
      reasons: evidence.has_internal_contradiction ?? [],
    },
  };

  return {
    ...baseInventory,
    boundedness: boundednessForFamily(taskClass, baseInventory),
  };
}

export function classifySemanticPrompt(prompt: string, role: Role): SemanticClassification {
  const extraction = extractSemanticTags(prompt, role);
  return {
    extraction,
    inventory: buildContextInventory(extraction),
  };
}
