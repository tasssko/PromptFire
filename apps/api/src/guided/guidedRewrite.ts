import type {
  Analysis,
  AnalyzeAndRewriteV2Request,
  BestNextMove,
  GuidedAnswers,
  ImprovementSuggestion,
  Role,
  RewritePreference,
} from '@promptfire/shared';
import { buildGuidedQuestionPlan, type EffectiveGuidedContext, type GuidedSoftGuidance } from './guidedPolicy';

export type GuidedIntent = {
  originalPrompt: string;
  role: Role;
  mode: AnalyzeAndRewriteV2Request['mode'];
  rewritePreference: RewritePreference;
  topStructuralIssue: string | null;
  explicitChoices: {
    goal?: string;
    audience?: string;
    format?: string;
    includes: string[];
    excludes: string[];
    proofType?: string;
    scopeStrategy?: string;
    nuance?: string;
  };
  softGuidance: GuidedSoftGuidance;
  rawGuidedAnswers: Record<string, string | string[]>;
};

export type GuidedPromptValidationResult = {
  isValid: boolean;
  hardFailures: string[];
  softWarnings: string[];
  fallbackReason: string | null;
};

const HARD_FAIL_SNIPPETS = [
  'original request:',
  'additional constraints:',
  'create a stronger, more specific version',
];

const META_PHRASES = [
  'make the primary goal',
  'format the output as',
  'target ',
  'tone and detail notes:',
  'context:',
];

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeForMatch(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return (Array.isArray(value) ? value : [value]).map((item) => normalizeWhitespace(item)).filter(Boolean);
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return toArray(value)[0];
}

function mergeUnique(...groups: Array<string | string[] | undefined>): string[] {
  return [...new Set(groups.flatMap((group) => toArray(group)))];
}

function hasAllSignificantTokens(haystack: string, needle: string): boolean {
  const haystackTokens = new Set(normalizeForMatch(haystack).split(' ').filter(Boolean));
  const tokens = normalizeForMatch(needle)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => haystackTokens.has(token));
}

function promptContainsConstraint(prompt: string, phrase: string): boolean {
  const normalizedPrompt = normalizeForMatch(prompt);
  const normalizedPhrase = normalizeForMatch(phrase);
  return normalizedPrompt.includes(normalizedPhrase) || hasAllSignificantTokens(prompt, phrase);
}

function sentence(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) {
    return '';
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function lowerFirst(value: string): string {
  return value.length > 0 ? `${value[0]!.toLowerCase()}${value.slice(1)}` : value;
}

function stripLeadingImperative(prompt: string): string {
  return normalizeWhitespace(prompt)
    .replace(/^(write|create|draft|build|generate|make|produce|prepare)\s+/i, '')
    .replace(/^(a|an|the)\s+/i, '');
}

function goalClause(goal: string | undefined): string {
  if (!goal) {
    return '';
  }

  const normalized = normalizeForMatch(goal);
  if (normalized === 'persuade') {
    return ' that persuades the audience';
  }
  if (normalized === 'explain') {
    return ' that explains the subject clearly';
  }
  if (normalized === 'compare trade offs' || normalized === 'compare') {
    return ' that compares the options and trade-offs';
  }
  if (normalized === 'instruct step by step') {
    return ' that gives step-by-step guidance';
  }
  if (normalized === 'summarize') {
    return ' that summarizes the key points';
  }
  if (normalized === 'brainstorm') {
    return ' that brainstorms practical options';
  }

  return ` that focuses on ${goal}`;
}

export function normalizeGuidedAnswers(guidedAnswers: GuidedAnswers): GuidedAnswers {
  const normalizedEntries = Object.entries(guidedAnswers)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        const items = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
        return items.length > 0 ? [key, items] : null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? [key, trimmed] : null;
    })
    .filter((entry): entry is [string, string | string[]] => entry !== null);

  return Object.fromEntries(normalizedEntries);
}

