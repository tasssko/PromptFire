import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzePrompt, evaluateRewrite } from '@promptfire/heuristics';
import { normalizePreferences } from '@promptfire/shared';
import { handleHttpRequest } from './server';

type Fixture = {
  id: string;
  prompt: string;
  role: 'general' | 'developer' | 'marketer';
  mode: 'balanced' | 'tight_scope' | 'high_contrast' | 'low_token_cost';
  rewritePreference: 'auto' | 'force' | 'suppress';
  expectedRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed';
  expectedEvaluationStatus: 'material_improvement' | 'minor_improvement' | 'no_significant_change' | 'possible_regression' | 'already_strong' | null;
  mustHaveSignals: string[];
  mustNotHaveSignals: string[];
  rationale: string;
  rewrittenPrompt?: string;
};

const fixtures: Fixture[] = JSON.parse(
  readFileSync(new URL('./fixtures/rewrite-integrity-v0.5.3.json', import.meta.url), 'utf8'),
) as Fixture[];

describe('rewrite integrity fixtures v0.5.3', () => {
  it('keeps recommendation anchors stable for fixture prompts', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    for (const fixture of fixtures) {
      const response = await handleHttpRequest({
        method: 'POST',
        path: '/v2/analyze-and-rewrite',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: fixture.prompt,
          role: fixture.role,
          mode: fixture.mode,
          rewritePreference: fixture.rewritePreference,
        }),
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode, fixture.id).toBe(200);
      expect(body.rewriteRecommendation, fixture.id).toBe(fixture.expectedRecommendation);

      if (fixture.expectedEvaluationStatus === null) {
        expect(body.evaluation, fixture.id).toBeNull();
      }
    }
  });

  it('enforces evaluation-status and signal anchors for deterministic rewritten prompts', () => {
    const preferences = normalizePreferences();

    for (const fixture of fixtures.filter((item) => item.rewrittenPrompt && item.expectedEvaluationStatus !== null)) {
      const originalAnalysis = analyzePrompt({
        prompt: fixture.prompt,
        role: fixture.role,
        mode: fixture.mode,
        preferences,
      });

      const rewriteAnalysis = analyzePrompt({
        prompt: fixture.rewrittenPrompt as string,
        role: fixture.role,
        mode: fixture.mode,
        preferences,
      });

      const evaluation = evaluateRewrite({
        originalPrompt: fixture.prompt,
        rewrittenPrompt: fixture.rewrittenPrompt as string,
        originalAnalysis,
        rewriteAnalysis,
      });

      expect(evaluation.improvement.status, fixture.id).toBe(fixture.expectedEvaluationStatus);

      for (const signal of fixture.mustHaveSignals) {
        expect(evaluation.signals, `${fixture.id}: must include ${signal}`).toContain(signal);
      }

      for (const signal of fixture.mustNotHaveSignals) {
        expect(evaluation.signals, `${fixture.id}: must not include ${signal}`).not.toContain(signal);
      }
    }
  });

  it('rerun: Kubernetes marketer/general repeats avoid rubric-heavy add/require scaffolding in visible v2 output', async () => {
    process.env.REWRITE_PROVIDER_MODE = 'mock';

    const kubernetesFixtures = fixtures.filter(
      (fixture) =>
        fixture.id === 'kubernetes_marketer_rubric_echo_blocked' ||
        fixture.id === 'kubernetes_general_meta_instruction_blocked',
    );

    for (const fixture of kubernetesFixtures) {
      const response = await handleHttpRequest({
        method: 'POST',
        path: '/v2/analyze-and-rewrite',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt: fixture.prompt,
          role: fixture.role,
          mode: fixture.mode,
          rewritePreference: 'auto',
        }),
      });

      const body = JSON.parse(response.body);
      expect(response.statusCode, fixture.id).toBe(200);
      expect(body.evaluation, fixture.id).toBeTruthy();
      const rewrittenPrompt = String(body.rewrite?.rewrittenPrompt ?? '').toLowerCase();
      expect(rewrittenPrompt, fixture.id).not.toContain('add one concrete requirement');
      expect(rewrittenPrompt, fixture.id).not.toContain('add one concrete exclusion');
      expect(rewrittenPrompt, fixture.id).not.toContain('require one concrete proof artifact');
    }
  });
});
