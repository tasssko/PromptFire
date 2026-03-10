import { useMemo, useState } from 'react';
import type { AnalyzeAndRewriteResponse, Mode, Role } from '@promptfire/shared';
import { fixtures, modes, roles } from './config';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

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
        <h1>PromptFire v0.1</h1>
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
