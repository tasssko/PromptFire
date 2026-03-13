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
  contrast: 1.5,
  clarity: 1.0,
  constraintQuality: 1.25,
  genericOutputRisk: 1.25,
  tokenWasteRisk: 1.0,
} as const;

function hasAudience(prompt: string, context?: Record<string, unknown>): boolean {
  const audienceHint = context?.audienceHint;
  return Boolean(audienceHint) || /\b(audience|for\s+[a-z]|target\s+user)\b/i.test(prompt);
}

function hasConstraints(prompt: string, context?: Record<string, unknown>): boolean {
  const hasContextConstraints = Boolean(context?.mustInclude) || Boolean(context?.systemGoals);
  const hasPromptConstraints =
    /\b(must|should|exactly|limit|only|at least|at most)\b/i.test(prompt) ||
    /\b(use one|use two|include one|include two|avoid|keep the tone|focus on|rather than|lead with)\b/i.test(prompt);
  return hasContextConstraints || hasPromptConstraints;
}

function hasExclusions(prompt: string, context?: Record<string, unknown>): boolean {
  const hasContextExclusions = Boolean(context?.mustAvoid) || Boolean(context?.forbiddenPhrases);
  const hasPromptExclusions = /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt);
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
  const overallDelta = computeOverallDelta(scoreDeltas);
  const lowExpectedImprovement = hasLowExpectedImprovement(
    input.originalAnalysis.scores,
    input.originalPrompt,
    input.context,
  );
  const originalHighQuality = isOriginalHighQuality(input.originalAnalysis.scores);
  const paraphraseHeavy = isParaphraseHeavy(scoreDeltas, input);

  let status = statusFromOverallDelta(overallDelta);
  if (paraphraseHeavy && status === 'minor_improvement') {
    status = 'no_significant_change';
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

  if (lowExpectedImprovement && originalHighQuality && overallDelta <= 1.5) {
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
      overallDelta,
      expectedUsefulness: expectedUsefulnessFromStatus(status),
      notes: notes.slice(0, 12),
    },
    signals: [...new Set(signals)].slice(0, 12),
  };
}
