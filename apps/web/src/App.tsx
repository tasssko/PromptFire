import { useMemo, useState } from 'react';
import type {
  AnalyzeAndRewriteV2Response,
  EvaluationV2,
  ImprovementSuggestion,
  Mode,
  RewriteRecommendation,
  RewritePreference,
  Role,
  ScoreBand,
} from '@promptfire/shared';
import { fixtures, modes, roles } from './config';
import {
  ImpactBadge,
  MetricTile,
  Section,
  SurfaceCard,
  TechnicalMetric,
  sectionTitleClass,
} from './components/ui';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

type ProductState = 'strong' | 'usable' | 'weak';

function toProductState(rewriteRecommendation: RewriteRecommendation): ProductState {
  switch (rewriteRecommendation) {
    case 'no_rewrite_needed':
      return 'strong';
    case 'rewrite_optional':
      return 'usable';
    case 'rewrite_recommended':
    default:
      return 'weak';
  }
}

function heroCopy(result: AnalyzeAndRewriteV2Response): {
  headline: string;
  supporting: string;
  primaryAction: string;
} {
  switch (result.rewriteRecommendation) {
    case 'no_rewrite_needed':
      return {
        headline: 'Strong prompt',
        supporting: 'This prompt is already well scoped and well directed.',
        primaryAction: 'Copy original prompt',
      };
    case 'rewrite_optional':
      return {
        headline: 'Usable, with room to improve',
        supporting:
          'The prompt is clear, but tightening constraints or differentiation could improve the output.',
        primaryAction: result.rewrite ? 'Show suggested rewrite' : 'Generate suggested rewrite',
      };
    case 'rewrite_recommended':
    default:
      return {
        headline: 'Rewrite recommended',
        supporting:
          'This prompt is likely to produce generic output unless it is narrowed and better directed.',
        primaryAction: result.rewrite ? 'Copy rewritten prompt' : 'Generate rewrite',
      };
  }
}

function verdictCopy(evaluation: EvaluationV2): { label: string; recommendation: string } {
  switch (evaluation.status) {
    case 'material_improvement':
      return {
        label: 'Material improvement',
        recommendation: 'Use the rewritten prompt.',
      };
    case 'minor_improvement':
      return {
        label: 'Minor improvement',
        recommendation: 'Rewrite is slightly stronger, but either version is workable.',
      };
    case 'possible_regression':
      return {
        label: 'Possible regression',
        recommendation: 'Keep the original unless you need a shorter or tighter variation.',
      };
    case 'already_strong':
      return {
        label: 'Already strong',
        recommendation: 'Original prompt was already strong before rewrite.',
      };
    case 'no_significant_change':
    default:
      return {
        label: 'No significant change',
        recommendation: 'Rewrite mostly rephrases the original prompt.',
      };
  }
}

function scoreDimensionLabel(name: string): string {
  switch (name) {
    case 'constraintQuality':
      return 'Constraint quality';
    case 'genericOutputRisk':
      return 'Generic output risk';
    case 'tokenWasteRisk':
      return 'Token waste risk';
    default:
      return name;
  }
}

function bandLabel(scoreBand: ScoreBand): string {
  return scoreBand.replace('_', ' ');
}

function suggestedFindings(result: AnalyzeAndRewriteV2Response): string[] {
  const findings: string[] = [];
  const { scores } = result.analysis;
  const issueMessages = result.analysis.issues.map((issue) => issue.message);
  const topIssueMessages = issueMessages.slice(0, 3);
  const state = toProductState(result.rewriteRecommendation);

  if (scores.scope >= 7) findings.push('Clear scope and deliverable.');
  if (scores.contrast >= 7) findings.push('Good trade-off framing and contrast.');
  if (scores.clarity >= 7) findings.push('Instructions are clear and direct.');
  if (scores.constraintQuality >= 7) findings.push('Useful constraints improve precision.');
  if (scores.genericOutputRisk <= 3) findings.push('Low generic-output risk.');
  if (scores.tokenWasteRisk <= 3) findings.push('Low token-waste risk.');

  if (state !== 'strong') {
    findings.push(...topIssueMessages);
  }

  if (findings.length < 3) {
    findings.push(...topIssueMessages);
  }

  if (findings.length < 3) {
    findings.push(result.analysis.summary);
  }

  return findings.slice(0, 4);
}

