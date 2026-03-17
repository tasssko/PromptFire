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

export type PrimarySurfaceKind = 'full-rewrite' | 'guided-completion' | 'no-rewrite-needed';

export type HeroView = {
  headline: string;
  supporting: string;
  primaryAction: string;
  secondaryAction?: string;
};

export type NoRewriteView = {
  title: string;
  label: string;
  supporting: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  secondaryActionExpandedLabel?: string;
  previewCopyLabel: string;
};

export type GuidedCompletionView = {
  title: string;
  detailTitle: string | null;
  summary: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  secondaryActionExpandedLabel?: string;
  forceRewriteLabel: string;
  templateLabel: string;
  exampleLabel: string;
  rewritePreviewTitle: string;
  previewCopyLabel: string;
};

export type RewritePanelView = {
  title: string;
  verdictLabel: string;
  verdictRecommendation: string;
  primaryActionLabel: string;
};

export type NextStepView = {
  title: string;
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
  noRewrite: NoRewriteView;
  guidedCompletion: GuidedCompletionView;
  rewritePanel: RewritePanelView;
  nextStep: NextStepView;
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

export function resolvePrimarySurface(result: AnalyzeAndRewriteV2Response): PrimarySurfaceKind {
  if (result.rewriteRecommendation === 'no_rewrite_needed') {
    return 'no-rewrite-needed';
  }

  if (hasMaterialRewrite(result)) {
    return 'full-rewrite';
  }

  return 'guided-completion';
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
  return resultsUiConfig.verdicts[resolveVerdictId(result)].visibleSections;
}

export function resolveSectionTitles(result: AnalyzeAndRewriteV2Response, role: Role): SectionTitleMap {
  const state = toProductState(result.rewriteRecommendation);

  return {
    findings: resolveRoleVariant(resultsUiConfig.sections.findings.title, role).value,
    subscores: resolveRoleVariant(resultsUiConfig.sections.subscores.title, role).value,
    why_no_rewrite: resolveRoleVariant(resultsUiConfig.sections.why_no_rewrite.title, role).value,
    best_next_move: resolveRoleVariant(resultsUiConfig.states[state].bestNextMoveTitle, role).title,
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
  const primaryAction = resolveActionLabel(resolvePrimaryActionId(result), role);
  const primarySurface = resolvePrimarySurface(result);

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
  const issueMessages = result.analysis.issues.map((issue) => issue.message);
  const topIssueMessages = issueMessages.slice(0, 3);
  const output = [...findings];

  if (state !== 'strong') {
    output.push(...topIssueMessages);
  }

  if (output.length < 3) {
    output.push(...topIssueMessages);
  }

  if (output.length < 3) {
    output.push(result.analysis.summary);
  }

  return [...new Set(output)].slice(0, 4);
}

export function resolveActionModule(result: AnalyzeAndRewriteV2Response, role: Role): GuidedCompletionView {
  const guidedCompletion = result.guidedCompletion ?? null;
  const guidedCopy = resolveGuidedCopy(result, role);

  return {
    title: guidedCompletion?.title ?? guidedCopy.title,
    detailTitle: guidedCompletion?.title ? null : result.bestNextMove?.title ?? guidedCopy.fallbackDetailTitle,
    summary:
      guidedCompletion?.summary ??
      (result.bestNextMove
        ? `Start by ${lowerFirst(result.bestNextMove.title)}. ${result.bestNextMove.rationale}`
        : guidedCopy.fallbackSummary),
    primaryActionLabel: resolveActionLabel(resolvePrimaryActionId(result), role),
    secondaryActionLabel: result.rewrite ? resolveActionLabel('show_rewrite_anyway', role) : undefined,
    secondaryActionExpandedLabel: result.rewrite ? resolveActionLabel('hide_rewrite_anyway', role) : undefined,
    forceRewriteLabel: resolveActionLabel('generate_rewrite_anyway', role),
    templateLabel: guidedCopy.templateLabel,
    exampleLabel: guidedCopy.exampleLabel,
    rewritePreviewTitle: guidedCopy.rewritePreviewTitle,
    previewCopyLabel: resolveActionLabel('copy_rewrite_anyway', role),
  };
}

function resolveNoRewriteView(result: AnalyzeAndRewriteV2Response, role: Role): NoRewriteView {
  const verdictId = resolveVerdictId(result);
  const fallbackVerdict =
    verdictId === 'rewrite_already_strong' || verdictId === 'strong_suppressed' || verdictId === 'strong_forced'
      ? resultsUiConfig.verdicts[verdictId]
      : resultsUiConfig.verdicts.strong_default;
  const noRewrite = resolveRoleVariant(fallbackVerdict.noRewrite!, role);

  return {
    title: noRewrite.title,
    label: noRewrite.label,
    supporting: noRewrite.supporting,
    primaryActionLabel: resolveActionLabel('copy_original_prompt', role),
    secondaryActionLabel: result.rewrite ? resolveActionLabel('show_rewrite_anyway', role) : resolveActionLabel('generate_rewrite_anyway', role),
    secondaryActionExpandedLabel: result.rewrite ? resolveActionLabel('hide_rewrite_anyway', role) : undefined,
    previewCopyLabel: resolveActionLabel('copy_rewrite_anyway', role),
  };
}

function resolveRewritePanelView(result: AnalyzeAndRewriteV2Response, role: Role): RewritePanelView {
  const title = resolveSectionTitles(result, role).rewrite_panel;
  const verdict =
    result.evaluation ? resolveRewriteVerdict(result.evaluation, role) : resolveRoleVariant(resultsUiConfig.rewriteVerdicts.no_significant_change, role);

  return {
    title,
    verdictLabel: verdict.label,
    verdictRecommendation: verdict.recommendation,
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
    noRewrite: resolveNoRewriteView(result, role),
    guidedCompletion: resolveActionModule(result, role),
    rewritePanel: resolveRewritePanelView(result, role),
    nextStep: {
      title: resolveSectionTitles(result, role).best_next_move,
    },
  };
}

export function scoreDimensionLabel(name: string): string {
  switch (name) {
    case 'constraintQuality':
      return 'Useful constraints';
    case 'genericOutputRisk':
      return 'Too generic';
    case 'tokenWasteRisk':
      return 'Wordiness';
    default:
      return name;
  }
}

export function methodFitLabel(name: string | null | undefined): string | null {
  switch (name) {
    case 'clarify_directly':
      return 'clarify the request directly';
    case 'add_examples':
      return 'add one or two examples';
    case 'break_into_steps':
      return 'break the reasoning into steps';
    case 'split_into_stages':
      return 'split the task into stages';
    case 'add_evaluation_criteria':
      return 'add evaluation criteria';
    case 'supply_missing_context':
      return 'supply the missing context';
    default:
      return name ? name.replaceAll('_', ' ') : null;
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
