import type { Analysis, Role } from '@promptfire/shared';
import type { PatternFit, PromptPattern } from './patternFit';

export type MissingContextType =
  | 'audience'
  | 'operating'
  | 'execution'
  | 'io'
  | 'comparison'
  | 'source'
  | 'boundary'
  | null;

interface InferMissingContextTypeInput {
  prompt: string;
  role: Role;
  patternFit?: PatternFit;
  analysis: Analysis;
}

type InternalPattern =
  | PromptPattern
  | 'compare_and_contrast'
  | 'extraction_or_transformation';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function detectInternalPattern(prompt: string, pattern: PromptPattern | undefined): InternalPattern {
  const lowered = prompt.toLowerCase();
  if (/\b(compare|comparison|contrast|versus|vs\.?)\b/.test(lowered)) {
    return 'compare_and_contrast';
  }
  if (/\b(summarize|summary|extract|transcribe|transcript|transform|rewrite in|convert to)\b/.test(lowered)) {
    return 'extraction_or_transformation';
  }
  return pattern ?? 'direct_instruction';
}

function hasAudience(prompt: string): boolean {
  return (
    /\b(for|aimed at|target(?:ing|ed at)?|tailored for)\s+(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,6}(?:cto|ctos|ciso|vp|director|manager|architect|administrator|engineers?|developers?|leaders?|buyers?|decision-makers?|teams?|business(?:es)?|companies|organizations|enterprises?|smbs?)\b/i.test(
      prompt,
    ) ||
    /\baudience|reader|buyer|decision-maker\b/i.test(prompt)
  );
}

function hasOperatingContext(prompt: string): boolean {
  return /\b(production|regulated|latency|compliance|cost|business|enterprise|smb|migration|deployment|environment)\b/i.test(
    prompt,
  );
}

function hasIoContext(prompt: string): boolean {
  return /\b(input|output|payload|request body|response|json|schema|format|shape|five bullets|bullet|table|fields?|interface)\b/i.test(
    prompt,
  );
}

function hasComparisonContext(prompt: string): boolean {
  return /\b(criteria|trade[-\s]?off|pros and cons|when .* and when .*|recommendation|decision boundary|rank|score)\b/i.test(
    prompt,
  );
}

function hasSourceContext(prompt: string): boolean {
  return /\b(provided below|attached below|source text|source notes|dataset|document excerpt|reference text|from the following)\b/i.test(
    prompt,
  );
}

function hasBoundaryContext(prompt: string): boolean {
  return /\b(avoid|exclude|without|do not|don't|only|exactly|at least|at most|in scope|out of scope)\b/i.test(prompt);
}

function rolePriority(role: Role): MissingContextType[] {
  if (role === 'developer') {
    return ['execution', 'io', 'boundary', 'operating', 'comparison', 'audience', 'source'];
  }
  if (role === 'marketer') {
    return ['audience', 'operating', 'comparison', 'source', 'boundary', 'io', 'execution'];
  }
  return ['audience', 'execution', 'io', 'boundary', 'comparison', 'operating', 'source'];
}

function patternPriority(pattern: InternalPattern): MissingContextType[] {
  switch (pattern) {
    case 'decomposition':
      return ['io', 'boundary', 'execution'];
    case 'stepwise_reasoning':
      return ['comparison', 'operating', 'boundary'];
    case 'decision_rubric':
      return ['comparison', 'boundary', 'io'];
    case 'context_first':
      return ['source'];
    case 'few_shot':
      return ['io', 'execution'];
    case 'compare_and_contrast':
      return ['comparison', 'operating', 'boundary'];
    case 'extraction_or_transformation':
      return ['source', 'io', 'boundary'];
    case 'direct_instruction':
    default:
      return [];
  }
}

export function inferMissingContextType(input: InferMissingContextTypeInput): MissingContextType {
  const prompt = input.prompt.trim();
  if (prompt.length === 0) {
    return null;
  }

  const pattern = detectInternalPattern(prompt, input.patternFit?.primary);
  const needsComparison = /\b(compare|comparison|contrast|versus|vs\.?|trade[-\s]?off|when .* and when .*)\b/i.test(prompt);
  const needsSource = pattern === 'context_first' || pattern === 'extraction_or_transformation';
  const codingIntent = /\b(write|build|implement|develop|create)\b/i.test(prompt) && /\b(handler|api|endpoint|function|code|script|webhook)\b/i.test(prompt);
  const developerImplementationIntent =
    input.role === 'developer' &&
    /\b(code|implement|implementation|build|develop|handler|api|endpoint|function|script|webhook)\b/i.test(prompt);
  const transformIntent = /\b(summarize|extract|transform|convert|rewrite)\b/i.test(prompt);

  const missing: Partial<Record<Exclude<MissingContextType, null>, number>> = {};
  if (!hasAudience(prompt)) {
    const audienceWeight =
      input.role === 'marketer' || /\blanding page|copy|campaign|email\b/i.test(prompt)
        ? 3
        : input.role === 'developer'
          ? 1
          : 2;
    missing.audience = audienceWeight;
  }
  if (!hasOperatingContext(prompt) && (input.role === 'marketer' || needsComparison)) {
    missing.operating = 2;
  }
  const executionCoverage =
    [
      /\b(node\.?js|typescript|javascript|python|go|java|rust|framework|runtime)\b/i.test(prompt),
      /\b(payload|request body|response|schema|interface)\b/i.test(prompt),
      /\b(validate|validation|status code|error handling)\b/i.test(prompt),
      /\b(retry|idempot|timeout|dependency|native)\b/i.test(prompt),
    ].filter(Boolean).length;
  if ((codingIntent || developerImplementationIntent) && executionCoverage < 4) {
    missing.execution = 3;
  }
  if (!hasIoContext(prompt) && (codingIntent || transformIntent || pattern === 'few_shot')) {
    missing.io = 3;
  }
  if (!hasComparisonContext(prompt) && needsComparison) {
    missing.comparison = 3;
  }
  if (!hasSourceContext(prompt) && needsSource) {
    missing.source = 4;
  }
  if (!hasBoundaryContext(prompt) && (input.analysis.scores.scope <= 6 || input.analysis.scores.genericOutputRisk >= 6)) {
    missing.boundary = 2;
  }

  const candidates = Object.entries(missing) as Array<[Exclude<MissingContextType, null>, number]>;
  if (candidates.length === 0) {
    return null;
  }

  const byRole = rolePriority(input.role);
  const byPattern = patternPriority(pattern);
  const scored = candidates.map(([type, base]) => {
    const roleRank = byRole.indexOf(type);
    const patternRank = byPattern.indexOf(type);
    const roleBonus = roleRank === -1 ? 0 : clamp(8 - roleRank, 1, 8);
    const patternBonus = patternRank === -1 ? 0 : clamp(8 - patternRank, 2, 8);
    return {
      type,
      score: base * 10 + roleBonus + patternBonus,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.type ?? null;
}