function formatSuggestionTitle(suggestion: ImprovementSuggestion): string {
  return suggestion.title.charAt(0).toUpperCase() + suggestion.title.slice(1);
}

function heroBandClass(scoreBand: ScoreBand): string {
  switch (scoreBand) {
    case 'poor':
      return 'bg-hero-poor';
    case 'weak':
      return 'bg-hero-weak';
    case 'usable':
      return 'bg-hero-usable';
    case 'excellent':
      return 'bg-hero-excellent';
    case 'strong':
    default:
      return 'bg-hero-strong';
  }
}

export function App() {
  const [prompt, setPrompt] = useState(fixtures.general);
  const [role, setRole] = useState<Role>('general');
  const [mode, setMode] = useState<Mode>('balanced');
  const [rewritePreference, setRewritePreference] = useState<RewritePreference>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeAndRewriteV2Response | null>(null);
  const [showOptionalRewrite, setShowOptionalRewrite] = useState(false);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  async function submitAnalysis(preferenceOverride?: RewritePreference) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v2/analyze-and-rewrite`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          role,
          mode,
          rewritePreference: preferenceOverride ?? rewritePreference,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(payload?.error?.message ?? 'Request failed.');
      } else {
        setResult(payload);
        setShowOptionalRewrite(false);
      }
    } catch {
      setResult(null);
      setError('Network error while calling API.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await submitAnalysis();
  }

  async function handleForceRewrite() {
    setRewritePreference('force');
    await submitAnalysis('force');
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value);
  }

  const state = result ? toProductState(result.rewriteRecommendation) : null;
  const hero = result ? heroCopy(result) : null;
  const findings = result ? suggestedFindings(result) : [];
  const topSuggestions = result ? result.improvementSuggestions.slice(0, 3) : [];
  const evaluation = result?.evaluation ?? null;

  return (
    <main className="mx-auto grid max-w-[980px] gap-4 p-6 text-pf-text-primary max-sm:p-3">
      <section className="grid gap-4 rounded-xl border border-pf-border-subtle bg-shell p-6 shadow-none max-sm:p-4">
        <header className="grid gap-2">
          <h1 className="text-[clamp(1.5rem,2vw,1.8rem)] font-bold">PeakPrompt</h1>
          <p className="text-pf-text-secondary">
            Paste a prompt, get one clear score, and only see rewrites when they are worth using.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label className="grid w-full gap-1 font-semibold">
            Prompt
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} />
          </label>

          <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
            <label className="grid w-auto gap-1 font-semibold">
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid w-auto gap-1 font-semibold">
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {modes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid w-auto gap-1 font-semibold">
              Rewrite preference
              <select
                value={rewritePreference}
                onChange={(e) => setRewritePreference(e.target.value as RewritePreference)}
              >
                <option value="auto">auto</option>
                <option value="force">force</option>
                <option value="suppress">suppress</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button type="submit" disabled={!canSubmit}>
              {loading ? 'Analyzing…' : 'Analyze prompt'}
            </button>
          </div>

          <details className="border-t border-pf-border-divider pt-3">
            <summary className="cursor-pointer text-[#3f5066]">Load example</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setRole('general');
                  setPrompt(fixtures.general);
                }}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('marketer');
                  setPrompt(fixtures.marketer);
                }}
              >
                Marketer
              </button>
              <button
                type="button"
                onClick={() => {
                  setRole('developer');
                  setPrompt(fixtures.developer);
                }}
              >
                Developer
              </button>
            </div>
          </details>
        </form>

        {error && <p className="text-[#b00020]">{error}</p>}
      </section>

      {result && hero && state && (
        <section className="grid gap-4 rounded-xl border border-pf-border-default bg-white p-6 shadow-md max-sm:p-4">
          <section className={`grid gap-2 rounded-lg p-4 text-[#f7f4ea] ${heroBandClass(result.scoreBand)}`}>
            <p className="text-[0.8rem] uppercase tracking-[0.08em] opacity-80">Overall Score</p>
            <div className="flex flex-wrap items-end gap-4">
              <strong className="text-[clamp(3rem,9vw,5rem)] font-bold leading-[0.9] max-sm:text-[clamp(2.4rem,16vw,4rem)]">
                {result.overallScore}
              </strong>
              <span className="rounded-[999px] border border-[rgba(247,244,234,0.25)] bg-[rgba(247,244,234,0.14)] px-3 py-1 capitalize">
                {bandLabel(result.scoreBand)}
              </span>
            </div>
            <p className="text-2xl font-bold">{hero.headline}</p>
            <p className="max-w-[42rem]">{hero.supporting}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="border-transparent bg-[#f7f4ea] text-[#1b2e49] hover:bg-[#efe9d8]"
                onClick={() => {
                  if (state === 'strong') {
                    copyText(prompt);
                    return;
                  }

                  if (result.rewrite) {
                    copyText(result.rewrite.rewrittenPrompt);
                    if (state === 'usable') {
                      setShowOptionalRewrite(true);
                    }
                    return;
                  }

                  void handleForceRewrite();
                }}
              >
                {hero.primaryAction}
              </button>
              {state === 'strong' && (
                <button
                  type="button"
                  className="border-[rgba(247,244,234,0.4)] bg-transparent text-[#f7f4ea] hover:bg-[rgba(247,244,234,0.12)]"
                  onClick={() => void handleForceRewrite()}
                >
                  Generate rewrite anyway
                </button>
              )}
            </div>
          </section>

          <Section title="Key findings">
            <ul className="grid list-disc gap-2 pl-[1.2rem]">
              {findings.map((finding) => (
                <li key={finding} className="text-[#253750]">
                  {finding}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Sub-scores">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
              <MetricTile label="Scope" value={result.analysis.scores.scope} />
              <MetricTile label="Contrast" value={result.analysis.scores.contrast} />
              <MetricTile label="Clarity" value={result.analysis.scores.clarity} />
              <MetricTile label="Constraint quality" value={result.analysis.scores.constraintQuality} />
              <MetricTile label="Generic output risk" value={result.analysis.scores.genericOutputRisk} />
              <MetricTile label="Token waste risk" value={result.analysis.scores.tokenWasteRisk} />
            </div>
          </Section>

          {state === 'strong' && (
            <SurfaceCard tone="default">
              <h2 className={sectionTitleClass}>Why no rewrite?</h2>
              <p>
                {result.gating.rewritePreference === 'suppress'
                  ? 'Rewrite suppressed by your preference.'
                  : 'No rewrite needed because this prompt is already strong and expected gains are low.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => copyText(prompt)}>
                  Copy original
                </button>
                <button type="button" onClick={() => void handleForceRewrite()}>
                  Generate rewrite anyway
                </button>
              </div>
            </SurfaceCard>
          )}

          {state === 'usable' && (
            <SurfaceCard tone="default">
              <h2 className={sectionTitleClass}>Suggested improvement</h2>
              {topSuggestions.length > 0 ? (
                <ul>
                  {topSuggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <strong>{formatSuggestionTitle(suggestion)}:</strong> {suggestion.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Prompt is usable. Tightening constraints or specificity may still improve outputs.</p>
              )}
              {result.rewrite ? (
                <>
                  <button type="button" onClick={() => setShowOptionalRewrite((value) => !value)}>
                    {showOptionalRewrite ? 'Hide rewrite preview' : 'Show rewrite preview'}
                  </button>
                  {showOptionalRewrite && (
                    <SurfaceCard tone="rewrite" className="mt-1">
                      <pre>{result.rewrite.rewrittenPrompt}</pre>
                      {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
                      <button type="button" onClick={() => copyText(result.rewrite!.rewrittenPrompt)}>
                        Copy rewritten prompt
                      </button>
                    </SurfaceCard>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => void handleForceRewrite()}>
                  Generate rewrite
                </button>
              )}
            </SurfaceCard>
          )}

          {state === 'weak' && (
            <SurfaceCard tone="rewrite">
              <h2 className={sectionTitleClass}>Recommended rewrite</h2>
              {result.rewrite ? (
                <>
                  <pre>{result.rewrite.rewrittenPrompt}</pre>
                  {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
                  <button type="button" onClick={() => copyText(result.rewrite!.rewrittenPrompt)}>
                    Copy rewritten prompt
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => void handleForceRewrite()}>
                  Generate rewrite
                </button>
              )}
            </SurfaceCard>
          )}

          {result.rewrite && evaluation && (
            <SurfaceCard tone="verdict">
              <h2 className={sectionTitleClass}>Rewrite verdict</h2>
              <p className="font-bold">{verdictCopy(evaluation).label}</p>
              <p>{verdictCopy(evaluation).recommendation}</p>
              <p>
                Overall delta: <code>{evaluation.overallDelta}</code>
              </p>
              <div className="grid gap-1">
                {(['scope', 'contrast', 'clarity'] as const).map((dimension) => (
                  <p key={dimension}>
                    {scoreDimensionLabel(dimension)}: <code>{evaluation.scoreComparison.original[dimension]}</code>{' '}
                    {'->'} <code>{evaluation.scoreComparison.rewrite[dimension]}</code>
                  </p>
                ))}
              </div>
            </SurfaceCard>
          )}

          {state !== 'strong' && (
            <Section title="How to improve this prompt">
              {result.improvementSuggestions.length > 0 ? (
                <div className="grid gap-3">
                  {result.improvementSuggestions.map((suggestion) => (
                    <SurfaceCard key={suggestion.id} tone="suggestion" className="gap-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base">{formatSuggestionTitle(suggestion)}</h3>
                        <ImpactBadge impact={suggestion.impact} />
                      </div>
                      <p className="mt-2">{suggestion.reason}</p>
                      <p className="mt-2">Improves: {suggestion.targetScores.map(scoreDimensionLabel).join(', ')}</p>
                      {suggestion.exampleChange && <p className="mt-2">Example: {suggestion.exampleChange}</p>}
                    </SurfaceCard>
                  ))}
                </div>
              ) : (
                <p>No specific follow-up suggestions for this prompt.</p>
              )}
            </Section>
          )}

          <details className="border-t border-pf-border-divider pt-3">
            <summary className="cursor-pointer text-[#3f5066]">Technical details</summary>
            <div className="my-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-4 gap-y-2">
              <TechnicalMetric>
                Recommendation <strong>{result.rewriteRecommendation}</strong>
              </TechnicalMetric>
              <TechnicalMetric>
                Rewrite preference <code>{result.gating.rewritePreference}</code>
              </TechnicalMetric>
              <TechnicalMetric>
                Expected improvement <code>{result.gating.expectedImprovement}</code>
              </TechnicalMetric>
              <TechnicalMetric>
                Major blocking issues <code>{result.gating.majorBlockingIssues ? 'true' : 'false'}</code>
              </TechnicalMetric>
              <TechnicalMetric>
                Issue codes <code>{result.analysis.detectedIssueCodes.length}</code>
              </TechnicalMetric>
              <TechnicalMetric>
                Evaluation signals <code>{result.evaluation?.signals.length ?? 0}</code>
              </TechnicalMetric>
              <TechnicalMetric>
                Request ID <code>{result.meta.requestId}</code>
              </TechnicalMetric>
              <TechnicalMetric>
                Provider <code>{result.meta.providerMode}</code>
              </TechnicalMetric>
              {result.meta.providerModel && (
                <TechnicalMetric>
                  Model <code>{result.meta.providerModel}</code>
                </TechnicalMetric>
              )}
              <TechnicalMetric>
                Latency <code>{result.meta.latencyMs}ms</code>
              </TechnicalMetric>
            </div>
            {result.analysis.detectedIssueCodes.length > 0 && (
              <p>
                Raw issue codes: <code>{result.analysis.detectedIssueCodes.join(', ')}</code>
              </p>
            )}
            {result.evaluation?.signals.length ? (
              <p>
                Full evaluation signals: <code>{result.evaluation.signals.join(', ')}</code>
              </p>
            ) : null}
          </details>
        </section>
      )}
    </main>
  );
}
