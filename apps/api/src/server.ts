import { createHash } from 'node:crypto';
import {
  analyzePrompt,
  buildDecisionState,
  buildRewritePolicy,
  classifySemanticPrompt,
  detectPatternFit,
  deriveFindings,
  deriveRewriteLadderState,
  evaluateRewrite,
  generateBestNextMove,
  generateImprovementSuggestions,
  projectScores,
  validateLadderStep,
} from '@promptfire/heuristics';
import type { PromptPattern } from '@promptfire/heuristics';
import {
  AnalyzeAndRewriteV2RequestSchema,
  GuidedRewriteRequestSchema,
  AnalyzeAndRewriteRequestSchema,
  API_VERSION,
  MagicLinkRequestSchema,
  PasskeyAuthenticateOptionsRequestSchema,
  PasskeyAuthenticateVerifyRequestSchema,
  PasskeyRegisterVerifyRequestSchema,
  normalizePreferences,
  type AnalyzeAndRewriteResponse,
  type AnalyzeAndRewriteV2Request,
  type AnalyzeAndRewriteV2Response,
  type Analysis,
  type BestNextMove,
  type GuidedAnswers,
  type ImprovementStatus,
  type Issue,
  type Role,
  type RewriteRecommendation,
  type RewritePreference,
  type ScoreBand,
  type ScoreSet,
} from '@promptfire/shared';
import {
  clearSessionCookie,
  createMagicLink,
  createPasskeyAuthenticationOptions,
  createPasskeyRegistrationOptions,
  createSessionCookie,
  getSessionUser,
  getUserSummary,
  hasValidSession,
  invalidateSession,
  parseSessionIdFromCookie,
  verifyMagicLink,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from './auth';
import { getAuthBypassEnabled, getProviderMode, getStaticApiKey } from './lib/env';
import { persistPromptRun } from './persistence/promptRuns';
import { getPromptRunDetailForUser, listPromptRunsForUser } from './persistence/promptRunsRead';
import {
  createMeta,
  createMetaV2,
  emptyResponse,
  errorResponse,
  jsonResponse,
  normalizeHeaders,
  requestIdFromHeaders,
  type HttpRequest,
  type HttpResponse,
} from './lib/http';
import { ProviderNotConfiguredError, UpstreamRewriteError } from './rewrite/errors';
import { selectRewriteEngine } from './rewrite/engineSelector';
import { getProviderConfig } from './rewrite/providerConfig';
import { buildGuidedCompletion, buildGuidedCompletionForm, selectRewritePresentationMode } from './rewrite/rewritePresentation';
import type { InternalLadderTrace } from './rewrite/types';
import { evaluateInferenceTrigger, mergeContextWithInference } from './inference/fallbackResolver';
import { buildEffectiveResolution } from './inference/effectiveContext';
import { OpenAIInferenceClient } from './inference/openaiInference';
import type { InferenceMetadata } from './inference/types';

function isAuthorized(headers: Record<string, string>): boolean {
  if (getAuthBypassEnabled()) {
    return true;
  }

  const authorization = headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  const token = authorization.slice('Bearer '.length).trim();
  return token === getStaticApiKey();
}

function contentTypeIsJson(headers: Record<string, string>): boolean {
  return (headers['content-type'] ?? '').toLowerCase().includes('application/json');
}

function parseJsonBody(request: HttpRequest): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: request.body ? JSON.parse(request.body) : {} };
  } catch {
    return { ok: false };
  }
}

function parsePositiveInt(input: string | null | undefined, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function logRequest(params: {
  requestId: string;
  endpoint: string;
  method: string;
  role?: string;
  mode?: string;
  statusCode: number;
  latencyMs: number;
  providerMode: string;
  providerModel?: string;
  evaluationStatus?: string;
  overallDelta?: number;
  alreadyStrong?: boolean;
  ladderTrace?: InternalLadderTrace | null;
  errorCode?: string;
}): void {
  console.info(JSON.stringify(params));
}

function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

async function persistPromptRunSafely(params: Parameters<typeof persistPromptRun>[0]): Promise<void> {
  try {
    await persistPromptRun(params);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'prompt_run_persistence_failed',
        endpoint: params.endpoint,
        requestId: params.requestId,
        userId: params.userId ?? null,
        sessionId: params.sessionId ?? null,
        error: error instanceof Error ? error.message : 'UNKNOWN_PERSISTENCE_ERROR',
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

function logInferenceCase(params: {
  prompt: string;
  role: string;
  mode: string;
  localMatchStatus: string;
  inferenceUsed: boolean;
  validatedInferenceMetadata: InferenceMetadata | null;
  inferenceError?: string;
  finalResolutionSource: 'local' | 'inference';
  inferenceMetadataApplied: boolean;
  effectiveTaskType: string | null;
  effectiveDeliverableType: string | null;
  effectiveMissingContextType: string | null;
  effectivePatternFit: string;
  effectiveCalibrationPath: string;
  scoringGuardrailsApplied: string[];
}): void {
  console.info(
    JSON.stringify({
      event: 'inference_fallback_review',
      prompt_hash: promptHash(params.prompt),
      role: params.role,
      mode: params.mode,
      local_match_status: params.localMatchStatus,
      inference_used: params.inferenceUsed,
      validated_inference_metadata: params.validatedInferenceMetadata,
      inference_error: params.inferenceError ?? null,
      final_resolution_source: params.finalResolutionSource,
      inference_metadata_applied: params.inferenceMetadataApplied,
      effective_task_type: params.effectiveTaskType,
      effective_deliverable_type: params.effectiveDeliverableType,
      effective_missing_context_type: params.effectiveMissingContextType,
      effective_pattern_fit: params.effectivePatternFit,
      effective_calibration_path: params.effectiveCalibrationPath,
      scoring_guardrails_applied: params.scoringGuardrailsApplied,
      timestamp: new Date().toISOString(),
    }),
  );
}

function validationErrorCode(issues: { path: PropertyKey[]; message?: string }[]): 'INVALID_ROLE' | 'INVALID_MODE' | 'PROMPT_TOO_LONG' | 'PROMPT_REQUIRED' | 'INVALID_REQUEST' {
  const firstIssue = issues[0];
  return firstIssue?.path.includes('role')
    ? 'INVALID_ROLE'
    : firstIssue?.path.includes('mode')
      ? 'INVALID_MODE'
      : firstIssue?.message === 'Prompt too long.'
        ? 'PROMPT_TOO_LONG'
        : firstIssue?.message === 'Prompt is required.'
          ? 'PROMPT_REQUIRED'
          : 'INVALID_REQUEST';
}

function isGuidedAnswersRecord(value: unknown): value is GuidedAnswers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) =>
      typeof entry === 'string' ||
      (Array.isArray(entry) && entry.every((item) => typeof item === 'string')),
  );
}

