import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type Tx = {
    insert: (table: unknown) => {
      values: (values: unknown) => Promise<void>;
    };
  };

  const insertCalls: Array<{ table: unknown; values: unknown }> = [];
  const tx: Tx = {
    insert(table: unknown) {
      return {
        values(values: unknown) {
          insertCalls.push({ table, values });
          return Promise.resolve();
        },
      };
    },
  };

  return {
    insertCalls,
    hasDatabaseUrl: vi.fn(),
    getDb: vi.fn(() => ({
      transaction: async (callback: (tx: Tx) => Promise<void>) => callback(tx),
    })),
    promptRuns: { name: 'prompt_runs' },
    promptRewrites: { name: 'prompt_rewrites' },
  };
});

vi.mock('@promptfire/db', () => ({
  getDb: mocks.getDb,
  hasDatabaseUrl: mocks.hasDatabaseUrl,
  promptRuns: mocks.promptRuns,
  promptRewrites: mocks.promptRewrites,
}));

import { buildRewriteRecords, persistPromptRun } from './promptRuns';

describe('persistPromptRun', () => {
  beforeEach(() => {
    mocks.insertCalls.length = 0;
    mocks.hasDatabaseUrl.mockReset();
    mocks.getDb.mockClear();
  });

  it('skips persistence when the database is unavailable', async () => {
    mocks.hasDatabaseUrl.mockReturnValue(false);

    await persistPromptRun({
      endpoint: '/v2/analyze-and-rewrite',
      requestId: 'req_1',
      userId: 'usr_1',
      sessionId: 'ses_1',
      input: {
        prompt: 'Write a launch email.',
        role: 'marketer',
        mode: 'balanced',
        rewritePreference: 'auto',
      },
      response: {
        id: 'par_req_1',
        overallScore: 72,
        scoreBand: 'usable',
        rewriteRecommendation: 'rewrite_optional',
        analysis: {
          scores: {
            scope: 7,
            contrast: 7,
            clarity: 7,
            constraintQuality: 7,
            genericOutputRisk: 3,
            tokenWasteRisk: 2,
          },
          issues: [],
          detectedIssueCodes: [],
          signals: [],
          summary: 'Solid.',
        },
        improvementSuggestions: [],
        bestNextMove: null,
        gating: {
          rewritePreference: 'auto',
          expectedImprovement: 'high',
          majorBlockingIssues: false,
        },
        rewrite: null,
        evaluation: null,
        rewritePresentationMode: 'suppressed',
        guidedCompletion: null,
        inferenceFallbackUsed: false,
        resolutionSource: 'local',
        meta: {
          version: '2',
          requestId: 'req_1',
          latencyMs: 12,
          providerMode: 'mock',
        },
      },
      inferenceData: { source: 'test' },
    });

    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.insertCalls).toEqual([]);
  });

  it('skips persistence when there is no authenticated user', async () => {
    mocks.hasDatabaseUrl.mockReturnValue(true);

    await persistPromptRun({
      endpoint: '/v1/analyze-and-rewrite',
      requestId: 'req_2',
      input: {
        prompt: 'Write a landing page.',
        role: 'marketer',
        mode: 'high_contrast',
      },
      response: {
        id: 'par_req_2',
        analysis: {
          scores: {
            scope: 6,
            contrast: 7,
            clarity: 6,
            constraintQuality: 5,
            genericOutputRisk: 4,
            tokenWasteRisk: 4,
          },
          issues: [],
          detectedIssueCodes: [],
          signals: [],
          summary: 'Needs more direction.',
        },
        rewrite: {
          role: 'marketer',
          mode: 'high_contrast',
          rewrittenPrompt: 'Rewrite this landing page.',
        },
        evaluation: {
          originalScore: {
            scope: 6,
            contrast: 7,
            clarity: 6,
            constraintQuality: 5,
            genericOutputRisk: 4,
            tokenWasteRisk: 4,
          },
          rewriteScore: {
            scope: 7,
            contrast: 8,
            clarity: 7,
            constraintQuality: 6,
            genericOutputRisk: 3,
            tokenWasteRisk: 3,
          },
          improvement: {
            status: 'material_improvement',
            scoreDeltas: {
              scope: 1,
              contrast: 1,
              clarity: 1,
              constraintQuality: 1,
              genericOutputRisk: -1,
              tokenWasteRisk: -1,
            },
            overallDelta: 5,
            expectedUsefulness: 'higher',
            notes: [],
          },
          signals: [],
        },
        meta: {
          version: '0.4',
          requestId: 'req_2',
          latencyMs: 9,
          providerMode: 'mock',
        },
      },
      inferenceData: { source: 'test' },
    });

    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.insertCalls).toEqual([]);
  });

  it('writes the run row and primary rewrite row for authenticated requests', async () => {
    mocks.hasDatabaseUrl.mockReturnValue(true);

    await persistPromptRun({
      endpoint: '/v2/analyze-and-rewrite',
      requestId: 'req_3',
      userId: 'usr_3',
      sessionId: 'ses_3',
      input: {
        prompt: 'Write an onboarding email for admins.',
        role: 'marketer',
        mode: 'balanced',
        rewritePreference: 'force',
      },
      response: {
        id: 'par_req_3',
        overallScore: 81,
        scoreBand: 'strong',
        rewriteRecommendation: 'rewrite_optional',
        analysis: {
          scores: {
            scope: 8,
            contrast: 8,
            clarity: 8,
            constraintQuality: 7,
            genericOutputRisk: 2,
            tokenWasteRisk: 2,
          },
          issues: [],
          detectedIssueCodes: [],
          signals: [],
          summary: 'Strong base prompt.',
        },
        improvementSuggestions: [],
        bestNextMove: null,
        gating: {
          rewritePreference: 'force',
          expectedImprovement: 'high',
          majorBlockingIssues: false,
        },
        rewrite: {
          role: 'marketer',
          mode: 'balanced',
          rewrittenPrompt: 'Draft an onboarding email for IT admins at mid-sized companies.',
          explanation: 'Adds audience and output framing.',
          changes: ['Added audience', 'Added structure'],
        },
        evaluation: {
          status: 'material_improvement',
          overallDelta: 7,
          signals: ['Better audience fit'],
          scoreComparison: {
            original: { scope: 8, contrast: 8, clarity: 8 },
            rewrite: { scope: 9, contrast: 8, clarity: 9 },
          },
        },
        rewritePresentationMode: 'full_rewrite',
        guidedCompletion: null,
        inferenceFallbackUsed: false,
        resolutionSource: 'local',
        meta: {
          version: '2',
          requestId: 'req_3',
          latencyMs: 20,
          providerMode: 'mock',
        },
      },
      inferenceData: { source: 'semantic' },
    });

    expect(mocks.getDb).toHaveBeenCalledTimes(1);
    expect(mocks.insertCalls).toHaveLength(2);

    expect(mocks.insertCalls[0]).toMatchObject({
      table: mocks.promptRuns,
      values: expect.objectContaining({
        userId: 'usr_3',
        sessionId: 'ses_3',
        requestId: 'req_3',
        endpoint: '/v2/analyze-and-rewrite',
        originalPrompt: 'Write an onboarding email for admins.',
        rewritePreference: 'force',
        overallScore: 81,
        scoreBand: 'strong',
        rewriteRecommendation: 'rewrite_optional',
        inferenceData: { source: 'semantic' },
      }),
    });

    expect(mocks.insertCalls[1]).toMatchObject({
      table: mocks.promptRewrites,
      values: [
        expect.objectContaining({
          kind: 'primary',
          position: 0,
          role: 'marketer',
          mode: 'balanced',
          rewrittenPrompt: 'Draft an onboarding email for IT admins at mid-sized companies.',
          explanation: 'Adds audience and output framing.',
          changes: ['Added audience', 'Added structure'],
          evaluationData: expect.objectContaining({
            status: 'material_improvement',
            overallDelta: 7,
          }),
          isPrimary: true,
        }),
      ],
    });
  });

  it('builds a rewrite record when a guided-submit response contains a rewrite', () => {
    const rewrites = buildRewriteRecords({
      id: 'par_guided_rewrite',
      overallScore: 74,
      scoreBand: 'usable',
      rewriteRecommendation: 'rewrite_optional',
      analysis: {
        scores: {
          scope: 7,
          contrast: 7,
          clarity: 7,
          constraintQuality: 6,
          genericOutputRisk: 3,
          tokenWasteRisk: 3,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Improved prompt.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'high',
        majorBlockingIssues: false,
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: 'Write a short landing page hero for ecommerce founders with one proof point and a clear CTA.',
      },
      evaluation: {
        status: 'no_significant_change',
        overallDelta: 1,
        signals: [],
        scoreComparison: {
          original: { scope: 6, contrast: 6, clarity: 6 },
          rewrite: { scope: 7, contrast: 7, clarity: 7 },
        },
      },
      rewritePresentationMode: 'full_rewrite',
      requestSource: 'guided_submit',
      guidedCompletion: null,
      guidedCompletionForm: null,
      inferenceFallbackUsed: false,
      resolutionSource: 'local',
      meta: {
        version: '2',
        requestId: 'req_guided_rewrite',
        latencyMs: 4,
        providerMode: 'mock',
      },
    });

    expect(rewrites).toHaveLength(1);
    expect(rewrites[0]).toMatchObject({
      kind: 'guided_completion',
      position: 0,
      isPrimary: true,
      rewrite: expect.objectContaining({
        rewrittenPrompt: 'Write a short landing page hero for ecommerce founders with one proof point and a clear CTA.',
      }),
    });
  });

  it('accepts guided rewrite endpoint persistence with guided metadata in inference data', async () => {
    mocks.hasDatabaseUrl.mockReturnValue(true);

    await persistPromptRun({
      endpoint: '/v2/rewrite-from-guided-answers',
      requestId: 'req_guided',
      userId: 'usr_guided',
      sessionId: 'ses_guided',
      input: {
        prompt: 'Write better copy.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      },
      response: {
        id: 'par_guided',
        overallScore: 68,
        scoreBand: 'usable',
        rewriteRecommendation: 'rewrite_optional',
        analysis: {
          scores: {
            scope: 7,
            contrast: 6,
            clarity: 7,
            constraintQuality: 6,
            genericOutputRisk: 4,
            tokenWasteRisk: 3,
          },
          issues: [],
          detectedIssueCodes: [],
          signals: [],
          summary: 'Improved prompt.',
        },
        improvementSuggestions: [],
        bestNextMove: null,
        gating: {
          rewritePreference: 'auto',
          expectedImprovement: 'high',
          majorBlockingIssues: false,
        },
        rewrite: {
          role: 'general',
          mode: 'balanced',
          rewrittenPrompt: 'Write a short landing page hero for ecommerce founders that persuades them to book a demo. Include one proof point and a clear CTA. Avoid generic marketing buzzwords.',
        },
        evaluation: {
          status: 'no_significant_change',
          overallDelta: 1,
          signals: [],
          scoreComparison: {
            original: { scope: 7, contrast: 6, clarity: 7 },
            rewrite: { scope: 7, contrast: 7, clarity: 7 },
          },
        },
        rewritePresentationMode: 'full_rewrite',
        requestSource: 'guided_submit',
        guidedCompletion: null,
        guidedCompletionForm: null,
        inferenceFallbackUsed: false,
        resolutionSource: 'local',
        meta: {
          version: '2',
          requestId: 'req_guided',
          latencyMs: 8,
          providerMode: 'mock',
        },
      },
      inferenceData: {
        guidedRewrite: {
          kind: 'guided_completion',
          originalPrompt: 'Write better copy.',
          guidedIntent: {
            originalPrompt: 'Write better copy.',
            role: 'general',
            mode: 'balanced',
            rewritePreference: 'auto',
            goal: 'persuade',
            includes: [],
            excludes: [],
            rawGuidedAnswers: {
              goal: 'persuade',
            },
          },
          internalSynthesisPrompt: 'Guided intent:\n- goal: persuade',
          modelComposedPrompt:
            'Write a short landing page hero for ecommerce founders that persuades them to book a demo. Include one proof point and a clear CTA. Avoid generic marketing buzzwords.',
          finalGuidedPrompt:
            'Write a short landing page hero for ecommerce founders that persuades them to book a demo. Include one proof point and a clear CTA. Avoid generic marketing buzzwords.',
          validation: {
            isValid: true,
            hardFailures: [],
            softWarnings: [],
            fallbackReason: null,
          },
          fallbackReason: null,
          usedDeterministicFallback: false,
          guidedAnswers: {
            goal: 'persuade',
          },
        },
      },
    });

    expect(mocks.insertCalls[0]).toMatchObject({
      table: mocks.promptRuns,
      values: expect.objectContaining({
        endpoint: '/v2/rewrite-from-guided-answers',
        originalPrompt: 'Write better copy.',
        inferenceData: expect.objectContaining({
          guidedRewrite: expect.objectContaining({
            kind: 'guided_completion',
            internalSynthesisPrompt: expect.stringContaining('Guided intent:'),
            modelComposedPrompt:
              'Write a short landing page hero for ecommerce founders that persuades them to book a demo. Include one proof point and a clear CTA. Avoid generic marketing buzzwords.',
            finalGuidedPrompt:
              'Write a short landing page hero for ecommerce founders that persuades them to book a demo. Include one proof point and a clear CTA. Avoid generic marketing buzzwords.',
            validation: expect.objectContaining({
              isValid: true,
            }),
            usedDeterministicFallback: false,
          }),
        }),
      }),
    });
    expect(mocks.insertCalls[1]).toMatchObject({
      table: mocks.promptRewrites,
      values: [
        expect.objectContaining({
          kind: 'guided_completion',
          rewrittenPrompt:
            'Write a short landing page hero for ecommerce founders that persuades them to book a demo. Include one proof point and a clear CTA. Avoid generic marketing buzzwords.',
        }),
      ],
    });
    const persistedGuidedRewrite = (mocks.insertCalls[1]?.values as Array<{ rewrittenPrompt: string }> | undefined)?.[0];
    expect(persistedGuidedRewrite?.rewrittenPrompt).not.toContain('Original request:');
    expect(persistedGuidedRewrite?.rewrittenPrompt).not.toContain('Additional constraints:');
  });

  it('persists only the final validated prompt as the primary guided rewrite when fallback metadata exists', async () => {
    mocks.hasDatabaseUrl.mockReturnValue(true);

    await persistPromptRun({
      endpoint: '/v2/rewrite-from-guided-answers',
      requestId: 'req_guided_fallback',
      userId: 'usr_guided_fallback',
      sessionId: 'ses_guided_fallback',
      input: {
        prompt: 'Write better copy.',
        role: 'general',
        mode: 'balanced',
        rewritePreference: 'auto',
      },
      response: {
        id: 'par_guided_fallback',
        overallScore: 66,
        scoreBand: 'usable',
        rewriteRecommendation: 'rewrite_optional',
        analysis: {
          scores: {
            scope: 7,
            contrast: 6,
            clarity: 7,
            constraintQuality: 6,
            genericOutputRisk: 4,
            tokenWasteRisk: 3,
          },
          issues: [],
          detectedIssueCodes: [],
          signals: [],
          summary: 'Improved prompt.',
        },
        improvementSuggestions: [],
        bestNextMove: null,
        gating: {
          rewritePreference: 'auto',
          expectedImprovement: 'high',
          majorBlockingIssues: false,
        },
        rewrite: {
          role: 'general',
          mode: 'balanced',
          rewrittenPrompt: 'Write better copy. Make the primary goal persuade. Target CTOs. Format the output as landing page. Avoid hype.',
        },
        evaluation: null,
        rewritePresentationMode: 'full_rewrite',
        requestSource: 'guided_submit',
        guidedCompletion: null,
        guidedCompletionForm: null,
        inferenceFallbackUsed: false,
        resolutionSource: 'local',
        meta: {
          version: '2',
          requestId: 'req_guided_fallback',
          latencyMs: 8,
          providerMode: 'real',
        },
      },
      inferenceData: {
        guidedRewrite: {
          kind: 'guided_completion',
          originalPrompt: 'Write better copy.',
          internalSynthesisPrompt: 'Guided intent:',
          modelComposedPrompt: 'Original request:\nWrite better copy.',
          finalGuidedPrompt: 'Write better copy. Make the primary goal persuade. Target CTOs. Format the output as landing page. Avoid hype.',
          validation: {
            isValid: false,
            hardFailures: ['Prompt contains synthesis scaffold markers.'],
            softWarnings: [],
            fallbackReason: 'Prompt contains synthesis scaffold markers.',
          },
          fallbackReason: 'Prompt contains synthesis scaffold markers.',
          usedDeterministicFallback: true,
          guidedAnswers: {
            goal: 'persuade',
            audience: 'CTOs',
            format: 'landing page',
            excludes: ['hype'],
          },
        },
      },
    });

    expect(mocks.insertCalls[1]).toMatchObject({
      table: mocks.promptRewrites,
      values: [
        expect.objectContaining({
          kind: 'guided_completion',
          rewrittenPrompt: 'Write better copy. Make the primary goal persuade. Target CTOs. Format the output as landing page. Avoid hype.',
        }),
      ],
    });
    expect(mocks.insertCalls[0]).toMatchObject({
      table: mocks.promptRuns,
      values: expect.objectContaining({
        inferenceData: expect.objectContaining({
          guidedRewrite: expect.objectContaining({
            modelComposedPrompt: 'Original request:\nWrite better copy.',
            usedDeterministicFallback: true,
          }),
        }),
      }),
    });
  });

  it('does not build persistence records for guided scaffold leakage', () => {
    const rewrites = buildRewriteRecords({
      id: 'par_guided_scaffold',
      overallScore: 68,
      scoreBand: 'usable',
      rewriteRecommendation: 'no_rewrite_needed',
      analysis: {
        scores: {
          scope: 7,
          contrast: 6,
          clarity: 7,
          constraintQuality: 6,
          genericOutputRisk: 4,
          tokenWasteRisk: 3,
        },
        issues: [],
        detectedIssueCodes: [],
        signals: [],
        summary: 'Improved prompt.',
      },
      improvementSuggestions: [],
      bestNextMove: null,
      gating: {
        rewritePreference: 'auto',
        expectedImprovement: 'low',
        majorBlockingIssues: false,
      },
      rewrite: {
        role: 'general',
        mode: 'balanced',
        rewrittenPrompt: `Original request:
Write better copy.

Additional constraints:
- Primary goal: persuade

Create a stronger, more specific version of the prompt that preserves the user’s intent while adding these boundaries.`,
      },
      evaluation: null,
      rewritePresentationMode: 'full_rewrite',
      requestSource: 'guided_submit',
      guidedCompletion: null,
      guidedCompletionForm: null,
      inferenceFallbackUsed: false,
      resolutionSource: 'local',
      meta: {
        version: '2',
        requestId: 'req_guided_scaffold',
        latencyMs: 8,
        providerMode: 'mock',
      },
    });

    expect(rewrites).toEqual([]);
  });
});
