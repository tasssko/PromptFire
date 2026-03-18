import { describe, expect, it } from 'vitest';
import type { Analysis, Role, ScoreBand, ScoreSet } from '@promptfire/shared';
import {
  semanticBoundaryFixtures,
  semanticConsistencyCases,
  semanticEquivalenceFamilies,
  semanticFindingCases,
} from '@promptfire/shared/src/semanticFixtures';
import { analyzePrompt } from '../analyzePrompt';
import { buildDecisionState } from './buildDecision';
import { classifySemanticPrompt } from './buildInventory';
import { deriveFindings } from './deriveFindings';
import { projectScores } from './projectScores';

function computeOverallScore(scores: ScoreSet): number {
  const raw =
    2.75 * scores.scope +
    2.25 * scores.contrast +
    1.25 * scores.clarity +
    2.0 * scores.constraintQuality +
    1.5 * (10 - scores.genericOutputRisk) +
    0.5 * (10 - scores.tokenWasteRisk);

  return Math.max(0, Math.min(100, Math.round(raw)));
}

function scoreBandFromOverallScore(overallScore: number): ScoreBand {
  if (overallScore >= 85) {
    return 'excellent';
  }
  if (overallScore >= 75) {
    return 'strong';
  }
  if (overallScore >= 60) {
    return 'usable';
  }
  if (overallScore >= 40) {
    return 'weak';
  }
  return 'poor';
}

function buildSemanticEvaluation(prompt: string, role: Role) {
  const classification = classifySemanticPrompt(prompt, role);
  const decision = buildDecisionState(classification.inventory, 'auto');
  const baseAnalysis = analyzePrompt({ prompt, role, mode: 'balanced' });
  const projectedScores = projectScores(baseAnalysis.scores, classification.inventory, decision);
  const analysis: Analysis = {
    ...baseAnalysis,
    scores: projectedScores,
  };
  const findings = deriveFindings(analysis, classification.inventory, decision);
  const overallScore = computeOverallScore(projectedScores);

  return {
    classification,
    decision,
    analysis,
    findings,
    overallScore,
    scoreBand: scoreBandFromOverallScore(overallScore),
  };
}

function expectTextToAvoidSnippets(text: string, forbidden: string[]): void {
  const lowered = text.toLowerCase();
  for (const snippet of forbidden) {
    expect(lowered).not.toContain(snippet.toLowerCase());
  }
}

function expectTextToContainAnySnippet(text: string, allowed: string[]): void {
  const lowered = text.toLowerCase();
  expect(allowed.some((snippet) => lowered.includes(snippet.toLowerCase()))).toBe(true);
}

function expectScoreStability(a: number, b: number, maxDelta = 8): void {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(maxDelta);
}

