import type {
  AnalyzeAndRewriteRequest,
  Analysis,
  BestNextMove,
  BestNextMoveType,
  ImprovementSuggestion,
  RewriteRecommendation,
  ScoreBand,
  TargetScore,
} from '@promptfire/shared';
import { inferMissingContextType, type MissingContextType } from './missingContext';
import { detectPatternFit, projectMethodFit, type PatternFit } from './patternFit';

type Theme =
  | 'landing_page'
  | 'blog_post'
  | 'email'
  | 'comparison'
  | 'explainer'
  | 'case_study'
  | 'internal_memo'
  | 'social_post'
  | 'generic';

interface OpportunityCandidate {
  id: string;
  suggestionTitle: string;
  suggestionReason: string;
  impact: 'high' | 'medium' | 'low';
  targetScores: TargetScore[];
  category: ImprovementSuggestion['category'];
  exampleChange?: string;
  moveType: BestNextMoveType;
  moveTitle: string;
  moveRationale: string;
  priority: number;
  tieGroup: 1 | 2 | 3;
  methodFit?: BestNextMove['methodFit'];
}

export interface OpportunityParams {
  input: Pick<AnalyzeAndRewriteRequest, 'prompt' | 'role' | 'mode' | 'context'>;
  analysis: Analysis;
  overallScore: number;
  scoreBand: ScoreBand;
  rewriteRecommendation: RewriteRecommendation;
  patternFit?: PatternFit;
  effectiveContext?: {
    role: 'general' | 'developer' | 'marketer';
    canonicalTaskType: string | null;
    canonicalDeliverableType: string | null;
    missingContextType: MissingContextType;
    effectivePatternFit: PatternFit | null;
  };
}

function inferTheme(prompt: string): Theme {
  if (/\blanding page|homepage|home page\b/i.test(prompt)) {
    return 'landing_page';
  }
  if (/\bblog post|article|blog\b/i.test(prompt)) {
    return 'blog_post';
  }
  if (/\bemail\b/i.test(prompt)) {
    return 'email';
  }
  if (/\bcompare|comparison|evaluate|evaluation|versus|vs\.?\b/i.test(prompt)) {
    return 'comparison';
  }
  if (/\bexplainer|explain\b/i.test(prompt)) {
    return 'explainer';
  }
  if (/\bcase study\b/i.test(prompt)) {
    return 'case_study';
  }
  if (/\binternal memo|memo\b/i.test(prompt)) {
    return 'internal_memo';
  }
  if (/\bsocial post|linkedin post|tweet|x post\b/i.test(prompt)) {
    return 'social_post';
  }
  return 'generic';
}

function hasAudience(prompt: string, context?: Record<string, unknown>): boolean {
  if (context?.audienceHint) {
    return true;
  }

  return /\b(for|aimed at|target(?:ing|ed at)?|tailored for)\s+/i.test(prompt) || /\baudience|reader|buyer\b/i.test(prompt);
}

function hasExclusions(prompt: string, context?: Record<string, unknown>): boolean {
  return Boolean(context?.mustAvoid || context?.forbiddenPhrases) || /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt);
}

function hasProof(prompt: string, context?: Record<string, unknown>): boolean {
  return (
    Boolean(context?.mustInclude) ||
    /\b(testimonial|proof|case study|example|examples|metric|measurable|quantifiable|result|outcome)\b/i.test(prompt)
  );
}

function hasSpecificProof(prompt: string): boolean {
  return /\b(one|two|\d+|at least|exactly)\b/i.test(prompt) && hasProof(prompt);
}

function hasLeadAngle(prompt: string): boolean {
  return /\b(lead with|pain|tension|trade-off|tradeoff|risk|pressure|sprawl|overhead|readiness|governance)\b/i.test(prompt);
}

function hasStructure(prompt: string, context?: Record<string, unknown>): boolean {
  return (
    Boolean(context?.mustInclude || context?.systemGoals) ||
    /\b(headline|section|outline|table|bullet|bullets|checklist|steps|opening|cta|call to action|subject line)\b/i.test(
      prompt,
    )
  );
}

