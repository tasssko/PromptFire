import { describe, expect, it } from 'vitest';
import type { Analysis } from '@promptfire/shared';
import { buildGuidedIntent, buildGuidedIntentCompositionPrompt } from './guidedRewrite';

function analysis(overrides?: Partial<Analysis>): Analysis {
  return {
    scores: {
      scope: 3,
      contrast: 3,
      clarity: 5,
      constraintQuality: 2,
      genericOutputRisk: 8,
      tokenWasteRisk: 4,
    },
    issues: [],
    detectedIssueCodes: ['TASK_OVERLOADED', 'EXCLUSIONS_MISSING', 'GENERIC_OUTPUT_RISK_HIGH'],
    signals: [],
    summary: 'Weak prompt.',
    ...overrides,
  };
}

describe('guided rewrite intent', () => {
  it('separates explicit choices from soft guidance and passes both into composition', () => {
    const intent = buildGuidedIntent({
      originalPrompt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      role: 'general',
      mode: 'balanced',
      rewritePreference: 'auto',
      guidedAnswers: {
        scopeStrategy: 'outline first',
        format: 'checklist',
        proofType: 'trade-offs',
        excludes: 'Skip migration strategy and broad background explanation',
      },
      analysis: analysis(),
      bestNextMove: {
        id: 'reduce_task_load',
        type: 'reduce_task_load',
        title: 'Split the guide into stages',
        rationale: 'The request is overloaded.',
        expectedImpact: 'high',
        targetScores: ['scope', 'clarity'],
      },
      improvementSuggestions: [
        {
          id: 'proof',
          title: 'Add proof',
          reason: 'Ground the answer in evidence.',
          impact: 'medium',
          targetScores: ['contrast'],
          category: 'proof',
        },
      ],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: 'boundary',
      },
    });

    expect(intent.explicitChoices.scopeStrategy).toBe('outline first');
    expect(intent.explicitChoices.format).toBe('checklist');
    expect(intent.explicitChoices.proofType).toBe('trade-offs');
    expect(intent.softGuidance.decomposeTask).toBe(true);
    expect(intent.softGuidance.reduceGenericRisk).toBe(true);
    expect(intent.topStructuralIssue).toBe('reduce_task_load');

    const prompt = buildGuidedIntentCompositionPrompt(intent);
    expect(prompt).toContain('top structural issue: reduce_task_load');
    expect(prompt).toContain('"decomposeTask":true');
    expect(prompt).toContain('"reduceGenericRisk":true');
    expect(prompt).toContain('"scopeStrategy":"outline first"');
  });
});
