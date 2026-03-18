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
import type { PrimaryGap, SemanticRewritePolicy } from '@promptfire/heuristics';
import type { InternalLadderTrace } from './types';

type EffectiveContextLike = {
  role?: 'general' | 'developer' | 'marketer';
  canonicalTaskType?: string | null;
  canonicalDeliverableType?: string | null;
  missingContextType?: 'audience' | 'operating' | 'execution' | 'io' | 'comparison' | 'source' | 'boundary' | null;
};

function isSemanticOwned(policy?: SemanticRewritePolicy | null): policy is SemanticRewritePolicy {
  return policy?.semanticOwned === true;
}

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

function selectSemanticOwnedPresentationMode(params: {
  allowedModes: RewritePresentationMode[];
  rewritePreference: RewritePreference;
  rewriteRecommendation: RewriteRecommendation;
  evaluation: EvaluationV2 | null;
  rewrite: Rewrite | null;
  analysis: Analysis;
  prompt: string;
  effectiveAnalysisContext?: EffectiveContextLike;
  ladderTrace?: InternalLadderTrace | null;
}): RewritePresentationMode {
  const allow = (mode: RewritePresentationMode): boolean => params.allowedModes.includes(mode);
  const fallbackMode = (): RewritePresentationMode => {
    if (allow('template_with_example')) return 'template_with_example';
    if (allow('questions_only')) return 'questions_only';
    if (allow('full_rewrite')) return 'full_rewrite';
    return 'suppressed';
  };

  // Owned prompts stay inside semantic policy. Late logic can only suppress, downgrade,
  // or recover when eval data is absent.
  if (params.rewritePreference === 'suppress' || params.rewriteRecommendation === 'no_rewrite_needed' || !params.rewrite) {
    return 'suppressed';
  }
  if (params.allowedModes.length === 1 && params.allowedModes[0] === 'suppressed') {
    return 'suppressed';
  }
  if (!params.evaluation) {
    return allow('full_rewrite') ? 'full_rewrite' : fallbackMode();
  }
  if (params.ladderTrace?.stopReason === 'already_strong' || params.ladderTrace?.stopReason === 'already_excellent') {
    return 'suppressed';
  }
  if (params.ladderTrace?.ladderAccepted === false) {
    if (params.ladderTrace.ladderReason === 'already_strong') {
      return params.rewritePreference === 'force' ? 'suppressed' : fallbackMode();
    }
    if (params.ladderTrace.ladderReason === 'intent_drift' || params.ladderTrace.ladderReason === 'rubric_echo_risk') {
      return allow('template_with_example') ? 'template_with_example' : fallbackMode();
    }
    if (
      isExtremelyUnderspecified(params.prompt, params.analysis) &&
      !hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext }) &&
      allow('questions_only')
    ) {
      return 'questions_only';
    }
    return allow('template_with_example') ? 'template_with_example' : fallbackMode();
  }
  if (params.evaluation.status === 'already_strong') {
    return 'suppressed';
  }
  if (params.evaluation.status === 'material_improvement') {
    return allow('full_rewrite') ? 'full_rewrite' : fallbackMode();
  }
  if (params.evaluation.status === 'minor_improvement') {
    if (hasConcreteRewriteGains(params.evaluation) && allow('full_rewrite')) {
      return 'full_rewrite';
    }
    return fallbackMode();
  }

  // For owned prompts, regression/no-change handling is downgrade-only.
  if (params.evaluation.status === 'possible_regression') {
    return allow('template_with_example') ? 'template_with_example' : fallbackMode();
  }
  if (params.evaluation.status === 'no_significant_change') {
    return allow('template_with_example') ? 'template_with_example' : fallbackMode();
  }

  return fallbackMode();
}

