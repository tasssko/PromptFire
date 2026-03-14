import type {
  Analysis,
  Improvement,
  ImprovementStatus,
  ScoreDeltas,
  ScoreSet,
} from '@promptfire/shared';

interface EvaluateRewriteInput {
  originalPrompt: string;
  rewrittenPrompt: string;
  originalAnalysis: Analysis;
  rewriteAnalysis: Analysis;
  context?: Record<string, unknown>;
}

interface EvaluateRewriteOutput {
  improvement: Improvement;
  signals: string[];
}

const OVERALL_DELTA_WEIGHTS = {
  scope: 1.5,
  contrast: 1.75,
  clarity: 0.9,
  constraintQuality: 1.25,
  genericOutputRisk: 1.25,
  tokenWasteRisk: 1.0,
} as const;

const RUBRIC_ECHO_PATTERNS: RegExp[] = [
  /\bimprove (?:clarity|contrast|scope)\b/i,
  /\badd (?:non[-\s]?negotiable )?constraints?\b/i,
  /\binclude explicit exclusions?\b/i,
  /\blead with operational tension\b/i,
  /\buse a specific lead angle\b/i,
  /\binclude (?:one )?(?:specific )?proof point\b/i,
  /\bmeasurable outcome\b/i,
  /\bdifferentiated positioning\b/i,
  /\bavoid generic buzzwords\b/i,
];

const FRAMING_IMPORT_PATTERNS: RegExp[] = [
  /\baudit pressure\b/i,
  /\bidentity sprawl\b/i,
  /\badmin overhead\b/i,
  /\bcompliance readiness\b/i,
  /\boperational tension\b/i,
  /\blead angle\b/i,
  /\bdifferentiated positioning\b/i,
];

function hasAudience(prompt: string, context?: Record<string, unknown>): boolean {
  const audienceHint = context?.audienceHint;
  return Boolean(audienceHint) || /\b(audience|for\s+[a-z]|target\s+user)\b/i.test(prompt);
}

function hasConstraints(prompt: string, context?: Record<string, unknown>): boolean {
  const hasContextConstraints = Boolean(context?.mustInclude) || Boolean(context?.systemGoals);
  const hasPromptConstraints =
    /\b(must|should|exactly|limit|only|at least|at most)\b/i.test(prompt) ||
    /\b(use one|use two|include one|include two|avoid|keep the tone|focus on|rather than|lead with)\b/i.test(prompt) ||
    /\b(include|incorporate|cover)\s+(?:real-world|actionable|specific|practical|one|two|\d+|examples?|best practices|steps?|checklist|conclusion)\b/i.test(
      prompt,
    );
  return hasContextConstraints || hasPromptConstraints;
}

function hasExclusions(prompt: string, context?: Record<string, unknown>): boolean {
  const hasContextExclusions = Boolean(context?.mustAvoid) || Boolean(context?.forbiddenPhrases);
  const hasPromptExclusions = /\b(avoid|exclude|excluding|without|do not|don't)\b/i.test(prompt);
  return hasContextExclusions || hasPromptExclusions;
}

function hasOutcome(prompt: string, context?: Record<string, unknown>): boolean {
  const contextOutcome = context?.outcome ?? context?.deliverable;
  return (
    Boolean(contextOutcome) ||
    /\b(outcome|deliverable|output|result|goal|objective|generate|draft|write|build|design|create)\b/i.test(
      prompt,
    )
  );
}

function getTaskType(prompt: string): string {
  const normalized = prompt.toLowerCase();
  if (/\b(write|draft|copy|blog|article|landing page)\b/.test(normalized)) {
    return 'writing';
  }
  if (/\b(code|implement|function|api|handler|test|refactor)\b/.test(normalized)) {
    return 'coding';
  }
  if (/\b(analyze|analysis|evaluate|review|audit)\b/.test(normalized)) {
    return 'analysis';
  }
  return 'general';
}

function getPrimaryDeliverable(prompt: string): string | null {
  const normalized = prompt.toLowerCase();
  if (/\blanding page\b/.test(normalized)) {
    return 'landing_page';
  }
  if (/\bblog\b|\barticle\b|\bpost\b/.test(normalized)) {
    return 'blog';
  }
  if (/\bguide\b/.test(normalized)) {
    return 'guide';
  }
  if (/\bemail\b/.test(normalized)) {
    return 'email';
  }
  if (/\bapi\b|\bhandler\b|\bfunction\b/.test(normalized)) {
    return 'technical';
  }
  return null;
}

function hasOutputStructure(prompt: string): boolean {
  return /\b(section|outline|template|format|table|bullet|step[-\s]?by[-\s]?step|headings?)\b/i.test(prompt);
}

function hasExampleOrComparisonFrame(prompt: string): boolean {
  return /\b(example|case study|comparison|compare|versus|vs\.?|trade[-\s]?off)\b/i.test(prompt);
}

function hasConcreteExclusion(prompt: string): boolean {
  return /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt) &&
    /\b(buzzwords?|jargon|hype|generic|unsupported|out of scope|fear[-\s]?based)\b/i.test(prompt);
}

