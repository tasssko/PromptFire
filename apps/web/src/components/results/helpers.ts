import type {
  AnalyzeAndRewriteV2Response,
  EvaluationV2,
  ImprovementSuggestion,
  RewriteRecommendation,
  ScoreBand,
} from '@promptfire/shared';

export type ProductState = 'strong' | 'usable' | 'weak';

export function toProductState(rewriteRecommendation: RewriteRecommendation): ProductState {
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

export function heroCopy(result: AnalyzeAndRewriteV2Response): {
  headline: string;
  supporting: string;
  primaryAction: string;
} {
  switch (result.rewriteRecommendation) {
    case 'no_rewrite_needed':
      return {
        headline: 'Strong prompt',
        supporting: 'This prompt is already well scoped and well directed.',
        primaryAction: 'Copy original prompt',
      };
    case 'rewrite_optional':
      return {
        headline: 'Usable, with room to improve',
        supporting:
          'The prompt is clear, but tightening constraints or differentiation could improve the output.',
        primaryAction: result.rewrite ? 'Show suggested rewrite' : 'Generate suggested rewrite',
      };
    case 'rewrite_recommended':
    default:
      return {
        headline: 'This prompt needs tightening',
        supporting:
          'This prompt is likely to produce generic output unless it is narrowed and better directed.',
        primaryAction: result.rewrite ? 'Copy rewritten prompt' : 'Generate rewrite',
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
        recommendation: 'Rewrite is slightly stronger, but either version is workable.',
      };
    case 'possible_regression':
      return {
        label: 'Might be worse',
        recommendation: 'Keep the original unless you need a shorter or tighter variation.',
      };
    case 'already_strong':
      return {
        label: 'Already in good shape',
        recommendation: 'Original prompt was already strong before rewrite.',
      };
    case 'no_significant_change':
    default:
      return {
        label: 'About the same',
        recommendation: 'Rewrite mostly rephrases the original prompt.',
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

export function heroBandClass(scoreBand: ScoreBand): string {
  switch (scoreBand) {
    case 'poor':
      return 'bg-hero-poor';
    case 'weak':
      return 'bg-hero-weak';
    case 'usable':
      return 'bg-hero-usable';
    case 'excellent':
      return 'bg-hero-excellent';
    case 'strong':
    default:
      return 'bg-hero-strong';
  }
}
