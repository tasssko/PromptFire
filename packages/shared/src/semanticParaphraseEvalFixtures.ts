import type { RewriteRecommendation, Role, ScoreSet } from './contracts';
import type { SemanticFixtureFamily } from './semanticFixtures';

type CoveredSemanticFamily = Exclude<SemanticFixtureFamily, 'implementation'>;

export interface SemanticParaphrasePositive {
  name: string;
  prompt: string;
  paraphrases: string[];
}

export interface SemanticParaphraseNearMiss {
  name: string;
  prompt: string;
  expectedFamily: CoveredSemanticFamily | 'other';
  failureMode: string;
}

export interface SemanticParaphraseEvalFamily {
  family: CoveredSemanticFamily;
  role: Role;
  rationale: string;
  expectedRecommendation: RewriteRecommendation;
  importantSubscores: (keyof ScoreSet)[];
  strongPositives: SemanticParaphrasePositive[];
  nearMisses: SemanticParaphraseNearMiss[];
}

export const semanticParaphraseEvalFamilies: SemanticParaphraseEvalFamily[] = [
  {
    family: 'analysis',
    role: 'general',
    rationale:
      'Analysis prompts are easy to confuse with generic advice or decision requests. These cases keep the diagnostic lens stable across verbs like analyze, diagnose, review, and audit while screening out lookalike comparison and recommendation asks.',
    expectedRecommendation: 'no_rewrite_needed',
    importantSubscores: ['scope', 'contrast', 'constraintQuality'],
    strongPositives: [
      {
        name: 'platform onboarding breakdowns',
        prompt:
          'Analyze why onboarding to the internal platform keeps stalling for a growing fintech engineering team. Use docs sprawl, unclear ownership, and access friction as the criteria. Include one startup example and one regulated enterprise example. Avoid generic change-management advice.',
        paraphrases: [
          'Diagnose why internal platform onboarding keeps slowing down for a growing fintech engineering org. Assess documentation sprawl, ownership ambiguity, and access friction as the analysis criteria. Include one startup case and one regulated enterprise case, and avoid generic change-management advice.',
          'Review the root causes behind stalled onboarding to the internal platform for a growing fintech team. Use docs sprawl, unclear ownership, and access friction as the criteria. Include a startup example and a regulated enterprise example, and keep it practical.',
          'Audit what is driving internal platform onboarding delays for a growing fintech engineering team. Assess documentation sprawl, ownership clarity, and access friction as the criteria. Include one startup case and one regulated enterprise case, and avoid generic advice.',
        ],
      },
      {
        name: 'pipeline review drag',
        prompt:
          'Assess why weekly pipeline review meetings keep dragging for a B2B SaaS leadership team. Use unclear owners, noisy dashboards, and follow-up lag as the criteria. Include one startup example and one enterprise example. Avoid generic management advice.',
        paraphrases: [
          'Analyze why weekly pipeline review meetings keep overrunning for a B2B SaaS leadership team. Assess unclear owners, noisy dashboards, and follow-up lag as the criteria. Include one startup case and one enterprise case, and avoid generic management advice.',
          'Diagnose the breakdowns behind long pipeline review meetings for a B2B SaaS leadership team. Use ownership clarity, dashboard noise, and follow-up lag as the analysis criteria. Include one startup example and one enterprise example, and avoid generic management advice.',
          'Review what is driving slow weekly pipeline reviews for a B2B SaaS leadership team using ownership clarity, dashboard signal quality, and follow-up lag as the criteria. Include one startup case and one enterprise case, and keep it practical.',
        ],
      },
      {
        name: 'support escalation volume',
        prompt:
          'Review what is driving support escalation volume after a self-serve launch for a devtools company. Use ticket routing, documentation gaps, and product edge cases as the criteria. Include one product-led example and one enterprise-led example. Avoid generic customer-success advice.',
        paraphrases: [
          'Analyze why support escalations rose after a self-serve launch for a devtools company. Assess ticket routing, documentation gaps, and product edge cases as the criteria. Include one product-led case and one enterprise-led case, and avoid generic customer-success advice.',
          'Diagnose the causes of higher support escalation volume after a self-serve launch at a devtools company. Use routing quality, docs gaps, and product edge cases as the analysis criteria. Include one PLG example and one enterprise-sales example, and keep it grounded.',
          'Audit the root causes behind post-launch support escalations for a devtools company. Assess ticket routing, missing docs, and product edge cases as the criteria. Include one product-led example and one enterprise-led example, and avoid generic CS advice.',
        ],
      },
    ],
    nearMisses: [
      {
        name: 'comparison framing instead of diagnosis',
        prompt:
          'Compare Linear and Jira for a product team using reporting depth, workflow flexibility, and admin overhead as the criteria. Include one startup example and one enterprise example. Avoid hype.',
        expectedFamily: 'comparison',
        failureMode: 'Explicit compare framing should route to comparison, not analysis.',
      },
      {
        name: 'decision request instead of root-cause review',
        prompt:
          'Recommend whether a fintech engineering team should centralize platform ownership this quarter. Use hiring capacity, incident frequency, and migration risk as the criteria. Include one startup case and one regulated enterprise case.',
        expectedFamily: 'decision_support',
        failureMode: 'A recommendation request with criteria should route to decision support, not analysis.',
      },
      {
        name: 'generic topic write-up without semantic frame',
        prompt: 'Write about onboarding problems on internal developer platforms for engineering leaders.',
        expectedFamily: 'other',
        failureMode: 'A topic-only write-up should stay out of the narrow semantic families.',
      },
    ],
  },
  {
    family: 'comparison',
    role: 'general',
    rationale:
      'Comparison prompts are high-value because product wording often shifts between compare, versus, better fit, and worth the overhead. The near-misses separate direct comparisons from decision and analysis prompts that mention similar objects.',
    expectedRecommendation: 'no_rewrite_needed',
    importantSubscores: ['scope', 'contrast', 'constraintQuality'],
    strongPositives: [
      {
        name: 'event store choice',
        prompt:
          'Compare Postgres and DynamoDB for an event log in a mid-sized SaaS platform. Use query flexibility, write throughput, and operational overhead as the criteria. Include one startup example and one enterprise example. Avoid hype and focus on real trade-offs.',
        paraphrases: [
          'Compare Postgres versus DynamoDB for an event log in a mid-sized SaaS platform. Evaluate query flexibility, write throughput, and operational overhead as the criteria. Include one startup case and one enterprise case, and focus on real trade-offs.',
          'Explain when Postgres is the better fit and when DynamoDB is the better choice for an event log in a mid-sized SaaS platform. Use query flexibility, write throughput, and operational overhead as the criteria. Include one startup example and one enterprise example, and focus on real trade-offs.',
          'Choose between Postgres and DynamoDB for an event log in a mid-sized SaaS platform using query flexibility, write throughput, and operational overhead as the criteria. Include one startup case and one enterprise case, and focus on real trade-offs.',
        ],
      },
      {
        name: 'support workflow tools',
        prompt:
          'Compare Zendesk and Intercom for a support team serving both self-serve and enterprise customers. Use routing control, automation depth, and reporting quality as the criteria. Include one PLG example and one enterprise-led example. Keep the trade-offs grounded.',
        paraphrases: [
          'Compare Zendesk versus Intercom for a support team serving both self-serve and enterprise customers. Evaluate routing control, automation depth, and reporting quality as the criteria. Include one product-led case and one enterprise-led case, and focus on real trade-offs.',
          'Show when Zendesk is the better fit and when Intercom is the better choice for a support team that serves self-serve and enterprise customers. Use routing control, automation depth, and reporting quality as the criteria. Include one PLG example and one enterprise-led example, and focus on real trade-offs.',
          'Choose between Zendesk and Intercom for a support team with self-serve and enterprise customers using routing control, automation depth, and reporting quality as the criteria. Include one PLG case and one enterprise-led case, and focus on real trade-offs.',
        ],
      },
      {
        name: 'warehouse architecture trade-off',
        prompt:
          'Compare Snowflake and BigQuery for a data team running customer-facing analytics. Use concurrency, governance, and cost predictability as the criteria. Include one startup example and one enterprise example. Avoid buzzwords and focus on real trade-offs.',
        paraphrases: [
          'Compare Snowflake versus BigQuery for a data team that runs customer-facing analytics. Evaluate concurrency, governance, and cost predictability as the criteria. Include one startup case and one enterprise case, and focus on real trade-offs.',
          'Explain when Snowflake is the better fit and when BigQuery is the better choice for customer-facing analytics. Use concurrency, governance, and cost predictability as the criteria. Include one startup example and one enterprise example, and focus on real trade-offs.',
          'Choose between Snowflake and BigQuery for a data team serving customer-facing analytics using concurrency, governance, and cost predictability as the criteria. Include one startup case and one enterprise case, and focus on real trade-offs.',
        ],
      },
    ],
    nearMisses: [
      {
        name: 'recommendation request without direct compare framing',
        prompt:
          'Recommend whether a mid-sized SaaS platform should move its event log to DynamoDB this year. Use write throughput, team familiarity, and migration risk as the criteria. Include one startup case and one enterprise case.',
        expectedFamily: 'decision_support',
        failureMode: 'A single-option recommendation should route to decision support, not comparison.',
      },
      {
        name: 'diagnostic review mentioning the same domain',
        prompt:
          'Analyze why our support tooling stack is creating duplicate conversations across channels. Use routing rules, ownership gaps, and reporting blind spots as the criteria. Include one PLG example and one enterprise-led example.',
        expectedFamily: 'analysis',
        failureMode: 'Diagnostic wording with causal language should route to analysis, not comparison.',
      },
      {
        name: 'generic vendor overview',
        prompt: 'Write an overview of the analytics warehouse market for data leaders.',
        expectedFamily: 'other',
        failureMode: 'A broad topic overview should not route into comparison.',
      },
    ],
  },
  {
    family: 'decision_support',
    role: 'general',
    rationale:
      'Decision-support prompts are a common routing source of drift because they overlap with trade-off copy and with context-first recommendations. These examples keep the decisive output intact across phrasing shifts and reject prompts that only compare or only describe context.',
    expectedRecommendation: 'no_rewrite_needed',
    importantSubscores: ['scope', 'contrast', 'constraintQuality'],
    strongPositives: [
      {
        name: 'feature flag adoption timing',
        prompt:
          'Help a B2B SaaS product team decide whether to adopt a dedicated feature flag platform this year. Use release safety, developer speed, and platform cost as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
        paraphrases: [
          'Recommend whether a B2B SaaS product team should adopt a dedicated feature flag platform this year. Use release safety, developer speed, and platform cost as the criteria. Include one startup case and one enterprise case, and keep it practical.',
          'Help a B2B SaaS product team decide whether to introduce a dedicated feature flag platform this year. Use release safety, developer speed, and platform cost as the criteria. Include one startup example and one enterprise example. Avoid hype and keep it practical.',
          'Help a B2B SaaS product team decide whether buying a dedicated feature flag platform this year is worth it. Use release safety, developer speed, and platform cost as the criteria. Include one startup case and one enterprise case, and avoid hype.',
        ],
      },
      {
        name: 'customer success centralization',
        prompt:
          'Recommend whether a SaaS company should centralize customer success operations after moving upmarket. Use account complexity, manager span, and expansion risk as the criteria. Include one product-led example and one enterprise-led example. Keep it grounded.',
        paraphrases: [
          'Help a SaaS company decide whether to centralize customer success operations after moving upmarket. Use account complexity, manager span, and expansion risk as the criteria. Include one PLG case and one enterprise-led case, and keep it grounded.',
          'Recommend whether a SaaS company should centralize customer success operations after moving upmarket. Use account complexity, manager span, and expansion risk as the criteria. Include one product-led example and one enterprise-led example, and keep it grounded.',
          'Help a SaaS company decide whether centralizing customer success after moving upmarket is worth it. Use account complexity, manager span, and expansion risk as the criteria. Include one PLG example and one enterprise-led example, and keep it grounded.',
        ],
      },
      {
        name: 'internal API gateway move',
        prompt:
          'Help engineering leaders decide whether to move internal APIs behind a gateway this quarter. Use governance, delivery speed, and migration risk as the criteria. Include one 40-person company example and one enterprise example. Avoid architectural fashion.',
        paraphrases: [
          'Recommend whether engineering leaders should move internal APIs behind a gateway this quarter. Use governance, delivery speed, and migration risk as the criteria. Include one 40-person company case and one enterprise case, and avoid architectural fashion.',
          'Help engineering leaders decide whether to put internal APIs behind a gateway this quarter. Use governance, delivery speed, and migration risk as the criteria. Include one 40-person company example and one enterprise example. Avoid architectural fashion.',
          'Help engineering leaders decide whether moving internal APIs behind a gateway this quarter is worth it. Use governance, delivery speed, and migration risk as the criteria. Include one 40-person company case and one enterprise case, and avoid architectural fashion.',
        ],
      },
    ],
    nearMisses: [
      {
        name: 'pure comparison of alternatives',
        prompt:
          'Compare LaunchDarkly and Flagsmith for a product team using release safety, developer speed, and platform cost as the criteria. Include one startup example and one enterprise example.',
        expectedFamily: 'comparison',
        failureMode: 'A side-by-side tool comparison should route to comparison, not decision support.',
      },
      {
        name: 'diagnostic investigation of a problem',
        prompt:
          'Analyze why customer success handoffs are breaking after a SaaS company moved upmarket. Use account complexity, unclear ownership, and tooling sprawl as the criteria. Include one PLG example and one enterprise-led example.',
        expectedFamily: 'analysis',
        failureMode: 'Root-cause wording should route to analysis, not decision support.',
      },
      {
        name: 'topic-only recommendation article',
        prompt: 'Write about feature flag strategies for product and platform leaders.',
        expectedFamily: 'other',
        failureMode: 'A general article prompt should stay outside the narrow decision-support family.',
      },
    ],
  },
  {
    family: 'context_first',
    role: 'general',
    rationale:
      'Context-first prompts matter because users often paste a situation block before the ask. These cases test that rich situational framing routes consistently even when the requested output changes wording, while near-misses separate context-first from plain decision support and analysis.',
    expectedRecommendation: 'no_rewrite_needed',
    importantSubscores: ['scope', 'clarity', 'constraintQuality'],
    strongPositives: [
      {
        name: 'platform team expansion timing',
        prompt:
          'We are a 35-person B2B SaaS company with two product squads, one platform lead, and a SOC 2 commitment. Given this situation, recommend whether we should hire a second platform engineer now or after the next two enterprise launches. Use delivery risk, operational load, and hiring leverage as the criteria.',
        paraphrases: [
          'We are a 35-person B2B SaaS company with two product squads, one platform lead, and a SOC 2 commitment. Given this situation, advise whether to hire a second platform engineer now or after the next two enterprise launches. Use delivery risk, operational load, and hiring leverage as the criteria.',
          'We are a 35-person B2B SaaS company with two product squads, one platform lead, and a SOC 2 commitment. Given this situation, recommend whether to add a second platform engineer now or wait until after the next two enterprise launches. Use delivery risk, operational load, and hiring leverage as the criteria.',
          'We are a 35-person B2B SaaS company with two product squads, one platform lead, and a SOC 2 commitment.\nGiven this situation, recommend whether a second platform engineer is worth hiring now or after the next two enterprise launches using delivery risk, operational load, and hiring leverage as the criteria.',
        ],
      },
      {
        name: 'support operating model shift',
        prompt:
          'We are a product-led SaaS business with one shared support queue, rising enterprise accounts, and no dedicated onboarding team. Given this situation, recommend whether we should split support by segment this quarter. Use response quality, manager overhead, and revenue risk as the criteria.',
        paraphrases: [
          'We are a product-led SaaS business with one shared support queue, rising enterprise accounts, and no dedicated onboarding team. Given this situation, advise whether to split support by segment this quarter. Use response quality, manager overhead, and revenue risk as the criteria.',
          'We are a product-led SaaS business with one shared support queue, rising enterprise accounts, and no dedicated onboarding team. Given this situation, recommend whether support should be split by segment this quarter. Use response quality, manager overhead, and revenue risk as the criteria.',
          'We are a product-led SaaS business with one shared support queue, rising enterprise accounts, and no dedicated onboarding team.\nGiven this situation, recommend whether segmenting support this quarter is the right move using response quality, manager overhead, and revenue risk as the criteria.',
        ],
      },
      {
        name: 'warehouse migration timing',
        prompt:
          'We are a data team of six supporting self-serve dashboards, finance reporting, and new customer-facing analytics. Given this situation, recommend whether we should migrate warehouse modeling to dbt now or after the next reporting cycle. Use analyst throughput, governance, and migration risk as the criteria.',
        paraphrases: [
          'We are a data team of six supporting self-serve dashboards, finance reporting, and new customer-facing analytics. Given this situation, advise whether to move warehouse modeling to dbt now or after the next reporting cycle. Use analyst throughput, governance, and migration risk as the criteria.',
          'We are a six-person data team supporting self-serve dashboards, finance reporting, and new customer-facing analytics. Given this situation, recommend whether to migrate warehouse modeling to dbt now or later. Use analyst throughput, governance, and migration risk as the criteria.',
          'We are a six-person data team supporting self-serve dashboards, finance reporting, and new customer-facing analytics.\nGiven this situation, recommend whether dbt migration should happen now or after the next reporting cycle using analyst throughput, governance, and migration risk as the criteria.',
        ],
      },
    ],
    nearMisses: [
      {
        name: 'decision support without a context block',
        prompt:
          'Recommend whether to hire a second platform engineer this quarter. Use delivery risk, operational load, and hiring leverage as the criteria. Include one startup example and one enterprise example.',
        expectedFamily: 'decision_support',
        failureMode: 'Without the context block, the same request should stay in decision support.',
      },
      {
        name: 'analysis framed inside a context block',
        prompt:
          'We are a product-led SaaS business with one shared support queue, rising enterprise accounts, and no dedicated onboarding team. Given this situation, analyze why enterprise response times keep slipping. Use queue ownership, ticket complexity, and staffing gaps as the criteria.',
        expectedFamily: 'analysis',
        failureMode: 'A contextualized root-cause request should route to analysis, not context-first.',
      },
      {
        name: 'narrative context with no output request',
        prompt:
          'We are a six-person data team supporting self-serve dashboards, finance reporting, and new customer-facing analytics. Our reporting backlog has grown for two quarters and stakeholders are pushing for faster delivery.',
        expectedFamily: 'other',
        failureMode: 'A situation block without a clear output request should not route into context-first.',
      },
    ],
  },
  {
    family: 'few_shot',
    role: 'general',
    rationale:
      'Few-shot routing is especially brittle because users mix examples, style transfer, and target-output asks in many forms. These cases check that example-driven prompts stay together across wording changes and that plain style requests or comparison prompts do not get misrouted.',
    expectedRecommendation: 'no_rewrite_needed',
    importantSubscores: ['clarity', 'constraintQuality', 'genericOutputRisk'],
    strongPositives: [
      {
        name: 'board update pattern transfer',
        prompt:
          'Use these examples as the model for tone and structure. Example 1: One-line verdict, three bullets, one risk callout. Example 2: One-line verdict, three bullets, one risk callout. Write a new board update about cloud cost controls. Preserve the structure and concise style, adapt the domain details, and avoid extra marketing language.',
        paraphrases: [
          'Use these examples as the model for tone and structure. Follow this pattern and write a new board update about cloud cost controls. Example 1: One-line verdict, three bullets, one risk callout. Example 2: One-line verdict, three bullets, one risk callout. Preserve the structure, adapt the domain details, and avoid extra marketing language.',
          'Use these examples as the model for tone and structure. Model the response after these examples and write a new board update about cloud cost controls. Example 1: One-line verdict, three bullets, one risk callout. Example 2: One-line verdict, three bullets, one risk callout. Keep the concise style, change the domain details, and avoid extra marketing language.',
          'Use the following examples and follow this pattern for tone and structure. Example 1: One-line verdict, three bullets, one risk callout. Example 2: One-line verdict, three bullets, one risk callout. Write a new board update about cloud cost controls, preserve the structure, and avoid extra marketing language.',
        ],
      },
      {
        name: 'launch note pattern transfer',
        prompt:
          'Use these examples as the model for tone and structure. Example 1: Short headline, two benefit bullets, one setup note. Example 2: Short headline, two benefit bullets, one setup note. Write a new launch note about audit trails. Preserve the structure, change the feature details, and avoid extra marketing language.',
        paraphrases: [
          'Use these examples as the model for tone and structure. Follow this pattern and write a new launch note about audit trails. Example 1: Short headline, two benefit bullets, one setup note. Example 2: Short headline, two benefit bullets, one setup note. Preserve the structure, change the feature details, and avoid extra marketing language.',
          'Use these examples as the model for tone and structure. Model the response after these examples and write a new launch note about audit trails. Example 1: Short headline, two benefit bullets, one setup note. Example 2: Short headline, two benefit bullets, one setup note. Keep the structure, change the feature details, and avoid extra marketing language.',
          'Use the following examples and follow this pattern for tone and structure. Example 1: Short headline, two benefit bullets, one setup note. Example 2: Short headline, two benefit bullets, one setup note. Write a new launch note about audit trails, preserve the structure, change the feature details, and avoid extra marketing language.',
        ],
      },
      {
        name: 'incident recap pattern transfer',
        prompt:
          'Use these examples as the model for tone and structure. Example 1: Timeline, impact summary, three follow-ups. Example 2: Timeline, impact summary, three follow-ups. Write a new incident recap about a degraded billing API. Preserve the format, change the domain details, and avoid speculation.',
        paraphrases: [
          'Use these examples as the model for tone and structure. Follow this pattern and write a new incident recap about a degraded billing API. Example 1: Timeline, impact summary, three follow-ups. Example 2: Timeline, impact summary, three follow-ups. Preserve the format, change the domain details, and avoid speculation.',
          'Use these examples as the model for tone and structure. Model the response after these examples and write a new incident recap about a degraded billing API. Example 1: Timeline, impact summary, three follow-ups. Example 2: Timeline, impact summary, three follow-ups. Keep the format, change the domain details, and avoid speculation.',
          'Use the following examples and follow this pattern for tone and structure. Example 1: Timeline, impact summary, three follow-ups. Example 2: Timeline, impact summary, three follow-ups. Write a new incident recap about a degraded billing API, preserve the format, change the domain details, and avoid speculation.',
        ],
      },
    ],
    nearMisses: [
      {
        name: 'style request without examples',
        prompt: 'Write a board update about cloud cost controls in a concise executive style with three bullets and one closing note.',
        expectedFamily: 'other',
        failureMode: 'A style-only request without examples should not route to few-shot.',
      },
      {
        name: 'context-first recommendation with structure hints',
        prompt:
          'We are a 35-person B2B SaaS company with two product squads and one platform lead. Given this situation, recommend whether to hire a second platform engineer now or later. Keep the answer concise with a short verdict and three bullets.',
        expectedFamily: 'context_first',
        failureMode: 'Context-first recommendations with format hints should stay context-first, not few-shot.',
      },
      {
        name: 'comparison with an example request',
        prompt:
          'Compare Snowflake and BigQuery for customer-facing analytics using concurrency, governance, and cost predictability as the criteria. Include one startup example and one enterprise example.',
        expectedFamily: 'comparison',
        failureMode: 'Examples used as evidence in a comparison should not trigger few-shot routing.',
      },
    ],
  },
];
