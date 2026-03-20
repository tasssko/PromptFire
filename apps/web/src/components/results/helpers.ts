import type {
  AnalyzeAndRewriteV2Response,
  EvaluationV2,
  ImprovementSuggestion,
  RewritePresentationMode,
  Role,
  ScoreBand,
} from '@promptfire/shared';
import {
  resolveRoleVariant,
  resultsUiConfig,
  type GuidedCompletionCopy,
  type ResultActionId,
  type ResultFindingId,
  type ResultSectionId,
  type ResultVerdictId,
  type RewriteVerdictCopy,
} from '../../config/resultsUiConfig';
export type { ProductState } from '../../config/resultsUiConfig';
import type { ProductState } from '../../config/resultsUiConfig';

export type PrimarySurfaceKind = 'full-rewrite' | 'guided-completion-form' | 'guided-completion-legacy' | 'no-rewrite-needed';

export type HeroView = {
  headline: string;
  supporting: string;
  primaryAction: string;
  secondaryAction?: string;
};

export type ActionCardView = {
  title: string;
  lead: string;
  reasons: string[];
  eyebrow?: string;
  questionTitle?: string;
  questions?: string[];
  templateLabel?: string;
  template?: string;
  exampleLabel?: string;
  example?: string;
  primaryActionLabel: string;
  formSubmitLabel?: string;
  formSkipLabel?: string;
  secondaryActionLabel?: string;
  secondaryActionExpandedLabel?: string;
  forceRewriteLabel: string;
  rewritePreviewTitle: string;
  previewCopyLabel: string;
};

export type RewritePanelView = {
  title: string;
  verdictLabel: string;
  verdictRecommendation: string;
  primaryActionLabel: string;
};

export type SectionTitleMap = Record<ResultSectionId, string>;

export type ResultsPresentation = {
  state: ProductState;
  verdictId: ResultVerdictId;
  primarySurface: PrimarySurfaceKind;
  visibleSectionIds: ResultSectionId[];
  hero: HeroView;
  findings: string[];
  sectionTitles: SectionTitleMap;
  actionCard: ActionCardView;
  rewritePanel: RewritePanelView;
};

const issueFindingMap = {
  AUDIENCE_MISSING: 'audience_missing',
  CONSTRAINTS_MISSING: 'constraints_missing',
  EXCLUSIONS_MISSING: 'exclusions_missing',
  TASK_OVERLOADED: 'task_overloaded',
  GENERIC_PHRASES_DETECTED: 'generic_phrases_detected',
  GENERIC_OUTPUT_RISK_HIGH: 'high_generic_risk',
  LOW_EXPECTED_IMPROVEMENT: 'rewrite_low_value',
  PROMPT_ALREADY_OPTIMIZED: 'already_strong_before_rewrite',
  PROMPT_CONVERGENCE_DETECTED: 'rewrite_low_value',
  REWRITE_POSSIBLE_REGRESSION: 'rewrite_possible_regression',
} satisfies Partial<Record<AnalyzeAndRewriteV2Response['analysis']['detectedIssueCodes'][number], ResultFindingId>>;

export function toProductState(rewriteRecommendation: AnalyzeAndRewriteV2Response['rewriteRecommendation']): ProductState {
  switch (rewriteRecommendation) {
    case 'no_rewrite_needed':
      return 'strong';
    case 'rewrite_optional':
      return 'usable';
    case 'rewrite_recommended':
    default:
      return 'weak';
  }
}

export function getRewritePresentationMode(result: AnalyzeAndRewriteV2Response): RewritePresentationMode {
  return result.rewritePresentationMode ?? (result.rewrite ? 'full_rewrite' : 'suppressed');
}

export function hasMaterialRewrite(result: AnalyzeAndRewriteV2Response): boolean {
  return (
    getRewritePresentationMode(result) === 'full_rewrite' &&
    Boolean(result.rewrite) &&
    result.evaluation?.status === 'material_improvement'
  );
}

export function isGuidedSubmitRewriteResult(result: AnalyzeAndRewriteV2Response): boolean {
  return result.requestSource === 'guided_submit' && Boolean(result.rewrite);
}

