import type { RewriteRecommendation, Role, ScoreBand, ScoreSet } from './contracts';

export type SemanticFixtureFamily = 'comparison' | 'decision_support' | 'context_first' | 'few_shot';

export interface SemanticConsistencyCase {
  name: string;
  family: SemanticFixtureFamily;
  role: Role;
  prompt: string;
  expectedRecommendation: RewriteRecommendation;
  forbiddenScoreBands?: ScoreBand[];
  forbiddenFindingSnippets?: string[];
  forbiddenSummarySnippets?: string[];
  forbiddenBestNextMoveSnippets?: string[];
}

export interface SemanticFindingCase {
  name: string;
  family: SemanticFixtureFamily;
  role: Role;
  prompt: string;
  expectedRecommendation: RewriteRecommendation;
  allowedFindingSnippets: string[];
  forbiddenFindingSnippets: string[];
}

export interface SemanticEquivalenceVariant {
  variant: string;
  prompt: string;
}

export interface SemanticEquivalenceFamily {
  family: SemanticFixtureFamily;
  role: Role;
  expectedRecommendation: RewriteRecommendation;
  expectedMajorBlockingIssues: boolean;
  importantSubscores: (keyof ScoreSet)[];
  variants: SemanticEquivalenceVariant[];
}

export const semanticConsistencyCases: SemanticConsistencyCase[] = [
  {
    name: 'typescript decision prompt stays aligned with non-rewrite verdict',
    family: 'decision_support',
    role: 'general',
    prompt:
      'Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity. Help engineering managers decide using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
    expectedRecommendation: 'no_rewrite_needed',
    forbiddenScoreBands: ['poor', 'weak'],
    forbiddenFindingSnippets: ['too open-ended', 'constraints are missing'],
    forbiddenSummarySnippets: ['too open-ended', 'lacks enough criteria', 'needs more contract detail'],
  },
  {
    name: 'covered comparison prompt can stay optional without harsh weak-copy',
    family: 'comparison',
    role: 'general',
    prompt:
      'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy and operational load. Keep the trade-offs practical and avoid hype.',
    expectedRecommendation: 'no_rewrite_needed',
    forbiddenScoreBands: ['poor'],
    forbiddenFindingSnippets: ['too open-ended', 'constraints are missing'],
    forbiddenSummarySnippets: ['too open-ended', 'lacks enough evaluation frame'],
    forbiddenBestNextMoveSnippets: ['add runtime', 'add contract detail'],
  },
  {
    name: 'thin comparison prompt stays in rewrite recommended state',
    family: 'comparison',
    role: 'general',
    prompt: 'Compare Kubernetes and ECS.',
    expectedRecommendation: 'rewrite_recommended',
    forbiddenScoreBands: ['strong', 'excellent'],
    forbiddenFindingSnippets: ['already strong', 'use safely without a rewrite'],
    forbiddenSummarySnippets: ['already strong', 'use safely without a rewrite', 'rewrite is optional at most'],
  },
  {
    name: 'context-rich prompt avoids generic missing-context fallback',
    family: 'context_first',
    role: 'general',
    prompt:
      'We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement. Given this situation, recommend whether we should adopt service mesh now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
    expectedRecommendation: 'no_rewrite_needed',
    forbiddenScoreBands: ['poor', 'weak'],
    forbiddenFindingSnippets: ['too open-ended', 'needs more detail'],
    forbiddenSummarySnippets: ['too open-ended', 'needs more detail', 'more contract detail'],
  },
  {
    name: 'few-shot transfer prompt avoids stale generic fallback',
    family: 'few_shot',
    role: 'general',
    prompt:
      'Use these examples as the model for tone and structure. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Write a new response about zero-trust adoption. Preserve the structure and concise style, adapt the domain details, and avoid extra marketing language.',
    expectedRecommendation: 'no_rewrite_needed',
    forbiddenScoreBands: ['poor', 'weak'],
    forbiddenFindingSnippets: ['too open-ended', 'needs more detail', 'add runtime'],
    forbiddenSummarySnippets: ['too open-ended', 'needs more detail', 'implementation detail'],
  },
];

