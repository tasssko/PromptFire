import type {
  AnalyzeAndRewriteV2Response,
  EvaluationV2,
  ImprovementSuggestion,
  RewritePresentationMode,
  ScoreBand,
} from '@promptfire/shared';

export type ProductState = 'strong' | 'usable' | 'weak';
export type PrimarySurfaceKind = 'full-rewrite' | 'guided-completion' | 'no-rewrite-needed';

export type HeroView = {
  headline: string;
  supporting: string;
  primaryAction: string;
};

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

export function heroCopy(result: AnalyzeAndRewriteV2Response): HeroView {
  const primarySurface = resolvePrimarySurface(result);
  const hasTemplate = Boolean(result.guidedCompletion?.template);
  const hasExample = Boolean(result.guidedCompletion?.example);
  const hasQuestions = Boolean(result.guidedCompletion?.questions?.length);

  switch (result.rewriteRecommendation) {
    case 'no_rewrite_needed':
      return {
        headline: result.scoreBand === 'excellent' ? 'Excellent prompt' : 'Strong prompt',
        supporting: 'This prompt is already scoped well enough to use as-is.',
        primaryAction: 'Copy original prompt',
      };
    case 'rewrite_optional':
      return {
        headline: 'Usable, with one clear upgrade',
        supporting: 'The prompt works now, but one focused change would make the result more reliable.',
        primaryAction:
          primarySurface === 'full-rewrite'
            ? 'Copy rewritten prompt'
            : hasTemplate
              ? 'Copy template'
              : hasExample
                ? 'Copy example'
                : hasQuestions
                  ? 'Copy questions'
                  : 'Copy original prompt',
      };
    case 'rewrite_recommended':
    default:
      return {
        headline: result.scoreBand === 'poor' ? 'Prompt is too open-ended' : 'This prompt needs tighter boundaries',
        supporting: 'Define the missing constraints first, then decide whether a rewrite is worth using.',
        primaryAction:
          primarySurface === 'full-rewrite'
            ? 'Copy rewritten prompt'
            : hasTemplate
              ? 'Copy template'
              : hasExample
                ? 'Copy example'
                : hasQuestions
                  ? 'Copy questions'
                  : 'Copy original prompt',
      };
  }
}

export function verdictCopy(evaluation: EvaluationV2): { label: string; recommendation: string } {
  switch (evaluation.status) {
    case 'material_improvement':
      return {
        label: 'Clearly better',
        recommendation: 'Use the rewritten prompt.',
      };
    case 'minor_improvement':
      return {
        label: 'Slightly better',
        recommendation: 'The rewrite helps a bit, but the original still works.',
      };
    case 'possible_regression':
      return {
        label: 'Possible regression',
        recommendation: 'Keep the original and apply the next step manually.',
      };
    case 'already_strong':
      return {
        label: 'Already strong',
        recommendation: 'The original prompt was already in good shape.',
      };
    case 'no_significant_change':
    default:
      return {
        label: 'No significant change',
        recommendation: 'The rewrite does not add enough value to switch.',
      };
  }
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

export function suggestedFindings(result: AnalyzeAndRewriteV2Response): string[] {
  const findings: string[] = [];
  const { scores } = result.analysis;
  const issueMessages = result.analysis.issues.map((issue) => issue.message);
  const topIssueMessages = issueMessages.slice(0, 3);
  const state = toProductState(result.rewriteRecommendation);

  if (scores.scope >= 7) findings.push('Clear scope and deliverable.');
  if (scores.contrast >= 7) findings.push('Good trade-off framing and contrast.');
  if (scores.clarity >= 7) findings.push('Instructions are clear and direct.');
  if (scores.constraintQuality >= 7) findings.push('Useful constraints improve precision.');
  if (scores.genericOutputRisk <= 3) findings.push('Low generic-output risk.');
  if (scores.tokenWasteRisk <= 3) findings.push('Low token-waste risk.');

  if (state !== 'strong') {
    findings.push(...topIssueMessages);
  }

  if (findings.length < 3) {
    findings.push(...topIssueMessages);
  }

  if (findings.length < 3) {
    findings.push(result.analysis.summary);
  }

  return findings.slice(0, 4);
}

export function formatSuggestionTitle(suggestion: ImprovementSuggestion): string {
  return suggestion.title.charAt(0).toUpperCase() + suggestion.title.slice(1);
}

export function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