function guidedRewriteStatus(result: AnalyzeAndRewriteV2Response): AnalyzeAndRewriteV2Response['guidedRewriteOutcome']['status'] | null {
  return result.guidedRewriteOutcome?.status ?? (isGuidedSubmitRewriteResult(result) ? 'stronger_prompt' : null);
}

export function isRewriteScaffoldLeak(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('original request:') &&
    normalized.includes('additional constraints:') &&
    normalized.includes('create a stronger, more specific version')
  );
}

export function getVisibleRewritePrompt(result: AnalyzeAndRewriteV2Response): string | null {
  const prompt = result.rewrite?.rewrittenPrompt?.trim() ?? '';
  if (prompt.length === 0 || isRewriteScaffoldLeak(prompt)) {
    return null;
  }

  return prompt;
}

export function hasGuidedCompletionForm(result: AnalyzeAndRewriteV2Response): boolean {
  return Boolean(result.guidedCompletionForm?.enabled && result.guidedCompletionForm.blocks.length > 0);
}

export function resolvePrimarySurface(result: AnalyzeAndRewriteV2Response): PrimarySurfaceKind {
  if (isGuidedSubmitRewriteResult(result)) {
    return 'full-rewrite';
  }

  if (result.rewriteRecommendation === 'no_rewrite_needed') {
    return 'no-rewrite-needed';
  }

  if (hasMaterialRewrite(result)) {
    return 'full-rewrite';
  }

  if (hasGuidedCompletionForm(result)) {
    return 'guided-completion-form';
  }

  return 'guided-completion-legacy';
}

export function resolveVerdictId(result: AnalyzeAndRewriteV2Response): ResultVerdictId {
  const state = toProductState(result.rewriteRecommendation);

  if (result.evaluation?.status === 'material_improvement') {
    return 'rewrite_material_improvement';
  }

  if (result.evaluation?.status === 'possible_regression') {
    return 'rewrite_possible_regression';
  }

  if (result.evaluation?.status === 'already_strong') {
    return 'rewrite_already_strong';
  }

  if (state === 'strong' && result.gating.rewritePreference === 'suppress') {
    return 'strong_suppressed';
  }

  if (state === 'strong' && result.gating.rewritePreference === 'force' && result.rewrite) {
    return 'strong_forced';
  }

  if (state === 'strong') {
    return 'strong_default';
  }

  if (state === 'usable') {
    return result.rewrite ? 'usable_with_rewrite' : 'usable_default';
  }

  return result.rewrite ? 'weak_default' : 'weak_without_rewrite';
}

export function resolveFindingIds(result: AnalyzeAndRewriteV2Response): ResultFindingId[] {
  const findings = new Set<ResultFindingId>();
  const { scores } = result.analysis;

  if (scores.scope >= 7) findings.add('clear_scope');
  if (scores.contrast >= 7) findings.add('strong_contrast');
  if (scores.clarity >= 7) findings.add('clear_instruction');
  if (scores.constraintQuality >= 7) findings.add('useful_constraints');
  if (scores.genericOutputRisk <= 3) findings.add('low_generic_risk');
  if (scores.tokenWasteRisk <= 3) findings.add('low_token_risk');

  if (result.gating.rewritePreference === 'suppress') findings.add('rewrite_suppressed_by_user');
  if (result.gating.rewritePreference === 'force' && result.rewrite) findings.add('rewrite_forced_by_user');
  if (result.gating.expectedImprovement === 'low' && result.rewrite) findings.add('rewrite_low_value');

  if (result.evaluation?.status === 'possible_regression') findings.add('rewrite_possible_regression');
  if (result.evaluation?.status === 'already_strong') findings.add('already_strong_before_rewrite');

  for (const code of result.analysis.detectedIssueCodes) {
    const findingId = issueFindingMap[code];
    if (findingId) {
      findings.add(findingId);
    }
  }

  return [...findings];
}

export function resolvePrimaryActionId(result: AnalyzeAndRewriteV2Response): ResultActionId {
  const primarySurface = resolvePrimarySurface(result);

  if (primarySurface === 'no-rewrite-needed') {
    return 'copy_original_prompt';
  }

  if (primarySurface === 'full-rewrite') {
    return 'copy_rewritten_prompt';
  }

  if (primarySurface === 'guided-completion-form') {
    return 'copy_original_prompt';
  }

  if (result.guidedCompletion?.template) {
    return 'copy_template';
  }

  if (result.guidedCompletion?.example) {
    return 'copy_example';
  }

  if (result.guidedCompletion?.questions?.length) {
    return 'copy_questions';
  }

  return resultsUiConfig.verdicts[resolveVerdictId(result)].primaryAction;
}

