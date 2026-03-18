import { describe, expect, it } from 'vitest';
import { buildDecisionState } from './buildDecision';
import { classifySemanticPrompt } from './buildInventory';

describe('semantic core', () => {
  it('treats canonical and synonym bounded webhook prompts as the same semantic state', () => {
    const canonical = classifySemanticPrompt(
      'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
      'developer',
    );
    const synonym = classifySemanticPrompt(
      'Build a small Node.js endpoint in TypeScript for receiving webhook events as JSON. Check the body against a defined contract before processing it. Return HTTP 200 when the payload is accepted and HTTP 400 when the contract check fails. Log failures for debugging. Leave auth, signature checks, and business-rule enforcement out of scope.',
      'developer',
    );

    const canonicalDecision = buildDecisionState(canonical.inventory, 'auto');
    const synonymDecision = buildDecisionState(synonym.inventory, 'auto');

    expect(canonical.extraction.inScope).toBe(true);
    expect(synonym.extraction.inScope).toBe(true);
    expect(canonical.extraction.taskClass).toBe('implementation');
    expect(synonym.extraction.taskClass).toBe('implementation');
    expect(canonical.inventory.boundedness.isBounded).toBe(true);
    expect(synonym.inventory.boundedness.isBounded).toBe(true);
    expect(canonicalDecision.semanticState).toBe(synonymDecision.semanticState);
    expect(canonicalDecision.rewriteRecommendation).toBe(synonymDecision.rewriteRecommendation);
    expect(canonicalDecision.missingContextType).toBeNull();
    expect(synonymDecision.missingContextType).toBeNull();
  });

  it('normalizes equivalent comparison prompts into the same task family and boundedness', () => {
    const compare = classifySemanticPrompt(
      'Compare Kubernetes and ECS for a mid-sized SaaS team. Focus on team autonomy, operational load, and scaling complexity. Include one startup case and one enterprise case. Avoid hype and focus on real trade-offs.',
      'general',
    );
    const whenWorthIt = classifySemanticPrompt(
      'Explain when Kubernetes is worth the overhead and when ECS is the better choice for a mid-sized SaaS engineering org. Use a startup example and an enterprise example, and keep the tone grounded in real trade-offs.',
      'general',
    );

    expect(compare.extraction.taskClass).toBe('comparison');
    expect(whenWorthIt.extraction.taskClass).toBe('comparison');
    expect(compare.inventory.comparisonContext.present).toBe(true);
    expect(whenWorthIt.inventory.comparisonContext.present).toBe(true);
    expect(compare.inventory.boundaryContext.groundedFraming.length).toBeGreaterThan(0);
    expect(whenWorthIt.inventory.boundaryContext.groundedFraming.length).toBeGreaterThan(0);
    expect(compare.inventory.boundedness.isBounded).toBe(true);
    expect(whenWorthIt.inventory.boundedness.isBounded).toBe(true);
  });

  it('normalizes equivalent decision-support prompts into the same task family and boundedness', () => {
    const helpsHurts = classifySemanticPrompt(
      'Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity. Help engineering managers decide with one startup example and one enterprise example. Avoid hype and keep it practical.',
      'general',
    );
    const criteria = classifySemanticPrompt(
      'Help engineering managers decide when TypeScript is worth introducing. Explain the criteria that should guide the choice, include a startup case and an enterprise case, and keep the advice grounded rather than hyped.',
      'general',
    );

    expect(helpsHurts.extraction.taskClass).toBe('decision_support');
    expect(criteria.extraction.taskClass).toBe('decision_support');
    expect(helpsHurts.inventory.decisionContext.present).toBe(true);
    expect(criteria.inventory.decisionContext.present).toBe(true);
    expect(helpsHurts.inventory.boundedness.isBounded).toBe(true);
    expect(criteria.inventory.boundedness.isBounded).toBe(true);
  });

  it('normalizes inline and block context-first prompts into the same task family', () => {
    const inline = classifySemanticPrompt(
      'For a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement, recommend whether we should adopt service mesh now or later.',
      'general',
    );
    const block = classifySemanticPrompt(
      'We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement.\nGiven this situation, advise whether service mesh is worth the operational cost now or later.',
      'general',
    );

    expect(inline.extraction.taskClass).toBe('context_first');
    expect(block.extraction.taskClass).toBe('context_first');
    expect(inline.inventory.contextBlock.relevant).toBe(true);
    expect(block.inventory.contextBlock.relevant).toBe(true);
    expect(inline.inventory.boundedness.isBounded).toBe(true);
    expect(block.inventory.boundedness.isBounded).toBe(true);
  });

  it('normalizes equivalent few-shot prompts into the same task family', () => {
    const useExamples = classifySemanticPrompt(
      'Use the following examples as the model for tone and structure. Write a new response for the new topic, preserve the structure, and change the domain details. Avoid extra marketing language.',
      'general',
    );
    const followPattern = classifySemanticPrompt(
      'Follow this pattern and write the new response in the same style and format. Model the response after these examples, keep the structure, but adapt the topic-specific details.',
      'general',
    );

    expect(useExamples.extraction.taskClass).toBe('few_shot');
    expect(followPattern.extraction.taskClass).toBe('few_shot');
    expect(useExamples.inventory.exampleContext.transferInstruction).toBe(true);
    expect(followPattern.inventory.exampleContext.transferInstruction).toBe(true);
    expect(useExamples.inventory.boundedness.isBounded).toBe(true);
    expect(followPattern.inventory.boundedness.isBounded).toBe(true);
  });

  it('marks a thin webhook prompt as weak and rewrite recommended', () => {
    const thin = classifySemanticPrompt('Write a webhook handler.', 'developer');
    const decision = buildDecisionState(thin.inventory, 'auto');

    expect(thin.extraction.inScope).toBe(true);
    expect(thin.inventory.boundedness.isBounded).toBe(false);
    expect(thin.inventory.boundedness.satisfiedGroups).toBe(0);
    expect(decision.semanticState).toBe('weak');
    expect(decision.missingContextType).toBe('constraints_missing');
    expect(decision.rewriteRecommendation).toBe('rewrite_recommended');
  });

  it('treats exactly three boundedness groups as bounded for implementation prompts', () => {
    const partial = classifySemanticPrompt(
      'Write a Node.js webhook endpoint in TypeScript that accepts JSON and returns 200 on success and 400 on invalid input.',
      'developer',
    );
    const decision = buildDecisionState(partial.inventory, 'auto');

    expect(partial.inventory.executionContext.present).toBe(true);
    expect(partial.inventory.ioContext.present).toBe(true);
    expect(partial.inventory.boundedness.satisfiedGroups).toBe(3);
    expect(partial.inventory.boundedness.isBounded).toBe(true);
    expect(decision.semanticState).toBe('usable');
    expect(decision.rewriteRecommendation).toBe('rewrite_optional');
  });
});
