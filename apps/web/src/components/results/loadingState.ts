import type { AnalyzeAndRewriteV2Response } from '@promptfire/shared';

export type AnalysisUiState = 'idle' | 'loading-local' | 'loading-inference' | 'success' | 'degraded-success' | 'error';

export function resolveSuccessState(result: AnalyzeAndRewriteV2Response): 'success' | 'degraded-success' {
  if (result.inferenceFallbackUsed && result.resolutionSource === 'local') {
    return 'degraded-success';
  }
  return 'success';
}

export function loadingStepLabels(state: 'loading-local' | 'loading-inference'): [string, string, string] {
  return [
    'Initial analysis',
    state === 'loading-inference' ? 'Looking up similar prompt patterns' : 'Pattern lookup',
    'Finalizing result',
  ];
}

export function loadingCopy(state: 'loading-local' | 'loading-inference'): { headline: string; supporting: string } {
  if (state === 'loading-inference') {
    return {
      headline: 'Analyzing your prompt',
      supporting: 'Checking prompt structure and looking up similar prompt patterns.',
    };
  }

  return {
    headline: 'Analyzing your prompt',
    supporting: 'Checking prompt structure.',
  };
}

export function panelForState(state: AnalysisUiState, hasResult: boolean): 'none' | 'loading' | 'result' {
  if (state === 'loading-local' || state === 'loading-inference') {
    return 'loading';
  }

  if (hasResult && (state === 'success' || state === 'degraded-success')) {
    return 'result';
  }

  return 'none';
}