function safeParseGuidedRewriteRequest(parsedBody: unknown):
  | { success: true; data: { prompt: string; role: Role; mode: AnalyzeAndRewriteV2Request['mode']; rewritePreference: RewritePreference; guidedAnswers: GuidedAnswers } }
  | { success: false; issues: { path: PropertyKey[]; message: string }[] } {
  if (GuidedRewriteRequestSchema) {
    const parsed = GuidedRewriteRequestSchema.safeParse(parsedBody);
    return parsed.success ? parsed : { success: false, issues: parsed.error.issues };
  }

  const base = AnalyzeAndRewriteV2RequestSchema.safeParse(parsedBody);
  if (!base.success) {
    return { success: false, issues: base.error.issues };
  }

  const guidedAnswers = (parsedBody as { guidedAnswers?: unknown }).guidedAnswers;
  if (!isGuidedAnswersRecord(guidedAnswers)) {
    return {
      success: false,
      issues: [
        {
          path: ['guidedAnswers'],
          message: 'Invalid request.',
        },
      ],
    };
  }

  return {
    success: true,
    data: {
      ...base.data,
      guidedAnswers,
    },
  };
}

function normalizeGuidedAnswers(guidedAnswers: GuidedAnswers): GuidedAnswers {
  const normalizedEntries = Object.entries(guidedAnswers)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        const items = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
        return items.length > 0 ? [key, items] : null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? [key, trimmed] : null;
    })
    .filter((entry): entry is [string, string | string[]] => entry !== null);

  return Object.fromEntries(normalizedEntries);
}

function asJoinedValue(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value.join(', ') : value;
}

function synthesizeGuidedPrompt(originalPrompt: string, guidedAnswers: GuidedAnswers): string {
  const goal = asJoinedValue(guidedAnswers.goal);
  const audience = asJoinedValue(guidedAnswers.audience);
  const includes = asJoinedValue(guidedAnswers.includes);
  const excludes = asJoinedValue(guidedAnswers.excludes);
  const format = asJoinedValue(guidedAnswers.format);
  const tone = asJoinedValue(guidedAnswers.tone);
  const detail = asJoinedValue(guidedAnswers.detail);
  const proof = asJoinedValue(guidedAnswers.proof);
  const context = asJoinedValue(guidedAnswers.context);

  const lines = [
    'Original request:',
    originalPrompt.trim(),
    '',
    'Additional constraints:',
    `- Primary goal: ${goal ?? 'preserve the original goal'}`,
    `- Audience: ${audience ?? 'use the implied audience from the original request'}`,
    `- Include: ${includes ?? 'no additional required inclusions provided'}`,
    `- Avoid: ${excludes ?? 'no additional exclusions provided'}`,
    `- Format: ${format ?? 'use the format implied by the original request'}`,
    `- Tone/detail notes: ${[tone, detail].filter(Boolean).join('; ') || 'no extra tone or detail notes provided'}`,
    `- Proof or differentiation: ${proof ?? 'no additional proof requirement provided'}`,
    `- Additional context: ${context ?? 'no additional context provided'}`,
    '',
    'Create a stronger, more specific version of the prompt that preserves the user’s intent while adding these boundaries.',
  ];

  return lines.join('\n');
}

type RunAnalyzeAndRewriteV2Params = {
  requestId: string;
  startedAtMs: number;
  providerMode: 'mock' | 'real';
  providerConfig: ReturnType<typeof getProviderConfig>;
  headers: Record<string, string>;
  pathname: '/v2/analyze-and-rewrite' | '/v2/rewrite-from-guided-answers';
  requestMethod: string;
  sessionId?: string;
  input: AnalyzeAndRewriteV2Request;
  persistInput?: AnalyzeAndRewriteV2Request;
  extraInferenceData?: Record<string, unknown>;
};