function hasResponseOutcome(prompt: string): boolean {
  return /\b(reply|response|book a demo|click|sign up|schedule|intended response|desired action)\b/i.test(prompt);
}

function hasSpecificBuyerContext(prompt: string): boolean {
  return /\b(cto|ctos|ciso|cisos|vp|vps|directors?|managers?|operators?|admins?|buyers?|decision[-\s]?makers?|procurement|it leaders?)\b/i.test(
    prompt,
  );
}

function hasCompanySegment(prompt: string, context?: Record<string, unknown>): boolean {
  return (
    Boolean(context?.audienceHint || context?.companySegment) ||
    /\b(mid[-\s]?sized|enterprise|enterprises|smb|small business|startup|startups|scale[-\s]?ups?|public sector|regulated industries?)\b/i.test(
      prompt,
    )
  );
}

function hasLandingPageBuyerContext(prompt: string, context?: Record<string, unknown>): boolean {
  if (context?.audienceHint) {
    return true;
  }

  return hasSpecificBuyerContext(prompt) || (hasAudience(prompt, context) && hasCompanySegment(prompt, context));
}

function hasTaskOverload(prompt: string): boolean {
  const directiveVerbCount =
    (prompt.match(/(?:^|[.;]\s+|\bthen\b\s+|\band\b\s+)(build|write|create|design|implement|analyze|optimize|draft)\b/gi) ?? [])
      .length;
  const listSeparators = (prompt.match(/,| and |;| then /gi) ?? []).length;
  const broadGuidePattern = /\b(complete guide|comprehensive guide|end-to-end guide|everything about)\b/i.test(prompt);
  return broadGuidePattern || directiveVerbCount >= 3 || (directiveVerbCount >= 2 && listSeparators >= 4) || listSeparators >= 8;
}

function clampSuggestionCount(scoreBand: ScoreBand, count: number): number {
  if (scoreBand === 'excellent' || scoreBand === 'strong') {
    return Math.min(2, count);
  }
  if (scoreBand === 'usable') {
    return Math.min(4, Math.max(2, count));
  }
  return Math.min(5, Math.max(2, count));
}

function lowestScoreKeys(analysis: Analysis): Array<keyof Analysis['scores']> {
  return Object.entries(analysis.scores)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key as keyof Analysis['scores']);
}

function missingContextPriorityBoost(type: MissingContextType, candidate: OpportunityCandidate): number {
  if (type === null) {
    return 0;
  }

  if (
    type === 'execution' &&
    (candidate.id === 'add_execution_context' || candidate.id === 'define_io_contract')
  ) {
    return 80;
  }
  if (type === 'source' && candidate.id === 'supply_missing_context') {
    return 80;
  }
  if (type === 'comparison' && (candidate.id === 'add_decision_criteria' || candidate.id === 'shift_to_comparison_pattern')) {
    return 75;
  }
  if (type === 'audience' && (candidate.id === 'add_audience' || candidate.id === 'add_buyer_context' || candidate.id === 'shift_to_audience_outcome_pattern')) {
    return 65;
  }

  return 0;
}

