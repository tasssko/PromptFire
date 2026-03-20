import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { AnalyzeAndRewriteV2Response, Mode, RewritePreference, Role } from '@promptfire/shared';
import { fixtures, modes, roles } from '../../config';
import {
  panelForState,
  resolveResultsPresentation,
  resolveSuccessState,
  type AnalysisUiState,
} from '../results';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export function usePromptAnalyzer() {
  const [prompt, setPrompt] = useState(fixtures.general);
  const [role, setRole] = useState<Role>('general');
  const [mode, setMode] = useState<Mode>('balanced');
  const [rewritePreference, setRewritePreference] = useState<RewritePreference>('auto');
  const [loading, setLoading] = useState(false);
  const [uiState, setUiState] = useState<AnalysisUiState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeAndRewriteV2Response | null>(null);
  const [showOptionalRewrite, setShowOptionalRewrite] = useState(false);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

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
        credentials: 'include',
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

  const presentation = result ? resolveResultsPresentation(result, role) : null;
  const topSuggestions = result ? result.improvementSuggestions.slice(0, 3) : [];
  const panel = panelForState(uiState, Boolean(result && presentation));

  return {
    prompt,
    role,
    mode,
    rewritePreference,
    loading,
    canSubmit,
    error,
    result,
    presentation,
    topSuggestions,
    showOptionalRewrite,
    panel,
    uiState,
    roles,
    modes,
    setPrompt,
    setRole,
    setMode,
    setRewritePreference,
    setShowOptionalRewrite,
    handleSubmit,
    handleForceRewrite,
    copyText,
  };
}
