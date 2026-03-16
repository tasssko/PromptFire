import { substitutePreferredLanguage, type Rewrite } from '@promptfire/shared';
import type { RewriteEngine, RewriteInput } from './types';

type PatchKind = 'audience' | 'structure' | 'exclusion' | 'task_load' | 'example_or_comparison';

function hasAudience(prompt: string): boolean {
  const explicitAudience =
    /\b(for|aimed at|target(?:ing|ed at)?|tailored for)\s+(?:an?\s+|the\s+)?(?:[a-z-]+\s+){0,6}(?:cto|ctos|it decision-makers?|decision-makers?|enterprise buyers?|buyers?|developers?|engineers?|directors?|managers?|leaders?|admins?|operators?|technical decision-makers?)\b/i;
  return explicitAudience.test(prompt) || /\b(audience|target users?)\b/i.test(prompt);
}

function hasConcreteExclusion(prompt: string): boolean {
  return /\b(avoid|exclude|without|do not|don't)\b/i.test(prompt);
}

function splitTopics(raw: string): string[] {
  return raw
    .split(/,|\band\b/gi)
    .map((part) => part.trim().replace(/\.$/, ''))
    .filter((part) => part.length > 0);
}

function formatTopicList(topics: string[]): string {
  if (topics.length === 0) {
    return 'core topics';
  }

  if (topics.length === 1) {
    return topics[0] ?? 'core topics';
  }

  if (topics.length === 2) {
    return `${topics[0] ?? 'core topic'} and ${topics[1] ?? 'core topic'}`;
  }

  const lastTopic = topics[topics.length - 1] ?? 'core topics';
  return `${topics.slice(0, -1).join(', ')}, and ${lastTopic}`;
}

function inferAudience(input: RewriteInput): string | null {
  const prompt = input.prompt;
  if (hasAudience(prompt)) {
    return null;
  }

  if (/\bkubernetes\b/i.test(prompt)) {
    return /\b(business|companies|organizations)\b/i.test(prompt)
      ? 'for CTOs and platform leaders evaluating adoption across different business types'
      : 'for technical decision-makers evaluating Kubernetes adoption';
  }

  if (/\b(iam|identity and access)\b/i.test(prompt)) {
    return 'for IT decision-makers evaluating identity and access strategy';
  }

  if (/\b(architecture|deployment|migration|security|monitoring|infrastructure|platform)\b/i.test(prompt)) {
    return 'for engineering managers comparing implementation options';
  }

  if (input.role === 'developer') {
    return 'for engineering managers comparing implementation options';
  }

  if (/\b(guide|playbook|strategy|comparison|evaluate|adoption)\b/i.test(prompt)) {
    return 'for technical decision-makers evaluating implementation options';
  }

  return null;
}

function inferStructureClause(input: RewriteInput): string | null {
  const prompt = input.prompt;
  const includingMatch = prompt.match(/\bincluding\s+([^.]*)/i);
  if (includingMatch) {
    const topics = splitTopics(includingMatch[1] ?? '').slice(0, 8);
    if (topics.length >= 3) {
      return /\bguide\b/i.test(prompt)
        ? `Structure the guide in sections covering ${formatTopicList(topics)}.`
        : `Structure the output in sections covering ${formatTopicList(topics)}.`;
    }
  }

  if (/\bguide\b/i.test(prompt)) {
    return 'Use three sections: scope, recommendations, and risks.';
  }

  return null;
}

function inferBoundaryClause(input: RewriteInput): string | null {
  const prompt = input.prompt;
  if (/\bkubernetes\b/i.test(prompt)) {
    return 'Explain when Kubernetes is worth the operational complexity and when simpler options are better.';
  }

  if (/\b(compare|comparison|vs\.?|versus|evaluate)\b/i.test(prompt)) {
    return 'Compare options using implementation complexity, operational overhead, and long-term maintainability.';
  }

  if (input.mode === 'high_contrast') {
    return 'Include one clear comparison to an alternative approach.';
  }

  return null;
}

function inferExclusionClause(input: RewriteInput): string | null {
  if (hasConcreteExclusion(input.prompt)) {
    return null;
  }

  if (input.role === 'marketer' || /\bkubernetes\b/i.test(input.prompt)) {
    return 'Avoid vendor-marketing language and unsupported superlatives.';
  }

  return 'Avoid vague language and unsupported claims.';
}

function inferExampleClause(input: RewriteInput): string | null {
  const prompt = input.prompt;
  if (/\b(startup|enterprise|case study|for example|example)\b/i.test(prompt)) {
    return null;
  }

  if (/\b(compare|comparison|vs\.?|versus|evaluate)\b/i.test(prompt)) {
    return 'Include one direct comparison example showing where each option is a better fit.';
  }

  if (/\b(business|companies|organizations)\b/i.test(prompt) || /\bkubernetes\b/i.test(prompt)) {
    return 'Include one startup example and one enterprise example.';
  }

  return null;
}

function toSentences(additions: Array<string | null | undefined>): string[] {
  return additions
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      const trimmed = value.trim();
      return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    })
    .filter((value, index, array) => array.indexOf(value) === index);
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function ensureSentence(text: string): string {
  const normalized = normalizeText(text);
  if (normalized.length === 0) {
    return '';
  }

  const withCapitalizedStart = normalized.replace(/^[a-z]/, (letter) => letter.toUpperCase());
  return /[.!?]$/.test(withCapitalizedStart) ? withCapitalizedStart : `${withCapitalizedStart}.`;
}