export function resolveVisibleSections(result: AnalyzeAndRewriteV2Response): ResultSectionId[] {
  const visibleSections = [...resultsUiConfig.verdicts[resolveVerdictId(result)].visibleSections];

  if (isGuidedSubmitRewriteResult(result) && !visibleSections.includes('rewrite_panel')) {
    const technicalDetailsIndex = visibleSections.indexOf('technical_details');
    if (technicalDetailsIndex >= 0) {
      visibleSections.splice(technicalDetailsIndex, 0, 'rewrite_panel');
    } else {
      visibleSections.push('rewrite_panel');
    }
  }

  return visibleSections;
}

export function resolveSectionTitles(result: AnalyzeAndRewriteV2Response, role: Role): SectionTitleMap {
  const state = toProductState(result.rewriteRecommendation);

  return {
    findings: resolveRoleVariant(resultsUiConfig.sections.findings.title, role).value,
    subscores: resolveRoleVariant(resultsUiConfig.sections.subscores.title, role).value,
    action_card: resolveRoleVariant(resultsUiConfig.states[state].actionCardTitle, role).title,
    rewrite_panel: resolveRoleVariant(resultsUiConfig.states[state].rewritePanelTitle, role).title,
    technical_details: resolveRoleVariant(resultsUiConfig.sections.technical_details.title, role).value,
  };
}

function resolveActionLabel(actionId: ResultActionId, role: Role): string {
  return resolveRoleVariant(resultsUiConfig.actions[actionId].text, role).label;
}

function resolveRewriteVerdict(evaluation: EvaluationV2, role: Role): RewriteVerdictCopy {
  return resolveRoleVariant(resultsUiConfig.rewriteVerdicts[evaluation.status], role);
}

function resolveGuidedCopy(result: AnalyzeAndRewriteV2Response, role: Role): GuidedCompletionCopy {
  const verdict = resultsUiConfig.verdicts[resolveVerdictId(result)];
  const guidedCompletion = verdict.guidedCompletion ?? resultsUiConfig.verdicts.weak_default.guidedCompletion;

  return resolveRoleVariant(guidedCompletion!, role);
}

export function resolveHeroView(result: AnalyzeAndRewriteV2Response, role: Role): HeroView {
  const verdict = resultsUiConfig.verdicts[resolveVerdictId(result)];
  const hero = resolveRoleVariant(verdict.hero, role);
  const primarySurface = resolvePrimarySurface(result);

  if (primarySurface === 'guided-completion-form') {
    return {
      headline: 'Prompt is too open-ended',
      supporting: 'The prompt needs stronger boundaries before a rewrite can add much value.',
      primaryAction: 'Complete missing details',
      secondaryAction: 'Rewrite anyway',
    };
  }

  const primaryAction = resolveActionLabel(resolvePrimaryActionId(result), role);

  if (isGuidedSubmitRewriteResult(result)) {
    const status = guidedRewriteStatus(result);
    return {
      headline: status === 'stronger_prompt' ? 'Stronger prompt' : 'Guided draft',
      supporting:
        status === 'did_not_improve'
          ? 'This draft did not improve the score.'
          : status === 'guided_draft'
            ? 'Built from your answers. The score gain was marginal.'
            : 'Built from your answers.',
      primaryAction,
    };
  }

  let secondaryAction: string | undefined;
  if (primarySurface !== 'full-rewrite') {
    if (result.rewrite) {
      secondaryAction = resolveActionLabel('show_rewrite_anyway', role);
    } else {
      secondaryAction = resolveActionLabel('generate_rewrite_anyway', role);
    }
  }

  return {
    headline: result.scoreBand === 'excellent' && verdict.state === 'strong' ? 'Excellent prompt' : hero.headline,
    supporting: hero.supporting,
    primaryAction,
    secondaryAction,
  };
}

