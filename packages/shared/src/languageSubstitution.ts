export type LanguageSubstitutionIntent = 'specificity' | 'realism' | 'support' | 'measurement';

export interface LanguageSubstitutionRule {
  term: string;
  status: 'discouraged';
  reason: string;
  replacements: Record<LanguageSubstitutionIntent, string[]>;
}

export const languageSubstitutionRegistry: LanguageSubstitutionRule[] = [
  {
    term: 'specific',
    status: 'discouraged',
    reason: 'Too abstract for default UI copy.',
    replacements: {
      specificity: ['specific', 'clear', 'explicit', 'exact'],
      realism: ['real', 'practical'],
      support: ['evidence-based', 'supported by an example'],
      measurement: ['measurable outcome', 'specific result'],
    },
  },
  {
    term: 'specifically',
    status: 'discouraged',
    reason: 'Too abstract for default UI copy.',
    replacements: {
      specificity: ['specifically', 'clearly', 'explicitly'],
      realism: ['in a real scenario', 'practically'],
      support: ['with supporting evidence', 'with an example'],
      measurement: ['with a measurable result', 'with a specific result'],
    },
  },
];

type PhraseReplacement = {
  pattern: RegExp;
  replacement: string;
};

const phraseReplacementsByIntent: Record<LanguageSubstitutionIntent, PhraseReplacement[]> = {
  specificity: [
    { pattern: /\bminimal and specific\b/gi, replacement: 'minimal and specific' },
    { pattern: /\bspecific,\s+task-grounded\b/gi, replacement: 'specific, task-grounded' },
    { pattern: /\bspecific example(s)?\b/gi, replacement: 'specific example$1' },
    { pattern: /\bspecific audience\b/gi, replacement: 'specific audience' },
    { pattern: /\bspecific positioning detail\b/gi, replacement: 'specific positioning detail' },
    { pattern: /\bspecific scope\b/gi, replacement: 'clear scope' },
    { pattern: /\bspecific detail(s)?\b/gi, replacement: 'specific detail$1' },
    { pattern: /\bspecific exclusion\b/gi, replacement: 'clear exclusion' },
    { pattern: /\bspecific requirement(s)?\b/gi, replacement: 'specific requirement$1' },
    { pattern: /\bspecific improvements\b/gi, replacement: 'specific improvements' },
  ],
  realism: [
    { pattern: /\bspecific comparison\b/gi, replacement: 'real comparison' },
    { pattern: /\bspecific scenario\b/gi, replacement: 'real scenario' },
  ],
  support: [
    { pattern: /\bspecific proof artifact\b/gi, replacement: 'evidence-backed proof point' },
    { pattern: /\bspecific proof\b/gi, replacement: 'evidence-based proof' },
    { pattern: /\bspecific claim\b/gi, replacement: 'claim supported by an example' },
    { pattern: /\bspecific support\b/gi, replacement: 'support backed by an example' },
  ],
  measurement: [
    { pattern: /\bspecific outcome\b/gi, replacement: 'measurable outcome' },
    { pattern: /\bspecific result\b/gi, replacement: 'specific result' },
  ],
};

const discouragedDefaultLanguagePatterns = languageSubstitutionRegistry.map((entry) => ({
  term: entry.term,
  pattern: new RegExp(`\\b${entry.term}\\b`, 'i'),
}));

export function substitutePreferredLanguage(text: string, intent: LanguageSubstitutionIntent): string {
  return phraseReplacementsByIntent[intent].reduce(
    (current, rule) => current.replace(rule.pattern, rule.replacement),
    text,
  );
}

export function findDiscouragedDefaultLanguage(text: string): string[] {
  return discouragedDefaultLanguagePatterns
    .filter((entry) => entry.pattern.test(text))
    .map((entry) => entry.term);
}

export function hasDiscouragedDefaultLanguage(text: string): boolean {
  return findDiscouragedDefaultLanguage(text).length > 0;
}