export function selectRewritePresentationMode(params: {
  rewriteRecommendation: RewriteRecommendation;
  rewritePreference: RewritePreference;
  evaluation: EvaluationV2 | null;
  analysis: Analysis;
  rewrite: Rewrite | null;
  scoreBand: ScoreBand;
  prompt: string;
  semanticPolicy?: SemanticRewritePolicy | null;
  effectiveAnalysisContext?: EffectiveContextLike;
  ladderTrace?: InternalLadderTrace | null;
}): RewritePresentationMode {
  const semanticOwned = isSemanticOwned(params.semanticPolicy);
  const allowedModes = params.semanticPolicy?.allowedPresentationModes ?? [
    params.rewriteRecommendation === 'no_rewrite_needed'
      ? 'suppressed'
      : params.rewriteRecommendation === 'rewrite_optional'
        ? 'template_with_example'
        : 'full_rewrite',
    'template_with_example',
    'questions_only',
    'suppressed',
  ];
  const allow = (mode: RewritePresentationMode): boolean => allowedModes.includes(mode);
  const fallbackMode = (): RewritePresentationMode => {
    if (allow('template_with_example')) return 'template_with_example';
    if (allow('questions_only')) return 'questions_only';
    if (allow('full_rewrite')) return 'full_rewrite';
    return 'suppressed';
  };

  if (semanticOwned) {
    return selectSemanticOwnedPresentationMode({
      allowedModes,
      rewritePreference: params.rewritePreference,
      rewriteRecommendation: params.rewriteRecommendation,
      evaluation: params.evaluation,
      rewrite: params.rewrite,
      analysis: params.analysis,
      prompt: params.prompt,
      effectiveAnalysisContext: params.effectiveAnalysisContext,
      ladderTrace: params.ladderTrace,
    });
  }

  if (params.rewritePreference === 'suppress' || params.rewriteRecommendation === 'no_rewrite_needed' || !params.rewrite) {
    return 'suppressed';
  }
  if (allowedModes.length === 1 && allowedModes[0] === 'suppressed') {
    return 'suppressed';
  }
  if (!params.evaluation) {
    return allow('full_rewrite') ? 'full_rewrite' : fallbackMode();
  }
  if (params.ladderTrace?.stopReason === 'already_strong' || params.ladderTrace?.stopReason === 'already_excellent') {
    return 'suppressed';
  }
  if (params.ladderTrace?.ladderAccepted === false) {
    if (params.ladderTrace.ladderReason === 'already_strong') {
      return params.rewritePreference === 'force' ? 'suppressed' : fallbackMode();
    }
    if (params.ladderTrace.ladderReason === 'intent_drift' || params.ladderTrace.ladderReason === 'rubric_echo_risk') {
      if (
        isExtremelyUnderspecified(params.prompt, params.analysis) &&
        !hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext }) &&
        allow('questions_only')
      ) {
        return 'questions_only';
      }
      return allow('template_with_example') ? 'template_with_example' : fallbackMode();
    }
    if (
      (params.scoreBand === 'poor' || params.scoreBand === 'weak' || params.scoreBand === 'usable') &&
      hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext }) &&
      allow('template_with_example')
    ) {
      return 'template_with_example';
    }
    if (allow('questions_only')) {
      return 'questions_only';
    }
    return fallbackMode();
  }

  if (params.evaluation.status === 'already_strong') {
    return 'suppressed';
  }
  if (params.evaluation.status === 'material_improvement') {
    return allow('full_rewrite') ? 'full_rewrite' : fallbackMode();
  }
  if (params.evaluation.status === 'minor_improvement') {
    if (hasConcreteRewriteGains(params.evaluation) && allow('full_rewrite')) {
      return 'full_rewrite';
    }
    return fallbackMode();
  }
  if (params.evaluation.status === 'possible_regression') {
    if (
      isExtremelyUnderspecified(params.prompt, params.analysis) &&
      !hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext }) &&
      allow('questions_only')
    ) {
      return 'questions_only';
    }
    return allow('template_with_example') ? 'template_with_example' : fallbackMode();
  }
  if (params.evaluation.status === 'no_significant_change') {
    if (
      (params.scoreBand === 'poor' || params.scoreBand === 'weak' || params.scoreBand === 'usable') &&
      hasBoundaryPattern({ analysis: params.analysis, effectiveAnalysisContext: params.effectiveAnalysisContext }) &&
      allow('template_with_example')
    ) {
      return 'template_with_example';
    }
    if (allow('questions_only')) {
      return 'questions_only';
    }
    return fallbackMode();
  }

  return fallbackMode();
}

