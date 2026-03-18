import type { RewriteRecommendation, Role, ScoreBand } from './contracts';
import type { SemanticFixtureFamily } from './semanticFixtures';

export interface SemanticEvalFixture {
  id: string;
  family: SemanticFixtureFamily;
  role: Role;
  prompt: string;
  expectedTaskClass: SemanticFixtureFamily;
  expectedRecommendation: RewriteRecommendation;
  acceptableScoreBands: ScoreBand[];
  forbiddenLegacyPhrases: string[];
  notes?: string;
}

const nonImplementationLegacyPhrases = ['add runtime', 'contract detail', 'validation or failure constraints are missing'];
const genericWeakPhrases = ['too open-ended', 'needs more detail'];

export const semanticEvalFixtures: SemanticEvalFixture[] = [
  {
    id: 'implementation-thin-webhook',
    family: 'implementation',
    role: 'developer',
    prompt: 'Write a webhook handler.',
    expectedTaskClass: 'implementation',
    expectedRecommendation: 'rewrite_recommended',
    acceptableScoreBands: ['poor', 'weak', 'usable'],
    forbiddenLegacyPhrases: ['comparison criteria', 'decision criteria', 'too open-ended'],
    notes: 'Thin boundedness baseline for the implementation family.',
  },
  {
    id: 'implementation-partial-webhook',
    family: 'implementation',
    role: 'developer',
    prompt: 'Write a Node.js webhook endpoint in TypeScript that accepts JSON and returns 200 on success and 400 on invalid input.',
    expectedTaskClass: 'implementation',
    expectedRecommendation: 'rewrite_optional',
    acceptableScoreBands: ['weak', 'usable', 'strong'],
    forbiddenLegacyPhrases: ['comparison criteria', 'decision criteria'],
  },
  {
    id: 'implementation-bounded-webhook',
    family: 'implementation',
    role: 'developer',
    prompt:
      'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
    expectedTaskClass: 'implementation',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['usable', 'strong', 'excellent'],
    forbiddenLegacyPhrases: ['too open-ended', 'needs more detail'],
  },
  {
    id: 'implementation-synonym-bounded-webhook',
    family: 'implementation',
    role: 'developer',
    prompt:
      'Build a small Node.js endpoint in TypeScript for receiving webhook events as JSON. Check the body against a defined contract before processing it. Return HTTP 200 when the payload is accepted and HTTP 400 when the contract check fails. Log failures for debugging. Leave auth, signature checks, and business-rule enforcement out of scope.',
    expectedTaskClass: 'implementation',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['usable', 'strong', 'excellent'],
    forbiddenLegacyPhrases: ['too open-ended', 'needs more detail'],
  },
  {
    id: 'implementation-bounded-with-idempotency',
    family: 'implementation',
    role: 'developer',
    prompt:
      'Implement a Node.js webhook endpoint in TypeScript that accepts JSON, validates the payload against a schema, logs failures, returns HTTP 200 on success and HTTP 400 on schema validation errors, keeps idempotency handling explicit, and excludes authorization and signature verification.',
    expectedTaskClass: 'implementation',
    expectedRecommendation: 'rewrite_recommended',
    acceptableScoreBands: ['poor', 'weak', 'usable'],
    forbiddenLegacyPhrases: ['too open-ended', 'comparison criteria'],
    notes: 'Edge-sensitive because the extra operational detail should not push it back into fallback missing-context copy.',
  },
  {
    id: 'comparison-thin-k8s-ecs',
    family: 'comparison',
    role: 'general',
    prompt: 'Compare Kubernetes and ECS.',
    expectedTaskClass: 'comparison',
    expectedRecommendation: 'rewrite_recommended',
    acceptableScoreBands: ['poor', 'weak', 'usable'],
    forbiddenLegacyPhrases: ['runtime', 'contract detail'],
  },
  {
    id: 'comparison-bounded-k8s-ecs',
    family: 'comparison',
    role: 'general',
    prompt:
      'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy, operational load, and scaling complexity. Include one startup case and one enterprise case. Avoid hype and focus on real trade-offs.',
    expectedTaskClass: 'comparison',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'comparison-worth-overhead-framing',
    family: 'comparison',
    role: 'general',
    prompt:
      'Explain when Kubernetes is worth the overhead and when ECS is the better choice for a mid-sized SaaS engineering org. Use a startup example and an enterprise example, and keep the tone grounded in real trade-offs.',
    expectedTaskClass: 'comparison',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'comparison-postgres-mysql',
    family: 'comparison',
    role: 'general',
    prompt:
      'Compare PostgreSQL and MySQL for a B2B SaaS team choosing a default operational database. Use migration effort, operational familiarity, and scaling trade-offs as the criteria. Include one startup case and one enterprise case. Avoid hype.',
    expectedTaskClass: 'comparison',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'comparison-buy-vs-build-observability',
    family: 'comparison',
    role: 'general',
    prompt:
      'Compare buying an observability platform versus building a lightweight internal stack for a mid-sized SaaS team. Judge the options using operational load, flexibility, and time-to-value. Include one case where each path is the better fit and keep the trade-offs grounded.',
    expectedTaskClass: 'comparison',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'decision-thin-typescript',
    family: 'decision_support',
    role: 'general',
    prompt: 'Help engineering managers decide whether to adopt TypeScript using maintainability and onboarding cost as the criteria.',
    expectedTaskClass: 'decision_support',
    expectedRecommendation: 'rewrite_recommended',
    acceptableScoreBands: ['poor', 'weak', 'usable'],
    forbiddenLegacyPhrases: ['runtime', 'contract detail'],
  },
  {
    id: 'decision-bounded-typescript',
    family: 'decision_support',
    role: 'general',
    prompt:
      'Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity. Help engineering managers decide using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
    expectedTaskClass: 'decision_support',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'decision-worth-the-complexity',
    family: 'decision_support',
    role: 'general',
    prompt:
      'Help engineering managers decide when TypeScript is worth the complexity using maintainability, onboarding cost, and build tooling complexity as the criteria. Include one startup case and one enterprise case, and keep the guidance grounded rather than hyped.',
    expectedTaskClass: 'decision_support',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'decision-service-mesh-adoption',
    family: 'decision_support',
    role: 'general',
    prompt:
      'Help platform leaders decide whether a service mesh is worth adopting for a mid-sized SaaS team. Use operational cost, security policy consistency, and team autonomy as the criteria. Include one case where the answer is yes and one where the answer is no. Avoid hype.',
    expectedTaskClass: 'decision_support',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'decision-monorepo',
    family: 'decision_support',
    role: 'general',
    prompt:
      'Help engineering leaders decide whether to keep a monorepo or split services into separate repos. Use onboarding cost, CI complexity, and release autonomy as the criteria. Include one startup example and one enterprise example, and keep the recommendation grounded.',
    expectedTaskClass: 'decision_support',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'context-thin-service-mesh',
    family: 'context_first',
    role: 'general',
    prompt: 'Given this situation, recommend whether to adopt service mesh.',
    expectedTaskClass: 'context_first',
    expectedRecommendation: 'rewrite_recommended',
    acceptableScoreBands: ['poor', 'weak', 'usable'],
    forbiddenLegacyPhrases: ['runtime', 'contract detail'],
  },
  {
    id: 'context-bounded-service-mesh',
    family: 'context_first',
    role: 'general',
    prompt:
      'For a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement, recommend whether we should adopt service mesh now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
    expectedTaskClass: 'context_first',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'context-explicit-block',
    family: 'context_first',
    role: 'general',
    prompt:
      'We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement. Given this situation, recommend whether service mesh is worth the operational cost now or later using operational cost, team autonomy, and compliance impact as the decision criteria.',
    expectedTaskClass: 'context_first',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'context-data-platform',
    family: 'context_first',
    role: 'general',
    prompt:
      'We are a 35-person data platform team with one analytics engineer, limited on-call capacity, and a compliance deadline. Given this situation, recommend whether we should adopt dbt Cloud now or keep the current self-managed setup using operational load, auditability, and team autonomy as the criteria.',
    expectedTaskClass: 'context_first',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'context-incident-review',
    family: 'context_first',
    role: 'general',
    prompt:
      'Given this situation: a mid-sized SaaS team, frequent incident handoffs, limited SRE coverage, and new compliance reporting requirements, recommend whether we should centralize incident ownership now or later. Base the answer on operational load, accountability, and escalation clarity.',
    expectedTaskClass: 'context_first',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'few-shot-thin-pattern-transfer',
    family: 'few_shot',
    role: 'general',
    prompt: 'Use the following examples and follow this pattern for tone and structure.',
    expectedTaskClass: 'few_shot',
    expectedRecommendation: 'rewrite_optional',
    acceptableScoreBands: ['weak', 'usable'],
    forbiddenLegacyPhrases: ['runtime', 'contract detail'],
  },
  {
    id: 'few-shot-bounded-zero-trust',
    family: 'few_shot',
    role: 'general',
    prompt:
      'Use these examples as the model for tone and structure. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Write a new response about zero-trust adoption. Preserve the structure and concise style, adapt the domain details, and avoid extra marketing language.',
    expectedTaskClass: 'few_shot',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'few-shot-follow-pattern',
    family: 'few_shot',
    role: 'general',
    prompt:
      'Use these examples as the model for tone and structure. Follow this pattern and write a new response about zero-trust adoption. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Preserve the structure and concise style, adapt the topic-specific details, and avoid extra marketing language.',
    expectedTaskClass: 'few_shot',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'few-shot-model-response',
    family: 'few_shot',
    role: 'general',
    prompt:
      'Use these examples as the model for tone and structure. Model the response after these examples and write a new response about zero-trust adoption. Example 1: Short verdict, three bullets, one closing recommendation. Example 2: Short verdict, three bullets, one closing recommendation. Preserve the structure and concise style, change the domain details, and avoid extra marketing language.',
    expectedTaskClass: 'few_shot',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
  {
    id: 'few-shot-support-playbook',
    family: 'few_shot',
    role: 'general',
    prompt:
      'Use these examples as the model for tone and structure. Example 1: Verdict first, then three operational bullets, then one closing recommendation. Example 2: Verdict first, then three operational bullets, then one closing recommendation. Write a new response about on-call support load. Preserve the structure, keep the concise style, adapt the domain details, and avoid extra marketing language.',
    expectedTaskClass: 'few_shot',
    expectedRecommendation: 'no_rewrite_needed',
    acceptableScoreBands: ['strong', 'excellent'],
    forbiddenLegacyPhrases: [...genericWeakPhrases, ...nonImplementationLegacyPhrases],
  },
];
