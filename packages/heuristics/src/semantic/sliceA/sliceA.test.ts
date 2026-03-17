import { describe, expect, it } from 'vitest';
import { buildDeveloperImplementationDecision } from './buildDeveloperImplementationDecision';
import { classifyDeveloperImplementationPrompt } from './buildDeveloperImplementationContext';

describe('Slice A developer implementation semantics', () => {
  it('treats canonical and synonym bounded webhook prompts as the same semantic state', () => {
    const canonical = classifyDeveloperImplementationPrompt(
      'Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.',
      'developer',
    );
    const synonym = classifyDeveloperImplementationPrompt(
      'Build a small Node.js endpoint in TypeScript for receiving webhook events as JSON. Check the body against a defined contract before processing it. Return HTTP 200 when the payload is accepted and HTTP 400 when the contract check fails. Log failures for debugging. Leave auth, signature checks, and business-rule enforcement out of scope.',
      'developer',
    );

    const canonicalDecision = buildDeveloperImplementationDecision(canonical.context, 'auto');
    const synonymDecision = buildDeveloperImplementationDecision(synonym.context, 'auto');

    expect(canonical.extraction.inScope).toBe(true);
    expect(synonym.extraction.inScope).toBe(true);
    expect(canonical.context.boundedness.isBounded).toBe(true);
    expect(synonym.context.boundedness.isBounded).toBe(true);
    expect(canonical.context.boundedness.satisfiedGroups).toBeGreaterThanOrEqual(3);
    expect(synonym.context.boundedness.satisfiedGroups).toBeGreaterThanOrEqual(3);
    expect(canonicalDecision.semanticState).toBe(synonymDecision.semanticState);
    expect(canonicalDecision.rewriteRecommendation).toBe(synonymDecision.rewriteRecommendation);
    expect(canonicalDecision.missingContextType).toBeNull();
    expect(synonymDecision.missingContextType).toBeNull();
  });

  it('marks a thin webhook prompt as weak and rewrite recommended', () => {
    const thin = classifyDeveloperImplementationPrompt('Write a webhook handler.', 'developer');
    const decision = buildDeveloperImplementationDecision(thin.context, 'auto');

    expect(thin.extraction.inScope).toBe(true);
    expect(thin.context.boundedness.isBounded).toBe(false);
    expect(thin.context.boundedness.satisfiedGroups).toBe(0);
    expect(decision.semanticState).toBe('weak');
    expect(decision.missingContextType).toBe('constraints_missing');
    expect(decision.rewriteRecommendation).toBe('rewrite_recommended');
  });

  it('treats exactly three boundedness groups as bounded', () => {
    const partial = classifyDeveloperImplementationPrompt(
      'Write a Node.js webhook endpoint in TypeScript that accepts JSON and returns 200 on success and 400 on invalid input.',
      'developer',
    );
    const decision = buildDeveloperImplementationDecision(partial.context, 'auto');

    expect(partial.context.executionContext.present).toBe(true);
    expect(partial.context.ioContext.present).toBe(true);
    expect(partial.context.boundedness.satisfiedGroups).toBe(3);
    expect(partial.context.boundedness.isBounded).toBe(true);
    expect(decision.semanticState).toBe('usable');
    expect(decision.rewriteRecommendation).toBe('rewrite_optional');
  });
});
