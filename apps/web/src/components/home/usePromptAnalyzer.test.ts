import { describe, expect, it, vi } from 'vitest';
import { submitGuidedRewriteRequest } from './usePromptAnalyzer';

describe('submitGuidedRewriteRequest', () => {
  it('posts normalized guided answers to the guided rewrite endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'par_1', meta: { version: '2' } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await submitGuidedRewriteRequest('http://localhost:3001', {
      prompt: 'Write better copy.',
      role: 'general',
      mode: 'balanced',
      rewritePreference: 'auto',
      guidedAnswers: {
        goal: 'persuade',
        includes: ['examples', 'specific recommendations'],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/v2/rewrite-from-guided-answers',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      prompt: 'Write better copy.',
      role: 'general',
      mode: 'balanced',
      rewritePreference: 'auto',
      guidedAnswers: {
        goal: 'persuade',
        includes: ['examples', 'specific recommendations'],
      },
    });
  });
});
