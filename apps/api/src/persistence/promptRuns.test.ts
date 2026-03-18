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

import { persistPromptRun } from './promptRuns';

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
});
