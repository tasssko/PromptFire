import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { AnalyzeAndRewriteV2Response, Mode, RewritePreference, Role } from '@promptfire/shared';
import { fixtures, modes, roles } from './config';
import {
  LoadingCard,
  ResultsCard,
  TopShell,
  heroCopy,
  panelForState,
  resolveSuccessState,
  suggestedFindings,
  toProductState,
  type AnalysisUiState,
} from './components/results';
import { applyTheme, resolveInitialTheme, type ThemeMode } from './theme';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export function App() {
  const [prompt, setPrompt] = useState(fixtures.general);
  const [role, setRole] = useState<Role>('general');
  const [mode, setMode] = useState<Mode>('balanced');
  const [rewritePreference, setRewritePreference] = useState<RewritePreference>('auto');
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());
  const [loading, setLoading] = useState(false);
  const [uiState, setUiState] = useState<AnalysisUiState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeAndRewriteV2Response | null>(null);
  const [showOptionalRewrite, setShowOptionalRewrite] = useState(false);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  async function submitAnalysis(preferenceOverride?: RewritePreference) {
    setLoading(true);
    setUiState('loading-local');
    setResult(null);
    setError(null);
    const inferenceStageTimer = globalThis.setTimeout(() => {
      setUiState((value) => (value === 'loading-local' ? 'loading-inference' : value));
    }, 900);

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
        setUiState('error');
      } else {
        setResult(payload);
        setShowOptionalRewrite(false);
        setUiState(resolveSuccessState(payload));
      }
    } catch {
      setResult(null);
      setError('Network error while calling API.');
      setUiState('error');
    } finally {
      clearTimeout(inferenceStageTimer);
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
  const panel = panelForState(uiState, Boolean(result && hero && state));

  return (
    <main className="mx-auto grid max-w-[980px] gap-4 p-6 text-pf-text-primary max-sm:p-3">
      <TopShell
        prompt={prompt}
        role={role}
        mode={mode}
        rewritePreference={rewritePreference}
        theme={theme}
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
        onThemeChange={setTheme}
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

      {panel === 'loading' && (
        <LoadingCard state={uiState === 'loading-inference' ? 'loading-inference' : 'loading-local'} />
      )}

      {panel === 'result' && result && hero && state && (
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
        />
      )}
    </main>
  );
}
