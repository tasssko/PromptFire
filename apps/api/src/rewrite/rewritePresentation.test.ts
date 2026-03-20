import { describe, expect, it } from 'vitest';
import type { Analysis, EvaluationV2, Rewrite } from '@promptfire/shared';
import type { SemanticRewritePolicy } from '@promptfire/heuristics';
import { buildGuidedCompletion, buildGuidedCompletionForm, selectRewritePresentationMode } from './rewritePresentation';

function analysis(overrides?: Partial<Analysis>): Analysis {
  return {
    scores: {
      scope: 3,
      contrast: 3,
      clarity: 5,
      constraintQuality: 2,
      genericOutputRisk: 7,
      tokenWasteRisk: 4,
    },
    issues: [
      {
        code: 'CONSTRAINTS_MISSING',
        severity: 'high',
        message: 'Constraints are missing.',
      },
    ],
    detectedIssueCodes: ['CONSTRAINTS_MISSING'],
    signals: [],
    summary: 'Weak prompt.',
    ...overrides,
  };
}

function rewrite(): Rewrite {
  return {
    role: 'developer',
    mode: 'balanced',
    rewrittenPrompt: 'Rewrite candidate text',
  };
}

function evaluation(status: EvaluationV2['status'], overallDelta = 0): EvaluationV2 {
  return {
    status,
    overallDelta,
    signals: status === 'possible_regression' ? ['REWRITE_POSSIBLE_REGRESSION'] : [],
    scoreComparison: {
      original: { scope: 3, contrast: 3, clarity: 5 },
      rewrite: { scope: 3, contrast: 3, clarity: 5 },
    },
  };
}

function semanticPolicy(
  overrides?: Partial<SemanticRewritePolicy>,
): SemanticRewritePolicy {
  return {
    semanticOwned: true,
    allowedPresentationModes: ['full_rewrite', 'template_with_example', 'questions_only'],
    primaryGap: 'execution',
    family: 'implementation',
    semanticState: 'weak',
    rewriteRecommendation: 'rewrite_recommended',
    rewriteRisk: 'low',
    ...overrides,
  };
}