function resolveFindings(result: AnalyzeAndRewriteV2Response, role: Role): string[] {
  const state = toProductState(result.rewriteRecommendation);
  const priority = new Map<ResultFindingId, number>([
    ['constraints_missing', 100],
    ['audience_missing', 95],
    ['exclusions_missing', 90],
    ['task_overloaded', 85],
    ['high_generic_risk', 80],
    ['rewrite_possible_regression', 75],
    ['already_strong_before_rewrite', 70],
    ['rewrite_low_value', 65],
    ['rewrite_forced_by_user', 60],
    ['rewrite_suppressed_by_user', 55],
    ['clear_scope', 30],
    ['strong_contrast', 25],
    ['clear_instruction', 20],
    ['useful_constraints', 15],
    ['low_generic_risk', 10],
    ['low_token_risk', 5],
    ['generic_phrases_detected', 40],
  ]);
  const findings = resolveFindingIds(result)
    .sort((left, right) => (priority.get(right) ?? 0) - (priority.get(left) ?? 0))
    .map((findingId) => resolveRoleVariant(resultsUiConfig.findings[findingId].text, role).value);
  const fallbackIssues = result.analysis.issues
    .map((issue) => issue.message.replace(/[.]+$/g, ''))
    .filter((message) => message.length > 0);
  let positiveBudget = state === 'strong' ? 2 : 1;
  const compact = findings.filter((finding) => {
    const isPositive = ['Clear', 'Good', 'Useful', 'Low'].some((prefix) => finding.startsWith(prefix));
    if (!isPositive) {
      return true;
    }
    if (positiveBudget <= 0) {
      return false;
    }
    positiveBudget -= 1;
    return true;
  });
  const output = [...new Set(compact)];

  if (output.length < 2) {
    output.push(...fallbackIssues);
  }

  if (output.length < 2) {
    output.push(result.analysis.summary.replace(/[.]+$/g, ''));
  }

  return [...new Set(output)].slice(0, 4);
}

function shortReasonForScore(dimension: ImprovementSuggestion['targetScores'][number]): string {
  switch (dimension) {
    case 'scope':
      return 'tightens scope';
    case 'contrast':
      return 'sharpens trade-offs';
    case 'clarity':
      return 'makes the request clearer';
    case 'constraintQuality':
      return 'adds usable constraints';
    case 'genericOutputRisk':
      return 'reduces generic-output risk';
    case 'tokenWasteRisk':
      return 'cuts wordiness';
    default:
      return dimension;
  }
}

function positiveReasonForResult(result: AnalyzeAndRewriteV2Response): string[] {
  const reasons: string[] = [];
  const { scores } = result.analysis;

  if (scores.scope >= 7) reasons.push('scope is already clear');
  if (scores.constraintQuality >= 7) reasons.push('constraints are already useful');
  if (scores.clarity >= 7) reasons.push('wording is already clear');
  if (scores.genericOutputRisk <= 3) reasons.push('generic-output risk is low');
  if (result.evaluation?.status === 'already_strong') reasons.unshift('the original is already the better default');
  if (result.gating.expectedImprovement === 'low') reasons.push('rewrite upside looks low');

  return [...new Set(reasons)].slice(0, 3);
}

