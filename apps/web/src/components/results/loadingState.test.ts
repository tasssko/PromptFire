import { describe, expect, it } from 'vitest';
import { loadingStepLabels, panelForState, resolveSuccessState } from './loadingState';

describe('loading state helpers', () => {
  it('switches to degraded-success when inference fallback resolves locally', () => {
    const state = resolveSuccessState({
      inferenceFallbackUsed: true,
      resolutionSource: 'local',
    } as any);
    expect(state).toBe('degraded-success');
  });

  it('keeps success for normal completions', () => {
    const state = resolveSuccessState({
      inferenceFallbackUsed: false,
      resolutionSource: 'local',
    } as any);
    expect(state).toBe('success');
  });

  it('uses inference-stage pattern lookup copy in step 2', () => {
    expect(loadingStepLabels('loading-inference')[1]).toBe('Looking up similar prompt patterns');
  });

  it('maps loading and completion states to panel visibility', () => {
    expect(panelForState('loading-local', false)).toBe('loading');
    expect(panelForState('loading-inference', false)).toBe('loading');
    expect(panelForState('success', true)).toBe('result');
    expect(panelForState('degraded-success', true)).toBe('result');
  });
});