export function buildGuidedIntent(params: {
  originalPrompt: string;
  role: Role;
  mode: AnalyzeAndRewriteV2Request['mode'];
  rewritePreference: RewritePreference;
  guidedAnswers: GuidedAnswers;
  analysis: Analysis;
  bestNextMove: BestNextMove | null;
  improvementSuggestions: ImprovementSuggestion[];
  effectiveAnalysisContext?: EffectiveGuidedContext;
}): GuidedIntent {
  const { originalPrompt, role, mode, rewritePreference, guidedAnswers } = params;
  const plan = buildGuidedQuestionPlan({
    prompt: originalPrompt,
    role,
    analysis: params.analysis,
    bestNextMove: params.bestNextMove,
    improvementSuggestions: params.improvementSuggestions,
    effectiveAnalysisContext: params.effectiveAnalysisContext,
  });
  const nuanceParts = mergeUnique(guidedAnswers.nuance, guidedAnswers.detail, guidedAnswers.tone, guidedAnswers.successFailure);

  return {
    originalPrompt: normalizeWhitespace(originalPrompt),
    role,
    mode,
    rewritePreference,
    topStructuralIssue: plan.topStructuralIssue,
    explicitChoices: {
      goal: firstValue(guidedAnswers.goal),
      audience: firstValue(guidedAnswers.audience),
      format: firstValue(guidedAnswers.format),
      includes: mergeUnique(guidedAnswers.includes, guidedAnswers.behaviors),
      excludes: mergeUnique(guidedAnswers.excludes),
      proofType: firstValue(guidedAnswers.proofType ?? guidedAnswers.proof),
      scopeStrategy: firstValue(guidedAnswers.scopeStrategy),
      nuance: nuanceParts.length > 0 ? nuanceParts.join('; ') : undefined,
    },
    softGuidance: plan.softGuidance,
    rawGuidedAnswers: { ...guidedAnswers },
  };
}

export function isGuidedSynthesisScaffold(value: string): boolean {
  const normalized = value.toLowerCase();
  return HARD_FAIL_SNIPPETS.some((snippet) => normalized.includes(snippet));
}

export function buildGuidedIntentCompositionPrompt(intent: GuidedIntent): string {
  const lines = [
    'You are rewriting a user prompt into one stronger, cleaner final prompt.',
    '',
    'Your job:',
    '- preserve the user’s original intent',
    '- preserve explicit user choices faithfully',
    '- resolve the top structural weakness first',
    '- use the soft guidance to sharpen the prompt without inventing new intent',
    '- compose a natural, human-usable final prompt',
    '- avoid sounding like metadata or settings',
    '',
    'Hard requirements:',
    '- keep the audience faithful to the explicit choices',
    '- keep the requested format faithful to the explicit choices',
    '- preserve important include and avoid constraints',
    '- preserve the original job unless an explicit choice narrows it',
    '- do not output headings, bullets, labels, or explanations',
    '- do not restate settings or use phrases like "Original request", "Additional constraints", "Target", or "Format the output as"',
    '- return only the final rewritten prompt text',
    '',
    `Original prompt: ${intent.originalPrompt}`,
    '',
    'Explicit user choices:',
    `- role: ${intent.role}`,
    `- mode: ${intent.mode}`,
    `- rewritePreference: ${intent.rewritePreference}`,
    `- top structural issue: ${intent.topStructuralIssue ?? 'none identified'}`,
    `- audience: ${intent.explicitChoices.audience ?? 'none provided'}`,
    `- goal: ${intent.explicitChoices.goal ?? 'preserve original goal'}`,
    `- format: ${intent.explicitChoices.format ?? 'use the format implied by the request'}`,
    `- includes: ${intent.explicitChoices.includes.join(', ') || 'none provided'}`,
    `- excludes: ${intent.explicitChoices.excludes.join(', ') || 'none provided'}`,
    `- proof type: ${intent.explicitChoices.proofType ?? 'none provided'}`,
    `- scope strategy: ${intent.explicitChoices.scopeStrategy ?? 'none provided'}`,
    `- nuance: ${intent.explicitChoices.nuance ?? 'none provided'}`,
    '',
    `Soft guidance: ${JSON.stringify(intent.softGuidance)}`,
    '',
    `Raw guided answers: ${JSON.stringify(intent.rawGuidedAnswers)}`,
    '',
    'Write one final prompt.',
  ];

  return lines.join('\n');
}

export function buildUserFacingGuidedPrompt(intent: GuidedIntent): string {
  return buildMockGuidedComposedPrompt(intent);
}

