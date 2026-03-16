import type { Analysis, Mode, Role } from '@promptfire/shared';
import { detectCurrentPattern, detectPatternFit, type PatternFit, type PromptPattern } from '@promptfire/heuristics';
import type { InferenceMetadata } from './types';

export type InferenceTriggerReason = 'no_local_pattern' | 'low_local_confidence' | 'contradictory_local_signals';

export type InferenceTrigger = {
  shouldInfer: boolean;
  reasons: InferenceTriggerReason[];
};

function normalizePromptPattern(value: string | null): PromptPattern | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes('context')) return 'context_first';
  if (normalized.includes('decom') || normalized.includes('stages')) return 'decomposition';
  if (normalized.includes('rubric') || normalized.includes('decision') || normalized.includes('evaluation')) return 'decision_rubric';
  if (normalized.includes('step') || normalized.includes('reason') || normalized.includes('comparison')) return 'stepwise_reasoning';
  if (normalized.includes('few') || normalized.includes('example') || normalized.includes('style')) return 'few_shot';
  if (normalized.includes('direct')) return 'direct_instruction';
  return null;
}

function hasContradictorySignals(patternFit: PatternFit): boolean {
  return patternFit.confidence !== 'high' && (patternFit.rejectedPatterns?.length ?? 0) >= 2;
}

export function evaluateInferenceTrigger(params: {
  prompt: string;
  role: Role;
  mode: Mode;
  analysis: Analysis;
  context?: Record<string, unknown>;
  patternFit: PatternFit;
}): InferenceTrigger {
  if (params.patternFit.confidence === 'high') {
    return {
      shouldInfer: false,
      reasons: [],
    };
  }

  const reasons: InferenceTriggerReason[] = [];
  const currentPattern = detectCurrentPattern({
    prompt: params.prompt,
    role: params.role,
    mode: params.mode,
    analysis: params.analysis,
    context: params.context,
  });

  if (!currentPattern) {
    reasons.push('no_local_pattern');
  }

  if (params.patternFit.confidence === 'low') {
    reasons.push('low_local_confidence');
  }

  if (hasContradictorySignals(params.patternFit)) {
    reasons.push('contradictory_local_signals');
  }

  return {
    shouldInfer: reasons.length > 0,
    reasons,
  };
}

export function mergeContextWithInference(
  context: Record<string, unknown> | undefined,
  metadata: InferenceMetadata,
): Record<string, unknown> | undefined {
  const nextContext: Record<string, unknown> = { ...(context ?? {}) };

  if (metadata.missingContextType === 'audience') {
    nextContext.audienceHint = nextContext.audienceHint ?? 'inferred';
  }

  if (metadata.missingContextType === 'execution') {
    nextContext.systemGoals = nextContext.systemGoals ?? ['runtime_constraints'];
  }

  if (metadata.missingContextType === 'io') {
    nextContext.mustInclude = nextContext.mustInclude ?? ['input_output_contract'];
  }

  if (metadata.missingContextType === 'boundary') {
    nextContext.mustAvoid = nextContext.mustAvoid ?? ['out_of_scope_expansion'];
  }

  if (metadata.lookupKeys.length > 0) {
    nextContext.inferenceLookupKeys = metadata.lookupKeys;
  }

  if (metadata.taskType) {
    nextContext.inferredTaskType = metadata.taskType;
  }

  if (metadata.deliverableType) {
    nextContext.inferredDeliverableType = metadata.deliverableType;
  }

  if (metadata.notes) {
    nextContext.inferenceNotes = metadata.notes;
  }

  return Object.keys(nextContext).length > 0 ? nextContext : context;
}

export function resolvePatternFitWithInference(params: {
  prompt: string;
  role: Role;
  mode: Mode;
  analysis: Analysis;
  context?: Record<string, unknown>;
  localPatternFit: PatternFit;
  metadata: InferenceMetadata;
}): {
  resolvedPatternFit: PatternFit;
  usedInference: boolean;
} {
  const inferredPattern = normalizePromptPattern(params.metadata.promptPattern);

  if (!inferredPattern) {
    return {
      resolvedPatternFit: params.localPatternFit,
      usedInference: false,
    };
  }

  if (params.localPatternFit.confidence === 'high') {
    return {
      resolvedPatternFit: params.localPatternFit,
      usedInference: false,
    };
  }

  const inferredPatternFit = detectPatternFit({
    prompt: params.prompt,
    role: params.role,
    mode: params.mode,
    analysis: params.analysis,
    context: params.context,
  });

  return {
    resolvedPatternFit:
      inferredPatternFit.primary === inferredPattern
        ? inferredPatternFit
        : {
            ...inferredPatternFit,
            primary: inferredPattern,
            confidence: params.metadata.confidence >= 0.7 ? 'high' : 'medium',
            reasons: [...inferredPatternFit.reasons, 'Resolved with inferred metadata.'].slice(0, 4),
          },
    usedInference: true,
  };
}
