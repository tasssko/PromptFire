import { describe, expect, it } from 'vitest';
import {
  API_VERSION,
  AnalyzeAndRewriteRequestSchema,
  AnalyzeAndRewriteResponseSchema,
  GuidedRewriteRequestSchema,
  AnalyzeAndRewriteV2RequestSchema,
  AnalyzeAndRewriteV2ResponseSchema,
  V2_API_VERSION,
  normalizePreferences,
} from './contracts';

describe('shared contracts', () => {
  it('applies preference defaults', () => {
    const defaults = normalizePreferences();
    expect(defaults.includeScores).toBe(true);
    expect(defaults.includeExplanation).toBe(true);
    expect(defaults.includeAlternatives).toBe(false);
    expect(defaults.preserveTone).toBe(false);
  });

  it('validates prompt upper bound', () => {
    const tooLongPrompt = 'a'.repeat(6001);
    const parsed = AnalyzeAndRewriteRequestSchema.safeParse({
      prompt: tooLongPrompt,
      role: 'general',
      mode: 'balanced',
    });
    expect(parsed.success).toBe(false);
  });

  it('validates analyze-and-rewrite response with evaluation block', () => {
    const parsed = AnalyzeAndRewriteResponseSchema.safeParse({
      id: 'par_test',
      analysis: {
        scores: {
          scope: 6,
          contrast: 6,
          clarity: 7,
          constraintQuality: 6,
          genericOutputRisk: 4,
          tokenWasteRisk: 3,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'ok',
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Rewrite',
      },
      evaluation: {
        originalScore: {
          scope: 6,
          contrast: 6,
          clarity: 7,
          constraintQuality: 6,
          genericOutputRisk: 4,
          tokenWasteRisk: 3,
        },
        rewriteScore: {
          scope: 7,
          contrast: 7,
          clarity: 7,
          constraintQuality: 7,
          genericOutputRisk: 3,
          tokenWasteRisk: 3,
        },
        improvement: {
          status: 'minor_improvement',
          scoreDeltas: {
            scope: 1,
            contrast: 1,
            clarity: 0,
            constraintQuality: 1,
            genericOutputRisk: -1,
            tokenWasteRisk: 0,
          },
          overallDelta: 2.75,
          expectedUsefulness: 'slightly_higher',
          notes: ['Improved'],
        },
        signals: [],
      },
      meta: {
        version: API_VERSION,
        requestId: 'req_1',
        latencyMs: 0,
        providerMode: 'mock',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('defaults v2 rewritePreference to auto', () => {
    const parsed = AnalyzeAndRewriteV2RequestSchema.safeParse({
      prompt: 'Write a blog post',
      role: 'general',
      mode: 'balanced',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rewritePreference).toBe('auto');
    }
  });

  it('validates v2 analyze-and-rewrite response with nullable rewrite and evaluation', () => {
    const parsed = AnalyzeAndRewriteV2ResponseSchema.safeParse({
      id: 'par_test_v2',
      overallScore: 86,
      scoreBand: 'strong',
      rewriteRecommendation: 'no_rewrite_needed',
      analysis: {
        scores: {
          scope: 8,
          contrast: 7,
          clarity: 8,
          constraintQuality: 8,
          genericOutputRisk: 2,
          tokenWasteRisk: 2,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: ['Low expected improvement.'],
        summary: 'Strong prompt.',
      },
      improvementSuggestions: [
        {
          id: 'optional_proof_requirement',
          title: 'Optional: require one proof point',
          reason: 'A proof requirement may slightly improve differentiation, but the prompt is already strong.',
          impact: 'low',
          targetScores: ['contrast', 'constraintQuality'],
          category: 'proof',
          exampleChange: 'Require one measurable example or clear comparison.',
        },
      ],
      bestNextMove: {
        id: 'optional_proof_requirement',
        type: 'add_proof_requirement',
        title: 'Optional: require one proof point',
        rationale: 'A proof requirement may slightly improve differentiation, but the prompt is already strong.',
        expectedImpact: 'low',
        targetScores: ['contrast', 'constraintQuality'],
        exampleChange: 'Require one measurable example or clear comparison.',
      },
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'low',
        majorBlockingIssues: false,
      },
      rewrite: null,
      evaluation: null,
      meta: {
        version: V2_API_VERSION,
        requestId: 'req_v2',
        latencyMs: 0,
        providerMode: 'mock',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('validates v2 response guided-completion fallback fields', () => {
    const parsed = AnalyzeAndRewriteV2ResponseSchema.safeParse({
      id: 'par_test_v2_gc',
      overallScore: 42,
      scoreBand: 'weak',
      rewriteRecommendation: 'rewrite_recommended',
      analysis: {
        scores: {
          scope: 3,
          contrast: 4,
          clarity: 5,
          constraintQuality: 2,
          genericOutputRisk: 7,
          tokenWasteRisk: 4,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Weak prompt.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'high',
        majorBlockingIssues: true,
      },
      rewrite: null,
      evaluation: {
        status: 'no_significant_change',
        overallDelta: 0,
        signals: [],
        scoreComparison: {
          original: { scope: 3, contrast: 4, clarity: 5 },
          rewrite: { scope: 3, contrast: 4, clarity: 5 },
        },
      },
      rewritePresentationMode: 'template_with_example',
      guidedCompletion: {
        mode: 'template_with_example',
        title: 'Fill in the missing details',
        summary: 'Add boundaries first.',
        questions: ['What runtime should be used?'],
        template: 'Write [deliverable] for [audience].',
        example: 'Example of a stronger prompt: Write...',
      },
      guidedCompletionForm: {
        enabled: true,
        title: 'Complete the missing details',
        summary: 'PeakPrompt can build a stronger prompt once the missing boundaries are filled in.',
        submitLabel: 'Build stronger prompt',
        skipLabel: 'Skip and rewrite anyway',
        blocks: [
          {
            id: 'goal',
            kind: 'radio',
            label: 'What should this prompt do?',
            required: true,
            mapsTo: 'goal',
            options: [
              {
                id: 'explain',
                label: 'Explain',
                value: 'explain',
              },
            ],
          },
        ],
      },
      meta: {
        version: V2_API_VERSION,
        requestId: 'req_v2_gc',
        latencyMs: 0,
        providerMode: 'mock',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('validates guided rewrite submit requests', () => {
    const parsed = GuidedRewriteRequestSchema.safeParse({
      prompt: 'Write better copy.',
      role: 'general',
      mode: 'balanced',
      rewritePreference: 'auto',
      guidedAnswers: {
        goal: 'persuade',
        includes: ['examples', 'specific recommendations'],
      },
    });

    expect(parsed.success).toBe(true);
  });
});