export function buildMockGuidedComposedPrompt(intent: GuidedIntent): string {
  const audiencePrefix = intent.explicitChoices.audience ? ` for ${intent.explicitChoices.audience}` : '';
  const formatLead = intent.explicitChoices.format ? `${intent.explicitChoices.format} ` : '';
  const contentFragment = stripLeadingImperative(intent.originalPrompt);
  const purposeClause = goalClause(intent.explicitChoices.goal);
  const structureLead =
    intent.explicitChoices.scopeStrategy === 'outline first'
      ? 'Start with an outline before expanding.'
      : intent.explicitChoices.scopeStrategy === 'staged sequence'
        ? 'Deliver the work in stages.'
        : intent.explicitChoices.scopeStrategy === 'first section only'
          ? 'Return only the first section.'
          : '';
  const lead =
    contentFragment.length > 18
      ? `Create a ${formatLead}${audiencePrefix}${purposeClause} about ${lowerFirst(contentFragment)}`
      : `Create a ${formatLead}${audiencePrefix}${purposeClause}`.trim();

  const clauses = [
    sentence(lead.replace(/\s+/g, ' ').trim()),
    structureLead ? sentence(structureLead) : null,
    intent.explicitChoices.includes.length > 0 ? sentence(`Include ${intent.explicitChoices.includes.join(', ')}`) : null,
    intent.explicitChoices.proofType ? sentence(`Ground it in ${intent.explicitChoices.proofType}`) : null,
    intent.explicitChoices.nuance ? sentence(`Keep the approach ${intent.explicitChoices.nuance}`) : null,
    intent.softGuidance.suggestedStructure ? sentence(intent.softGuidance.suggestedStructure) : null,
    intent.explicitChoices.excludes.length > 0 ? sentence(`Avoid ${intent.explicitChoices.excludes.join(', ')}`) : null,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  return clauses.join(' ');
}

export function validateGuidedComposedPrompt(intent: GuidedIntent, prompt: string): GuidedPromptValidationResult {
  const normalizedPrompt = normalizeWhitespace(prompt);
  const lowered = normalizedPrompt.toLowerCase();
  const hardFailures: string[] = [];
  const softWarnings: string[] = [];

  if (normalizedPrompt.length < 24) {
    hardFailures.push('Prompt is too short to be usable.');
  }

  if (HARD_FAIL_SNIPPETS.some((snippet) => lowered.includes(snippet))) {
    hardFailures.push('Prompt contains synthesis scaffold markers.');
  }

  if (META_PHRASES.some((snippet) => lowered.includes(snippet))) {
    hardFailures.push('Prompt contains metadata phrasing.');
  }

  if (intent.explicitChoices.audience && !promptContainsConstraint(normalizedPrompt, intent.explicitChoices.audience)) {
    hardFailures.push('Audience drifted from guided input.');
  } else if (
    intent.explicitChoices.audience &&
    !normalizeForMatch(normalizedPrompt.slice(0, 180)).includes(normalizeForMatch(intent.explicitChoices.audience))
  ) {
    softWarnings.push('Audience does not appear early in the prompt.');
  }

  if (intent.explicitChoices.format && !promptContainsConstraint(normalizedPrompt, intent.explicitChoices.format)) {
    hardFailures.push('Format drifted from guided input.');
  }

  if (
    intent.explicitChoices.excludes.length > 0 &&
    !intent.explicitChoices.excludes.every((item) => promptContainsConstraint(normalizedPrompt, item))
  ) {
    hardFailures.push('One or more required exclusions disappeared.');
  }

  if (
    intent.explicitChoices.includes.length > 0 &&
    !intent.explicitChoices.includes.some((item) => promptContainsConstraint(normalizedPrompt, item))
  ) {
    softWarnings.push('Required includes are not clearly represented.');
  }

  if (intent.explicitChoices.excludes.length > 0 && !/avoid|exclude|without|do not|keep/i.test(normalizedPrompt)) {
    softWarnings.push('Exclusions are not expressed naturally.');
  }

  if (normalizeForMatch(normalizedPrompt).startsWith(normalizeForMatch(intent.originalPrompt)) && normalizedPrompt.length > intent.originalPrompt.length + 24) {
    softWarnings.push('Prompt reads like the original request plus appended settings.');
  }

  return {
    isValid: hardFailures.length === 0,
    hardFailures,
    softWarnings,
    fallbackReason: hardFailures.length > 0 ? hardFailures[0]! : null,
  };
}