function pushUnique(items: string[], value: string) {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function pushSemanticGapQuestions(questions: string[], family: SemanticRewritePolicy['family'], primaryGap: PrimaryGap): void {
  switch (family) {
    case 'implementation':
      if (primaryGap === 'execution') {
        pushUnique(questions, 'What runtime, framework, or execution surface should be used?');
        pushUnique(questions, 'What setup, environment, or integration constraints should be explicit?');
        pushUnique(questions, 'What validation or operational behavior must the implementation enforce?');
        return;
      }
      if (primaryGap === 'io') {
        pushUnique(questions, 'What does the input payload or request shape look like?');
        pushUnique(questions, 'What exact output, response, or return shape is required?');
        pushUnique(questions, 'What should happen on success and on failure?');
        return;
      }
      if (primaryGap === 'boundary') {
        pushUnique(questions, 'What is explicitly in scope versus out of scope?');
        pushUnique(questions, 'What auth, signature, or middleware behavior should be excluded or included?');
        pushUnique(questions, 'What constraints should prevent the implementation from expanding beyond the intended surface?');
        return;
      }
      break;
    case 'comparison':
    case 'decision_support':
      if (primaryGap === 'criteria') {
        pushUnique(questions, 'What criteria or trade-off axes should drive the answer?');
        pushUnique(questions, 'What outcome should those criteria optimize for?');
        pushUnique(questions, 'What evidence or examples should the comparison use to apply those criteria?');
        return;
      }
      if (primaryGap === 'boundary') {
        pushUnique(questions, 'What scenario, scope, or constraints should keep the answer specific?');
        pushUnique(questions, 'What should the answer explicitly include versus avoid?');
        pushUnique(questions, 'What decision context should narrow the comparison?');
        return;
      }
      if (primaryGap === 'audience') {
        pushUnique(questions, 'Who is the decision-maker or audience for this answer?');
        pushUnique(questions, 'What level of depth or technicality does that audience need?');
        pushUnique(questions, 'What practical context matters most for that audience?');
        return;
      }
      break;
    case 'context_first':
      if (primaryGap === 'context_linkage') {
        pushUnique(questions, 'Which part of the provided context should drive the answer most?');
        pushUnique(questions, 'How should the answer connect that context to the requested outcome?');
        pushUnique(questions, 'What criteria should be applied to the provided context?');
        return;
      }
      if (primaryGap === 'deliverable') {
        pushUnique(questions, 'What exact deliverable should the model produce from the provided context?');
        pushUnique(questions, 'What format or structure should that deliverable follow?');
        pushUnique(questions, 'What outcome should the deliverable help the reader reach?');
        return;
      }
      if (primaryGap === 'boundary') {
        pushUnique(questions, 'What assumptions should stay out of scope when using this context?');
        pushUnique(questions, 'What constraints should keep the answer grounded in the provided context?');
        pushUnique(questions, 'What context should be treated as decisive versus secondary?');
        return;
      }
      break;
    case 'few_shot':
      if (primaryGap === 'example_transfer') {
        pushUnique(questions, 'What should be preserved from the examples?');
        pushUnique(questions, 'What should change from the examples in the new output?');
        pushUnique(questions, 'What pattern should transfer versus stay specific to the examples?');
        return;
      }
      if (primaryGap === 'deliverable') {
        pushUnique(questions, 'What exact new output should be produced from the examples?');
        pushUnique(questions, 'What format or structure should the new output follow?');
        pushUnique(questions, 'What success criteria should the new output meet?');
        return;
      }
      if (primaryGap === 'boundary') {
        pushUnique(questions, 'What drift from the examples should be avoided?');
        pushUnique(questions, 'What constraints should limit how the new output adapts the pattern?');
        pushUnique(questions, 'What details are out of scope for the adapted output?');
        return;
      }
      break;
    case 'analysis':
      if (primaryGap === 'criteria') {
        pushUnique(questions, 'What analysis lens, standard, or diagnostic criteria should the output use?');
        pushUnique(questions, 'What should the analysis optimize for or test against?');
        pushUnique(questions, 'How should the findings be organized around those criteria?');
        return;
      }
      if (primaryGap === 'source') {
        pushUnique(questions, 'What evidence, source material, or grounding should the analysis rely on?');
        pushUnique(questions, 'What real scenario, data, or examples should anchor the analysis?');
        pushUnique(questions, 'What context should the model treat as authoritative?');
        return;
      }
      if (primaryGap === 'boundary') {
        pushUnique(questions, 'What scope or scenario should keep the analysis specific?');
        pushUnique(questions, 'What should the analysis explicitly avoid covering?');
        pushUnique(questions, 'What practical constraints should shape the analysis?');
        return;
      }
      break;
    default:
      break;
  }
}

export function buildGuidedCompletionQuestions(params: {
  role: Role;
  semanticPolicy?: SemanticRewritePolicy | null;
  bestNextMove: BestNextMove | null;
  improvementSuggestions: ImprovementSuggestion[];
  effectiveAnalysisContext?: EffectiveContextLike;
}): string[] {
  const questions: string[] = [];
  const missing = params.effectiveAnalysisContext?.missingContextType ?? null;
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  const bestMoveText = `${params.bestNextMove?.title ?? ''} ${params.bestNextMove?.rationale ?? ''}`.toLowerCase();
  const suggestionsText = params.improvementSuggestions.map((item) => `${item.title} ${item.reason}`.toLowerCase()).join(' ');

  if (params.semanticPolicy?.semanticOwned) {
    pushSemanticGapQuestions(questions, params.semanticPolicy.family, params.semanticPolicy.primaryGap);
    if (questions.length > 0) {
      return questions.slice(0, 6);
    }
  }

  // Non-owned fallback only.
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

  // Generic fallback for non-owned prompts when semantic family/gap data is absent.
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
  semanticPolicy?: SemanticRewritePolicy | null;
  effectiveAnalysisContext?: EffectiveContextLike;
}): string | null {
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  if (params.semanticPolicy?.family === 'context_first') {
    return 'Using the context below, produce [deliverable]. Base the answer primarily on [specific context points]. Evaluate it using [criteria], and avoid [out-of-scope assumptions].';
  }
  if (params.semanticPolicy?.family === 'few_shot') {
    return 'Use the examples to preserve [tone/structure/pattern]. Change [topic/details]. Produce [target output shape], and avoid [unwanted drift].';
  }
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
  semanticPolicy?: SemanticRewritePolicy | null;
  effectiveAnalysisContext?: EffectiveContextLike;
}): string | null {
  const role = params.effectiveAnalysisContext?.role ?? params.role;
  if (params.semanticPolicy?.family === 'context_first') {
    return 'Example of a stronger prompt: Given this team context, write a recommendation memo. Base the recommendation on the compliance requirement, limited SRE support, and team size. Use operational overhead and delivery risk as the criteria, and avoid generic platform advice.';
  }
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
  semanticPolicy?: SemanticRewritePolicy | null;
  bestNextMove: BestNextMove | null;
  improvementSuggestions: ImprovementSuggestion[];
  effectiveAnalysisContext?: EffectiveContextLike;
}): GuidedCompletion | null {
  const questions = buildGuidedCompletionQuestions({
    role: params.role,
    semanticPolicy: params.semanticPolicy,
    bestNextMove: params.bestNextMove,
    improvementSuggestions: params.improvementSuggestions,
    effectiveAnalysisContext: params.effectiveAnalysisContext,
  });
  const template = params.mode === 'template_with_example' ? buildGuidedCompletionTemplate(params) : null;
  const example = params.mode === 'template_with_example' && template ? buildGuidedCompletionExample(params) : null;

  if (questions.length === 0 && !template) {
    return null;
  }

  const semanticOwned = params.semanticPolicy?.semanticOwned === true;

  return {
    mode: params.mode,
    title: params.mode === 'questions_only' ? 'Questions to tighten this prompt' : 'Fill in the missing details',
    summary:
      semanticOwned
        ? params.mode === 'questions_only'
          ? 'Answer these questions to fill the remaining semantic gaps before rewriting.'
          : 'Add the missing details below to keep the rewrite aligned with the prompt intent.'
        : params.mode === 'questions_only'
          ? 'This prompt is too underspecified for a safe rewrite. Answer these questions first, then resubmit.'
          : 'This prompt is too broad for a safe rewrite, but adding concrete boundaries will make it much stronger.',
    questions: questions.length > 0 ? questions : undefined,
    template: template ?? undefined,
    example: example ?? undefined,
    rationale:
      semanticOwned
        ? params.mode === 'questions_only'
          ? 'The semantic path identified specific gaps that should be clarified before rewriting.'
          : 'The semantic path identified specific gaps, so a bounded template is safer than expanding the request.'
        : params.mode === 'questions_only'
          ? 'Questions are safer than a full rewrite because key assumptions are still missing.'
          : 'A template is safer here than a full rewrite because the original prompt is missing concrete boundaries.',
  };
}
