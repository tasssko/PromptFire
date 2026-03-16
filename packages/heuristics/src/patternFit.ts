import type { Analysis, Mode, Role } from '@promptfire/shared';

export type PromptPattern =
  | 'direct_instruction'
  | 'few_shot'
  | 'stepwise_reasoning'
  | 'decomposition'
  | 'decision_rubric'
  | 'context_first';

export interface PatternFit {
  primary: PromptPattern;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  rejectedPatterns?: PromptPattern[];
}

export interface PatternSignals {
  hasClearDeliverable: boolean;
  hasSingleDeliverable: boolean;
  hasTaskOverload: boolean;
  hasStyleImitationIntent: boolean;
  hasFormatConsistencyNeed: boolean;
  hasTradeoffFraming: boolean;
  hasComparisonIntent: boolean;
  hasEvaluationIntent: boolean;
  hasDecisionIntent: boolean;
  hasStrongExampleRequirement: boolean;
  hasMissingContextForSpecificity: boolean;
}

interface DetectPatternFitInput {
  prompt: string;
  role: Role;
  mode: Mode;
  analysis: Analysis;
  context?: Record<string, unknown>;
}

const PATTERN_ORDER: PromptPattern[] = [
  'context_first',
  'decomposition',
  'decision_rubric',
  'stepwise_reasoning',
  'few_shot',
  'direct_instruction',
];

function getContextText(context?: Record<string, unknown>): string {
  if (!context) {
    return '';
  }
  return JSON.stringify(context).toLowerCase();
}

function hasSourceMaterialContext(context?: Record<string, unknown>): boolean {
  const contextText = getContextText(context);
  return /(source|transcript|brief|notes|reference|dataset|customer|research|document|quote|evidence)/i.test(contextText);
}

function countDeliverables(prompt: string): number {
  const matches =
    prompt.match(
      /\b(strategy|roadmap|launch plan|messaging|landing page|blog post|article|email|report|plan|outline|copy|case study|comparison|checklist)\b/gi,
    ) ?? [];
  return new Set(matches.map((item) => item.toLowerCase())).size;
}

function hasTaskOverload(prompt: string, analysis: Analysis): boolean {
  if (analysis.detectedIssueCodes.includes('TASK_OVERLOADED')) {
    return true;
  }

  const directiveVerbCount =
    (prompt.match(/(?:^|[.;]\s+|\bthen\b\s+|\band\b\s+)(build|write|create|design|implement|analyze|optimize|draft)\b/gi) ?? [])
      .length;
  const listSeparators = (prompt.match(/,| and |;| then /gi) ?? []).length;
  return directiveVerbCount >= 3 || (directiveVerbCount >= 2 && listSeparators >= 4) || countDeliverables(prompt) >= 3;
}

function detectPatternSignals(input: DetectPatternFitInput): PatternSignals {
  const prompt = input.prompt.trim();
  const lowered = prompt.toLowerCase();
  const clearDeliverable =
    /\b(write|draft|create|build|design|implement|analyze|optimize|summarize|generate|score|rank|review)\b/i.test(prompt) &&
    /\b(landing page|copy|email|blog post|article|report|plan|outline|strategy|case study|comparison|reply|replies)\b/i.test(prompt);
  const deliverables = countDeliverables(prompt);
  const singleDeliverable = deliverables <= 1 && !/\b(strategy, roadmap, launch plan, and messaging)\b/i.test(prompt);
  const overload = hasTaskOverload(prompt, input.analysis) || /complete guide|comprehensive guide|end-to-end guide/i.test(prompt);
  const styleImitation =
    /\b(house style|our style|match style|imitate style|same style|rewrite these .* replies)\b/i.test(prompt) ||
    (/rewrite/i.test(prompt) && /\bstyle\b/i.test(prompt));
  const formatConsistency =
    /\b(format|template|same format|consistent format|json schema|exact structure)\b/i.test(prompt);
  const tradeoffFraming = /\b(trade[-\s]?off|when .* and when .*|pros and cons)\b/i.test(prompt);
  const comparisonIntent = /\b(compare|comparison|versus|vs\.?|choose between|whether to)\b/i.test(prompt);
  const evaluationIntent =
    /\b(score|rank|grade|evaluate|review|assess|criteria|rubric|policy check|qa)\b/i.test(prompt);
  const decisionIntent = /\b(decide|decision|recommend|recommendation|which option)\b/i.test(prompt);
  const strongExampleRequirement =
    /\b(follow these examples|using these examples|few-shot|1-3 examples|one to three examples)\b/i.test(prompt) ||
    (/\bexample|examples\b/i.test(prompt) && (styleImitation || formatConsistency));
  const requiresSpecificGrounding =
    /\b(case study|customer migration|measurable outcomes|quantifiable results|detailed case study)\b/i.test(prompt);
  const missingContextForSpecificity =
    requiresSpecificGrounding && !hasSourceMaterialContext(input.context) && !/\bprovided|below|attached\b/i.test(lowered);

  return {
    hasClearDeliverable: clearDeliverable,
    hasSingleDeliverable: singleDeliverable,
    hasTaskOverload: overload,
    hasStyleImitationIntent: styleImitation,
    hasFormatConsistencyNeed: formatConsistency,
    hasTradeoffFraming: tradeoffFraming,
    hasComparisonIntent: comparisonIntent,
    hasEvaluationIntent: evaluationIntent,
    hasDecisionIntent: decisionIntent,
    hasStrongExampleRequirement: strongExampleRequirement,
    hasMissingContextForSpecificity: missingContextForSpecificity,
  };
}