function firstSentence(prompt: string): string {
  const normalized = normalizeText(prompt);
  const match = normalized.match(/^.+?[.!?](?=\s|$)/);
  return match ? match[0] : normalized;
}

function integrateAudienceIntoOpening(opening: string, audienceClause: string): string {
  const audience = normalizeText(audienceClause).replace(/[.!?]$/, '');
  if (!/^for\b/i.test(audience)) {
    return ensureSentence(opening);
  }

  if (hasAudience(opening)) {
    return ensureSentence(opening);
  }

  const strippedOpening = normalizeText(opening).replace(/[.!?]$/, '');
  if (/\s*,\s*including\b/i.test(strippedOpening)) {
    return ensureSentence(strippedOpening.replace(/\s*,\s*including\b/i, ` ${audience}, including`));
  }

  if (/\s+including\b/i.test(strippedOpening)) {
    return ensureSentence(strippedOpening.replace(/\s+including\b/i, ` ${audience} including`));
  }

  return ensureSentence(`${strippedOpening} ${audience}`);
}

function composeRewrite(input: {
  basePrompt: string;
  selectedPatches: Partial<Record<PatchKind, string>>;
}): string {
  const opening = input.selectedPatches.audience
    ? integrateAudienceIntoOpening(firstSentence(input.basePrompt), input.selectedPatches.audience)
    : ensureSentence(firstSentence(input.basePrompt));

  const ordered = toSentences([
    opening,
    input.selectedPatches.structure,
    input.selectedPatches.task_load,
    input.selectedPatches.example_or_comparison,
    input.selectedPatches.exclusion,
  ]);

  return ordered.length > 0 ? ordered.join(' ') : input.basePrompt;
}

function composePatternRewrite(input: {
  basePrompt: string;
  selectedPatches: Partial<Record<PatchKind, string>>;
  pattern: NonNullable<RewriteInput['patternFit']>['primary'];
}): string {
  const direct = composeRewrite({ basePrompt: input.basePrompt, selectedPatches: input.selectedPatches });
  const opening = ensureSentence(firstSentence(input.basePrompt));

  if (input.pattern === 'few_shot') {
    return toSentences([
      opening,
      input.selectedPatches.audience,
      input.selectedPatches.exclusion,
      'Follow this pattern: Example 1 -> concise, grounded answer. Example 2 -> same structure with different facts.',
      'Then produce the final answer using the same pattern.',
    ]).join(' ');
  }

  if (input.pattern === 'stepwise_reasoning') {
    return toSentences([
      opening,
      input.selectedPatches.audience,
      'Use three steps: identify decision dimensions, compare options across those dimensions, then provide a final recommendation with trade-offs.',
      input.selectedPatches.exclusion,
    ]).join(' ');
  }

  if (input.pattern === 'decomposition') {
    return toSentences([
      opening,
      'Break the work into phases and start with the first phase output.',
      input.selectedPatches.structure,
      input.selectedPatches.task_load,
      input.selectedPatches.exclusion,
    ]).join(' ');
  }

  if (input.pattern === 'decision_rubric') {
    return toSentences([
      opening,
      'Define criteria first, then score each option against those criteria, and finish with a ranked verdict.',
      input.selectedPatches.structure,
      input.selectedPatches.exclusion,
    ]).join(' ');
  }

  if (input.pattern === 'context_first') {
    return toSentences([
      opening,
      'Before drafting, request the missing source context and required facts.',
      'Then generate output grounded only in supplied source material.',
      input.selectedPatches.example_or_comparison,
      input.selectedPatches.exclusion,
      input.selectedPatches.structure,
    ]).join(' ');
  }

  return direct;
}

function patchKindFromSuggestion(input: { id: string; title: string; category: string }): PatchKind | null {
  const id = input.id.toLowerCase();
  const title = input.title.toLowerCase();
  const category = input.category.toLowerCase();

  if (id.includes('audience') || title.includes('add a specific audience') || category === 'audience') {
    return 'audience';
  }

  if (
    title.includes('specify the output structure') ||
    id.includes('output_structure') ||
    id.includes('clarify_output_structure') ||
    category === 'structure'
  ) {
    return 'structure';
  }

  if (id.includes('exclusion') || title.includes('add one exclusion') || category === 'exclusion') {
    return 'exclusion';
  }

  if (id.includes('task_load') || title.includes('split or narrow the task load') || category === 'task_load') {
    return 'task_load';
  }

  if (
    category === 'proof' ||
    title.includes('comparison') ||
    title.includes('examples') ||
    title.includes('proof point') ||
    title.includes('decision criteria')
  ) {
    return 'example_or_comparison';
  }

  return null;
}

