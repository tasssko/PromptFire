import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { AnalyzeAndRewriteV2Response, Mode, RewritePreference, Role } from '@promptfire/shared';
import { fixtures, modes, roles } from './config';
import { ResultsCard, TopShell, heroCopy, suggestedFindings, toProductState } from './components/results';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

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

  async function handleSubmit(event: FormEvent) {
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
      <TopShell
        prompt={prompt}
        role={role}
        mode={mode}
        rewritePreference={rewritePreference}
        roles={roles}
        modes={modes}
        loading={loading}
        canSubmit={canSubmit}
        error={error}
        onSubmit={handleSubmit}
        onPromptChange={setPrompt}
        onRoleChange={setRole}
        onModeChange={setMode}
        onRewritePreferenceChange={setRewritePreference}
        onLoadGeneral={() => {
          setRole('general');
          setPrompt(fixtures.general);
        }}
        onLoadMarketer={() => {
          setRole('marketer');
          setPrompt(fixtures.marketer);
        }}
        onLoadDeveloper={() => {
          setRole('developer');
          setPrompt(fixtures.developer);
        }}
      />

      {result && hero && state && (
        <ResultsCard
          prompt={prompt}
          result={result}
          state={state}
          hero={hero}
          findings={findings}
          topSuggestions={topSuggestions}
          evaluation={evaluation}
          showOptionalRewrite={showOptionalRewrite}
          onToggleOptionalRewrite={() => setShowOptionalRewrite((value) => !value)}
          onForceRewrite={handleForceRewrite}
          onCopyPrompt={copyText}
          onSetShowOptionalRewrite={setShowOptionalRewrite}
        />
      )}
    </main>
  );
}
