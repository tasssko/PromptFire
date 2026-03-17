import type { Role } from '@promptfire/shared';
import { extractSemanticTags, type SemanticTag, type SemanticTagExtraction } from './extractTags';

export interface ContextInventory {
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
  };
  operationalContext: {
    present: boolean;
    logging: boolean;
    retryOrIdempotency: boolean;
  };
  contradictions: {
    present: boolean;
    reasons: string[];
  };
  boundedness: {
    satisfiedGroups: number;
    isBounded: boolean;
  };
}

export interface SemanticClassification {
  extraction: SemanticTagExtraction;
  inventory: ContextInventory;
}

function hasTag(tags: SemanticTag[], tag: SemanticTag): boolean {
  return tags.includes(tag);
}

export function buildContextInventory(extraction: SemanticTagExtraction): ContextInventory {
  const { evidence, tags } = extraction;
  const executionPresent =
    hasTag(tags, 'has_runtime_context') || hasTag(tags, 'has_framework_context') || hasTag(tags, 'has_language_context');
  const ioPresent = hasTag(tags, 'has_input_shape') || hasTag(tags, 'has_output_behavior') || hasTag(tags, 'has_success_failure_behavior');
  const validationPresent = hasTag(tags, 'has_validation_contract');
  const boundaryPresent = hasTag(tags, 'has_boundary_exclusion');
  const operationalPresent = hasTag(tags, 'has_operational_logging') || hasTag(tags, 'has_operational_retry_or_idempotency');
  const contradictionPresent = hasTag(tags, 'has_internal_contradiction');

  const satisfiedGroups = [executionPresent, ioPresent, validationPresent, boundaryPresent, operationalPresent].filter(Boolean).length;
  const handlerLike = hasTag(tags, 'has_handler_deliverable');
  const codeLike = hasTag(tags, 'has_code_deliverable');

  return {
    deliverable: {
      handlerLike,
      codeLike,
    },
    executionContext: {
      present: executionPresent,
      runtime: evidence.has_runtime_context ?? [],
      framework: evidence.has_framework_context ?? [],
      language: evidence.has_language_context ?? [],
    },
    ioContext: {
      present: ioPresent,
      input: evidence.has_input_shape ?? [],
      successFailure: [...(evidence.has_output_behavior ?? []), ...(evidence.has_success_failure_behavior ?? [])],
    },
    validationContext: {
      present: validationPresent,
      contractSignals: evidence.has_validation_contract ?? [],
    },
    boundaryContext: {
      present: boundaryPresent,
      exclusions: evidence.has_boundary_exclusion ?? [],
    },
    operationalContext: {
      present: operationalPresent,
      logging: hasTag(tags, 'has_operational_logging'),
      retryOrIdempotency: hasTag(tags, 'has_operational_retry_or_idempotency'),
    },
    contradictions: {
      present: contradictionPresent,
      reasons: evidence.has_internal_contradiction ?? [],
    },
    boundedness: {
      satisfiedGroups,
      isBounded: handlerLike && codeLike && satisfiedGroups >= 3 && !contradictionPresent,
    },
  };
}

export function classifySemanticPrompt(prompt: string, role: Role): SemanticClassification {
  const extraction = extractSemanticTags(prompt, role);
  return {
    extraction,
    inventory: buildContextInventory(extraction),
  };
}