export const semanticFindingCases: SemanticFindingCase[] = [
  {
    name: 'comparison findings stay on criteria and trade-off guidance',
    family: 'comparison',
    role: 'general',
    prompt:
      'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy, operational load, and scaling complexity. Include one startup case and one enterprise case. Avoid hype and focus on real trade-offs.',
    expectedRecommendation: 'no_rewrite_needed',
    allowedFindingSnippets: ['comparison criteria', 'trade-off', 'grounded'],
    forbiddenFindingSnippets: ['add runtime', 'add contract detail', 'validation or failure constraints are missing'],
  },
  {
    name: 'decision-support findings stay on criteria and grounded scenarios',
    family: 'decision_support',
    role: 'general',
    prompt:
      'Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity. Help engineering managers decide using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
    expectedRecommendation: 'no_rewrite_needed',
    allowedFindingSnippets: ['decision criteria', 'scenario', 'grounded example'],
    forbiddenFindingSnippets: ['add runtime', 'add contract detail', 'validation or failure constraints are missing'],
  },
  {
    name: 'context-first findings stay on deliverable and evaluation frame',
    family: 'context_first',
    role: 'general',
    prompt:
      'We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement. Given this situation, recommend whether we should adopt service mesh now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
    expectedRecommendation: 'no_rewrite_needed',
    allowedFindingSnippets: ['requested deliverable', 'decision criteria', 'supplied context'],
    forbiddenFindingSnippets: ['too open-ended', 'needs more detail', 'add runtime'],
  },
  {
    name: 'few-shot findings stay on preserve-versus-change guidance',
    family: 'few_shot',
    role: 'general',
    prompt:
      'Use these examples as the model for tone and structure. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Write a new response about zero-trust adoption. Preserve the structure and concise style, adapt the domain details, and avoid extra marketing language.',
    expectedRecommendation: 'no_rewrite_needed',
    allowedFindingSnippets: ['preserve', 'change', 'target output shape'],
    forbiddenFindingSnippets: ['too open-ended', 'needs more detail', 'implementation detail'],
  },
];

export const semanticEquivalenceFamilies: SemanticEquivalenceFamily[] = [
  {
    family: 'comparison',
    role: 'general',
    expectedRecommendation: 'no_rewrite_needed',
    expectedMajorBlockingIssues: false,
    importantSubscores: ['scope', 'contrast', 'constraintQuality'],
    variants: [
      {
        variant: 'direct comparison',
        prompt:
          'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy, operational load, and scaling complexity. Include one startup case and one enterprise case. Avoid hype and focus on real trade-offs.',
      },
      {
        variant: 'when worth it framing',
        prompt:
          'Compare Kubernetes versus ECS for a mid-sized SaaS engineering org. Show when each is the better fit using team autonomy, operational load, and scaling complexity. Include one startup example and one enterprise example, and keep the tone grounded in real trade-offs.',
      },
      {
        variant: 'criteria-led evaluation',
        prompt:
          'Compare Kubernetes and ECS for a mid-sized SaaS engineering team using team autonomy, ops load, and scaling complexity. Include one startup case and one enterprise case, keep the tone grounded in real trade-offs, and avoid hype.',
      },
    ],
  },
  {
    family: 'decision_support',
    role: 'general',
    expectedRecommendation: 'no_rewrite_needed',
    expectedMajorBlockingIssues: false,
    importantSubscores: ['scope', 'contrast', 'constraintQuality'],
    variants: [
      {
        variant: 'helps versus hurts',
        prompt:
          'Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity. Help engineering managers decide using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
      },
      {
        variant: 'worth the complexity',
        prompt:
          'Help engineering managers decide when TypeScript is worth the complexity using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup case and one enterprise case, and keep the guidance grounded rather than hyped.',
      },
      {
        variant: 'criteria for adoption',
        prompt:
          'Explain the criteria for deciding whether to adopt TypeScript for a growing engineering team. Use maintainability, onboarding cost, and build tooling complexity as the decision criteria. Include a startup example and an enterprise example, and focus on grounded trade-offs.',
      },
    ],
  },
  {
    family: 'context_first',
    role: 'general',
    expectedRecommendation: 'no_rewrite_needed',
    expectedMajorBlockingIssues: false,
    importantSubscores: ['scope', 'clarity', 'constraintQuality'],
    variants: [
      {
        variant: 'inline scenario',
        prompt:
          'For a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement, recommend whether we should adopt service mesh now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
      },
      {
        variant: 'explicit context block',
        prompt:
          'We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement. Given this situation, recommend whether service mesh is worth the operational cost now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
      },
      {
        variant: 'given this situation wording',
        prompt:
          'Given this situation: a 20-person B2B SaaS team, two product squads, limited SRE support, and a compliance requirement, advise whether to adopt service mesh now or later. Base the answer on operational cost, team autonomy, and compliance impact.',
      },
    ],
  },
  {
    family: 'few_shot',
    role: 'general',
    expectedRecommendation: 'no_rewrite_needed',
    expectedMajorBlockingIssues: false,
    importantSubscores: ['clarity', 'constraintQuality', 'genericOutputRisk'],
    variants: [
      {
        variant: 'use these examples',
        prompt:
          'Use these examples as the model for tone and structure. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Write a new response about zero-trust adoption. Preserve the structure and concise style, adapt the domain details, and avoid extra marketing language.',
      },
      {
        variant: 'follow this pattern',
        prompt:
          'Use these examples as the model for tone and structure. Follow this pattern and write a new response about zero-trust adoption. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Preserve the structure and concise style, adapt the topic-specific details, and avoid extra marketing language.',
      },
      {
        variant: 'model the response after these examples',
        prompt:
          'Use these examples as the model for tone and structure. Model the response after these examples and write a new response about zero-trust adoption. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Preserve the structure and concise style, change the domain details, and avoid extra marketing language.',
      },
    ],
  },
];