function fallbackPatchOrder(issueCodes: Set<string>): PatchKind[] {
  const order: PatchKind[] = [];
  if (issueCodes.has('AUDIENCE_MISSING')) {
    order.push('audience');
  }
  if (issueCodes.has('CONSTRAINTS_MISSING')) {
    order.push('structure');
  }
  if (issueCodes.has('TASK_OVERLOADED')) {
    order.push('task_load');
  }
  if (issueCodes.has('EXCLUSIONS_MISSING')) {
    order.push('exclusion');
  }
  if (issueCodes.has('CONSTRAINTS_MISSING') || issueCodes.has('GENERIC_OUTPUT_RISK_HIGH')) {
    order.push('example_or_comparison');
  }
  return order;
}

function rankedPatchKinds(input: RewriteInput): PatchKind[] {
  const issueCodes = new Set(input.analysis?.detectedIssueCodes ?? []);
  const suggestions = input.improvementSuggestions ?? [];
  const fromSuggestions = suggestions
    .map((item) => patchKindFromSuggestion({ id: item.id, title: item.title, category: item.category }))
    .filter((value): value is PatchKind => value !== null)
    .filter((value, index, array) => array.indexOf(value) === index);

  if (fromSuggestions.length > 0) {
    if (input.mode === 'high_contrast' && issueCodes.size > 0 && !fromSuggestions.includes('example_or_comparison')) {
      fromSuggestions.push('example_or_comparison');
    }
    if (input.role === 'marketer' && input.mode === 'high_contrast' && !fromSuggestions.includes('exclusion')) {
      fromSuggestions.push('exclusion');
    }
    return fromSuggestions;
  }

  const fallback = fallbackPatchOrder(issueCodes);
  if (input.mode === 'high_contrast' && issueCodes.size > 0 && !fallback.includes('example_or_comparison')) {
    fallback.push('example_or_comparison');
  }
  if (input.role === 'marketer' && input.mode === 'high_contrast' && !fallback.includes('exclusion')) {
    fallback.push('exclusion');
  }
  return fallback;
}

function inferPatchClause(input: RewriteInput, patchKind: PatchKind): string | null {
  if (patchKind === 'audience') {
    return inferAudience(input);
  }
  if (patchKind === 'structure') {
    return inferStructureClause(input);
  }
  if (patchKind === 'exclusion') {
    return inferExclusionClause(input);
  }
  if (patchKind === 'task_load') {
    return inferBoundaryClause(input);
  }
  if (input.mode === 'high_contrast') {
    return inferBoundaryClause(input) ?? inferExampleClause(input);
  }
  return inferExampleClause(input);
}

export class MockRewriteEngine implements RewriteEngine {
  async rewrite(input: RewriteInput): Promise<Rewrite> {
    const basePrompt = input.prompt.trim().replace(/\s+/g, ' ');
    const pattern = input.patternFit?.primary ?? 'direct_instruction';
    const rankedKinds = rankedPatchKinds(input);
    const selectedPatches: Partial<Record<PatchKind, string>> = {};
    const selectedKinds: PatchKind[] = [];

    for (const patchKind of rankedKinds) {
      if (selectedKinds.length >= 4) {
        break;
      }
      if (selectedPatches[patchKind]) {
        continue;
      }
      const clause = inferPatchClause(input, patchKind);
      if (!clause) {
        if (patchKind === 'example_or_comparison' && input.mode === 'high_contrast' && !selectedPatches.task_load) {
          const fallbackBoundary = inferBoundaryClause(input);
          if (fallbackBoundary) {
            selectedPatches.task_load = fallbackBoundary;
            selectedKinds.push('task_load');
          }
        }
        continue;
      }
      selectedPatches[patchKind] = clause;
      selectedKinds.push(patchKind);
    }

    const finalAdditions = toSentences(
      selectedKinds
        .map((kind) => selectedPatches[kind])
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    );
    const rewrittenPrompt =
      finalAdditions.length > 0 || pattern !== 'direct_instruction'
        ? composePatternRewrite({ basePrompt, selectedPatches, pattern })
        : basePrompt;

    return {
      role: input.role,
      mode: input.mode,
      rewrittenPrompt,
      explanation:
        finalAdditions.length > 0
          ? substitutePreferredLanguage(`Applied ${pattern} rewrite guidance with concrete, task-grounded additions.`, 'specificity')
          : substitutePreferredLanguage('Applied a minimal rewrite because concrete improvements were not safely inferable.', 'specificity'),
      changes: finalAdditions.length > 0 ? finalAdditions : ['Kept rewrite minimal to avoid abstract scaffolding.'],
    };
  }
}