export function generateOpportunityCandidates(params: OpportunityParams): OpportunityCandidate[] {
  const prompt = params.input.prompt.trim();
  const context = params.input.context;
  const theme = inferTheme(prompt);
  const issueSet = new Set(params.analysis.detectedIssueCodes);
  const isStrongPrompt =
    params.scoreBand === 'strong' ||
    params.scoreBand === 'excellent' ||
    params.rewriteRecommendation === 'no_rewrite_needed';
  const patternFit =
    params.effectiveContext?.effectivePatternFit ??
    params.patternFit ??
    detectPatternFit({
      prompt,
      role: params.input.role,
      mode: params.input.mode,
      analysis: params.analysis,
      context,
    });
  const methodFit =
    projectMethodFit(
      {
        prompt,
        role: params.input.role,
        mode: params.input.mode,
        analysis: params.analysis,
        context,
      },
      patternFit,
    ) ?? undefined;
  const candidates: OpportunityCandidate[] = [];
  const hasComparisonIntent = /\b(compare|comparison|versus|vs\.?|better than)\b/i.test(prompt);
  const hasDecisionIntent = /\b(decide|decision(?!-makers?)|which option|when .* and when .*|trade[-\s]?off)\b/i.test(prompt);
  const missingContextType =
    params.effectiveContext?.missingContextType ??
    inferMissingContextType({
      prompt,
      role: params.input.role,
      patternFit,
      analysis: params.analysis,
    });
  const isBoundedDeveloperCodePrompt =
    (params.effectiveContext?.role ?? params.input.role) === 'developer' &&
    params.effectiveContext?.canonicalDeliverableType === 'code' &&
    params.effectiveContext?.canonicalTaskType === 'implementation_code' &&
    missingContextType === null &&
    patternFit.primary === 'direct_instruction';

  const push = (candidate: OpportunityCandidate) => {
    candidates.push({
      ...candidate,
      suggestionTitle: isStrongPrompt ? `Optional: ${candidate.suggestionTitle}` : candidate.suggestionTitle,
      impact: isStrongPrompt ? 'low' : candidate.impact,
    });
  };

  if (patternFit.primary === 'stepwise_reasoning') {
    const moveType = hasComparisonIntent ? 'shift_to_comparison_pattern' : 'shift_to_decision_frame';
    push({
      id: moveType,
      suggestionTitle: moveType === 'shift_to_comparison_pattern' ? 'shift to a comparison pattern' : 'break the reasoning into steps',
      suggestionReason:
        moveType === 'shift_to_comparison_pattern'
          ? 'This task is comparative, so explicit comparison framing will do more work than generic explanation.'
          : 'This task depends on trade-offs or judgment, so a stepwise structure will work better than a broad explanation.',
      impact: 'high',
      targetScores: ['contrast', 'constraintQuality', 'genericOutputRisk'],
      category: 'framing',
      moveType,
      moveTitle: moveType === 'shift_to_comparison_pattern' ? 'Shift to a comparison pattern' : 'Break the reasoning into steps',
      moveRationale:
        moveType === 'shift_to_comparison_pattern'
          ? 'The prompt needs explicit comparison structure more than broad explanation, so the model can judge options instead of drifting into generic summary.'
          : 'The prompt needs an explicit sequence for weighing dimensions, trade-offs, and the final recommendation.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange:
        moveType === 'shift_to_comparison_pattern'
          ? 'Ask for the options to be compared against named criteria or trade-offs.'
          : 'Ask the model to identify the dimensions first, weigh them second, and conclude with a recommendation third.',
    });
  }

  if (patternFit.primary === 'few_shot' && !isBoundedDeveloperCodePrompt) {
    push({
      id: 'require_examples',
      suggestionTitle: 'add one or two examples',
      suggestionReason: 'This task is easier to demonstrate than describe, so compact examples will control the output better than extra prose.',
      impact: 'high',
      targetScores: ['clarity', 'constraintQuality', 'genericOutputRisk'],
      category: 'proof',
      moveType: 'require_examples',
      moveTitle: 'Add one or two examples',
      moveRationale: 'A few compact examples will show the model the pattern to follow and reduce ambiguity faster than more instructions.',
      priority: 2,
      tieGroup: 1,
      methodFit,
      exampleChange: 'Include one or two short examples of the style, structure, or transformation you want.',
    });
  }

  if (patternFit.primary === 'decomposition') {
    push({
      id: 'reduce_task_load',
      suggestionTitle: 'split the task into stages',
      suggestionReason: 'This prompt is overloaded, so splitting it into stages will improve focus before smaller copy-level fixes matter.',
      impact: 'high',
      targetScores: ['scope', 'tokenWasteRisk'],
      category: 'task_load',
      moveType: 'reduce_task_load',
      moveTitle: 'Split the task into stages',
      moveRationale: 'The prompt is trying to do too much at once. Breaking it into stages will reduce sprawl and improve focus.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange: 'Ask for the first deliverable now, then move secondary outputs into a follow-up step or prompt.',
    });
  }

  if (patternFit.primary === 'decision_rubric') {
    push({
      id: 'add_decision_criteria',
      suggestionTitle: 'add evaluation criteria',
      suggestionReason: 'This task is about scoring or ranking, so the prompt should define the criteria and verdict format explicitly.',
      impact: 'high',
      targetScores: ['contrast', 'constraintQuality'],
      category: 'theme_specific',
      moveType: 'add_decision_criteria',
      moveTitle: 'Add evaluation criteria',
      moveRationale: 'The prompt should define how options are judged so the output stays consistent and grounded in the right criteria.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange: 'List the criteria, weighting, or verdict format the scoring should use.',
    });
  }

  if (patternFit.primary === 'context_first') {
    push({
      id: 'supply_missing_context',
      suggestionTitle: 'supply the missing context',
      suggestionReason: 'This task asks for grounded specifics, but the source material or facts are missing.',
      impact: 'high',
      targetScores: ['constraintQuality', 'genericOutputRisk', 'contrast'],
      category: 'proof',
      moveType: 'add_proof_requirement',
      moveTitle: 'Supply the missing context',
      moveRationale: 'The model needs the source material, customer facts, or evidence before it can produce grounded specifics without inventing detail.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange: 'Provide the source notes, transcript, customer facts, or examples the output should use.',
    });
  }

  if (missingContextType === 'source' && patternFit.primary !== 'context_first') {
    push({
      id: 'supply_missing_context',
      suggestionTitle: 'supply the source context',
      suggestionReason:
        'This request depends on source material, but the prompt does not include the transcript, notes, or reference content.',
      impact: 'high',
      targetScores: ['constraintQuality', 'genericOutputRisk', 'scope'],
      category: 'proof',
      moveType: 'add_proof_requirement',
      moveTitle: 'Supply the source context',
      moveRationale:
        'The model needs the source content before it can summarize or transform accurately without filling gaps.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange: 'Attach or paste the source transcript, notes, or document the output must be based on.',
    });
  }

  if (params.input.role === 'developer' && missingContextType === 'execution' && !isBoundedDeveloperCodePrompt) {
    push({
      id: 'add_execution_context',
      suggestionTitle: 'add runtime and execution constraints',
      suggestionReason:
        'Implementation prompts are more useful when they specify runtime, framework assumptions, validation, and failure behavior.',
      impact: 'high',
      targetScores: ['constraintQuality', 'scope', 'genericOutputRisk'],
      category: 'boundary',
      moveType: 'clarify_output_structure',
      moveTitle: 'Add runtime and execution constraints',
      moveRationale:
        'This prompt needs execution details such as runtime, interfaces, validation rules, and error/retry behavior before copy-level refinements.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange:
        'Specify runtime/language, interface assumptions, payload validation, error status behavior, retry/idempotency, and explicit exclusions.',
    });
  }

  if (missingContextType === 'io') {
    push({
      id: 'define_io_contract',
      suggestionTitle: 'define input and output shape',
      suggestionReason:
        'The prompt should specify expected input and output structure to reduce ambiguity and generic responses.',
      impact: 'high',
      targetScores: ['constraintQuality', 'clarity', 'genericOutputRisk'],
      category: 'structure',
      moveType: 'clarify_output_structure',
      moveTitle: 'Define input and output shape',
      moveRationale:
        'The model needs explicit input/output shape constraints so the result is directly usable instead of generic.',
      priority: 2,
      tieGroup: 1,
      exampleChange: 'Define input schema, required output format, and validation requirements.',
    });
  }

  if (missingContextType === 'operating' && params.input.role !== 'developer') {
    push({
      id: 'add_operating_context',
      suggestionTitle: 'add operating context',
      suggestionReason:
        'The task would be more precise with environment assumptions such as production conditions, cost/latency limits, or business context.',
      impact: 'medium',
      targetScores: ['scope', 'contrast', 'genericOutputRisk'],
      category: 'framing',
      moveType: 'add_framing_boundary',
      moveTitle: 'Add operating context',
      moveRationale:
        'Adding operating context narrows decisions and prevents broad default output.',
      priority: 4,
      tieGroup: 2,
      exampleChange:
        'State operating constraints such as production environment, latency/cost limits, compliance requirements, or deployment boundaries.',
    });
  }

  const landingPageHasBuyerContext = hasLandingPageBuyerContext(prompt, context);
  const shouldSuggestAudience =
    (params.input.role !== 'developer' || missingContextType === 'audience') &&
    (
      theme === 'landing_page'
        ? !hasAudience(prompt, context) || !landingPageHasBuyerContext
        : !hasAudience(prompt, context) || issueSet.has('AUDIENCE_MISSING') || params.analysis.scores.scope <= 5
    );
  if (shouldSuggestAudience) {
    push({
      id: theme === 'landing_page' ? 'add_buyer_context' : 'add_audience',
      suggestionTitle: theme === 'landing_page' ? 'add target buyer context' : 'add a specific audience',
      suggestionReason:
        theme === 'landing_page'
          ? 'The prompt does not clearly define who the page is meant to convert, which weakens scope and positioning.'
          : 'The prompt does not identify who the output is for, which increases generic output risk.',
      impact: 'high',
      targetScores: ['scope', 'contrast', 'genericOutputRisk'],
      category: 'audience',
      moveType: theme === 'landing_page' ? 'shift_to_audience_outcome_pattern' : 'add_audience',
      moveTitle: theme === 'landing_page' ? 'Add buyer context and outcome' : 'Add a specific audience',
      moveRationale:
        theme === 'landing_page'
          ? 'The prompt still lacks clear buyer context, so the output has no reliable conversion target and will stay broad.'
          : 'The prompt needs a defined audience before other refinements matter, otherwise the model will default to generic output.',
      priority: theme === 'landing_page' ? 3 : 6,
      tieGroup: 2,
      exampleChange:
        theme === 'landing_page'
          ? 'Specify the buyer, operator, or decision-maker this page should speak to and the outcome it should drive.'
          : 'Specify the buyer, reader, or operator this is meant for.',
    });
  }

  if (theme === 'landing_page' && landingPageHasBuyerContext && !hasResponseOutcome(prompt)) {
    push({
      id: 'define_conversion_goal',
      suggestionTitle: 'define the conversion goal',
      suggestionReason:
        'The prompt already has an audience, but it does not say what action or response the page should drive.',
      impact: 'medium',
      targetScores: ['constraintQuality', 'clarity', 'contrast'],
      category: 'structure',
      moveType: 'add_framing_boundary',
      moveTitle: 'Define the conversion goal',
      moveRationale:
        'The page has a buyer, but the prompt does not define the response it should drive, so the copy direction will stay broad.',
      priority: 11,
      tieGroup: 2,
      exampleChange: 'Specify the intended action, such as booking a demo, requesting an assessment, or starting a trial.',
    });
  }

  if (issueSet.has('TASK_OVERLOADED') || hasTaskOverload(prompt) || params.analysis.scores.tokenWasteRisk >= 6) {
    push({
      id: 'reduce_task_load',
      suggestionTitle: 'split or narrow the task load',
      suggestionReason: 'Bundling multiple jobs together makes the output broader, less focused, and more wasteful.',
      impact: 'high',
      targetScores: ['scope', 'tokenWasteRisk'],
      category: 'task_load',
      moveType: 'reduce_task_load',
      moveTitle: 'Narrow the task load',
      moveRationale: 'This prompt tries to do too many jobs at once, which increases generic-output risk and token waste before wording quality matters.',
      priority: patternFit.primary === 'decomposition' ? 10 : 2,
      tieGroup: 1,
      exampleChange: 'Reduce the request to one deliverable or move secondary asks into a separate prompt.',
    });
  }

  if (
    (theme === 'comparison' && !/\b(criteria|trade-off|tradeoff|recommend(?:ation)?|decision)\b/i.test(prompt)) ||
    (hasDecisionIntent && params.analysis.scores.contrast <= 6)
  ) {
    push({
      id: 'add_decision_criteria',
      suggestionTitle: 'name the decision criteria',
      suggestionReason: 'Comparison and trade-off prompts are stronger when they define how options should be evaluated.',
      impact: 'high',
      targetScores: ['contrast', 'constraintQuality'],
      category: 'theme_specific',
      moveType: 'add_decision_criteria',
      moveTitle: 'Add decision criteria',
      moveRationale: 'The task implies evaluation, but the prompt does not tell the model which criteria or trade-offs should drive the judgment.',
      priority: patternFit.primary === 'decision_rubric' ? 10 : 5,
      tieGroup: 2,
      exampleChange: 'List the criteria, trade-offs, or decision boundary the comparison must use.',
    });
  }

  if (
    (theme === 'landing_page' && !hasLeadAngle(prompt)) ||
    (theme === 'blog_post' && !hasLeadAngle(prompt))
  ) {
    push({
      id: theme === 'landing_page' ? 'add_business_pain' : 'add_core_tension',
      suggestionTitle: theme === 'landing_page' ? 'add a specific business pain' : 'name the core tension or trade-off',
      suggestionReason:
        theme === 'landing_page'
          ? 'Landing-page prompts improve when they name the pressure or pain the buyer is trying to solve.'
          : 'A stated tension gives the post a sharper angle than a broad topic summary.',
      impact: 'high',
      targetScores: ['contrast', 'genericOutputRisk'],
      category: theme === 'landing_page' ? 'theme_specific' : 'framing',
      moveType: 'add_framing_boundary',
      moveTitle: theme === 'landing_page' ? 'Add a sharper problem frame' : 'Add a sharper framing boundary',
      moveRationale:
        theme === 'landing_page'
          ? 'The prompt needs a specific buyer problem or pressure, otherwise the copy will drift into category-default claims.'
          : 'The prompt needs an explicit tension or trade-off so the output has an angle instead of a broad summary.',
      priority: theme === 'landing_page' ? 8 : 9,
      tieGroup: 3,
      exampleChange:
        theme === 'landing_page'
          ? 'Add the operational pain, pressure, or risk the page should lead with.'
          : 'State what trade-off, conflict, or decision the post should examine.',
    });
  }

  if (
    (!hasProof(prompt, context) && params.analysis.scores.contrast <= 6) ||
    (theme === 'landing_page' && !hasSpecificProof(prompt)) ||
    (theme === 'blog_post' && !/\bexample|examples\b/i.test(prompt))
  ) {
    const requireExamples = !isBoundedDeveloperCodePrompt && (theme === 'blog_post' || patternFit.primary === 'few_shot');
    push({
      id: requireExamples ? 'require_examples' : isStrongPrompt ? 'optional_proof_requirement' : 'add_proof_requirement',
      suggestionTitle: requireExamples ? 'require specific examples' : 'require one proof point',
      suggestionReason: requireExamples
        ? 'Examples make the post more specific and reduce the chance of abstract, generic output.'
        : isStrongPrompt
          ? 'A proof requirement may slightly improve differentiation, but the prompt is already strong.'
          : 'A proof requirement helps push the output beyond category-default claims.',
      impact: requireExamples ? 'medium' : isStrongPrompt ? 'low' : 'medium',
      targetScores: requireExamples ? ['contrast', 'constraintQuality', 'genericOutputRisk'] : ['contrast', 'constraintQuality'],
      category: 'proof',
      moveType: requireExamples ? 'require_examples' : 'add_proof_requirement',
      moveTitle: requireExamples ? 'Require specific examples' : 'Require one proof point',
      moveRationale: requireExamples
        ? 'Specific examples will improve specificity faster than more wording polish.'
        : 'A proof requirement will make the output less generic by forcing one supported claim or clear comparison.',
      priority: patternFit.primary === 'few_shot' ? 8 : isStrongPrompt ? 50 : 30,
      tieGroup: 3,
      exampleChange: requireExamples
        ? 'Require one or two specific examples, scenarios, or cases.'
        : 'Require one measurable example, customer proof point, or clear comparison.',
    });
  }

  if (!hasExclusions(prompt, context) || issueSet.has('EXCLUSIONS_MISSING')) {
    push({
      id: 'add_exclusion',
      suggestionTitle: 'add one exclusion',
      suggestionReason: 'An exclusion helps prevent generic category-default language and keeps the model inside clear boundaries.',
      impact: isStrongPrompt ? 'low' : 'medium',
      targetScores: ['constraintQuality', 'genericOutputRisk'],
      category: 'exclusion',
      moveType: 'add_exclusion',
      moveTitle: 'Add one exclusion',
      moveRationale: 'A clear exclusion will reduce generic drift, but it is usually secondary to audience, structure, or task-shaping fixes.',
      priority: isStrongPrompt ? 60 : 15,
      tieGroup: 3,
      exampleChange: 'Add a phrase such as "avoid generic buzzwords" or define one angle to leave out.',
    });
  }

  if (
    issueSet.has('CONSTRAINTS_MISSING') ||
    params.analysis.scores.constraintQuality <= 5 ||
    (theme === 'email' && !hasResponseOutcome(prompt)) ||
    (!hasStructure(prompt, context) && params.analysis.scores.clarity <= 6)
  ) {
    push({
      id: theme === 'email' && !hasResponseOutcome(prompt) ? 'define_email_outcome' : !hasStructure(prompt, context) ? 'clarify_output_structure' : 'add_constraints',
      suggestionTitle:
        theme === 'email' && !hasResponseOutcome(prompt)
          ? 'state the intended response'
          : !hasStructure(prompt, context)
            ? 'specify the output structure'
            : 'add specific constraints',
      suggestionReason:
        theme === 'email' && !hasResponseOutcome(prompt)
          ? 'Email prompts improve when they define what action or reply the message should drive.'
          : !hasStructure(prompt, context)
            ? isStrongPrompt
              ? 'A tighter structure may improve consistency, but the prompt is already strong.'
              : 'A clearer structure gives the model less room to drift into generic formatting.'
            : 'The prompt needs more explicit boundaries on what to include, how much to include, or how to frame it.',
      impact: theme === 'email' && !hasResponseOutcome(prompt) ? 'high' : !hasStructure(prompt, context) ? isStrongPrompt ? 'low' : 'medium' : 'high',
      targetScores:
        theme === 'email' && !hasResponseOutcome(prompt)
          ? ['constraintQuality', 'clarity', 'genericOutputRisk']
          : !hasStructure(prompt, context)
            ? ['clarity', 'constraintQuality']
            : ['scope', 'constraintQuality', 'tokenWasteRisk'],
      category: !hasStructure(prompt, context) ? 'structure' : 'boundary',
      moveType: 'clarify_output_structure',
      moveTitle:
        theme === 'email' && !hasResponseOutcome(prompt) ? 'State the intended response' : 'Clarify the output structure',
      moveRationale:
        theme === 'email' && !hasResponseOutcome(prompt)
          ? 'The prompt should define the reply or action it wants, otherwise the message direction stays loose.'
          : !hasStructure(prompt, context)
            ? 'The prompt needs a clearer output form so the model can stay bounded and consistent.'
            : 'The prompt needs clearer output boundaries before smaller refinements will matter.',
      priority: isStrongPrompt ? 70 : 12,
      tieGroup: 2,
      exampleChange:
        theme === 'email' && !hasResponseOutcome(prompt)
          ? 'Specify the desired reply, call to action, or next step.'
          : !hasStructure(prompt, context)
            ? 'Name the sections, format, or sequence the output should follow.'
            : 'Set a limit, required element, or framing boundary the output must follow.',
    });
  }

  if (isBoundedDeveloperCodePrompt) {
    push({
      id: 'clarify_output_structure',
      suggestionTitle: 'clarify request/response contract details',
      suggestionReason:
        'This prompt is already bounded at runtime/framework level; the next gains come from exact schema fields and contract boundaries.',
      impact: 'high',
      targetScores: ['constraintQuality', 'clarity', 'genericOutputRisk'],
      category: 'structure',
      moveType: 'clarify_output_structure',
      moveTitle: 'Clarify request/response contract details',
      moveRationale:
        'Specify exact schema fields, auth/signature scope, retry/idempotency semantics, config boundaries, and sample payload/test coverage.',
      priority: 1,
      tieGroup: 1,
      methodFit,
      exampleChange:
        'Define required schema properties, auth/signature checks, success/error payload shape, retry/idempotency handling, and one test payload set.',
    });
  }

  if (
    theme === 'blog_post' &&
    !/\b(avoid hype|avoid generic|keep the tone grounded|rather than)\b/i.test(prompt) &&
    params.analysis.scores.genericOutputRisk >= 4
  ) {
    push({
      id: 'add_framing_boundary',
      suggestionTitle: 'add a framing boundary',
      suggestionReason: 'A blog prompt benefits from a clear stance on what tone, angle, or framing to avoid.',
      impact: 'medium',
      targetScores: ['contrast', 'genericOutputRisk'],
      category: 'framing',
      moveType: 'add_framing_boundary',
      moveTitle: 'Add a framing boundary',
      moveRationale: 'An explicit anti-generic or anti-hype boundary will make the output more differentiated.',
      priority: 25,
      tieGroup: 3,
      exampleChange: 'Add anti-hype, anti-generic, or trade-off framing guidance.',
    });
  }

  if (patternFit.primary === 'direct_instruction' && !hasAudience(prompt, context)) {
    push({
      id: 'shift_to_audience_outcome_pattern',
      suggestionTitle: 'shift to an audience-outcome pattern',
      suggestionReason: 'The prompt needs a named audience and outcome before a full rewrite will add much value.',
      impact: 'high',
      targetScores: ['scope', 'clarity', 'genericOutputRisk'],
      category: 'audience',
      moveType: 'shift_to_audience_outcome_pattern',
      moveTitle: 'Shift to an audience-outcome pattern',
      moveRationale: 'The prompt is broad because it does not anchor the task around who the output is for and what result it should drive.',
      priority: 7,
      tieGroup: 1,
      methodFit,
      exampleChange: 'State who the output is for, what deliverable you want, and what outcome it should support.',
    });
  }

  return candidates
    .sort((a, b) => {
      const boostDelta = missingContextPriorityBoost(missingContextType, b) - missingContextPriorityBoost(missingContextType, a);
      if (boostDelta !== 0) {
        return boostDelta;
      }
      return a.priority - b.priority || a.tieGroup - b.tieGroup;
    })
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index);
}