describe('rewrite presentation fallback', () => {
  it('A: uses guided completion for thin developer prompts with regression-prone rewrite', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('possible_regression', -1.5),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'weak',
      prompt: 'Write a webhook handler.',
      semanticPolicy: semanticPolicy(),
      effectiveAnalysisContext: {
        role: 'developer',
        canonicalTaskType: 'implementation_code',
        canonicalDeliverableType: 'code',
        missingContextType: 'execution',
      },
    });
    expect(mode).toBe('template_with_example');

    const guided = buildGuidedCompletion({
      prompt: 'Write a webhook handler.',
      role: 'developer',
      mode: 'template_with_example',
      analysis: analysis(),
      semanticPolicy: semanticPolicy(),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'developer',
        canonicalTaskType: 'implementation_code',
        canonicalDeliverableType: 'code',
        missingContextType: 'execution',
      },
    });
    expect(guided?.questions?.join(' ').toLowerCase()).toMatch(/runtime|input|validation|success|failure/);
    expect(guided?.template).toContain('[runtime/framework]');
    expect(guided?.example).toContain('Example of a stronger prompt:');
  });

  it('B: falls back to questions-only for speculative thin non-developer prompts', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('possible_regression', -1),
      analysis: analysis({
        scores: {
          scope: 2,
          contrast: 2,
          clarity: 3,
          constraintQuality: 1,
          genericOutputRisk: 8,
          tokenWasteRisk: 4,
        },
        issues: [],
        detectedIssueCodes: [],
      }),
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Speculative rewrite',
      },
      scoreBand: 'poor',
      prompt: 'Write better copy.',
      semanticPolicy: semanticPolicy({
        semanticOwned: false,
        family: 'analysis',
        primaryGap: 'criteria',
      }),
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: null,
      },
    });
    expect(mode).toBe('questions_only');
  });

  it('C: keeps full rewrite when evaluation is material improvement', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('material_improvement', 8),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'weak',
      prompt: 'Write a webhook handler.',
      semanticPolicy: semanticPolicy(),
    });
    expect(mode).toBe('full_rewrite');
  });

  it('D: suppresses rewrite for already strong path', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'no_rewrite_needed',
      rewritePreference: 'auto',
      evaluation: evaluation('already_strong', 0),
      analysis: analysis({
        scores: {
          scope: 8,
          contrast: 8,
          clarity: 8,
          constraintQuality: 8,
          genericOutputRisk: 2,
          tokenWasteRisk: 2,
        },
        issues: [],
        detectedIssueCodes: [],
      }),
      rewrite: rewrite(),
      scoreBand: 'strong',
      prompt: 'Strong prompt',
      semanticPolicy: semanticPolicy({
        allowedPresentationModes: ['suppressed'],
        semanticState: 'strong',
        rewriteRecommendation: 'no_rewrite_needed',
      }),
    });
    expect(mode).toBe('suppressed');
  });

  it('D2: downgrades rejected ladder steps to template guidance instead of full rewrite', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_recommended',
      rewritePreference: 'auto',
      evaluation: evaluation('minor_improvement', 1.5),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'weak',
      prompt: 'Write a webhook handler.',
      semanticPolicy: semanticPolicy(),
      effectiveAnalysisContext: {
        role: 'developer',
        missingContextType: 'execution',
      },
      ladderTrace: {
        current: 'weak',
        next: 'good',
        target: 'good',
        maxSafeTarget: 'strong',
        stopReason: null,
        pattern: 'direct_instruction',
        claimedStep: { from: 'weak', to: 'good' },
        ladderAccepted: false,
        ladderReason: 'insufficient_grounded_improvement',
      },
    });

    expect(mode).toBe('template_with_example');
  });

  it('D3: keeps forced strong rewrites suppressed at presentation level when advancement is not earned', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_optional',
      rewritePreference: 'force',
      evaluation: evaluation('already_strong', 0),
      analysis: analysis({
        scores: {
          scope: 8,
          contrast: 8,
          clarity: 8,
          constraintQuality: 8,
          genericOutputRisk: 2,
          tokenWasteRisk: 2,
        },
        issues: [],
        detectedIssueCodes: [],
      }),
      rewrite: rewrite(),
      scoreBand: 'strong',
      prompt: 'Strong prompt',
      semanticPolicy: semanticPolicy({
        allowedPresentationModes: ['full_rewrite', 'template_with_example', 'questions_only'],
        semanticState: 'strong',
        rewriteRecommendation: 'rewrite_optional',
      }),
      ladderTrace: {
        current: 'strong',
        next: 'excellent',
        target: 'excellent',
        maxSafeTarget: 'excellent',
        stopReason: 'already_strong',
        pattern: 'direct_instruction',
        claimedStep: { from: 'strong', to: 'excellent' },
        ladderAccepted: false,
        ladderReason: 'already_strong',
      },
    });

    expect(mode).toBe('suppressed');
  });

  it('E: prefers template_with_example for weak/usable no-significant-change cases', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_optional',
      rewritePreference: 'auto',
      evaluation: evaluation('no_significant_change', 0.4),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'usable',
      prompt: 'Write a webhook handler.',
      semanticPolicy: semanticPolicy({
        allowedPresentationModes: ['suppressed', 'template_with_example', 'questions_only'],
        semanticState: 'usable',
        rewriteRecommendation: 'rewrite_optional',
      }),
      effectiveAnalysisContext: {
        role: 'developer',
        missingContextType: 'execution',
      },
    });
    expect(mode).toBe('template_with_example');
  });

  it('E2: keeps owned no-significant-change handling free of score-band heuristics', () => {
    const strongBandMode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_optional',
      rewritePreference: 'auto',
      evaluation: evaluation('no_significant_change', 0.4),
      analysis: analysis({
        detectedIssueCodes: [],
      }),
      rewrite: rewrite(),
      scoreBand: 'strong',
      prompt: 'Compare two options for our team.',
      semanticPolicy: semanticPolicy({
        family: 'comparison',
        primaryGap: 'criteria',
        allowedPresentationModes: ['suppressed', 'template_with_example', 'questions_only'],
        semanticState: 'usable',
        rewriteRecommendation: 'rewrite_optional',
      }),
    });

    expect(strongBandMode).toBe('template_with_example');
  });

  it('F: prevents rewrite_optional from escalating to full_rewrite on material improvement', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_optional',
      rewritePreference: 'auto',
      evaluation: evaluation('material_improvement', 8),
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'usable',
      prompt: 'Compare two options for our team.',
      semanticPolicy: semanticPolicy({
        family: 'comparison',
        primaryGap: 'criteria',
        allowedPresentationModes: ['suppressed', 'template_with_example', 'questions_only'],
        semanticState: 'usable',
        rewriteRecommendation: 'rewrite_optional',
      }),
    });

    expect(mode).toBe('template_with_example');
  });

  it('G: uses semantic family and gap for guided completion before role/text heuristics', () => {
    const guided = buildGuidedCompletion({
      prompt: 'Given this context, advise whether we should adopt service mesh.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis(),
      semanticPolicy: semanticPolicy({
        family: 'context_first',
        primaryGap: 'context_linkage',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: null,
      },
    });

    expect(guided?.questions?.join(' ').toLowerCase()).toMatch(/deliverable|context|criteria/);
  });

  it('H: drives analysis guided completion from semantic source gaps before generic fallback', () => {
    const guided = buildGuidedCompletion({
      prompt: 'Analyze incident response handoff failures using ownership ambiguity and escalation gaps as the criteria.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis(),
      semanticPolicy: semanticPolicy({
        family: 'analysis',
        primaryGap: 'source',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: 'source',
      },
    });

    const joined = guided?.questions?.join(' ').toLowerCase() ?? '';
    expect(joined).toMatch(/evidence|source material|grounding|authoritative/);
    expect(joined).not.toMatch(/audience|format or structure/);
  });

  it('I: keeps implementation execution gaps on execution questions instead of generic developer prompts', () => {
    const guided = buildGuidedCompletion({
      prompt: 'Write a webhook handler.',
      role: 'developer',
      mode: 'questions_only',
      analysis: analysis(),
      semanticPolicy: semanticPolicy({
        family: 'implementation',
        primaryGap: 'execution',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'developer',
        missingContextType: 'execution',
      },
    });

    const joined = guided?.questions?.join(' ').toLowerCase() ?? '';
    expect(joined).toMatch(/runtime|framework|execution surface|environment|integration constraints/);
  });

  it('J: keeps owned prompts on semantic guided completion when evaluation is absent', () => {
    const mode = selectRewritePresentationMode({
      rewriteRecommendation: 'rewrite_optional',
      rewritePreference: 'auto',
      evaluation: null,
      analysis: analysis(),
      rewrite: rewrite(),
      scoreBand: 'usable',
      prompt: 'Given this context, recommend whether to adopt service mesh.',
      semanticPolicy: semanticPolicy({
        family: 'context_first',
        primaryGap: 'context_linkage',
        allowedPresentationModes: ['suppressed', 'template_with_example', 'questions_only'],
        semanticState: 'usable',
        rewriteRecommendation: 'rewrite_optional',
      }),
    });

    expect(mode).toBe('template_with_example');

    const guided = buildGuidedCompletion({
      prompt: 'Given this context, recommend whether to adopt service mesh.',
      role: 'general',
      mode: 'template_with_example',
      analysis: analysis(),
      semanticPolicy: semanticPolicy({
        family: 'context_first',
        primaryGap: 'context_linkage',
        allowedPresentationModes: ['suppressed', 'template_with_example', 'questions_only'],
        semanticState: 'usable',
        rewriteRecommendation: 'rewrite_optional',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: null,
      },
    });

    const joined = guided?.questions?.join(' ').toLowerCase() ?? '';
    expect(joined).toMatch(/context|requested outcome|criteria/);
    expect(joined).not.toMatch(/who is the exact audience|format or structure should the response follow/);
  });

  it('K: keeps semantic-owned guided completion copy out of generic underspecification wording', () => {
    const guided = buildGuidedCompletion({
      prompt: 'Given this context, recommend whether to adopt service mesh.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis(),
      semanticPolicy: semanticPolicy({
        family: 'context_first',
        primaryGap: 'context_linkage',
        allowedPresentationModes: ['suppressed', 'template_with_example', 'questions_only'],
        semanticState: 'usable',
        rewriteRecommendation: 'rewrite_optional',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: null,
      },
    });

    expect(guided?.summary.toLowerCase()).not.toContain('too underspecified');
    expect(guided?.summary.toLowerCase()).not.toContain('too broad');
    expect(guided?.rationale?.toLowerCase()).toContain('semantic path');
  });

  it('L: preserves generic guided-completion fallback for non-owned prompts', () => {
    const guided = buildGuidedCompletion({
      prompt: 'Write better copy.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis(),
      semanticPolicy: null,
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: 'audience',
      },
    });

    const joined = guided?.questions?.join(' ').toLowerCase() ?? '';
    expect(joined).toMatch(/who is the exact audience|format or structure should the response follow/);
    expect(guided?.summary.toLowerCase()).toContain('too underspecified');
  });

  it('builds compact general guided forms for thin prompts', () => {
    const form = buildGuidedCompletionForm({
      prompt: 'Write better copy.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis({
        issues: [],
        detectedIssueCodes: [],
      }),
      semanticPolicy: semanticPolicy({
        semanticOwned: false,
        family: 'analysis',
        primaryGap: 'criteria',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: 'audience',
      },
    });

    expect(form?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['audience', 'goal', 'format']));
    expect(form?.blocks.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(form?.blocks.length ?? 0).toBeLessThanOrEqual(4);
  });

  it('builds developer guided forms from the top structural and boundary gaps', () => {
    const form = buildGuidedCompletionForm({
      prompt: 'Write a webhook handler.',
      role: 'developer',
      mode: 'template_with_example',
      analysis: analysis(),
      semanticPolicy: semanticPolicy(),
      bestNextMove: {
        id: 'define_runtime',
        type: 'clarify_output_structure',
        title: 'Define auth and retries',
        rationale: 'The request is missing auth, retry, and setup expectations.',
        expectedImpact: 'high',
        targetScores: ['constraintQuality'],
      },
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'developer',
        missingContextType: 'boundary',
      },
    });

    expect(form?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['format', 'goal']));
    expect(form?.blocks.map((block) => block.id)).not.toContain('audience');
    expect(form?.blocks.length ?? 0).toBeLessThanOrEqual(4);
  });

  it('builds marketer guided forms without re-asking audience when it is already explicit', () => {
    const form = buildGuidedCompletionForm({
      prompt: 'Write landing page copy for IT directors at regulated mid-market companies about our IAM platform.',
      role: 'marketer',
      mode: 'template_with_example',
      analysis: analysis({
        detectedIssueCodes: ['CONSTRAINTS_MISSING'],
      }),
      semanticPolicy: semanticPolicy({
        semanticOwned: false,
        family: 'analysis',
        primaryGap: 'boundary',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'marketer',
        missingContextType: 'boundary',
      },
    });

    expect(form?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['goal', 'format']));
    expect(form?.blocks.map((block) => block.id)).not.toContain('audience');
  });

  it('prioritizes top structural and boundary gaps for broad Kubernetes prompts', () => {
    const form = buildGuidedCompletionForm({
      prompt:
        'Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis({
        detectedIssueCodes: ['TASK_OVERLOADED', 'EXCLUSIONS_MISSING', 'GENERIC_OUTPUT_RISK_HIGH'],
      }),
      semanticPolicy: semanticPolicy({
        semanticOwned: false,
        family: 'analysis',
        primaryGap: 'boundary',
      }),
      bestNextMove: {
        id: 'reduce_task_load',
        type: 'reduce_task_load',
        title: 'Split the guide into stages',
        rationale: 'The request is overloaded and needs structure.',
        expectedImpact: 'high',
        targetScores: ['scope', 'clarity'],
      },
      improvementSuggestions: [
        {
          id: 'clarify_structure',
          title: 'Clarify the output structure',
          reason: 'A narrower structure will reduce generic output.',
          impact: 'high',
          targetScores: ['scope', 'clarity'],
          category: 'structure',
        },
        {
          id: 'proof_requirement',
          title: 'Add a proof requirement',
          reason: 'Evidence or grounded trade-offs will improve the answer.',
          impact: 'medium',
          targetScores: ['contrast'],
          category: 'proof',
        },
        {
          id: 'exclusion',
          title: 'Add exclusions',
          reason: 'Exclusions will keep the scope bounded.',
          impact: 'medium',
          targetScores: ['scope'],
          category: 'exclusion',
        },
      ],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: 'boundary',
      },
    });

    const ids = form?.blocks.map((block) => block.id) ?? [];
    expect(ids).toContain('scopeStrategy');
    expect(ids).toContain('excludes');
    expect(ids.some((id) => id === 'format' || id === 'proofType')).toBe(true);
    expect(form?.blocks.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(form?.blocks.length ?? 0).toBeLessThanOrEqual(4);
  });

  it('keeps short weak prompts to a minimal high-leverage set of questions', () => {
    const form = buildGuidedCompletionForm({
      prompt: 'Write better copy.',
      role: 'general',
      mode: 'questions_only',
      analysis: analysis({
        detectedIssueCodes: ['GENERIC_OUTPUT_RISK_HIGH'],
      }),
      semanticPolicy: semanticPolicy({
        semanticOwned: false,
        family: 'analysis',
        primaryGap: 'boundary',
      }),
      bestNextMove: null,
      improvementSuggestions: [],
      effectiveAnalysisContext: {
        role: 'general',
        missingContextType: 'audience',
      },
    });

    expect(form?.blocks.length ?? 0).toBeLessThanOrEqual(4);
    expect(form?.blocks.map((block) => block.id)).toEqual(expect.arrayContaining(['audience', 'goal', 'format']));
  });
});