function hasBoundaryNarrowing(prompt: string): boolean {
  return /\b(exactly|at least|at most|one|two|\d+)\b/i.test(prompt) &&
    /\b(example|section|deliverable|output|audience|comparison|constraint)\b/i.test(prompt);
}

function countPatternAdds(original: string, rewrite: string, patterns: RegExp[]): number {
  return patterns.filter((pattern) => pattern.test(rewrite) && !pattern.test(original)).length;
}

function countConcreteGroundingGains(input: {
  originalPrompt: string;
  rewrittenPrompt: string;
  context?: Record<string, unknown>;
}): number {
  const gains = [
    !hasAudience(input.originalPrompt, input.context) && hasAudience(input.rewrittenPrompt, input.context),
    !hasOutputStructure(input.originalPrompt) && hasOutputStructure(input.rewrittenPrompt),
    !hasExampleOrComparisonFrame(input.originalPrompt) && hasExampleOrComparisonFrame(input.rewrittenPrompt),
    !hasConcreteExclusion(input.originalPrompt) && hasConcreteExclusion(input.rewrittenPrompt),
    !hasBoundaryNarrowing(input.originalPrompt) && hasBoundaryNarrowing(input.rewrittenPrompt),
  ];

  return gains.filter(Boolean).length;
}

function rubricEchoRiskLevel(input: {
  originalPrompt: string;
  rewrittenPrompt: string;
  context?: Record<string, unknown>;
}): 'none' | 'medium' | 'high' {
  const addedRubricPatterns = countPatternAdds(
    input.originalPrompt,
    input.rewrittenPrompt,
    RUBRIC_ECHO_PATTERNS,
  );
  const concreteGroundingGains = countConcreteGroundingGains(input);

  if (addedRubricPatterns >= 3 && concreteGroundingGains <= 1) {
    return 'high';
  }
  if (addedRubricPatterns >= 2 && concreteGroundingGains <= 1) {
    return 'medium';
  }
  return 'none';
}

function intentDriftRiskLevel(input: {
  originalPrompt: string;
  rewrittenPrompt: string;
}): 'none' | 'medium' | 'high' {
  const taskTypeChanged = getTaskType(input.originalPrompt) !== getTaskType(input.rewrittenPrompt);
  const originalDeliverable = getPrimaryDeliverable(input.originalPrompt);
  const rewrittenDeliverable = getPrimaryDeliverable(input.rewrittenPrompt);
  const deliverableChanged =
    Boolean(originalDeliverable) &&
    Boolean(rewrittenDeliverable) &&
    originalDeliverable !== rewrittenDeliverable;
  const importedFramingAnchors = countPatternAdds(
    input.originalPrompt,
    input.rewrittenPrompt,
    FRAMING_IMPORT_PATTERNS,
  );

  if (taskTypeChanged || deliverableChanged || importedFramingAnchors >= 3) {
    return 'high';
  }
  if (importedFramingAnchors >= 2) {
    return 'medium';
  }
  return 'none';
}

function computeScoreDeltas(original: ScoreSet, rewrite: ScoreSet): ScoreDeltas {
  return {
    scope: rewrite.scope - original.scope,
    contrast: rewrite.contrast - original.contrast,
    clarity: rewrite.clarity - original.clarity,
    constraintQuality: rewrite.constraintQuality - original.constraintQuality,
    genericOutputRisk: rewrite.genericOutputRisk - original.genericOutputRisk,
    tokenWasteRisk: rewrite.tokenWasteRisk - original.tokenWasteRisk,
  };
}