async function runAnalyzeAndRewriteV2(params: RunAnalyzeAndRewriteV2Params): Promise<HttpResponse> {
  const { requestId, startedAtMs, providerMode, providerConfig, headers, pathname, requestMethod, sessionId } = params;
  const input = params.input;
  const persistInput = params.persistInput ?? input;
  const preferences = normalizePreferences(input.preferences);

  let resolvedContext = input.context;
  let resolvedAnalysis = withV2Scores(analyzePrompt({ ...input, preferences }), input.prompt, resolvedContext);
  let patternFit = detectPatternFit({
    prompt: input.prompt,
    role: input.role,
    mode: input.mode,
    analysis: resolvedAnalysis,
    context: resolvedContext,
  });

  const semanticClassification = classifySemanticPrompt(input.prompt, input.role);
  const semanticDecision = semanticClassification.extraction.inScope
    ? buildDecisionState(semanticClassification.inventory, input.rewritePreference)
    : null;
  const hasSemanticDecision = semanticDecision !== null;
  const inferenceTrigger = hasSemanticDecision
    ? {
        shouldInfer: false,
        reasons: [],
      }
    : evaluateInferenceTrigger({
        prompt: input.prompt,
        role: input.role,
        mode: input.mode,
        analysis: resolvedAnalysis,
        context: resolvedContext,
        patternFit,
      });
  const localMatchStatus = inferenceTrigger.shouldInfer ? inferenceTrigger.reasons.join('|') : 'strong_local_match';
  let inferenceFallbackUsed = false;
  let resolutionSource: 'local' | 'inference' = 'local';
  let validatedInferenceMetadata: InferenceMetadata | null = null;
  let inferenceError: string | undefined;

  if (inferenceTrigger.shouldInfer) {
    inferenceFallbackUsed = true;

    if (providerMode !== 'real') {
      inferenceError = 'INFERENCE_UNAVAILABLE_PROVIDER_MODE';
    } else {
      try {
        const inferenceClient = new OpenAIInferenceClient(providerConfig);
        validatedInferenceMetadata = await inferenceClient.inferMetadata({
          prompt: input.prompt,
          role: input.role,
          mode: input.mode,
        });

        resolvedContext = mergeContextWithInference(resolvedContext, validatedInferenceMetadata);
        resolvedAnalysis = withV2Scores(
          analyzePrompt({
            prompt: input.prompt,
            role: input.role,
            mode: input.mode,
            context: resolvedContext,
            preferences,
          }),
          input.prompt,
          resolvedContext,
        );
        patternFit = detectPatternFit({
          prompt: input.prompt,
          role: input.role,
          mode: input.mode,
          analysis: resolvedAnalysis,
          context: resolvedContext,
        });
      } catch (error) {
        inferenceError = error instanceof Error ? error.message : 'UNKNOWN_INFERENCE_ERROR';
      }
    }
  }

  const effectiveResolution = buildEffectiveResolution({
    prompt: input.prompt,
    role: input.role,
    mode: input.mode,
    context: resolvedContext,
    analysis: resolvedAnalysis,
    patternFit,
    metadata: validatedInferenceMetadata,
  });
  resolvedAnalysis = effectiveResolution.analysis;
  patternFit = effectiveResolution.patternFit;
  resolutionSource =
    validatedInferenceMetadata && effectiveResolution.effectiveAnalysisContext.source === 'inference' ? 'inference' : 'local';
  const effectiveContext = {
    ...(resolvedContext ?? {}),
    effectiveRole: effectiveResolution.effectiveAnalysisContext.role,
    effectiveTaskType: effectiveResolution.effectiveTaskType,
    effectiveDeliverableType: effectiveResolution.effectiveDeliverableType,
    effectiveMissingContextType: effectiveResolution.effectiveMissingContextType,
    effectivePatternFit: effectiveResolution.effectivePatternFit,
    effectiveCalibrationPath: effectiveResolution.effectiveCalibrationPath,
  };
  const effectiveInput: AnalyzeAndRewriteV2Request = {
    ...input,
    context: effectiveContext,
  };

  if (inferenceTrigger.shouldInfer) {
    logInferenceCase({
      prompt: input.prompt,
      role: input.role,
      mode: input.mode,
      localMatchStatus,
      inferenceUsed: inferenceFallbackUsed,
      validatedInferenceMetadata,
      inferenceError,
      finalResolutionSource: resolutionSource,
      inferenceMetadataApplied: effectiveResolution.inferenceMetadataApplied,
      effectiveTaskType: effectiveResolution.effectiveTaskType,
      effectiveDeliverableType: effectiveResolution.effectiveDeliverableType,
      effectiveMissingContextType: effectiveResolution.effectiveMissingContextType,
      effectivePatternFit: effectiveResolution.effectivePatternFit,
      effectiveCalibrationPath: effectiveResolution.effectiveCalibrationPath,
      scoringGuardrailsApplied: effectiveResolution.scoringGuardrailsApplied,
    });
  }

  if (hasSemanticDecision && semanticDecision) {
    resolvedAnalysis = {
      ...resolvedAnalysis,
      scores: projectScores(resolvedAnalysis.scores, semanticClassification.inventory, semanticDecision),
    };
  }

  const overallScore = computeOverallScore(resolvedAnalysis.scores);
  const scoreBand = scoreBandFromOverallScore(overallScore);
  const expectedImprovement = semanticDecision
    ? semanticDecision.expectedImprovement
    : hasLowExpectedImprovementV2(resolvedAnalysis.scores, input.prompt, resolvedContext)
      ? 'low'
      : 'high';
  const publicExpectedImprovement = expectedImprovement === 'low' ? 'low' : 'high';
  const majorBlockingIssues = semanticDecision ? semanticDecision.majorBlockingIssues : hasMajorBlockingIssues(resolvedAnalysis.issues);
  const cleanStrongPrompt = expectedImprovement === 'low' && resolvedAnalysis.issues.length === 0;
  const shouldSuppressByStrength =
    (overallScore >= 75 || cleanStrongPrompt) &&
    !majorBlockingIssues &&
    expectedImprovement === 'low' &&
    input.rewritePreference !== 'force';
  const shouldSuppress = input.rewritePreference === 'suppress' || shouldSuppressByStrength;
  let rewriteRecommendation = semanticDecision?.rewriteRecommendation ?? recommendationFromState({
    overallScore,
    rewritePreference: input.rewritePreference,
    shouldSuppress,
    expectedImprovementLow: expectedImprovement === 'low',
  });
  if (!semanticDecision) {
    if (
      rewriteRecommendation === 'rewrite_recommended' &&
      shouldFloorDeveloperRecommendation({
        role: input.role,
        prompt: input.prompt,
        context: resolvedContext,
        analysis: resolvedAnalysis,
        majorBlockingIssues,
      })
    ) {
      rewriteRecommendation = 'rewrite_optional';
    }
  }
  const improvementSuggestions = generateImprovementSuggestions({
    input: effectiveInput,
    analysis: resolvedAnalysis,
    overallScore,
    scoreBand,
    rewriteRecommendation,
    patternFit,
    effectiveContext: effectiveResolution.effectiveAnalysisContext,
  });
  const semanticFindings =
    hasSemanticDecision && semanticDecision
      ? deriveFindings(resolvedAnalysis, semanticClassification.inventory, semanticDecision)
      : null;
  const semanticRewritePolicy =
    hasSemanticDecision && semanticDecision && semanticFindings
      ? buildRewritePolicy(semanticClassification.inventory, semanticDecision)
      : null;
  const semanticOwned = semanticRewritePolicy?.semanticOwned === true;
  const generatedBestNextMove = semanticFindings
    ? null
    : generateBestNextMove({
        input: effectiveInput,
        analysis: resolvedAnalysis,
        overallScore,
        scoreBand,
        rewriteRecommendation,
        patternFit,
        effectiveContext: effectiveResolution.effectiveAnalysisContext,
      });
  const bestNextMove: BestNextMove | null = semanticFindings?.bestNextMove ?? generatedBestNextMove;
  const rewriteLadder = deriveRewriteLadderState({
    overallScore,
    rewriteRecommendation,
    rewritePreference: input.rewritePreference,
    expectedImprovement: publicExpectedImprovement,
  });
  let ladderTrace: InternalLadderTrace | null = {
    current: rewriteLadder.current,
    next: rewriteLadder.next,
    target: rewriteLadder.target,
    maxSafeTarget: rewriteLadder.maxSafeTarget,
    stopReason: rewriteLadder.stopReason,
    pattern: patternFit.primary,
    claimedStep: rewriteLadder.target
      ? {
          from: rewriteLadder.current,
          to: rewriteLadder.target,
        }
      : null,
    ladderAccepted: null,
    ladderReason: null,
  };

  try {
    let rewrite: AnalyzeAndRewriteV2Response['rewrite'] = null;
    let evaluation: AnalyzeAndRewriteV2Response['evaluation'] = null;
    let rewritePresentationMode: AnalyzeAndRewriteV2Response['rewritePresentationMode'] = 'suppressed';
    let guidedCompletion: AnalyzeAndRewriteV2Response['guidedCompletion'] = null;
    let guidedCompletionForm: AnalyzeAndRewriteV2Response['guidedCompletionForm'] = null;

    if (!shouldSuppress && rewriteLadder.target !== null) {
      const rewriteEngine = selectRewriteEngine(providerConfig);
      const generatedRewrite = await rewriteEngine.rewrite({
        prompt: input.prompt,
        role: input.role,
        mode: input.mode,
        context: effectiveContext,
        preferences,
        analysis: resolvedAnalysis,
        improvementSuggestions,
        patternFit,
        ladder: rewriteLadder,
      });

      const rewriteAnalysis = withV2Scores(
        analyzePrompt({
          prompt: generatedRewrite.rewrittenPrompt,
          role: input.role,
          mode: input.mode,
          context: effectiveContext,
          preferences,
        }),
        generatedRewrite.rewrittenPrompt,
        effectiveContext,
      );
      const rewritePatternFit = detectPatternFit({
        prompt: generatedRewrite.rewrittenPrompt,
        role: input.role,
        mode: input.mode,
        analysis: rewriteAnalysis,
        context: effectiveContext,
      });
      const effectiveRewrite = buildEffectiveResolution({
        prompt: generatedRewrite.rewrittenPrompt,
        role: input.role,
        mode: input.mode,
        context: effectiveContext,
        analysis: rewriteAnalysis,
        patternFit: rewritePatternFit,
        metadata: validatedInferenceMetadata,
      });
      const calibratedRewriteAnalysis = effectiveRewrite.analysis;
      const rewriteEvaluation = evaluateRewrite({
        originalPrompt: input.prompt,
        rewrittenPrompt: generatedRewrite.rewrittenPrompt,
        originalAnalysis: resolvedAnalysis,
        rewriteAnalysis: calibratedRewriteAnalysis,
        context: effectiveContext,
        role: input.role,
      });
      const ladderEvaluation =
        rewriteLadder.target !== null
          ? validateLadderStep({
              from: rewriteLadder.current,
              to: rewriteLadder.target,
              evaluationStatus: rewriteEvaluation.improvement.status,
              diagnostics: rewriteEvaluation.diagnostics,
            })
          : null;
      const evaluationStatus = reconcileLadderStatus({
        currentStatus: rewriteEvaluation.improvement.status,
        overallDelta: rewriteEvaluation.improvement.overallDelta,
        ladderEvaluation,
      });
      ladderTrace = {
        ...ladderTrace,
        claimedStep: ladderEvaluation?.claimedStep ?? ladderTrace?.claimedStep ?? null,
        ladderAccepted: ladderEvaluation?.accepted ?? null,
        ladderReason: ladderEvaluation?.reason ?? null,
      };
      const evaluationSignals = [...rewriteEvaluation.signals];
      if (ladderEvaluation) {
        evaluationSignals.push(`LADDER_${ladderEvaluation.reason.toUpperCase()}`);
      }

      rewrite = generatedRewrite;
      evaluation = {
        status: evaluationStatus,
        overallDelta: rewriteEvaluation.improvement.overallDelta,
        signals: [...new Set(evaluationSignals)].slice(0, 12),
        scoreComparison: {
          original: {
            scope: resolvedAnalysis.scores.scope,
            contrast: resolvedAnalysis.scores.contrast,
            clarity: resolvedAnalysis.scores.clarity,
          },
          rewrite: {
            scope: calibratedRewriteAnalysis.scores.scope,
            contrast: calibratedRewriteAnalysis.scores.contrast,
            clarity: calibratedRewriteAnalysis.scores.clarity,
          },
        },
      };

      rewritePresentationMode = selectRewritePresentationMode({
        rewriteRecommendation,
        rewritePreference: input.rewritePreference,
        evaluation,
        analysis: resolvedAnalysis,
        rewrite,
        scoreBand,
        prompt: input.prompt,
        semanticPolicy: semanticRewritePolicy,
        effectiveAnalysisContext: effectiveResolution.effectiveAnalysisContext,
        ladderTrace,
      });
      if (rewritePresentationMode === 'template_with_example' || rewritePresentationMode === 'questions_only') {
        guidedCompletion = buildGuidedCompletion({
          prompt: input.prompt,
          role: input.role,
          mode: rewritePresentationMode,
          analysis: resolvedAnalysis,
          semanticPolicy: semanticRewritePolicy,
          bestNextMove,
          improvementSuggestions,
          effectiveAnalysisContext: effectiveResolution.effectiveAnalysisContext,
        });
        guidedCompletionForm = buildGuidedCompletionForm({
          prompt: input.prompt,
          role: input.role,
          mode: rewritePresentationMode,
          analysis: resolvedAnalysis,
          semanticPolicy: semanticRewritePolicy,
          bestNextMove,
          improvementSuggestions,
          effectiveAnalysisContext: effectiveResolution.effectiveAnalysisContext,
        });
        rewrite = null;
      }
    } else {
      rewritePresentationMode = 'suppressed';
    }

    const finalIssues = semanticFindings?.issues ?? resolvedAnalysis.issues;
    const finalSignalsBase = semanticFindings?.signals ?? resolvedAnalysis.signals;
    const finalSignals = [...finalSignalsBase];
    if (!semanticOwned && expectedImprovement === 'low' && !finalSignals.includes('Low expected improvement.')) {
      finalSignals.push('Low expected improvement.');
    }
    if (!semanticOwned && !semanticFindings) {
      finalSignals.push(bestImprovementPath(patternFit.primary));
    }
    const analysis: Analysis = {
      ...resolvedAnalysis,
      issues: finalIssues,
      detectedIssueCodes: [...new Set(finalIssues.map((issue) => issue.code))],
      signals: [...new Set(finalSignals)].slice(0, 12),
      summary:
        semanticFindings?.summary ??
        summaryForV2({
          recommendation: rewriteRecommendation,
          rewritePreference: input.rewritePreference,
          generatedRewrite: rewrite !== null,
          role: input.role,
          prompt: input.prompt,
          context: resolvedContext,
        }),
    };
    const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
    const payload: AnalyzeAndRewriteV2Response = {
      id: `par_${requestId}`,
      overallScore,
      scoreBand,
      rewriteRecommendation,
      analysis,
      improvementSuggestions,
      bestNextMove,
      gating: {
        rewritePreference: input.rewritePreference,
        expectedImprovement: publicExpectedImprovement,
        majorBlockingIssues,
      },
      rewrite,
      evaluation,
      rewritePresentationMode,
      guidedCompletion,
      guidedCompletionForm,
      inferenceFallbackUsed,
      resolutionSource,
      meta,
    };

    const sessionUser = await getSessionUser(sessionId);
    await persistPromptRunSafely({
      endpoint: pathname,
      requestId,
      sessionId,
      userId: sessionUser?.id,
      input: persistInput,
      response: payload,
      inferenceData: {
        resolvedAnalysis,
        semanticClassification,
        semanticDecision,
        semanticFindings,
        semanticRewritePolicy,
        patternFit,
        improvementSuggestions,
        bestNextMove,
        inferenceTrigger,
        inferenceFallbackUsed,
        validatedInferenceMetadata,
        inferenceError: inferenceError ?? null,
        resolutionSource,
        effectiveResolution: {
          inferenceMetadataApplied: effectiveResolution.inferenceMetadataApplied,
          effectiveTaskType: effectiveResolution.effectiveTaskType,
          effectiveDeliverableType: effectiveResolution.effectiveDeliverableType,
          effectiveMissingContextType: effectiveResolution.effectiveMissingContextType,
          effectivePatternFit: effectiveResolution.effectivePatternFit,
          effectiveCalibrationPath: effectiveResolution.effectiveCalibrationPath,
          scoringGuardrailsApplied: effectiveResolution.scoringGuardrailsApplied,
          effectiveAnalysisContext: effectiveResolution.effectiveAnalysisContext,
        },
        providerMode,
        providerModel: providerConfig.model ?? null,
        responseVersion: meta.version,
        ...params.extraInferenceData,
      },
    });

    const response = jsonResponse(200, payload, headers);
    logRequest({
      requestId,
      endpoint: pathname,
      method: requestMethod,
      role: input.role,
      mode: input.mode,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
      evaluationStatus: evaluation?.status,
      overallDelta: evaluation?.overallDelta,
      alreadyStrong: rewriteRecommendation === 'no_rewrite_needed',
      ladderTrace,
    });
    return response;
  } catch (error) {
    const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);

    if (error instanceof ProviderNotConfiguredError) {
      const response = errorResponse(500, 'PROVIDER_NOT_CONFIGURED', 'Rewrite provider is not configured for real mode.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: requestMethod,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'PROVIDER_NOT_CONFIGURED',
      });
      return response;
    }

    if (error instanceof UpstreamRewriteError) {
      const response = errorResponse(502, 'UPSTREAM_MODEL_ERROR', 'Rewrite provider failed. Please try again.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: requestMethod,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'UPSTREAM_MODEL_ERROR',
      });
      return response;
    }

    const response = errorResponse(500, 'INTERNAL_ERROR', 'Internal server error.', meta, headers);
    logRequest({
      requestId,
      endpoint: pathname,
      method: requestMethod,
      role: input.role,
      mode: input.mode,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
      errorCode: 'INTERNAL_ERROR',
    });
    return response;
  }
}

