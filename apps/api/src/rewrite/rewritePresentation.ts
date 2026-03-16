import type {
  Analysis,
  BestNextMove,
  GuidedCompletion,
  ImprovementSuggestion,
  Rewrite,
  RewritePreference,
  RewritePresentationMode,
  RewriteRecommendation,
  Role,
  ScoreBand,
  EvaluationV2,
} from '@promptfire/shared';

type EffectiveContextLike = {
  role?: 'general' | 'developer' | 'marketer';
  canonicalTaskType?: string | null;
  canonicalDeliverableType?: string | null;
  missingContextType?: 'audience' | 'operating' | 'execution' | 'io' | 'comparison' | 'source' | 'boundary' | null;
};

function hasConcreteRewriteGains(evaluation: EvaluationV2): boolean {
  const scoreGainCount =
    Number(evaluation.scoreComparison.rewrite.scope > evaluation.scoreComparison.original.scope) +
    Number(evaluation.scoreComparison.rewrite.contrast > evaluation.scoreComparison.original.contrast) +
    Number(evaluation.scoreComparison.rewrite.clarity > evaluation.scoreComparison.original.clarity);
  const hasRiskSignals = evaluation.signals.some((signal) =>
    /REWRITE_RUBRIC_ECHO|REWRITE_INTENT_DRIFT_RISK|LOW_INTENT_PRESERVATION|REWRITE_POSSIBLE_REGRESSION/.test(signal),
  );
  return evaluation.overallDelta >= 2 && scoreGainCount >= 1 && !hasRiskSignals;
}

function hasBoundaryPattern(params: { analysis: Analysis; effectiveAnalysisContext?: EffectiveContextLike }): boolean {
  if (params.effectiveAnalysisContext?.missingContextType !== undefined) {
    return params.effectiveAnalysisContext.missingContextType !== null;
  }
  const issueSet = new Set(params.analysis.detectedIssueCodes);
  return (
    issueSet.has('CONSTRAINTS_MISSING') ||
    issueSet.has('EXCLUSIONS_MISSING') ||
    issueSet.has('AUDIENCE_MISSING') ||
    issueSet.has('GENERIC_OUTPUT_RISK_HIGH')
  );
}

function isExtremelyUnderspecified(prompt: string, analysis: Analysis): boolean {
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  return wordCount <= 6 || (analysis.scores.scope <= 3 && analysis.scores.constraintQuality <= 3);
}

export function selectRewritePresentationMode(params: {
  rewriteRecommendation: RewriteRecommendation;
  rewritePreference: RewritePreference;
  evaluation: EvaluationV2 | null;
  analysis: Analysis;
  rewrite: Rewrite | null;
  scoreBand: ScoreBand;
  prompt: string;
  effectiveAnalysisContext?: EffectiveContextLike;
}): RewritePresentationMode {
  if (params.rewritePreference === 'suppress' || params.rewriteRecommendation === 'no_rewrite_needed' || !params.rewrite) {
    return 'suppressed';
  }
  if (!params.evaluation) {
    return 'full_rewrite';
  }

  if (params.evaluation.status === 'already_strong') {
    return 'suppressed';
  }
  if (params.evaluation.status === 'material_improvement') {
    return 'full_rewrite';
  }
  if (params.evaluation.status === 'minor_improvement') {
    return hasConcreteRewriteGains(params.evaluation) ? 'full_rewrite' : 'template_with_example';
  }
  if (params.evaluation.status === 'possible_regression') {
    if (
      isExtremelyUnderspecified(params.prompt, params.analysis) &&
      !hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext })
    ) {
      return 'questions_only';
    }
    return 'template_with_example';
  }
  if (params.evaluation.status === 'no_significant_change') {
    if (
      (params.scoreBand === 'poor' || params.scoreBand === 'weak' || params.scoreBand === 'usable') &&
      hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext })
    ) {
      return 'template_with_example';
    }
    return 'questions_only';
  }

  return 'template_with_example';
}

function pushUnique(items: string[], value: string) {
  if (!items.includes(value)) {
    items.push(value);
  }
}