function expectSubscoreStability(a: ScoreSet, b: ScoreSet, keys: (keyof ScoreSet)[], maxDelta = 2): void {
  for (const key of keys) {
    expect(Math.abs(a[key] - b[key])).toBeLessThanOrEqual(maxDelta);
  }
}

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

  describe('decision state consistency', () => {
    for (const fixture of semanticConsistencyCases) {
      it(fixture.name, () => {
        const result = buildSemanticEvaluation(fixture.prompt, fixture.role);
        const joinedFindings = result.findings.issues.map((issue) => issue.message).join(' ');

        expect(result.classification.extraction.taskClass).toBe(fixture.family);
        expect(result.decision.rewriteRecommendation).toBe(fixture.expectedRecommendation);
        if (fixture.expectedBestNextMoveTypes) {
          expect(fixture.expectedBestNextMoveTypes).toContain(result.findings.bestNextMove?.type as typeof fixture.expectedBestNextMoveTypes[number]);
        } else {
          expect(result.findings.bestNextMove?.type ?? null).toBeNull();
        }

        if (fixture.forbiddenScoreBands) {
          expect(fixture.forbiddenScoreBands).not.toContain(result.scoreBand);
        }
        if (fixture.forbiddenSummarySnippets) {
          expectTextToAvoidSnippets(result.findings.summary, fixture.forbiddenSummarySnippets);
        }
        if (fixture.forbiddenFindingSnippets) {
          expectTextToAvoidSnippets(joinedFindings, fixture.forbiddenFindingSnippets);
        }
        if (fixture.forbiddenBestNextMoveSnippets && result.findings.bestNextMove) {
          expectTextToAvoidSnippets(
            `${result.findings.bestNextMove.title} ${result.findings.bestNextMove.rationale}`,
            fixture.forbiddenBestNextMoveSnippets,
          );
        }
      });
    }
  });

  describe('family-specific findings', () => {
    for (const fixture of semanticFindingCases) {
      it(fixture.name, () => {
        const result = buildSemanticEvaluation(fixture.prompt, fixture.role);
        const visibleFindingText = [
          result.findings.summary,
          ...result.findings.issues.map((issue) => issue.message),
          result.findings.bestNextMove?.title ?? '',
          result.findings.bestNextMove?.rationale ?? '',
        ].join(' ');

        expect(result.classification.extraction.taskClass).toBe(fixture.family);
        expect(result.decision.rewriteRecommendation).toBe(fixture.expectedRecommendation);
        expectTextToContainAnySnippet(visibleFindingText, fixture.allowedFindingSnippets);
        expectTextToAvoidSnippets(visibleFindingText, fixture.forbiddenFindingSnippets);
      });
    }
  });

  describe('semantic equivalence score stability', () => {
    for (const family of semanticEquivalenceFamilies) {
      it(`${family.family} variants keep the same semantic state and stable scores`, () => {
        const baselineVariant = family.variants[0]!;
        const baseline = buildSemanticEvaluation(baselineVariant.prompt, family.role);

        expect(baseline.classification.extraction.taskClass).toBe(family.family);
        expect(baseline.decision.rewriteRecommendation).toBe(family.expectedRecommendation);
        expect(baseline.decision.majorBlockingIssues).toBe(family.expectedMajorBlockingIssues);

        for (const variant of family.variants.slice(1)) {
          const current = buildSemanticEvaluation(variant.prompt, family.role);

          expect(current.classification.extraction.taskClass).toBe(baseline.classification.extraction.taskClass);
          expect(current.classification.inventory.boundedness.isBounded).toBe(baseline.classification.inventory.boundedness.isBounded);
          expect(current.decision.rewriteRecommendation).toBe(baseline.decision.rewriteRecommendation);
          expect(current.decision.majorBlockingIssues).toBe(baseline.decision.majorBlockingIssues);
          expect(current.decision.missingContextType).toBe(baseline.decision.missingContextType);
          expect(current.findings.bestNextMove?.type ?? null).toBe(baseline.findings.bestNextMove?.type ?? null);
          expectScoreStability(baseline.overallScore, current.overallScore);
          expectSubscoreStability(baseline.analysis.scores, current.analysis.scores, family.importantSubscores);
        }
      });
    }
  });

  describe('implementation and shared boundary checks', () => {
    for (const fixture of semanticBoundaryFixtures) {
      it(fixture.name, () => {
        const thin = buildSemanticEvaluation(fixture.thinPrompt, fixture.role);
        const bounded = buildSemanticEvaluation(fixture.boundedPrompt, fixture.role);
        const boundedText = [
          bounded.findings.summary,
          ...bounded.findings.issues.map((issue) => issue.message),
          bounded.findings.bestNextMove?.title ?? '',
          bounded.findings.bestNextMove?.rationale ?? '',
        ].join(' ');

        expect(thin.classification.extraction.taskClass).toBe(fixture.family);
        expect(thin.decision.rewriteRecommendation).toBe(fixture.thinRecommendation);
        if (fixture.thinAllowedScoreBands) {
          expect(fixture.thinAllowedScoreBands).toContain(thin.scoreBand);
        }

        expect(bounded.classification.extraction.taskClass).toBe(fixture.family);
        expect(bounded.decision.rewriteRecommendation).toBe(fixture.boundedRecommendation);
        expect(bounded.overallScore).toBeGreaterThanOrEqual(thin.overallScore);
        expectTextToAvoidSnippets(boundedText, fixture.boundedForbiddenSnippets);
        expect(bounded.findings.bestNextMove?.type ?? null).toBe(fixture.expectedBoundedBestNextMoveType ?? null);

        if (fixture.family === 'implementation') {
          const partial = buildSemanticEvaluation(fixture.partialPrompt!, fixture.role);

          expect(partial.classification.extraction.taskClass).toBe('implementation');
          expect(partial.decision.rewriteRecommendation).toBe(fixture.partialRecommendation);
          expect(partial.findings.bestNextMove?.type ?? null).toBe('clarify_output_structure');
          expect(partial.overallScore).toBeGreaterThanOrEqual(thin.overallScore);
          expect(partial.overallScore).toBeLessThanOrEqual(bounded.overallScore);

          const synonym = buildSemanticEvaluation(fixture.synonymBoundedPrompt!, fixture.role);

          expect(synonym.classification.extraction.taskClass).toBe('implementation');
          expect(synonym.decision.rewriteRecommendation).toBe(fixture.boundedRecommendation);
          expect(synonym.decision.majorBlockingIssues).toBe(false);
          expect(synonym.findings.bestNextMove?.type ?? null).toBe(fixture.expectedBoundedBestNextMoveType ?? null);
        } else {
          expect(bounded.decision.rewriteRecommendation).not.toBe(thin.decision.rewriteRecommendation);
        }
      });
    }
  });
});
