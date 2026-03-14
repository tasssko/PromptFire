import { useMemo, useState } from 'react';
import type {
  AnalyzeAndRewriteV2Response,
  Mode,
  RewritePreference,
  Role,
} from '@promptfire/shared';
import { fixtures, modes, roles } from './config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

function recommendation(result: AnalyzeAndRewriteV2Response): string {
  if (result.rewriteRecommendation === 'no_rewrite_needed') {
    return 'Strong prompt. No rewrite needed.';
  }

  if (!result.evaluation) {
    return 'Rewrite not generated.';
  }

  switch (result.evaluation.status) {
    case 'material_improvement':
      return 'Material improvement: use the rewritten prompt.';
    case 'minor_improvement':
      return 'Minor improvement: rewrite is slightly tighter.';
    case 'already_strong':
      return 'Original prompt was already strong.';
    case 'possible_regression':
      return 'Possible regression: rewrite may have removed useful specificity.';
    case 'no_significant_change':
    default:
      return 'No significant change: rewrite mostly rephrases the original.';
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

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v2/analyze-and-rewrite`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt, role, mode, rewritePreference }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(payload?.error?.message ?? 'Request failed.');
      } else {
        setResult(payload);
      }
    } catch {
      setResult(null);
      setError('Network error while calling API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>PromptFire v2</h1>
        <p>Score-first prompt analysis with rewrite gating and explicit rewrite preference controls.</p>

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
              Rewrite
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
            <button type="button" onClick={() => {
              setRole('general');
              setPrompt(fixtures.general);
            }}>
              General Fixture
            </button>
            <button type="button" onClick={() => {
              setRole('marketer');
              setPrompt(fixtures.marketer);
            }}>
              Marketer Fixture
            </button>
            <button type="button" onClick={() => {
              setRole('developer');
              setPrompt(fixtures.developer);
            }}>
              Developer Fixture
            </button>
            <button type="submit" disabled={!canSubmit}>
              {loading ? 'Analyzing…' : 'Analyze + Rewrite'}
            </button>
          </div>
        </form>

        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <section className="panel">
          <section className="score-hero">
            <p className="eyebrow">Overall Score</p>
            <div className="score-line">
              <strong className="score-value">{result.overallScore}</strong>
              <span className={`score-band score-band-${result.scoreBand}`}>{result.scoreBand}</span>
            </div>
            <p className="score-summary">{recommendation(result)}</p>
          </section>

          <h2>Analysis</h2>
          <p>{result.analysis.summary}</p>

          <div className="metrics">
            <p>
              Scope <code>{result.analysis.scores.scope}</code>
            </p>
            <p>
              Contrast <code>{result.analysis.scores.contrast}</code>
            </p>
            <p>
              Clarity <code>{result.analysis.scores.clarity}</code>
            </p>
            <p>
              Constraints <code>{result.analysis.scores.constraintQuality}</code>
            </p>
            <p>
              Generic Risk <code>{result.analysis.scores.genericOutputRisk}</code>
            </p>
            <p>
              Token Risk <code>{result.analysis.scores.tokenWasteRisk}</code>
            </p>
          </div>

          <ul>
            {result.analysis.issues.map((issue) => (
              <li key={issue.code}>
                <strong>{issue.code}</strong>: {issue.message}
              </li>
            ))}
          </ul>

          <h2>Gating</h2>
          <div className="metrics">
            <p>
              Recommendation <strong>{result.rewriteRecommendation}</strong>
            </p>
            <p>
              Rewrite Preference <code>{result.gating.rewritePreference}</code>
            </p>
            <p>
              Expected Improvement <code>{result.gating.expectedImprovement}</code>
            </p>
            <p>
              Major Blocking Issues <code>{result.gating.majorBlockingIssues ? 'true' : 'false'}</code>
            </p>
          </div>

          <h2>Rewrite</h2>
          {result.rewrite ? (
            <>
              <pre>{result.rewrite.rewrittenPrompt}</pre>
              {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
              <button onClick={() => navigator.clipboard.writeText(result.rewrite!.rewrittenPrompt)} type="button">
                Copy rewritten prompt
              </button>
            </>
          ) : (
            <p>No rewrite returned for this request.</p>
          )}

          <h2>Evaluation</h2>
          {result.evaluation ? (
            <>
              <p>
                Status: <strong>{result.evaluation.status}</strong>
              </p>
              <p>
                Overall Delta: <code>{result.evaluation.overallDelta}</code>
              </p>
              <p>Signals: {result.evaluation.signals.length > 0 ? result.evaluation.signals.join(', ') : 'none'}</p>

              <h3>Score Comparison</h3>
              <p>
                Original scope: <code>{result.evaluation.scoreComparison.original.scope}</code> | Rewrite scope:{' '}
                <code>{result.evaluation.scoreComparison.rewrite.scope}</code>
              </p>
              <p>
                Original contrast: <code>{result.evaluation.scoreComparison.original.contrast}</code> | Rewrite
                contrast: <code>{result.evaluation.scoreComparison.rewrite.contrast}</code>
              </p>
              <p>
                Original clarity: <code>{result.evaluation.scoreComparison.original.clarity}</code> | Rewrite clarity:{' '}
                <code>{result.evaluation.scoreComparison.rewrite.clarity}</code>
              </p>
            </>
          ) : (
            <p>No evaluation returned because no rewrite was generated.</p>
          )}

          <h3>Trace</h3>
          <p>
            requestId: <code>{result.meta.requestId}</code>
          </p>
          <p>
            providerMode: <code>{result.meta.providerMode}</code>
          </p>
          <p>
            latencyMs: <code>{result.meta.latencyMs}</code>
          </p>
        </section>
      )}
    </main>
  );
}