export function buildGuidedCompletionQuestions(params: {
  role: Role;
  bestNextMove: BestNextMove | null;
  improvementSuggestions: ImprovementSuggestion[];
  effectiveAnalysisContext?: EffectiveContextLike;
}): string[] {
  const questions: string[] = [];
  const missing = params.effectiveAnalysisContext?.missingContextType ?? null;
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  const bestMoveText = `${params.bestNextMove?.title ?? ''} ${params.bestNextMove?.rationale ?? ''}`.toLowerCase();
  const suggestionsText = params.improvementSuggestions.map((item) => `${item.title} ${item.reason}`.toLowerCase()).join(' ');

  if (role === 'developer') {
    pushUnique(questions, 'What runtime or framework should be used?');
    pushUnique(questions, 'What does the input payload look like?');
    pushUnique(questions, 'How should validation be defined and enforced?');
    pushUnique(questions, 'What should happen on success and on failure?');
    if (missing === 'boundary' || /auth|signature/.test(bestMoveText + suggestionsText)) {
      pushUnique(questions, 'What auth or signature verification scope is required?');
    }
    if (missing === 'execution' || /retry|idempot/.test(bestMoveText + suggestionsText)) {
      pushUnique(questions, 'What retry or idempotency behavior should be enforced?');
    }
    pushUnique(questions, 'What setup or config boundaries should be explicit (middleware, port, env)?');
    return questions.slice(0, 6);
  }

  if (missing === 'audience') {
    pushUnique(questions, 'Who is the exact audience for this prompt?');
  }
  if (missing === 'comparison') {
    pushUnique(questions, 'What decision criteria or trade-offs should the output use?');
  }
  if (missing === 'source') {
    pushUnique(questions, 'What source material must the output be grounded in?');
  }

  pushUnique(questions, 'What concrete outcome should the output drive?');
  pushUnique(questions, 'What must be included versus explicitly excluded?');
  pushUnique(questions, 'What format or structure should the response follow?');
  pushUnique(questions, 'What level of detail is required to avoid generic output?');
  return questions.slice(0, 6);
}

function isDeveloperWebhookPrompt(prompt: string): boolean {
  return /\b(webhook|handler|endpoint|route|api)\b/i.test(prompt);
}

export function buildGuidedCompletionTemplate(params: {
  prompt: string;
  role: Role;
  effectiveAnalysisContext?: EffectiveContextLike;
}): string | null {
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  if (role === 'developer' && isDeveloperWebhookPrompt(params.prompt)) {
    return 'Write a webhook handler in [runtime/framework] that accepts [input format]. Validate the request against [schema or rule]. On success, return [success response]. On failure, return [error response]. Exclude [out-of-scope behavior].';
  }
  if (role === 'developer') {
    return 'Implement [deliverable] in [runtime/framework]. Define [input contract] and [output contract]. Include [validation and error behavior]. Exclude [out-of-scope behavior].';
  }
  if (params.prompt.trim().split(/\s+/).filter(Boolean).length < 8) {
    return null;
  }
  return 'Write [deliverable] for [audience] about [topic]. Include [required details], and avoid [out-of-scope content]. Use [format/structure] and keep the output focused on [goal].';
}

export function buildGuidedCompletionExample(params: {
  prompt: string;
  role: Role;
  effectiveAnalysisContext?: EffectiveContextLike;
}): string | null {
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  if (role === 'developer' && isDeveloperWebhookPrompt(params.prompt)) {
    return 'Example of a stronger prompt: Write a webhook handler in Node.js using Express that accepts JSON payloads. Validate the request body against a predefined JSON schema. On success, return a 200 status code with a JSON success response. On validation failure, return a 400 status code with a descriptive error message. Exclude unsupported HTTP methods and non-JSON requests.';
  }
  if (params.prompt.trim().split(/\s+/).filter(Boolean).length < 8) {
    return null;
  }
  return null;
}

export function buildGuidedCompletion(params: {
  prompt: string;
  role: Role;
  mode: 'template_with_example' | 'questions_only';
  analysis: Analysis;
  bestNextMove: BestNextMove | null;
  improvementSuggestions: ImprovementSuggestion[];
  effectiveAnalysisContext?: EffectiveContextLike;
}): GuidedCompletion | null {
  const questions = buildGuidedCompletionQuestions({
    role: params.role,
    bestNextMove: params.bestNextMove,
    improvementSuggestions: params.improvementSuggestions,
    effectiveAnalysisContext: params.effectiveAnalysisContext,
  });
  const template = params.mode === 'template_with_example' ? buildGuidedCompletionTemplate(params) : null;
  const example = params.mode === 'template_with_example' && template ? buildGuidedCompletionExample(params) : null;

  if (questions.length === 0 && !template) {
    return null;
  }

  return {
    mode: params.mode,
    title: params.mode === 'questions_only' ? 'Questions to tighten this prompt' : 'Fill in the missing details',
    summary:
      params.mode === 'questions_only'
        ? 'This prompt is too underspecified for a safe rewrite. Answer these questions first, then resubmit.'
        : 'This prompt is too broad for a safe rewrite, but adding concrete boundaries will make it much stronger.',
    questions: questions.length > 0 ? questions : undefined,
    template: template ?? undefined,
    example: example ?? undefined,
    rationale:
      params.mode === 'questions_only'
        ? 'Questions are safer than a full rewrite because key assumptions are still missing.'
        : 'A template is safer here than a full rewrite because the original prompt is missing concrete boundaries.',
  };
}