function hasAudience(prompt: string, context?: Record<string, unknown>): boolean {
  const audienceHint = context?.audienceHint;
  if (audienceHint) {
    return true;
  }

  const explicitAudience =
    /\b(for|to|aimed at|target(?:ing|ed at)?|tailored for)\s+(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,6}(?:cto|ctos|it decision-makers?|decision-makers?|enterprise buyers?|buyers?|developers?|engineers?|directors?|managers?|leaders?|admins?|business(?:es)?|companies|organizations|teams|startups?|scaleups?|enterprises?|smbs?|small(?:\s+to\s+medium-sized)?\s+business(?:es)?|mid-sized\s+business(?:es)?)\b/i;
  const genericAudience = /\b(audience|target\s+user)\b/i;
  return explicitAudience.test(prompt) || genericAudience.test(prompt);
}

function hasConstraintsV2(prompt: string, context?: Record<string, unknown>): boolean {
  return (
    Boolean(context?.mustInclude || context?.systemGoals) ||
    /\b(must|should|exactly|limit|only|at least|at most)\b/i.test(prompt) ||
    /\b(use one|use two|include one|include two|avoid|keep the tone|focus on|rather than|lead with)\b/i.test(prompt) ||
    /\b(node\.?js|typescript|python|go|java|json|schema|validate|validation|payload|request body|response body|status code|http 200|http 400|error logging)\b/i.test(
      prompt,
    )
  );
}