function computeOverallDelta(scoreDeltas: ScoreDeltas): number {
  const raw =
    scoreDeltas.scope * OVERALL_DELTA_WEIGHTS.scope +
    scoreDeltas.contrast * OVERALL_DELTA_WEIGHTS.contrast +
    scoreDeltas.clarity * OVERALL_DELTA_WEIGHTS.clarity +
    scoreDeltas.constraintQuality * OVERALL_DELTA_WEIGHTS.constraintQuality -
    scoreDeltas.genericOutputRisk * OVERALL_DELTA_WEIGHTS.genericOutputRisk -
    scoreDeltas.tokenWasteRisk * OVERALL_DELTA_WEIGHTS.tokenWasteRisk;

  return Math.round(raw * 100) / 100;
}

function isOriginalHighQuality(scores: ScoreSet): boolean {
  return (
    scores.scope >= 7 &&
    scores.contrast >= 6 &&
    scores.clarity >= 7 &&
    scores.constraintQuality >= 6 &&
    scores.genericOutputRisk <= 4 &&
    scores.tokenWasteRisk <= 4
  );
}

function hasLowExpectedImprovement(
  scores: ScoreSet,
  prompt: string,
  context?: Record<string, unknown>,
): boolean {
  const baselineHigh =
    scores.scope >= 7 &&
    scores.clarity >= 7 &&
    scores.genericOutputRisk <= 4 &&
    scores.tokenWasteRisk <= 4;

  const structureSignals = [
    hasAudience(prompt, context),
    hasOutcome(prompt, context),
    hasConstraints(prompt, context),
    hasExclusions(prompt, context),
  ];

  return baselineHigh && structureSignals.some(Boolean);
}

function isParaphraseHeavy(
  scoreDeltas: ScoreDeltas,
  input: {
    originalPrompt: string;
    rewrittenPrompt: string;
    context?: Record<string, unknown>;
  },
): boolean {
  const minimalScoreMovement =
    Math.abs(scoreDeltas.scope) <= 1 &&
    Math.abs(scoreDeltas.contrast) <= 1 &&
    Math.abs(scoreDeltas.clarity) <= 1 &&
    Math.abs(scoreDeltas.constraintQuality) <= 1 &&
    Math.abs(scoreDeltas.genericOutputRisk) <= 1 &&
    Math.abs(scoreDeltas.tokenWasteRisk) <= 1;

  const audienceUnchanged =
    hasAudience(input.originalPrompt, input.context) === hasAudience(input.rewrittenPrompt, input.context);
  const constraintsUnchanged =
    hasConstraints(input.originalPrompt, input.context) ===
    hasConstraints(input.rewrittenPrompt, input.context);
  const exclusionsUnchanged =
    hasExclusions(input.originalPrompt, input.context) === hasExclusions(input.rewrittenPrompt, input.context);
  const outcomeUnchanged =
    hasOutcome(input.originalPrompt, input.context) === hasOutcome(input.rewrittenPrompt, input.context);
  const taskTypeUnchanged = getTaskType(input.originalPrompt) === getTaskType(input.rewrittenPrompt);

  return (
    minimalScoreMovement &&
    audienceUnchanged &&
    constraintsUnchanged &&
    exclusionsUnchanged &&
    outcomeUnchanged &&
    taskTypeUnchanged
  );
}

function statusFromOverallDelta(overallDelta: number): ImprovementStatus {
  if (overallDelta >= 4) {
    return 'material_improvement';
  }

  if (overallDelta >= 1.5) {
    return 'minor_improvement';
  }

  if (overallDelta <= -1.5) {
    return 'possible_regression';
  }

  return 'no_significant_change';
}

function expectedUsefulnessFromStatus(status: ImprovementStatus): Improvement['expectedUsefulness'] {
  switch (status) {
    case 'material_improvement':
      return 'higher';
    case 'minor_improvement':
      return 'slightly_higher';
    case 'possible_regression':
      return 'lower';
    case 'already_strong':
    case 'no_significant_change':
    default:
      return 'unchanged';
  }
}