export function generateImprovementSuggestionsFromCandidates(
  analysis: Analysis,
  scoreBand: ScoreBand,
  candidates: OpportunityCandidate[],
): ImprovementSuggestion[] {
  const prioritized = lowestScoreKeys(analysis)
    .flatMap((scoreKey) =>
      candidates.filter((candidate) => candidate.targetScores.includes(scoreKey) || candidate.category === 'theme_specific'),
    )
    .concat(candidates)
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index);

  const limit = clampSuggestionCount(scoreBand, prioritized.length);
  return prioritized.slice(0, limit).map((candidate) => ({
    id: candidate.id,
    title: candidate.suggestionTitle,
    reason: candidate.suggestionReason,
    impact: candidate.impact,
    targetScores: candidate.targetScores,
    category: candidate.category,
    exampleChange: candidate.exampleChange,
  }));
}

export function generateBestNextMoveFromCandidates(
  scoreBand: ScoreBand,
  rewriteRecommendation: RewriteRecommendation,
  candidates: OpportunityCandidate[],
): BestNextMove | null {
  const topCandidate = candidates[0];
  if (!topCandidate) {
    return null;
  }
  const isActuallyStrong = scoreBand === 'strong' || scoreBand === 'excellent';
  if (
    rewriteRecommendation === 'no_rewrite_needed' &&
    isActuallyStrong &&
    topCandidate.impact === 'low' &&
    topCandidate.moveType !== 'add_proof_requirement' &&
    topCandidate.moveType !== 'clarify_output_structure'
  ) {
    return null;
  }

  return {
    id: topCandidate.id,
    type: topCandidate.moveType,
    title: topCandidate.suggestionTitle.charAt(0).toUpperCase() + topCandidate.suggestionTitle.slice(1),
    rationale: topCandidate.moveRationale,
    expectedImpact: topCandidate.impact,
    targetScores: topCandidate.targetScores,
    methodFit: topCandidate.methodFit,
    exampleChange: topCandidate.exampleChange,
  };
}