function hasExclusions(prompt: string, context?: Record<string, unknown>): boolean {
  return Boolean(context?.mustAvoid || context?.forbiddenPhrases) || /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt);
}

function hasClearDeliverableV2(prompt: string): 0 | 1 | 2 | 3 {
  const actionVerb = /\b(write|draft|create|build|design|implement|analyze|optimize|summarize|generate)\b/i.test(prompt);
  const deliverableType =
    /\b(landing page|copy|email|ad copy|blog|article|webhook|handler|api|report|plan|outline|strategy|cta|headline|post)\b/i.test(
      prompt,
    );

  if (actionVerb && deliverableType) {
    return 3;
  }
  if (actionVerb || deliverableType) {
    return 2;
  }
  return 0;
}

function audienceOrContextSpecificityV2(prompt: string, context?: Record<string, unknown>): 0 | 1 | 2 | 3 {
  const hasAudienceSignal = hasAudience(prompt, context);
  if (!hasAudienceSignal) {
    return 0;
  }

  const broadAudience = /\b(it decision-makers?|decision-makers?|enterprise buyers?|audience|users?)\b/i.test(prompt);
  const specificAudience = /\b(cto|vp|director|architect|administrator|manager|engineering managers?)\b/i.test(prompt);
  const specificContext = /\b(mid-sized|enterprise|regulated|audit|sprawl|acquisition|overhead|governance|saas)\b/i.test(
    prompt,
  );

  if (specificAudience || specificContext) {
    return 3;
  }
  if (broadAudience) {
    return 1;
  }
  return 2;
}

function taskBoundariesV2(prompt: string, context?: Record<string, unknown>): 0 | 1 | 2 {
  const exclusionsPresent = hasExclusions(prompt, context);
  const strongBoundary =
    exclusionsPresent ||
    /\b(lead with|focus on|rather than|in scope|out of scope|avoid fear-based|do not use|keep the tone|only)\b/i.test(
      prompt,
    );
  const weakBoundary = /\b(focus on|highlight|emphasize|keep)\b/i.test(prompt);

  if (strongBoundary) {
    return 2;
  }
  if (weakBoundary) {
    return 1;
  }
  return 0;
}

function taskLoadScoreV2(prompt: string, overloaded: boolean): 0 | 1 | 2 {
  if (overloaded) {
    return 0;
  }
  if (/\b(and also|plus|as well as|in addition)\b/i.test(prompt)) {
    return 1;
  }
  return 2;
}

function isImplementationOrTransformationPromptV2(prompt: string): boolean {
  return /\b(code|implement|implementation|build|develop|webhook|handler|api|extract|transformation|transform|summarize|summary)\b/i.test(
    prompt,
  );
}

function technicalBoundaryBonusV2(prompt: string, context?: Record<string, unknown>): 0 | 1 {
  if (!isImplementationOrTransformationPromptV2(prompt)) {
    return 0;
  }

  const runtimeSpecificity =
    /\b(node\.?js|typescript|python|go|java|json|schema|validate|validation|payload|request body|response body|error logging|http\s*(?:status|200|400|500))\b/i.test(
      prompt,
    );
  const explicitBranching =
    /\b(on success|on failure|success|failure|error|invalid|valid)\b/i.test(prompt) &&
    /\b(return|respond|http|status code|2\d\d|4\d\d|5\d\d)\b/i.test(prompt);

  return runtimeSpecificity && (explicitBranching || hasExclusions(prompt, context)) ? 1 : 0;
}

function computeScopeScoreV2(analysis: Analysis, prompt: string, context?: Record<string, unknown>): number {
  const overloaded = analysis.detectedIssueCodes.includes('TASK_OVERLOADED');
  return (
    hasClearDeliverableV2(prompt) +
    audienceOrContextSpecificityV2(prompt, context) +
    taskBoundariesV2(prompt, context) +
    taskLoadScoreV2(prompt, overloaded) +
    technicalBoundaryBonusV2(prompt, context)
  );
}

function withV2Scores(analysis: Analysis, prompt: string, context?: Record<string, unknown>): Analysis {
  return {
    ...analysis,
    scores: {
      ...analysis.scores,
      scope: computeScopeScoreV2(analysis, prompt, context),
    },
  };
}