function decidePattern(signals: PatternSignals): PromptPattern {
  if (signals.hasMissingContextForSpecificity) {
    return 'context_first';
  }
  if (signals.hasTaskOverload) {
    return 'decomposition';
  }
  if (signals.hasEvaluationIntent) {
    return 'decision_rubric';
  }
  if (signals.hasTradeoffFraming || signals.hasComparisonIntent) {
    return 'stepwise_reasoning';
  }
  if (signals.hasStyleImitationIntent || signals.hasFormatConsistencyNeed || signals.hasStrongExampleRequirement) {
    return 'few_shot';
  }
  return 'direct_instruction';
}

function confidenceForPattern(primary: PromptPattern, signals: PatternSignals): PatternFit['confidence'] {
  const directConfidence = signals.hasClearDeliverable && signals.hasSingleDeliverable ? 'high' : 'medium';
  if (primary === 'direct_instruction') {
    return directConfidence;
  }
  if (primary === 'few_shot') {
    return signals.hasStyleImitationIntent && (signals.hasFormatConsistencyNeed || signals.hasStrongExampleRequirement)
      ? 'high'
      : 'medium';
  }
  if (primary === 'stepwise_reasoning') {
    return signals.hasTradeoffFraming && signals.hasComparisonIntent ? 'high' : 'medium';
  }
  if (primary === 'decomposition') {
    return signals.hasTaskOverload ? 'high' : 'medium';
  }
  if (primary === 'decision_rubric') {
    return signals.hasEvaluationIntent && signals.hasDecisionIntent ? 'high' : 'medium';
  }
  return signals.hasMissingContextForSpecificity ? 'high' : 'medium';
}

function reasonsForPattern(primary: PromptPattern, signals: PatternSignals): string[] {
  if (primary === 'context_first') {
    return ['Prompt requests grounded specificity but source context is missing.'];
  }
  if (primary === 'decomposition') {
    return ['Prompt appears overloaded or asks for multiple deliverables.'];
  }
  if (primary === 'decision_rubric') {
    return ['Prompt centers on scoring, ranking, or decision criteria.'];
  }
  if (primary === 'stepwise_reasoning') {
    return ['Prompt requires comparison or trade-off judgment.'];
  }
  if (primary === 'few_shot') {
    return ['Prompt emphasizes style or format consistency where examples likely help control output.'];
  }

  const reasons = ['Prompt is a direct task that mainly needs clearer boundaries.'];
  if (signals.hasClearDeliverable && signals.hasSingleDeliverable) {
    reasons.push('Prompt already has a clear single deliverable.');
  }
  return reasons;
}

function fallbackRejectReasons(primary: PromptPattern, signals: PatternSignals): PromptPattern[] {
  const eligible = new Set<PromptPattern>(['direct_instruction']);
  if (signals.hasMissingContextForSpecificity) {
    eligible.add('context_first');
  }
  if (signals.hasTaskOverload) {
    eligible.add('decomposition');
  }
  if (signals.hasEvaluationIntent || signals.hasDecisionIntent) {
    eligible.add('decision_rubric');
  }
  if (signals.hasTradeoffFraming || signals.hasComparisonIntent) {
    eligible.add('stepwise_reasoning');
  }
  if (signals.hasStyleImitationIntent || signals.hasFormatConsistencyNeed || signals.hasStrongExampleRequirement) {
    eligible.add('few_shot');
  }

  const rejected = PATTERN_ORDER.filter((pattern) => pattern !== primary && eligible.has(pattern));
  return rejected.length > 0 ? rejected : [];
}

export function detectPatternFit(input: DetectPatternFitInput): PatternFit {
  const signals = detectPatternSignals(input);
  const primary = decidePattern(signals);
  const rejectedPatterns = fallbackRejectReasons(primary, signals);

  return {
    primary,
    confidence: confidenceForPattern(primary, signals),
    reasons: reasonsForPattern(primary, signals),
    rejectedPatterns: rejectedPatterns.length > 0 ? rejectedPatterns : undefined,
  };
}