export function evaluateRewrite(input: EvaluateRewriteInput): EvaluateRewriteOutput {
  const scoreDeltas = computeScoreDeltas(input.originalAnalysis.scores, input.rewriteAnalysis.scores);
  const rawOverallDelta = computeOverallDelta(scoreDeltas);
  const lowExpectedImprovement = hasLowExpectedImprovement(
    input.originalAnalysis.scores,
    input.originalPrompt,
    input.context,
  );
  const originalHighQuality = isOriginalHighQuality(input.originalAnalysis.scores);
  const paraphraseHeavy = isParaphraseHeavy(scoreDeltas, input);
  const rubricEchoRisk = rubricEchoRiskLevel(input);
  const intentDriftRisk = intentDriftRiskLevel(input);
  const concreteGroundingGains = countConcreteGroundingGains(input);

  let adjustedOverallDelta = rawOverallDelta;
  if (rubricEchoRisk === 'medium') {
    adjustedOverallDelta -= 1.5;
  } else if (rubricEchoRisk === 'high') {
    adjustedOverallDelta -= 3;
  }

  if (intentDriftRisk === 'medium') {
    adjustedOverallDelta -= 1.5;
  } else if (intentDriftRisk === 'high') {
    adjustedOverallDelta -= 3;
  }

  let status = statusFromOverallDelta(adjustedOverallDelta);
  if (paraphraseHeavy && status === 'minor_improvement') {
    status = 'no_significant_change';
  }

  if (rubricEchoRisk === 'high' && concreteGroundingGains <= 1) {
    if (status === 'material_improvement' || status === 'minor_improvement') {
      status = 'no_significant_change';
    }
  } else if (rubricEchoRisk !== 'none' && concreteGroundingGains <= 1 && status === 'material_improvement') {
    status = 'minor_improvement';
  }

  if (intentDriftRisk === 'high') {
    if (status === 'material_improvement' || status === 'minor_improvement') {
      status = 'no_significant_change';
    }
  } else if (intentDriftRisk === 'medium' && status === 'material_improvement') {
    status = 'minor_improvement';
  }

  if (
    lowExpectedImprovement &&
    (status === 'minor_improvement' || status === 'no_significant_change')
  ) {
    status = 'already_strong';
  }

  const signals: string[] = [];
  const notes: string[] = [];

  if (lowExpectedImprovement) {
    signals.push('LOW_EXPECTED_IMPROVEMENT');
    notes.push('Original prompt already has strong structure.');
  }

  if (lowExpectedImprovement && originalHighQuality && adjustedOverallDelta <= 1.5) {
    signals.push('PROMPT_ALREADY_OPTIMIZED');
    notes.push('Further rewriting is unlikely to create material gains.');
  }

  if (paraphraseHeavy) {
    signals.push('PROMPT_CONVERGENCE_DETECTED');
    notes.push('Rewrite mostly rephrases the same instruction.');
  }

  if (status === 'possible_regression') {
    signals.push('REWRITE_POSSIBLE_REGRESSION');
    notes.push('Rewrite may have regressed prompt quality.');
  }

  if (rubricEchoRisk !== 'none') {
    signals.push('REWRITE_RUBRIC_ECHO');
    notes.push('Rewrite adds scorer-facing rubric language with limited task-grounded specificity gains.');
  }

  if (intentDriftRisk !== 'none') {
    signals.push('REWRITE_INTENT_DRIFT_RISK');
    notes.push('Rewrite may shift framing or deliverable away from the original job.');
  }

  if (notes.length === 0) {
    if (status === 'material_improvement') {
      notes.push('Rewrite materially improves prompt quality.');
    } else if (status === 'minor_improvement') {
      notes.push('Rewrite provides modest quality improvements.');
    } else if (status === 'already_strong') {
      notes.push('Original prompt was already strong.');
    } else if (status === 'no_significant_change') {
      notes.push('No meaningful change in audience, scope, or constraints.');
    }
  }

  return {
    improvement: {
      status,
      scoreDeltas,
      overallDelta: Math.round(adjustedOverallDelta * 100) / 100,
      expectedUsefulness: expectedUsefulnessFromStatus(status),
      notes: notes.slice(0, 12),
    },
    signals: [...new Set(signals)].slice(0, 12),
  };
}
