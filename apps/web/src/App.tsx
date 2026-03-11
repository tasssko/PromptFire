import { useMemo, useState } from 'react';
import type { AnalyzeAndRewriteResponse, Mode, Role } from '@promptfire/shared';
import { fixtures, modes, roles } from './config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

function recommendation(status: AnalyzeAndRewriteResponse['evaluation']['improvement']['status']): string {
  switch (status) {
    case 'material_improvement':
      return 'Material improvement: use the rewritten prompt';
    case 'minor_improvement':
      return 'Minor improvement: rewrite is slightly tighter';
    case 'already_strong':
      return 'Already strong: your original prompt is already well scoped';
    case 'possible_regression':
      return 'Possible regression: rewrite may have removed useful specificity';
    case 'no_significant_change':
    default:
      return 'No significant change: rewrite mostly rephrases the original';
  }
}

export function App() {
  const [prompt, setPrompt] = useState(fixtures.marketer);
  const [role, setRole] = useState<Role>('marketer');
  const [mode, setMode] = useState<Mode>('balanced');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeAndRewriteResponse | null>(null);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/analyze-and-rewrite`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt, role, mode }),
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
        <h1>PromptFire v0.4</h1>
        <p>Analyze and rewrite prompts with deterministic heuristics and a mock rewrite engine.</p>

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
          </div>

          <div className="row">
            <button type="button" onClick={() => setPrompt(fixtures.marketer)}>
              Marketer Fixture
            </button>
            <button type="button" onClick={() => setPrompt(fixtures.developer)}>
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
          <h2>Analysis</h2>
          <p>{result.analysis.summary}</p>

          <ul>
            {result.analysis.issues.map((issue) => (
              <li key={issue.code}>
                <strong>{issue.code}</strong>: {issue.message}
              </li>
            ))}
          </ul>

          <h2>Rewrite</h2>
          <pre>{result.rewrite.rewrittenPrompt}</pre>
          {result.rewrite.explanation && <p>{result.rewrite.explanation}</p>}
          <button onClick={() => navigator.clipboard.writeText(result.rewrite.rewrittenPrompt)} type="button">
            Copy rewritten prompt
          </button>

          <h2>Evaluation</h2>
          <p>
            Status: <strong>{result.evaluation.improvement.status}</strong>
          </p>
          <p>
            Overall Delta: <code>{result.evaluation.improvement.overallDelta}</code>
          </p>
          <p>{recommendation(result.evaluation.improvement.status)}</p>
          <p>Signals: {result.evaluation.signals.length > 0 ? result.evaluation.signals.join(', ') : 'none'}</p>

          <h3>Score Comparison</h3>
          <p>
            Original scope: <code>{result.evaluation.originalScore.scope}</code> | Rewrite scope:{' '}
            <code>{result.evaluation.rewriteScore.scope}</code>
          </p>
          <p>
            Original contrast: <code>{result.evaluation.originalScore.contrast}</code> | Rewrite contrast:{' '}
            <code>{result.evaluation.rewriteScore.contrast}</code>
          </p>
          <p>
            Original clarity: <code>{result.evaluation.originalScore.clarity}</code> | Rewrite clarity:{' '}
            <code>{result.evaluation.rewriteScore.clarity}</code>
          </p>

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
