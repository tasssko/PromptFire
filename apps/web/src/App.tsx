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
        primaryAction: result.rewrite ? 'Use rewritten prompt' : 'Generate rewrite',
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
    <main className="page">
      <section className="panel">
        <h1>PromptFire</h1>
        <p>Paste a prompt, get one clear score, and only see rewrites when they are worth using.</p>

        <form onSubmit={handleSubmit} className="form">
          <label>
            Prompt
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} />
          </label>

          <div className="row">
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {modes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
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

          <div className="row">
            <button type="submit" disabled={!canSubmit}>
              {loading ? 'Analyzing…' : 'Analyze prompt'}
            </button>
          </div>

          <details className="examples">
            <summary>Load example</summary>
            <div className="example-buttons">
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

        {error && <p className="error">{error}</p>}
      </section>

      {result && hero && state && (
        <section className="panel">
          <section className={`score-hero score-hero-${state}`}>
            <p className="eyebrow">Overall Score</p>
            <div className="score-line">
              <strong className="score-value">{result.overallScore}</strong>
              <span className={`score-band score-band-${result.scoreBand}`}>{bandLabel(result.scoreBand)}</span>
            </div>
            <p className="hero-title">{hero.headline}</p>
            <p className="score-summary">{hero.supporting}</p>
            <div className="hero-actions">
              <button
                type="button"
                className="hero-primary"
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
                <button type="button" className="hero-secondary" onClick={() => void handleForceRewrite()}>
                  Generate rewrite anyway
                </button>
              )}
            </div>
          </section>

          <section>
            <h2>Key findings</h2>
            <ul className="findings">
              {findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Sub-scores</h2>
            <div className="subscores">
              <article className="score-tile">
                <p className="tile-label">Scope</p>
                <p className="tile-value">{result.analysis.scores.scope}</p>
              </article>
              <article className="score-tile">
                <p className="tile-label">Contrast</p>
                <p className="tile-value">{result.analysis.scores.contrast}</p>
              </article>
              <article className="score-tile">
                <p className="tile-label">Clarity</p>
                <p className="tile-value">{result.analysis.scores.clarity}</p>
              </article>
              <article className="score-tile">
                <p className="tile-label">Constraint quality</p>
                <p className="tile-value">{result.analysis.scores.constraintQuality}</p>
              </article>
              <article className="score-tile">
                <p className="tile-label">Generic output risk</p>
                <p className="tile-value">{result.analysis.scores.genericOutputRisk}</p>
              </article>
              <article className="score-tile">
                <p className="tile-label">Token waste risk</p>
                <p className="tile-value">{result.analysis.scores.tokenWasteRisk}</p>
              </article>
            </div>
          </section>

          {state === 'strong' && (
            <section className="decision-panel">
              <h2>Why no rewrite?</h2>
              <p>
                {result.gating.rewritePreference === 'suppress'
                  ? 'Rewrite suppressed by your preference.'
                  : 'No rewrite needed because this prompt is already strong and expected gains are low.'}
              </p>
              <div className="row">
                <button type="button" onClick={() => copyText(prompt)}>
                  Copy original
                </button>
                <button type="button" onClick={() => void handleForceRewrite()}>
                  Generate rewrite anyway
                </button>
              </div>
            </section>
          )}

          {state === 'usable' && (
            <section className="decision-panel">
              <h2>Suggested improvement</h2>
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
                    <div className="rewrite-panel">
                      <pre>{result.rewrite.rewrittenPrompt}</pre>
                      {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
                      <button type="button" onClick={() => copyText(result.rewrite!.rewrittenPrompt)}>
                        Copy rewritten prompt
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => void handleForceRewrite()}>
                  Generate rewrite
                </button>
              )}
            </section>
          )}

          {state === 'weak' && (
            <section className="decision-panel rewrite-panel">
              <h2>Recommended rewrite</h2>
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
            </section>
          )}

          {result.rewrite && evaluation && (
            <section className="verdict">
              <h2>Rewrite verdict</h2>
              <p className="verdict-title">{verdictCopy(evaluation).label}</p>
              <p>{verdictCopy(evaluation).recommendation}</p>
              <p>
                Overall delta: <code>{evaluation.overallDelta}</code>
              </p>
              <div className="comparison">
                {(['scope', 'contrast', 'clarity'] as const).map((dimension) => (
                  <p key={dimension}>
                    {scoreDimensionLabel(dimension)}: <code>{evaluation.scoreComparison.original[dimension]}</code>{' '}
                    {'->'} <code>{evaluation.scoreComparison.rewrite[dimension]}</code>
                  </p>
                ))}
              </div>
            </section>
          )}

          {state !== 'strong' && (
            <section>
              <h2>How to improve this prompt</h2>
              {result.improvementSuggestions.length > 0 ? (
                <div className="suggestions">
                  {result.improvementSuggestions.map((suggestion) => (
                    <article key={suggestion.id} className="suggestion-card">
                      <div className="suggestion-header">
                        <h3>{formatSuggestionTitle(suggestion)}</h3>
                        <span className={`impact impact-${suggestion.impact}`}>{suggestion.impact}</span>
                      </div>
                      <p>{suggestion.reason}</p>
                      <p>Improves: {suggestion.targetScores.map(scoreDimensionLabel).join(', ')}</p>
                      {suggestion.exampleChange && <p>Example: {suggestion.exampleChange}</p>}
                    </article>
                  ))}
                </div>
              ) : (
                <p>No specific follow-up suggestions for this prompt.</p>
              )}
            </section>
          )}

          <details className="technical-details">
            <summary>Technical details</summary>
            <div className="metrics">
              <p>
                Recommendation <strong>{result.rewriteRecommendation}</strong>
              </p>
              <p>
                Rewrite preference <code>{result.gating.rewritePreference}</code>
              </p>
              <p>
                Expected improvement <code>{result.gating.expectedImprovement}</code>
              </p>
              <p>
                Major blocking issues <code>{result.gating.majorBlockingIssues ? 'true' : 'false'}</code>
              </p>
              <p>
                Issue codes <code>{result.analysis.detectedIssueCodes.length}</code>
              </p>
              <p>
                Evaluation signals <code>{result.evaluation?.signals.length ?? 0}</code>
              </p>
              <p>
                Request ID <code>{result.meta.requestId}</code>
              </p>
              <p>
                Provider <code>{result.meta.providerMode}</code>
              </p>
              {result.meta.providerModel && (
                <p>
                  Model <code>{result.meta.providerModel}</code>
                </p>
              )}
              <p>
                Latency <code>{result.meta.latencyMs}ms</code>
              </p>
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
