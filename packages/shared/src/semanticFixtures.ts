import type { BestNextMoveType, RewriteRecommendation, Role, ScoreBand, ScoreSet } from './contracts';

export type SemanticFixtureFamily = 'implementation' | 'analysis' | 'comparison' | 'decision_support' | 'context_first' | 'few_shot';

export interface SemanticConsistencyCase {
  name: string;
  family: Exclude<SemanticFixtureFamily, 'implementation'>;
  role: Role;
  prompt: string;
  expectedRecommendation: RewriteRecommendation;
  expectedBestNextMoveTypes?: BestNextMoveType[];
  forbiddenScoreBands?: ScoreBand[];
  forbiddenFindingSnippets?: string[];
  forbiddenSummarySnippets?: string[];
  forbiddenBestNextMoveSnippets?: string[];
}

export interface SemanticFindingCase {
  name: string;
  family: Exclude<SemanticFixtureFamily, 'implementation'>;
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
  family: Exclude<SemanticFixtureFamily, 'implementation'>;
  role: Role;
  expectedRecommendation: RewriteRecommendation;
  expectedMajorBlockingIssues: boolean;
  importantSubscores: (keyof ScoreSet)[];
  variants: SemanticEquivalenceVariant[];
}

export interface SemanticBoundaryFixture {
  name: string;
  family: SemanticFixtureFamily;
  role: Role;
  thinPrompt: string;
  thinRecommendation: RewriteRecommendation;
  thinAllowedScoreBands?: ScoreBand[];
  boundedPrompt: string;
  boundedRecommendation: RewriteRecommendation;
  boundedForbiddenSnippets: string[];
  expectedBoundedBestNextMoveType?: BestNextMoveType | null;
  partialPrompt?: string;
  partialRecommendation?: RewriteRecommendation;
  synonymBoundedPrompt?: string;
}

export const semanticConsistencyCases: SemanticConsistencyCase[] = [
  {
    name: 'bounded analysis prompt stays aligned with non-rewrite verdict',
    family: 'analysis',
    role: 'general',
    prompt:
      'Analyze why incident response handoffs keep stalling for a mid-sized SaaS team. Assess ownership ambiguity, escalation gaps, and on-call load as the criteria. Include one startup case and one enterprise case. Avoid generic management advice and keep the findings practical.',
    expectedRecommendation: 'no_rewrite_needed',
    forbiddenScoreBands: ['poor', 'weak'],
    forbiddenFindingSnippets: ['too open-ended', 'constraints are missing', 'add runtime'],
    forbiddenSummarySnippets: ['too open-ended', 'needs more detail', 'decision frame'],
  },
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
    expectedBestNextMoveTypes: ['add_decision_criteria'],
    forbiddenScoreBands: ['strong', 'excellent'],
    forbiddenFindingSnippets: ['already strong', 'use safely without a rewrite'],
    forbiddenSummarySnippets: ['already strong', 'use safely without a rewrite', 'rewrite is optional at most'],
  },
  {
    name: 'thin decision-support prompt stays in rewrite recommended state',
    family: 'decision_support',
    role: 'general',
    prompt: 'Help engineering managers decide whether to adopt TypeScript.',
    expectedRecommendation: 'rewrite_recommended',
    expectedBestNextMoveTypes: ['add_decision_criteria', 'shift_to_decision_frame'],
    forbiddenScoreBands: ['strong', 'excellent'],
    forbiddenFindingSnippets: ['already strong', 'use safely without a rewrite'],
    forbiddenSummarySnippets: ['already strong', 'rewrite is optional at most'],
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
    name: 'thin context-first prompt stays in rewrite recommended state',
    family: 'context_first',
    role: 'general',
    prompt: 'Given this situation, recommend whether to adopt service mesh.',
    expectedRecommendation: 'rewrite_recommended',
    expectedBestNextMoveTypes: ['clarify_output_structure'],
    forbiddenScoreBands: ['strong', 'excellent'],
    forbiddenFindingSnippets: ['already strong', 'use safely without a rewrite'],
    forbiddenSummarySnippets: ['already strong', 'rewrite is optional at most'],
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
  {
    name: 'thin few-shot prompt stays in rewrite optional state',
    family: 'few_shot',
    role: 'general',
    prompt: 'Use the following examples and follow this pattern for tone and structure.',
    expectedRecommendation: 'rewrite_optional',
    expectedBestNextMoveTypes: ['require_examples'],
    forbiddenScoreBands: ['strong', 'excellent'],
    forbiddenFindingSnippets: ['already strong', 'use safely without a rewrite'],
    forbiddenSummarySnippets: ['already strong', 'rewrite is optional at most'],
  },
];

