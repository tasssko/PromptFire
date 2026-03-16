import type { Analysis, Issue, Mode, Role, ScoreSet } from '@promptfire/shared';
import type { PatternFit } from '@promptfire/heuristics';
import type { InferenceMetadata } from './types';

export interface EffectiveResolution {
  analysis: Analysis;
  context?: Record<string, unknown>;
  patternFit: PatternFit;
  inferenceMetadataApplied: boolean;
  effectiveTaskType: string | null;
  effectiveDeliverableType: string | null;
  effectiveMissingContextType: InferenceMetadata['missingContextType'];
  effectivePatternFit: string;
  effectiveCalibrationPath: string;
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

  if (/(development|developer|coding|code|implementation|programming|software)/.test(normalized)) {
    return 'development';
  }

  return normalized.replace(/\s+/g, '_');
}

export function normalizeInferenceDeliverableType(deliverableType: string | null): string | null {
  const normalized = normalizeLower(deliverableType);
  if (!normalized) {
    return null;
  }

  if (/(code|webhook|api|handler|function|script|endpoint)/.test(normalized)) {
    return 'code';
  }

  return normalized.replace(/\s+/g, '_');
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const next: Issue[] = [];

  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    next.push(issue);
  }

  return next;
}

function hasTechnicalConstraintSignals(prompt: string, context?: Record<string, unknown>): boolean {
  const runtimeFramework = /\b(node\.?js|typescript|javascript|python|go|java|rust|express|fastify|nestjs|runtime|framework)\b/i.test(
    prompt,
  );
  const methodRestrictions = /\b(get|post|put|patch|delete)\b/i.test(prompt) || /\bmethod\b/i.test(prompt);
  const schemaValidation = /\b(json schema|schema validation|validate|validation|zod|ajv|joi|request body|payload)\b/i.test(prompt);
  const statusCodes = /\bstatus code|status codes|200|400|401|403|404|422|500\b/i.test(prompt);
  const middleware = /\bmiddleware|auth|authorization|rate limit|cors\b/i.test(prompt);
  const retries = /\bretry|idempot(?:ent|ency)|backoff|timeout\b/i.test(prompt);
  const exclusions = /\bavoid|exclude|without|do not|don't\b/i.test(prompt);
  const contextSignals = Boolean(context?.mustInclude || context?.mustAvoid || context?.systemGoals);

  const signalCount = [runtimeFramework, methodRestrictions, schemaValidation, statusCodes, middleware, retries, exclusions, contextSignals].filter(Boolean).length;
  return signalCount >= 3;
}

function applyDeveloperCodeGuardrails(params: {
  prompt: string;
  analysis: Analysis;
  context?: Record<string, unknown>;
}): { analysis: Analysis; calibrationPath: string } {
  const technicalConstraints = hasTechnicalConstraintSignals(params.prompt, params.context);
  if (!technicalConstraints) {
    return {
      analysis: {
        ...params.analysis,
        issues: dedupeIssues(params.analysis.issues),
        detectedIssueCodes: [...new Set(params.analysis.issues.map((issue) => issue.code))],
      },
      calibrationPath: 'developer_code_unbounded',
    };
  }

  const filteredIssues = dedupeIssues(params.analysis.issues).filter((issue) => issue.code !== 'CONSTRAINTS_MISSING');
  const filteredSignals = params.analysis.signals.filter((signal) => !/constraints are missing/i.test(signal));
  const scores: ScoreSet = {
    ...params.analysis.scores,
    scope: clamp(params.analysis.scores.scope + 1, 0, 10),
    constraintQuality: clamp(params.analysis.scores.constraintQuality + 2, 0, 10),
    genericOutputRisk: clamp(params.analysis.scores.genericOutputRisk - 2, 0, 10),
  };

  const summary =
    filteredIssues.length === 0
      ? 'Prompt quality is acceptable with low generic-output risk.'
      : `Detected ${filteredIssues.length} quality issue(s); add the most relevant missing context and tighten boundaries for better output.`;

  return {
    analysis: {
      ...params.analysis,
      scores,
      issues: filteredIssues,
      detectedIssueCodes: [...new Set(filteredIssues.map((issue) => issue.code))],
      signals: [...filteredSignals, 'Technical constraints provide strong execution grounding.'].slice(0, 12),
      summary,
    },
    calibrationPath: 'developer_code_bounded',
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
  const normalizedTaskType = normalizeInferenceTaskType(params.metadata?.taskType ?? null);
  const normalizedDeliverableType = normalizeInferenceDeliverableType(params.metadata?.deliverableType ?? null);
  const effectiveMissingContextType = params.metadata?.missingContextType ?? null;

  let effectiveAnalysis: Analysis = {
    ...params.analysis,
    issues: dedupeIssues(params.analysis.issues),
    detectedIssueCodes: [...new Set(params.analysis.issues.map((issue) => issue.code))],
  };
  let calibrationPath = 'local_only';

  const shouldApplyDeveloperCodeGuardrails =
    params.metadata?.roleHint === 'developer' && normalizedDeliverableType === 'code' && effectiveMissingContextType === null;

  if (shouldApplyDeveloperCodeGuardrails) {
    const calibrated = applyDeveloperCodeGuardrails({
      prompt: params.prompt,
      context: params.context,
      analysis: effectiveAnalysis,
    });
    effectiveAnalysis = calibrated.analysis;
    calibrationPath = calibrated.calibrationPath;
  } else if (params.metadata) {
    calibrationPath = 'inference_metadata_no_guardrail';
  }

  return {
    analysis: effectiveAnalysis,
    context: params.context,
    patternFit: params.patternFit,
    inferenceMetadataApplied: params.metadata !== null,
    effectiveTaskType: normalizedTaskType,
    effectiveDeliverableType: normalizedDeliverableType,
    effectiveMissingContextType,
    effectivePatternFit: params.patternFit.primary,
    effectiveCalibrationPath: calibrationPath,
  };
}
