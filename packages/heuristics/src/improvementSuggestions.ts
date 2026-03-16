import type {
  AnalyzeAndRewriteRequest,
  Analysis,
  ImprovementSuggestion,
  RewriteRecommendation,
  ScoreBand,
  TargetScore,
} from '@promptfire/shared';

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

interface SuggestionCandidate extends ImprovementSuggestion {
  priority: number;
}

type SuggestionDraft = Omit<SuggestionCandidate, 'priority'>;

interface SuggestionParams {
  input: Pick<AnalyzeAndRewriteRequest, 'prompt' | 'role' | 'mode' | 'context'>;
  analysis: Analysis;
  overallScore: number;
  scoreBand: ScoreBand;
  rewriteRecommendation: RewriteRecommendation;
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

function hasTaskOverload(prompt: string): boolean {
  const directiveVerbCount =
    (prompt.match(/(?:^|[.;]\s+|\bthen\b\s+|\band\b\s+)(build|write|create|design|implement|analyze|optimize|draft)\b/gi) ?? [])
      .length;
  const listSeparators = (prompt.match(/,| and |;| then /gi) ?? []).length;
  return directiveVerbCount >= 3 || (directiveVerbCount >= 2 && listSeparators >= 4);
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

function buildCandidate(candidate: SuggestionDraft, priority: number, optional = false): SuggestionCandidate {
  return {
    ...candidate,
    title: optional ? `Optional: ${candidate.title}` : candidate.title,
    impact: optional ? 'low' : candidate.impact,
    priority,
  };
}

export function generateImprovementSuggestions(params: SuggestionParams): ImprovementSuggestion[] {
  const prompt = params.input.prompt.trim();
  const context = params.input.context;
  const theme = inferTheme(prompt);
  const issueSet = new Set(params.analysis.detectedIssueCodes);
  const candidates: SuggestionCandidate[] = [];
  const isStrongPrompt =
    params.scoreBand === 'strong' ||
    params.scoreBand === 'excellent' ||
    params.rewriteRecommendation === 'no_rewrite_needed';
  const optionalTone = isStrongPrompt;

  const push = (candidate: SuggestionDraft, priority: number) => {
    candidates.push(buildCandidate(candidate, priority, optionalTone));
  };

  if (!hasAudience(prompt, context) || issueSet.has('AUDIENCE_MISSING') || params.analysis.scores.scope <= 5) {
    push(
      {
        id: theme === 'landing_page' ? 'add_buyer_context' : 'add_audience',
        title: theme === 'landing_page' ? 'add target buyer context' : 'add a specific audience',
        reason:
          theme === 'landing_page'
            ? 'The prompt does not clearly define who the page is meant to convert, which weakens scope and positioning.'
            : 'The prompt does not identify who the output is for, which increases generic output risk.',
        impact: 'high',
        targetScores: ['scope', 'contrast', 'genericOutputRisk'],
        category: 'audience',
        exampleChange:
          theme === 'landing_page'
            ? 'Specify the buyer, operator, or decision-maker this page should speak to.'
            : 'Specify the buyer, reader, or operator this is meant for.',
      },
      10,
    );
  }

  if (
    (theme === 'landing_page' && !hasLeadAngle(prompt)) ||
    (theme === 'blog_post' && !hasLeadAngle(prompt)) ||
    (theme === 'comparison' && !/\b(criteria|trade-off|tradeoff|recommend(?:ation)?|decision)\b/i.test(prompt))
  ) {
    const themeSpecific =
      theme === 'landing_page'
        ? {
            id: 'add_business_pain',
            title: 'add a specific business pain',
            reason: 'Landing-page prompts improve when they name the pressure or pain the buyer is trying to solve.',
            impact: 'high' as const,
            targetScores: ['contrast', 'genericOutputRisk'] satisfies TargetScore[],
            category: 'theme_specific' as const,
            exampleChange: 'Add the operational pain, pressure, or risk the page should lead with.',
          }
        : theme === 'blog_post'
          ? {
              id: 'add_core_tension',
              title: 'name the core tension or trade-off',
              reason: 'A stated tension gives the post a sharper angle than a broad topic summary.',
              impact: 'high' as const,
              targetScores: ['contrast', 'genericOutputRisk'] satisfies TargetScore[],
              category: 'framing' as const,
              exampleChange: 'State what trade-off, conflict, or decision the post should examine.',
            }
          : {
              id: 'add_decision_criteria',
              title: 'name the decision criteria',
              reason: 'Comparison prompts are stronger when they define how options should be evaluated.',
              impact: 'high' as const,
              targetScores: ['contrast', 'constraintQuality'] satisfies TargetScore[],
              category: 'theme_specific' as const,
              exampleChange: 'List the criteria, trade-offs, or decision boundary the comparison must use.',
            };

    push(themeSpecific, 20);
  }

  if (
    (!hasProof(prompt, context) && params.analysis.scores.contrast <= 6) ||
    (theme === 'landing_page' && !hasSpecificProof(prompt)) ||
    (theme === 'blog_post' && !/\bexample|examples\b/i.test(prompt))
  ) {
    const proofCandidate =
      theme === 'blog_post'
        ? {
            id: 'require_examples',
            title: 'require specific examples',
            reason: 'Examples make the post more specific and reduce the chance of abstract, generic output.',
            impact: 'medium' as const,
            targetScores: ['contrast', 'constraintQuality', 'genericOutputRisk'] satisfies TargetScore[],
            category: 'proof' as const,
            exampleChange: 'Require one or two concrete examples, scenarios, or cases.',
          }
        : {
            id: isStrongPrompt ? 'optional_proof_requirement' : 'add_proof_requirement',
            title: 'require one proof point',
            reason: isStrongPrompt
              ? 'A proof requirement may slightly improve differentiation, but the prompt is already strong.'
              : 'A proof requirement helps push the output beyond category-default claims.',
            impact: isStrongPrompt ? 'low' as const : 'medium' as const,
            targetScores: ['contrast', 'constraintQuality'] satisfies TargetScore[],
            category: 'proof' as const,
            exampleChange: 'Require one measurable example, customer proof point, or concrete comparison.',
          };

    push(proofCandidate, isStrongPrompt ? 50 : 30);
  }

  if (!hasExclusions(prompt, context) || issueSet.has('EXCLUSIONS_MISSING')) {
    push(
      {
        id: 'add_exclusion',
        title: 'add one exclusion',
        reason: 'An exclusion helps prevent generic category-default language and keeps the model inside clear boundaries.',
        impact: isStrongPrompt ? 'low' : 'medium',
        targetScores: ['constraintQuality', 'genericOutputRisk'],
        category: 'exclusion',
        exampleChange: 'Add a phrase such as "avoid generic buzzwords" or define one angle to leave out.',
      },
      isStrongPrompt ? 60 : 15,
    );
  }

  if (
    issueSet.has('CONSTRAINTS_MISSING') ||
    params.analysis.scores.constraintQuality <= 5 ||
    (theme === 'email' && !hasResponseOutcome(prompt)) ||
    (!hasStructure(prompt, context) && params.analysis.scores.clarity <= 6)
  ) {
    const structuralCandidate =
      theme === 'email' && !hasResponseOutcome(prompt)
        ? {
            id: 'define_email_outcome',
            title: 'state the intended response',
            reason: 'Email prompts improve when they define what action or reply the message should drive.',
            impact: 'high' as const,
            targetScores: ['constraintQuality', 'clarity', 'genericOutputRisk'] satisfies TargetScore[],
            category: 'structure' as const,
            exampleChange: 'Specify the desired reply, call to action, or next step.',
          }
        : !hasStructure(prompt, context)
          ? {
              id: isStrongPrompt ? 'optional_output_structure' : 'clarify_output_structure',
              title: 'specify the output structure',
              reason: isStrongPrompt
                ? 'A tighter structure may improve consistency, but the prompt is already strong.'
                : 'A clearer structure gives the model less room to drift into generic formatting.',
              impact: isStrongPrompt ? 'low' as const : 'medium' as const,
              targetScores: ['clarity', 'constraintQuality'] satisfies TargetScore[],
              category: 'structure' as const,
              exampleChange: 'Name the sections, format, or sequence the output should follow.',
            }
          : {
              id: 'add_constraints',
              title: 'add specific constraints',
              reason: 'The prompt needs more explicit boundaries on what to include, how much to include, or how to frame it.',
              impact: 'high' as const,
              targetScores: ['scope', 'constraintQuality', 'tokenWasteRisk'] satisfies TargetScore[],
              category: 'boundary' as const,
              exampleChange: 'Set a limit, required element, or framing boundary the output must follow.',
            };

    push(structuralCandidate, isStrongPrompt ? 70 : 12);
  }

  if (issueSet.has('TASK_OVERLOADED') || hasTaskOverload(prompt) || params.analysis.scores.tokenWasteRisk >= 6) {
    push(
      {
        id: 'reduce_task_load',
        title: 'split or narrow the task load',
        reason: 'Bundling multiple jobs together makes the output broader, less focused, and more wasteful.',
        impact: 'high',
        targetScores: ['scope', 'tokenWasteRisk'],
        category: 'task_load',
        exampleChange: 'Reduce the request to one deliverable or move secondary asks into a separate prompt.',
      },
      11,
    );
  }

  if (
    theme === 'blog_post' &&
    !/\b(avoid hype|avoid generic|keep the tone grounded|rather than)\b/i.test(prompt) &&
    params.analysis.scores.genericOutputRisk >= 4
  ) {
    push(
      {
        id: 'add_framing_boundary',
        title: 'add a framing boundary',
        reason: 'A blog prompt benefits from a clear stance on what tone, angle, or framing to avoid.',
        impact: 'medium',
        targetScores: ['contrast', 'genericOutputRisk'],
        category: 'framing',
        exampleChange: 'Add anti-hype, anti-generic, or trade-off framing guidance.',
      },
      25,
    );
  }

  if (
    params.analysis.scores.clarity <= 6 &&
    !candidates.some((candidate) => candidate.category === 'structure' || candidate.category === 'clarity')
  ) {
    push(
      {
        id: 'clarify_ambiguous_wording',
        title: 'remove ambiguous wording',
        reason: 'Loose wording leaves too much room for the model to guess at format and intent.',
        impact: 'medium',
        targetScores: ['clarity', 'tokenWasteRisk'],
        category: 'clarity',
        exampleChange: 'Replace broad instructions with one explicit deliverable and a bounded format.',
      },
      40,
    );
  }

  const filtered = candidates
    .sort((a, b) => a.priority - b.priority)
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index);

  if (isStrongPrompt && filtered.length === 0) {
    return [];
  }

  const prioritized = lowestScoreKeys(params.analysis)
    .flatMap((scoreKey) =>
      filtered.filter((candidate) => candidate.targetScores.includes(scoreKey) || candidate.category === 'theme_specific'),
    )
    .concat(filtered)
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index);

  const limit = clampSuggestionCount(params.scoreBand, prioritized.length);
  return prioritized.slice(0, limit).map(({ priority: _priority, ...candidate }) => candidate);
}