export const semanticFindingCases: SemanticFindingCase[] = [
  {
    name: 'analysis findings stay on diagnostic lens and grounded context',
    family: 'analysis',
    role: 'general',
    prompt:
      'Analyze why incident response handoffs keep stalling for a mid-sized SaaS team. Assess ownership ambiguity, escalation gaps, and on-call load as the criteria. Include one startup case and one enterprise case. Avoid generic management advice and keep the findings practical.',
    expectedRecommendation: 'no_rewrite_needed',
    allowedFindingSnippets: ['analysis lens', 'scenario', 'grounded boundary'],
    forbiddenFindingSnippets: ['add runtime', 'add contract detail', 'validation or failure constraints are missing'],
  },
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
    family: 'analysis',
    role: 'general',
    expectedRecommendation: 'no_rewrite_needed',
    expectedMajorBlockingIssues: false,
    importantSubscores: ['scope', 'contrast', 'constraintQuality'],
    variants: [
      {
        variant: 'analyze why it stalls',
        prompt:
          'Analyze why incident response handoffs keep stalling for a mid-sized SaaS team. Assess ownership ambiguity, escalation gaps, and on-call load as the criteria. Include one startup case and one enterprise case. Avoid generic management advice and keep the findings practical.',
      },
      {
        variant: 'diagnose the breakdowns',
        prompt:
          'Diagnose the breakdowns in incident response handoffs for a mid-sized SaaS engineering org. Use ownership ambiguity, escalation gaps, and on-call load as the analysis criteria. Include one startup example and one enterprise example, and keep the findings grounded rather than generic.',
      },
      {
        variant: 'review the root causes',
        prompt:
          'Review the root causes behind stalled incident response handoffs for a mid-sized SaaS team using ownership clarity, escalation flow, and on-call load as the criteria. Include one startup case and one enterprise case, and avoid generic management advice.',
      },
    ],
  },
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

export const semanticBoundaryFixtures: SemanticBoundaryFixture[] = [
  {
    name: 'analysis thin versus bounded',
    family: 'analysis',
    role: 'general',
    thinPrompt: 'Analyze our incident response process.',
    thinRecommendation: 'rewrite_recommended',
    thinAllowedScoreBands: ['poor', 'weak', 'usable'],
    boundedPrompt:
      'Analyze why incident response handoffs keep stalling for a mid-sized SaaS team. Assess ownership ambiguity, escalation gaps, and on-call load as the criteria. Include one startup case and one enterprise case. Avoid generic management advice and keep the findings practical.',
    boundedRecommendation: 'no_rewrite_needed',
    boundedForbiddenSnippets: ['too open-ended', 'needs more detail', 'runtime', 'contract detail'],
    expectedBoundedBestNextMoveType: null,
  },
  {
    name: 'comparison thin versus bounded',
    family: 'comparison',
    role: 'general',
    thinPrompt: 'Compare Kubernetes and ECS.',
    thinRecommendation: 'rewrite_recommended',
    thinAllowedScoreBands: ['poor', 'weak', 'usable'],
    boundedPrompt:
      'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy, operational load, and scaling complexity. Include one startup case and one enterprise case. Avoid hype and focus on real trade-offs.',
    boundedRecommendation: 'no_rewrite_needed',
    boundedForbiddenSnippets: ['too open-ended', 'constraints are missing', 'runtime', 'contract detail'],
    expectedBoundedBestNextMoveType: null,
  },
  {
    name: 'decision-support thin versus bounded',
    family: 'decision_support',
    role: 'general',
    thinPrompt: 'Help engineering managers decide whether to adopt TypeScript.',
    thinRecommendation: 'rewrite_recommended',
    thinAllowedScoreBands: ['poor', 'weak', 'usable'],
    boundedPrompt:
      'Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity. Help engineering managers decide using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
    boundedRecommendation: 'no_rewrite_needed',
    boundedForbiddenSnippets: ['too open-ended', 'runtime', 'contract', 'validation'],
    expectedBoundedBestNextMoveType: null,
  },
  {
    name: 'context-first thin versus bounded',
    family: 'context_first',
    role: 'general',
    thinPrompt: 'Given this situation, recommend whether to adopt service mesh.',
    thinRecommendation: 'rewrite_recommended',
    thinAllowedScoreBands: ['poor', 'weak', 'usable'],
    boundedPrompt:
      'For a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement, recommend whether we should adopt service mesh now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
    boundedRecommendation: 'no_rewrite_needed',
    boundedForbiddenSnippets: ['too open-ended', 'needs more detail', 'runtime', 'contract detail'],
    expectedBoundedBestNextMoveType: null,
  },
  {
    name: 'few-shot thin versus bounded',
    family: 'few_shot',
    role: 'general',
    thinPrompt: 'Use the following examples and follow this pattern for tone and structure.',
    thinRecommendation: 'rewrite_optional',
    thinAllowedScoreBands: ['poor', 'weak', 'usable'],
    boundedPrompt:
      'Use these examples as the model for tone and structure. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Write a new response about zero-trust adoption. Preserve the structure and concise style, adapt the domain details, and avoid extra marketing language.',
    boundedRecommendation: 'no_rewrite_needed',
    boundedForbiddenSnippets: ['too open-ended', 'needs more detail', 'runtime', 'implementation detail'],
    expectedBoundedBestNextMoveType: null,
  },
  {
    name: 'implementation thin partial and bounded',
    family: 'implementation',
    role: 'developer',
    thinPrompt: 'Write a webhook handler.',
    thinRecommendation: 'rewrite_recommended',
    thinAllowedScoreBands: ['poor', 'weak', 'usable'],
    partialPrompt: 'Write a Node.js webhook endpoint in TypeScript that accepts JSON and returns 200 on success and 400 on invalid input.',
    partialRecommendation: 'rewrite_optional',
    boundedPrompt:
      'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
    synonymBoundedPrompt:
      'Build a small Node.js endpoint in TypeScript for receiving webhook events as JSON. Check the body against a defined contract before processing it. Return HTTP 200 when the payload is accepted and HTTP 400 when the contract check fails. Log failures for debugging. Leave auth, signature checks, and business-rule enforcement out of scope.',
    boundedRecommendation: 'no_rewrite_needed',
    boundedForbiddenSnippets: ['too open-ended', 'constraints are missing', 'add runtime, contract, and response detail'],
    expectedBoundedBestNextMoveType: null,
  },
];