export function resolveActionModule(result: AnalyzeAndRewriteV2Response, role: Role): ActionCardView {
  const guidedCompletion = result.guidedCompletion ?? null;
  const guidedCompletionForm = result.guidedCompletionForm ?? null;
  const guidedCopy = resolveGuidedCopy(result, role);
  const sectionTitles = resolveSectionTitles(result, role);
  const primarySurface = resolvePrimarySurface(result);
  const questions = guidedCompletion?.questions?.slice(0, 4);
  const reasons =
    primarySurface === 'no-rewrite-needed'
      ? positiveReasonForResult(result)
      : (result.bestNextMove?.targetScores ?? [])
          .map(shortReasonForScore)
          .slice(0, 3);
  const fallbackReasons =
    reasons.length > 0
      ? reasons
      : resolveFindings(result, role)
          .slice(0, 3)
          .map((finding) => finding.replace(/[.]+$/g, '').toLowerCase());

  return {
    title: sectionTitles.action_card,
    eyebrow: guidedCompletionForm ? 'Before rewriting' : undefined,
    lead:
      primarySurface === 'no-rewrite-needed'
        ? result.bestNextMove?.title ?? 'Keep the original prompt'
        : guidedCompletionForm?.title ?? result.bestNextMove?.title ?? guidedCompletion?.title ?? guidedCopy.fallbackLead,
    reasons: fallbackReasons,
    questionTitle: questions?.length ? guidedCopy.questionTitle : undefined,
    questions,
    templateLabel: guidedCompletion?.template ? guidedCopy.templateLabel : undefined,
    template: guidedCompletion?.template,
    exampleLabel: !guidedCompletion?.template && guidedCompletion?.example ? guidedCopy.exampleLabel : undefined,
    example: !guidedCompletion?.template ? guidedCompletion?.example : undefined,
    primaryActionLabel: guidedCompletionForm?.submitLabel ?? resolveActionLabel(resolvePrimaryActionId(result), role),
    formSubmitLabel: guidedCompletionForm?.submitLabel,
    formSkipLabel: guidedCompletionForm?.skipLabel,
    secondaryActionLabel:
      primarySurface === 'full-rewrite'
        ? undefined
        : result.rewrite
          ? resolveActionLabel('show_rewrite_anyway', role)
          : undefined,
    secondaryActionExpandedLabel:
      primarySurface === 'full-rewrite'
        ? undefined
        : result.rewrite
          ? resolveActionLabel('hide_rewrite_anyway', role)
          : undefined,
    forceRewriteLabel: resolveActionLabel('generate_rewrite_anyway', role),
    rewritePreviewTitle: guidedCopy.rewritePreviewTitle,
    previewCopyLabel: resolveActionLabel('copy_rewrite_anyway', role),
  };
}

function resolveRewritePanelView(result: AnalyzeAndRewriteV2Response, role: Role): RewritePanelView {
  const guidedStatus = guidedRewriteStatus(result);
  const title =
    isGuidedSubmitRewriteResult(result)
      ? guidedStatus === 'stronger_prompt'
        ? 'Stronger prompt'
        : 'Guided draft'
      : resolveSectionTitles(result, role).rewrite_panel;
  const verdict =
    result.evaluation ? resolveRewriteVerdict(result.evaluation, role) : resolveRoleVariant(resultsUiConfig.rewriteVerdicts.no_significant_change, role);

  return {
    title,
    verdictLabel:
      isGuidedSubmitRewriteResult(result)
        ? guidedStatus === 'stronger_prompt'
          ? 'Built from your answers'
          : guidedStatus === 'did_not_improve'
            ? 'Guided draft did not improve the score'
            : 'Draft from your answers'
        : verdict.label,
    verdictRecommendation:
      isGuidedSubmitRewriteResult(result)
        ? guidedStatus === 'stronger_prompt'
          ? 'Use this as the stronger prompt.'
          : guidedStatus === 'did_not_improve'
            ? 'Keep this as an optional draft, not the preferred prompt.'
            : 'Keep this as an optional draft if it fits your intent better.'
        : verdict.recommendation,
    primaryActionLabel: resolveActionLabel('copy_rewritten_prompt', role),
  };
}

export function resolveResultsPresentation(result: AnalyzeAndRewriteV2Response, role: Role): ResultsPresentation {
  const state = toProductState(result.rewriteRecommendation);

  return {
    state,
    verdictId: resolveVerdictId(result),
    primarySurface: resolvePrimarySurface(result),
    visibleSectionIds: resolveVisibleSections(result),
    hero: resolveHeroView(result, role),
    findings: resolveFindings(result, role),
    sectionTitles: resolveSectionTitles(result, role),
    actionCard: resolveActionModule(result, role),
    rewritePanel: resolveRewritePanelView(result, role),
  };
}

export function scoreDimensionLabel(name: string): string {
  switch (name) {
    case 'scope':
      return 'Scope';
    case 'contrast':
      return 'Contrast';
    case 'clarity':
      return 'Clarity';
    case 'constraintQuality':
      return 'Constraints';
    case 'genericOutputRisk':
      return 'Generic risk';
    case 'tokenWasteRisk':
      return 'Wordiness';
    default:
      return name;
  }
}

export function bandLabel(scoreBand: ScoreBand): string {
  return scoreBand.replace('_', ' ');
}

export function formatSuggestionTitle(suggestion: ImprovementSuggestion): string {
  return suggestion.title.charAt(0).toUpperCase() + suggestion.title.slice(1);
}

export function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
