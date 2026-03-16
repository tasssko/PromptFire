import type { Analysis, Issue, Mode, Role, ScoreSet } from '@promptfire/shared';
import type { PatternFit, PromptPattern } from '@promptfire/heuristics';
import type { InferenceMetadata } from './types';

export interface NormalizedInferenceMetadata {
  roleHint: InferenceMetadata['roleHint'];
  canonicalTaskType: string | null;
  canonicalDeliverableType: string | null;
  missingContextType: InferenceMetadata['missingContextType'];
  confidence: number | null;
}

export interface EffectiveAnalysisContext {
  source: 'local' | 'inference';
  role: 'general' | 'developer' | 'marketer';
  canonicalTaskType: string | null;
  canonicalDeliverableType: string | null;
  missingContextType: InferenceMetadata['missingContextType'];
  effectivePatternFit: PatternFit | null;
  metadataConfidence: number | null;
  calibrationPath: string;
}

export interface EffectiveResolution {
  analysis: Analysis;
  context?: Record<string, unknown>;
  patternFit: PatternFit;
  effectiveAnalysisContext: EffectiveAnalysisContext;
  inferenceMetadataApplied: boolean;
  effectiveTaskType: string | null;
  effectiveDeliverableType: string | null;
  effectiveMissingContextType: InferenceMetadata['missingContextType'];
  effectivePatternFit: string;
  effectiveCalibrationPath: string;
  scoringGuardrailsApplied: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeLower(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeInferenceTaskType(taskType: string | null): string | null {
  const normalized = normalizeLower(taskType);
  if (!normalized) {
    return null;
  }

  if (/\b(development|coding|implementation)\b/.test(normalized)) {
    return 'implementation_code';
  }

  return normalized.replace(/\s+/g, '_');
}

export function normalizeInferenceDeliverableType(deliverableType: string | null): string | null {
  const normalized = normalizeLower(deliverableType);
  if (!normalized) {
    return null;
  }

  if (normalized === 'code' || /(webhook|api|handler|function|script|endpoint)/.test(normalized)) {
    return 'code';
  }

  return null;
}

export function normalizeInferenceMetadata(raw: InferenceMetadata | null): NormalizedInferenceMetadata | null {
  if (!raw) {
    return null;
  }

  return {
    roleHint: raw.roleHint,
    canonicalTaskType: normalizeInferenceTaskType(raw.taskType),
    canonicalDeliverableType: normalizeInferenceDeliverableType(raw.deliverableType),
    missingContextType: raw.missingContextType,
    confidence: Number.isFinite(raw.confidence) ? raw.confidence : null,
  };
}

function normalizeIssueText(message: string): string {
  return message.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const next: Issue[] = [];

  for (const issue of issues) {
    const key = `${issue.code}:${normalizeIssueText(issue.message)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(issue);
  }

  return next;
}

function detectTechnicalConstraintAreas(prompt: string, context?: Record<string, unknown>): string[] {
  const areas: string[] = [];
  if (/\b(node\.?js|typescript|javascript|python|go|java|rust|express|fastify|nestjs|runtime|framework)\b/i.test(prompt))
    areas.push('runtime_or_framework');
  if (/\b(get|post|put|patch|delete)\b/i.test(prompt) || /\bmethod\b/i.test(prompt)) areas.push('request_method_restrictions');
  if (/\b(content[- ]?type|json payload|json body|accepts json)\b/i.test(prompt)) areas.push('content_type_restrictions');
  if (/\b(json schema|schema validation|validate|validation|zod|ajv|joi|contract)\b/i.test(prompt))
    areas.push('schema_contract_validation');
  if (/\bstatus code|status codes|200|201|202|204|400|401|403|404|409|422|500\b/i.test(prompt))
    areas.push('status_code_behavior');
  if (/\b(log|logging|logger|error format|error message)\b/i.test(prompt)) areas.push('logging_error_formatting');
  if (/\bmiddleware|setup|bootstrap|listen on|port|server setup|json parsing\b/i.test(prompt))
    areas.push('middleware_setup_requirements');
  if (/\b(gracefully|graceful|without crashing|error handling|exception handling)\b/i.test(prompt))
    areas.push('graceful_error_handling');
  if (/\bavoid|exclude|without|do not|don't\b/i.test(prompt)) areas.push('exclusions');
  if (/\bretry|idempot(?:ent|ency)|backoff|timeout\b/i.test(prompt)) areas.push('retry_idempotency');
  if (Boolean(context?.mustInclude || context?.mustAvoid || context?.systemGoals)) areas.push('explicit_context_constraints');
  return [...new Set(areas)];
}

function shouldUseInferenceAsSource(params: {
  metadata: NormalizedInferenceMetadata | null;
  localPatternFit: PatternFit;
  effectivePatternFit: PatternFit;
  role: Role;
}): boolean {
  if (!params.metadata) {
    return false;
  }
  if (params.localPatternFit.confidence !== 'high') {
    return true;
  }
  if (params.effectivePatternFit.primary !== params.localPatternFit.primary) {
    return true;
  }
  if (
    params.role === 'developer' &&
    params.metadata.canonicalDeliverableType === 'code' &&
    params.metadata.canonicalTaskType === 'implementation_code'
  ) {
    return true;
  }
  return false;
}

function promptRequestsExamples(prompt: string): boolean {
  return /\b(example|examples|demonstration|demonstrate|few-shot|imitate|pattern)\b/i.test(prompt);
}

export function chooseEffectivePatternFit(params: {
  prompt: string;
  role: Role;
  localPatternFit: PatternFit;
  normalizedMetadata: NormalizedInferenceMetadata | null;
}): PatternFit {
  const local = params.localPatternFit;
  const metadata = params.normalizedMetadata;
  if (!metadata) {
    return local;
  }

  const localWeak = local.confidence !== 'high';
  if (!localWeak) {
    return local;
  }

  const isDeveloperCodeImplementation =
    (metadata.roleHint === 'developer' || params.role === 'developer') &&
    metadata.canonicalDeliverableType === 'code' &&
    metadata.canonicalTaskType === 'implementation_code';
  const handlerLanguage = /\b(webhook|handler|route|endpoint|express|api)\b/i.test(params.prompt);
  const explicitExamples = promptRequestsExamples(params.prompt);

  if (isDeveloperCodeImplementation && (!explicitExamples || handlerLanguage)) {
    return {
      ...local,
      primary: 'direct_instruction',
      confidence: metadata.confidence !== null && metadata.confidence >= 0.7 ? 'high' : 'medium',
      reasons: [...local.reasons, 'Effective bridge: bounded developer code prompts default to direct instruction.'].slice(0, 4),
      rejectedPatterns: [
        ...new Set<PromptPattern>([...(local.rejectedPatterns ?? []), ...(local.primary !== 'direct_instruction' ? [local.primary] : [])]),
      ],
    };
  }

  if (local.primary === 'few_shot' && !explicitExamples) {
    return {
      ...local,
      primary: 'direct_instruction',
      confidence: 'medium',
      reasons: [...local.reasons, 'Examples are not explicitly requested, so direct instruction is a better fit.'].slice(0, 4),
    };
  }

  return local;
}

export function buildEffectiveAnalysisContext(params: {
  role: Role;
  localPatternFit: PatternFit;
  effectivePatternFit: PatternFit;
  normalizedMetadata: NormalizedInferenceMetadata | null;
}): EffectiveAnalysisContext {
  const role = params.normalizedMetadata?.roleHint ?? params.role;
  const source = shouldUseInferenceAsSource({
    metadata: params.normalizedMetadata,
    localPatternFit: params.localPatternFit,
    effectivePatternFit: params.effectivePatternFit,
    role,
  })
    ? 'inference'
    : 'local';

  return {
    source,
    role,
    canonicalTaskType: params.normalizedMetadata?.canonicalTaskType ?? null,
    canonicalDeliverableType: params.normalizedMetadata?.canonicalDeliverableType ?? null,
    missingContextType: params.normalizedMetadata?.missingContextType ?? null,
    effectivePatternFit: params.effectivePatternFit,
    metadataConfidence: params.normalizedMetadata?.confidence ?? null,
    calibrationPath: source === 'inference' ? 'inference_context_bridge' : 'local_only',
  };
}

function targetedDeveloperGapIssue(prompt: string): Issue | null {
  const needsSchemaShape =
    /\b(schema|contract|json schema)\b/i.test(prompt) && !/\b(required fields?|properties|field names?|payload example|sample payload)\b/i.test(prompt);
  const needsAuthScope = !/\b(auth|authorization|signature|hmac|token verification)\b/i.test(prompt);
  const needsContractScope = !/\b(request|response)\b/i.test(prompt);
  const needsRetrySemantics = !/\bretry|idempot(?:ent|ency)\b/i.test(prompt);
  const needsConfigBoundary = !/\b(env|environment|config|bootstrap|setup|listen on|port)\b/i.test(prompt);
  const needsTestsOrSamples = !/\b(test|tests|unit test|integration test|sample payload|example payload)\b/i.test(prompt);

  if (needsSchemaShape) {
    return {
      code: 'CONSTRAINTS_MISSING',
      severity: 'low',
      message: 'Define exact schema field names, required properties, and validation error payload shape.',
    };
  }
  if (needsAuthScope) {
    return {
      code: 'CONSTRAINTS_MISSING',
      severity: 'low',
      message: 'Clarify auth or signature verification scope for webhook acceptance.',
    };
  }
  if (needsContractScope) {
    return {
      code: 'CONSTRAINTS_MISSING',
      severity: 'low',
      message: 'Clarify request and response contract boundaries for success and validation failures.',
    };
  }
  if (needsRetrySemantics) {
    return {
      code: 'CONSTRAINTS_MISSING',
      severity: 'low',
      message: 'Define retry and idempotency behavior for repeated webhook deliveries.',
    };
  }
  if (needsConfigBoundary) {
    return {
      code: 'CONSTRAINTS_MISSING',
      severity: 'low',
      message: 'Define environment/config bootstrap boundaries such as parser middleware and port setup.',
    };
  }
  if (needsTestsOrSamples) {
    return {
      code: 'CONSTRAINTS_MISSING',
      severity: 'low',
      message: 'Add tests or sample payload cases to lock down edge-case behavior.',
    };
  }
  return null;
}

export function applyEffectiveScoringGuardrails(params: {
  prompt: string;
  analysis: Analysis;
  context?: Record<string, unknown>;
  effectiveContext: EffectiveAnalysisContext;
}): {
  analysis: Analysis;
  calibrationPath: string;
  scoringGuardrailsApplied: string[];
} {
  const guardrails: string[] = [];
  const boundedDeveloperCode =
    params.effectiveContext.role === 'developer' &&
    params.effectiveContext.canonicalDeliverableType === 'code' &&
    params.effectiveContext.missingContextType === null;
  if (!boundedDeveloperCode) {
    return {
      analysis: {
        ...params.analysis,
        issues: dedupeIssues(params.analysis.issues),
        detectedIssueCodes: [...new Set(params.analysis.issues.map((issue) => issue.code))],
      },
      calibrationPath: params.effectiveContext.calibrationPath,
      scoringGuardrailsApplied: guardrails,
    };
  }

  const technicalAreas = detectTechnicalConstraintAreas(params.prompt, params.context);
  const hasTechnicalConstraints = technicalAreas.length >= 3;

  let filteredIssues = dedupeIssues(params.analysis.issues).filter((issue) => {
    if (
      /\b(runtime|language|framework|execution context)\b/i.test(issue.message) ||
      /\bmissing runtime|missing language|add runtime\b/i.test(issue.message)
    ) {
      guardrails.push('suppressed_stale_runtime_or_execution_finding');
      return false;
    }
    if (hasTechnicalConstraints && issue.code === 'CONSTRAINTS_MISSING') {
      guardrails.push('suppressed_default_constraints_missing_for_bounded_developer_code');
      return false;
    }
    return true;
  });
  const filteredSignals = params.analysis.signals.filter(
    (signal) =>
      !/constraints are missing/i.test(signal) &&
      !/most useful missing context appears to be execution/i.test(signal) &&
      !/most useful missing context appears to be io/i.test(signal),
  );

  if (hasTechnicalConstraints) {
    guardrails.push('credited_technical_constraints');
    guardrails.push('prevented_default_execution_penalty');
    guardrails.push('prevented_default_generic_output_risk_inflation');
  }

  const scores: ScoreSet = {
    ...params.analysis.scores,
    scope: hasTechnicalConstraints ? clamp(Math.max(params.analysis.scores.scope, 5) + 1, 0, 10) : params.analysis.scores.scope,
    constraintQuality: hasTechnicalConstraints
      ? clamp(Math.max(params.analysis.scores.constraintQuality, 5) + Math.min(3, Math.floor(technicalAreas.length / 3) + 1), 0, 10)
      : params.analysis.scores.constraintQuality,
    genericOutputRisk: hasTechnicalConstraints
      ? clamp(Math.min(params.analysis.scores.genericOutputRisk, 5) - 1, 0, 10)
      : params.analysis.scores.genericOutputRisk,
  };

  if (hasTechnicalConstraints && filteredIssues.length === 0) {
    const focusedGapIssue = targetedDeveloperGapIssue(params.prompt);
    if (focusedGapIssue) {
      filteredIssues = [focusedGapIssue];
      guardrails.push('added_targeted_developer_gap_finding');
    }
  }

  filteredIssues = dedupeIssues(filteredIssues);
  const summary =
    filteredIssues.length === 0
      ? 'Prompt quality is acceptable with low generic-output risk.'
      : `Detected ${filteredIssues.length} quality issue(s); add the most relevant missing context and tighten boundaries for better output.`;

  const technicalSignal =
    technicalAreas.length > 0
      ? `Technical constraints detected: ${technicalAreas.slice(0, 6).join(', ')}.`
      : 'No bounded technical constraints detected.';

  return {
    analysis: {
      ...params.analysis,
      scores,
      issues: filteredIssues,
      detectedIssueCodes: [...new Set(filteredIssues.map((issue) => issue.code))],
      signals: [...filteredSignals, technicalSignal, 'Effective analysis context: bounded_developer_code.'].slice(0, 12),
      summary,
    },
    calibrationPath: hasTechnicalConstraints ? 'developer_code_bounded' : 'developer_code_unbounded',
    scoringGuardrailsApplied: [...new Set(guardrails)],
  };
}

export function buildEffectiveResolution(params: {
  prompt: string;
  role: Role;
  mode: Mode;
  context?: Record<string, unknown>;
  analysis: Analysis;
  patternFit: PatternFit;
  metadata: InferenceMetadata | null;
}): EffectiveResolution {
  const normalizedMetadata = normalizeInferenceMetadata(params.metadata);
  const effectivePatternFit = chooseEffectivePatternFit({
    prompt: params.prompt,
    role: params.role,
    localPatternFit: params.patternFit,
    normalizedMetadata,
  });
  const effectiveContext = buildEffectiveAnalysisContext({
    role: params.role,
    localPatternFit: params.patternFit,
    effectivePatternFit,
    normalizedMetadata,
  });

  let effectiveAnalysis: Analysis = {
    ...params.analysis,
    issues: dedupeIssues(params.analysis.issues),
    detectedIssueCodes: [...new Set(params.analysis.issues.map((issue) => issue.code))],
  };
  const calibrated = applyEffectiveScoringGuardrails({
    prompt: params.prompt,
    context: params.context,
    analysis: effectiveAnalysis,
    effectiveContext,
  });
  effectiveAnalysis = calibrated.analysis;
  const metadataApplied =
    params.metadata !== null &&
    (effectiveContext.source === 'inference' ||
      calibrated.scoringGuardrailsApplied.length > 0 ||
      effectivePatternFit.primary !== params.patternFit.primary ||
      normalizedMetadata?.canonicalTaskType !== null ||
      normalizedMetadata?.canonicalDeliverableType !== null ||
      normalizedMetadata?.missingContextType !== null);

  return {
    analysis: effectiveAnalysis,
    context: params.context,
    patternFit: effectivePatternFit,
    effectiveAnalysisContext: {
      ...effectiveContext,
      calibrationPath: calibrated.calibrationPath,
    },
    inferenceMetadataApplied: metadataApplied,
    effectiveTaskType: normalizedMetadata?.canonicalTaskType ?? null,
    effectiveDeliverableType: normalizedMetadata?.canonicalDeliverableType ?? null,
    effectiveMissingContextType: normalizedMetadata?.missingContextType ?? null,
    effectivePatternFit: effectivePatternFit.primary,
    effectiveCalibrationPath: calibrated.calibrationPath,
    scoringGuardrailsApplied: calibrated.scoringGuardrailsApplied,
  };
}