function computeOverallScore(scores: ScoreSet): number {
  const raw =
    2.75 * scores.scope +
    2.25 * scores.contrast +
    1.25 * scores.clarity +
    2.0 * scores.constraintQuality +
    1.5 * (10 - scores.genericOutputRisk) +
    0.5 * (10 - scores.tokenWasteRisk);

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function scoreBandFromOverallScore(overallScore: number): ScoreBand {
  if (overallScore >= 85) {
    return 'excellent';
  }
  if (overallScore >= 75) {
    return 'strong';
  }
  if (overallScore >= 60) {
    return 'usable';
  }
  if (overallScore >= 40) {
    return 'weak';
  }
  return 'poor';
}

function hasLowExpectedImprovementV2(scores: ScoreSet, prompt: string, context?: Record<string, unknown>): boolean {
  const baselineHigh =
    scores.scope >= 7 &&
    scores.clarity >= 7 &&
    scores.genericOutputRisk <= 4 &&
    scores.tokenWasteRisk <= 4;

  const structureSignals = [
    hasAudience(prompt, context),
    /\b(outcome|deliverable|output|result|goal|objective|generate|draft|write|build|design|create)\b/i.test(prompt),
    hasConstraintsV2(prompt, context),
    hasExclusions(prompt, context),
  ];

  return baselineHigh && structureSignals.some(Boolean);
}

function hasMajorBlockingIssues(issues: Issue[]): boolean {
  const highSeverityIssues = issues.filter((issue) => issue.severity === 'high');
  if (highSeverityIssues.length >= 2) {
    return true;
  }

  const blockingCodes = new Set(['AUDIENCE_MISSING', 'CONSTRAINTS_MISSING', 'GENERIC_OUTPUT_RISK_HIGH']);
  return highSeverityIssues.some((issue) => blockingCodes.has(issue.code));
}

function recommendationFromState(params: {
  overallScore: number;
  rewritePreference: RewritePreference;
  shouldSuppress: boolean;
  expectedImprovementLow: boolean;
}): RewriteRecommendation {
  if (params.shouldSuppress) {
    return 'no_rewrite_needed';
  }
  if (params.overallScore <= 59) {
    return params.rewritePreference === 'suppress' ? 'rewrite_optional' : 'rewrite_recommended';
  }
  if (params.overallScore <= 74) {
    return 'rewrite_optional';
  }
  return 'rewrite_optional';
}

function shouldFloorDeveloperRecommendation(params: {
  role: Role;
  prompt: string;
  context?: Record<string, unknown>;
  analysis: Analysis;
  majorBlockingIssues: boolean;
}): boolean {
  return (
    params.role === 'developer' &&
    !params.majorBlockingIssues &&
    isImplementationOrTransformationPromptV2(params.prompt) &&
    hasConstraintsV2(params.prompt, params.context) &&
    hasExclusions(params.prompt, params.context) &&
    params.analysis.scores.scope >= 7 &&
    params.analysis.scores.contrast >= 1
  );
}

function summaryForV2(params: {
  recommendation: RewriteRecommendation;
  rewritePreference: RewritePreference;
  generatedRewrite: boolean;
  role: Role;
  prompt: string;
  context?: Record<string, unknown>;
}): string {
  if (params.rewritePreference === 'suppress') {
    return 'Rewrite generation was suppressed by request.';
  }
  if (params.rewritePreference === 'force' && params.generatedRewrite) {
    return 'Strong prompt. Rewrite was generated because it was explicitly requested.';
  }
  if (
    params.role === 'developer' &&
    isImplementationOrTransformationPromptV2(params.prompt) &&
    hasConstraintsV2(params.prompt, params.context) &&
    hasExclusions(params.prompt, params.context)
  ) {
    return 'Prompt is well scoped with direct implementation instructions and useful constraints.';
  }
  if (params.recommendation === 'no_rewrite_needed') {
    return 'Strong prompt. It is already well scoped and well directed.';
  }
  if (params.recommendation === 'rewrite_recommended') {
    return 'Prompt is weakly bounded and likely to produce generic output.';
  }
  return 'Prompt is usable but may benefit from a targeted rewrite.';
}

function bestImprovementPath(pattern: PromptPattern): string {
  if (pattern === 'few_shot') {
    return 'Best improvement path: add one or two examples of the pattern you want.';
  }
  if (pattern === 'stepwise_reasoning') {
    return 'Best improvement path: break the reasoning into explicit steps.';
  }
  if (pattern === 'decomposition') {
    return 'Best improvement path: split the task into stages.';
  }
  if (pattern === 'decision_rubric') {
    return 'Best improvement path: add evaluation criteria and a verdict format.';
  }
  if (pattern === 'context_first') {
    return 'Best improvement path: supply missing context or source material.';
  }
  return 'Best improvement path: clarify the request directly.';
}

function reconcileLadderStatus(input: {
  currentStatus: ImprovementStatus;
  overallDelta: number;
  ladderEvaluation: ReturnType<typeof validateLadderStep> | null;
}): ImprovementStatus {
  if (!input.ladderEvaluation) {
    return input.currentStatus;
  }

  if (!input.ladderEvaluation.accepted) {
    if (input.ladderEvaluation.reason === 'intent_drift' || input.ladderEvaluation.reason === 'rubric_echo_risk') {
      return 'possible_regression';
    }
    if (input.ladderEvaluation.reason === 'already_strong') {
      return 'already_strong';
    }
    return 'no_significant_change';
  }

  if (input.overallDelta >= 4 && input.ladderEvaluation.groundedImprovementCount >= 2) {
    return 'material_improvement';
  }
  if (input.overallDelta > 0 || input.ladderEvaluation.groundedImprovementCount >= 1) {
    return 'minor_improvement';
  }
  return input.currentStatus;
}

export async function handleHttpRequest(request: HttpRequest): Promise<HttpResponse> {
  const startedAtMs = performance.now();
  const headers = normalizeHeaders(request.headers);
  const requestId = requestIdFromHeaders(request.headers);
  const providerMode = getProviderMode();
  const providerConfig = getProviderConfig();
  const requestUrl = new URL(request.path, 'http://localhost');
  const pathname = requestUrl.pathname;
  const sessionId = parseSessionIdFromCookie(headers.cookie);

  if (request.method === 'OPTIONS') {
    return emptyResponse(204, headers);
  }

  if (request.method === 'GET' && pathname === '/v1/health') {
    const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
    const response = jsonResponse(200, { status: 'ok', meta }, headers);
    logRequest({
      requestId,
      endpoint: '/v1/health',
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
    });
    return response;
  }

  if (request.method === 'GET' && pathname === '/v2/health') {
    const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
    const response = jsonResponse(200, { status: 'ok', meta }, headers);
    logRequest({
      requestId,
      endpoint: '/v2/health',
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
    });
    return response;
  }

  if (request.method === 'POST' && pathname === '/v1/auth/magic-link/request') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.', meta, headers);
    }

    const parsedBody = parseJsonBody(request);
    if (!parsedBody.ok) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
    }

    const parsed = MagicLinkRequestSchema.safeParse(parsedBody.value);
    if (!parsed.success) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid request.', meta, headers, { issues: parsed.error.issues });
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const { token } = await createMagicLink(parsed.data.email);
    const isLocalDev = (process.env.NODE_ENV ?? '').toLowerCase() !== 'production';
    if (isLocalDev) {
      const callbackBaseUrl = process.env.AUTH_MAGIC_LINK_CALLBACK_URL ?? 'http://localhost:5173/app/auth/callback';
      const callbackUrl = new URL(callbackBaseUrl);
      callbackUrl.searchParams.set('token', token);
      console.info(
        JSON.stringify({
          event: 'auth_magic_link_generated',
          email: normalizedEmail,
          magicLinkUrl: callbackUrl.toString(),
        }),
      );
    }

    const includeDebugToken = process.env.AUTH_INCLUDE_DEBUG_TOKEN === 'true';
    const payload = includeDebugToken
      ? { ok: true, message: 'If the email is valid, a sign-in link has been sent.', debugToken: token }
      : { ok: true, message: 'If the email is valid, a sign-in link has been sent.' };
    return jsonResponse(200, payload, headers);
  }

  if (request.method === 'GET' && pathname === '/v1/auth/magic-link/verify') {
    const token = requestUrl.searchParams.get('token') ?? '';
    const result = await verifyMagicLink(token);
    if (!result.ok) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const messageByReason = {
        invalid: 'Invalid magic-link token.',
        expired: 'Magic-link token expired.',
        already_used: 'Magic-link token has already been used.',
      } as const;
      return errorResponse(400, 'INVALID_REQUEST', messageByReason[result.reason], meta, headers, {
        reason: result.reason,
      });
    }

    const response = jsonResponse(
      200,
      {
        ok: true,
        authenticated: true,
        user: await getUserSummary(result.user),
      },
      headers,
    );
    response.headers['set-cookie'] = createSessionCookie(result.sessionId);
    return response;
  }

  if (request.method === 'GET' && pathname === '/v1/auth/session') {
    const user = await getSessionUser(sessionId);
    if (!user) {
      return jsonResponse(200, { authenticated: false }, headers);
    }
    return jsonResponse(200, { authenticated: true, user: await getUserSummary(user) }, headers);
  }

  if (request.method === 'POST' && pathname === '/v1/auth/logout') {
    await invalidateSession(sessionId);
    const response = jsonResponse(200, { ok: true }, headers);
    response.headers['set-cookie'] = clearSessionCookie();
    return response;
  }

  if (request.method === 'GET' && pathname === '/v1/account/home') {
    const user = await getSessionUser(sessionId);
    if (!user) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    }

    const recentRuns = await listPromptRunsForUser(user.id, parsePositiveInt(requestUrl.searchParams.get('limit'), 6));
    return jsonResponse(
      200,
      {
        ok: true,
        user: await getUserSummary(user),
        recentRuns,
      },
      headers,
    );
  }

  if (request.method === 'GET' && pathname === '/v1/prompt-runs') {
    const user = await getSessionUser(sessionId);
    if (!user) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    }

    const runs = await listPromptRunsForUser(user.id, Math.min(parsePositiveInt(requestUrl.searchParams.get('limit'), 20), 100));
    return jsonResponse(200, { ok: true, runs }, headers);
  }

  if (request.method === 'GET' && pathname.startsWith('/v1/prompt-runs/')) {
    const user = await getSessionUser(sessionId);
    if (!user) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    }

    const runId = pathname.slice('/v1/prompt-runs/'.length).trim();
    if (!runId) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid run id.', meta, headers);
    }

    const run = await getPromptRunDetailForUser(user.id, runId);
    if (!run) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(404, 'INVALID_REQUEST', 'Run not found.', meta, headers);
    }
    return jsonResponse(200, { ok: true, run }, headers);
  }

  if (request.method === 'POST' && pathname === '/v1/auth/passkey/register/options') {
    const user = await getSessionUser(sessionId);
    if (!user) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    }
    return jsonResponse(200, { ok: true, ...createPasskeyRegistrationOptions(user.id) }, headers);
  }

  if (request.method === 'POST' && pathname === '/v1/auth/passkey/register/verify') {
    const user = await getSessionUser(sessionId);
    if (!user) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    }
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.', meta, headers);
    }
    const parsedBody = parseJsonBody(request);
    if (!parsedBody.ok) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
    }
    const parsed = PasskeyRegisterVerifyRequestSchema.safeParse(parsedBody.value);
    if (!parsed.success) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid request.', meta, headers, { issues: parsed.error.issues });
    }

    await verifyPasskeyRegistration(user.id, parsed.data.credentialId, parsed.data.label);
    return jsonResponse(200, { ok: true }, headers);
  }

  if (request.method === 'POST' && pathname === '/v1/auth/passkey/authenticate/options') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.', meta, headers);
    }
    const parsedBody = parseJsonBody(request);
    if (!parsedBody.ok) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
    }
    const parsed = PasskeyAuthenticateOptionsRequestSchema.safeParse(parsedBody.value);
    if (!parsed.success) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid request.', meta, headers, { issues: parsed.error.issues });
    }

    return jsonResponse(200, { ok: true, ...(await createPasskeyAuthenticationOptions(parsed.data.email)) }, headers);
  }

  if (request.method === 'POST' && pathname === '/v1/auth/passkey/authenticate/verify') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.', meta, headers);
    }
    const parsedBody = parseJsonBody(request);
    if (!parsedBody.ok) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
    }
    const parsed = PasskeyAuthenticateVerifyRequestSchema.safeParse(parsedBody.value);
    if (!parsed.success) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(400, 'INVALID_REQUEST', 'Invalid request.', meta, headers, { issues: parsed.error.issues });
    }

    const result = await verifyPasskeyAuthentication(parsed.data);
    if (!result) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      return errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    }

    const response = jsonResponse(
      200,
      {
        ok: true,
        authenticated: true,
        user: await getUserSummary(result.user),
      },
      headers,
    );
    response.headers['set-cookie'] = createSessionCookie(result.sessionId);
    return response;
  }

  if (
    (pathname === '/v1/analyze-and-rewrite' ||
      pathname === '/v2/analyze-and-rewrite' ||
      pathname === '/v2/rewrite-from-guided-answers') &&
    !isAuthorized(headers) &&
    !(await hasValidSession(sessionId))
  ) {
    const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
    const response = errorResponse(401, 'UNAUTHORIZED', 'Unauthorized.', meta, headers);
    logRequest({
      requestId,
      endpoint: pathname,
      method: request.method,
      statusCode: response.statusCode,
      latencyMs: meta.latencyMs,
      providerMode,
      providerModel: providerConfig.model,
      errorCode: 'UNAUTHORIZED',
    });
    return response;
  }

  if (request.method === 'POST' && pathname === '/v1/analyze-and-rewrite') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(
        415,
        'UNSUPPORTED_CONTENT_TYPE',
        'Content-Type must be application/json.',
        meta,
        headers,
      );
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      });
      return response;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.body ? JSON.parse(request.body) : {};
    } catch {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INVALID_REQUEST',
      });
      return response;
    }

    const parsed = AnalyzeAndRewriteRequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const code =
        firstIssue?.path.includes('role')
          ? 'INVALID_ROLE'
          : firstIssue?.path.includes('mode')
            ? 'INVALID_MODE'
            : firstIssue?.message === 'Prompt too long.'
              ? 'PROMPT_TOO_LONG'
              : firstIssue?.message === 'Prompt is required.'
                ? 'PROMPT_REQUIRED'
                : 'INVALID_REQUEST';

      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(
        400,
        code,
        firstIssue?.message ?? 'Invalid request.',
        meta,
        headers,
        {
          issues: parsed.error.issues,
        },
      );
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: code,
      });
      return response;
    }

    const input = parsed.data;
    const preferences = normalizePreferences(input.preferences);
    const analysis = analyzePrompt({ ...input, preferences });
    const patternFit = detectPatternFit({
      prompt: input.prompt,
      role: input.role,
      mode: input.mode,
      analysis,
      context: input.context,
    });
    const overallScore = computeOverallScore(withV2Scores(analysis, input.prompt, input.context).scores);
    const scoreBand = scoreBandFromOverallScore(overallScore);
    const improvementSuggestions = generateImprovementSuggestions({
      input,
      analysis,
      overallScore,
      scoreBand,
      rewriteRecommendation: 'rewrite_recommended',
      patternFit,
    });

    try {
      const rewriteEngine = selectRewriteEngine(providerConfig);
      const rewrite = await rewriteEngine.rewrite({
        prompt: input.prompt,
        role: input.role,
        mode: input.mode,
        context: input.context,
        preferences,
        analysis,
        improvementSuggestions,
        patternFit,
      });

      const rewriteAnalysis = analyzePrompt({
        prompt: rewrite.rewrittenPrompt,
        role: input.role,
        mode: input.mode,
        context: input.context,
        preferences,
      });
      const evaluation = evaluateRewrite({
        originalPrompt: input.prompt,
        rewrittenPrompt: rewrite.rewrittenPrompt,
        originalAnalysis: analysis,
        rewriteAnalysis,
        context: input.context,
        role: input.role,
      });

      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);

      const payload: AnalyzeAndRewriteResponse = {
        id: `par_${requestId}`,
        analysis,
        rewrite,
        evaluation: {
          originalScore: analysis.scores,
          rewriteScore: rewriteAnalysis.scores,
          improvement: evaluation.improvement,
          signals: evaluation.signals,
        },
        meta,
      };

      const sessionUser = await getSessionUser(sessionId);
      await persistPromptRunSafely({
        endpoint: '/v1/analyze-and-rewrite',
        requestId,
        sessionId,
        userId: sessionUser?.id,
        input,
        response: payload,
        inferenceData: {
          analysis,
          patternFit,
          improvementSuggestions,
          providerMode,
          providerModel: providerConfig.model ?? null,
          responseVersion: meta.version,
        },
      });

      const response = jsonResponse(200, payload, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        evaluationStatus: evaluation.improvement.status,
        overallDelta: evaluation.improvement.overallDelta,
        alreadyStrong: evaluation.improvement.status === 'already_strong',
      });
      return response;
    } catch (error) {
      const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);

      if (error instanceof ProviderNotConfiguredError) {
        const response = errorResponse(
          500,
          'PROVIDER_NOT_CONFIGURED',
          'Rewrite provider is not configured for real mode.',
          meta,
          headers,
        );
        logRequest({
          requestId,
          endpoint: pathname,
          method: request.method,
          role: input.role,
          mode: input.mode,
          statusCode: response.statusCode,
          latencyMs: meta.latencyMs,
          providerMode,
          providerModel: providerConfig.model,
          errorCode: 'PROVIDER_NOT_CONFIGURED',
        });
        return response;
      }

      if (error instanceof UpstreamRewriteError) {
        const response = errorResponse(
          502,
          'UPSTREAM_MODEL_ERROR',
          'Rewrite provider failed. Please try again.',
          meta,
          headers,
        );
        logRequest({
          requestId,
          endpoint: pathname,
          method: request.method,
          role: input.role,
          mode: input.mode,
          statusCode: response.statusCode,
          latencyMs: meta.latencyMs,
          providerMode,
          providerModel: providerConfig.model,
          errorCode: 'UPSTREAM_MODEL_ERROR',
        });
        return response;
      }

      const response = errorResponse(500, 'INTERNAL_ERROR', 'Internal server error.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        role: input.role,
        mode: input.mode,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INTERNAL_ERROR',
      });
      return response;
    }
  }

  if (request.method === 'POST' && pathname === '/v2/analyze-and-rewrite') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(
        415,
        'UNSUPPORTED_CONTENT_TYPE',
        'Content-Type must be application/json.',
        meta,
        headers,
      );
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      });
      return response;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.body ? JSON.parse(request.body) : {};
    } catch {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INVALID_REQUEST',
      });
      return response;
    }

    const parsed = AnalyzeAndRewriteV2RequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const code =
        firstIssue?.path.includes('role')
          ? 'INVALID_ROLE'
          : firstIssue?.path.includes('mode')
            ? 'INVALID_MODE'
            : firstIssue?.message === 'Prompt too long.'
              ? 'PROMPT_TOO_LONG'
              : firstIssue?.message === 'Prompt is required.'
                ? 'PROMPT_REQUIRED'
                : 'INVALID_REQUEST';

      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, code, firstIssue?.message ?? 'Invalid request.', meta, headers, {
        issues: parsed.error.issues,
      });
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: code,
      });
      return response;
    }

    return runAnalyzeAndRewriteV2({
      requestId,
      startedAtMs,
      providerMode,
      providerConfig,
      headers,
      pathname,
      requestMethod: request.method,
      sessionId,
      input: parsed.data,
    });
  }

  if (request.method === 'POST' && pathname === '/v2/rewrite-from-guided-answers') {
    if (!contentTypeIsJson(headers)) {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      });
      return response;
    }

    let parsedBody: unknown;
    try {
      parsedBody = request.body ? JSON.parse(request.body) : {};
    } catch {
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, 'INVALID_REQUEST', 'Malformed JSON body.', meta, headers);
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: 'INVALID_REQUEST',
      });
      return response;
    }

    const parsed = safeParseGuidedRewriteRequest(parsedBody);
    if (!parsed.success) {
      const code = validationErrorCode(parsed.issues);
      const meta = createMetaV2(requestId, startedAtMs, providerMode, providerConfig.model);
      const response = errorResponse(400, code, parsed.issues[0]?.message ?? 'Invalid request.', meta, headers, {
        issues: parsed.issues,
      });
      logRequest({
        requestId,
        endpoint: pathname,
        method: request.method,
        statusCode: response.statusCode,
        latencyMs: meta.latencyMs,
        providerMode,
        providerModel: providerConfig.model,
        errorCode: code,
      });
      return response;
    }

    const normalizedGuidedAnswers = normalizeGuidedAnswers(parsed.data.guidedAnswers);
    const mergedPrompt = synthesizeGuidedPrompt(parsed.data.prompt, normalizedGuidedAnswers);

    return runAnalyzeAndRewriteV2({
      requestId,
      startedAtMs,
      providerMode,
      providerConfig,
      headers,
      pathname,
      requestMethod: request.method,
      sessionId,
      input: {
        prompt: mergedPrompt,
        role: parsed.data.role,
        mode: parsed.data.mode,
        rewritePreference: parsed.data.rewritePreference,
      },
      persistInput: {
        prompt: parsed.data.prompt,
        role: parsed.data.role,
        mode: parsed.data.mode,
        rewritePreference: parsed.data.rewritePreference,
      },
      extraInferenceData: {
        guidedRewrite: {
          kind: 'guided_completion',
          originalPrompt: parsed.data.prompt,
          mergedPrompt,
          guidedAnswers: normalizedGuidedAnswers,
        },
      },
    });
  }

  const meta = createMeta(requestId, startedAtMs, providerMode, providerConfig.model);
  return errorResponse(
    404,
    'INVALID_REQUEST',
    `Route not found for ${request.method} ${request.path}.`,
    meta,
    headers,
  );
}

export function version(): string {
  return API_VERSION;
}
