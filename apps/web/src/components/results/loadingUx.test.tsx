import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LoadingCard } from './LoadingCard';
import { TopShell } from './TopShell';

describe('loading UX components', () => {
  it('renders loading card progress labels while analyzing', () => {
    const markup = renderToStaticMarkup(<LoadingCard state="loading-local" />);
    expect(markup).toContain('Analyzing your prompt');
    expect(markup).toContain('Initial analysis');
    expect(markup).toContain('Pattern lookup');
    expect(markup).toContain('Finalizing result');
  });

  it('disables form controls while loading', () => {
    const markup = renderToStaticMarkup(
      <TopShell
        prompt="Prompt"
        role="general"
        mode="balanced"
        rewritePreference="auto"
        roles={['general', 'developer', 'marketer']}
        modes={['balanced', 'tight_scope', 'high_contrast', 'low_token_cost']}
        loading={true}
        canSubmit={false}
        error={null}
        onSubmit={vi.fn()}
        onPromptChange={vi.fn()}
        onRoleChange={vi.fn()}
        onModeChange={vi.fn()}
        onRewritePreferenceChange={vi.fn()}
        onLoadGeneral={vi.fn()}
        onLoadMarketer={vi.fn()}
        onLoadDeveloper={vi.fn()}
      />,
    );

    expect(markup).toContain('<textarea rows="7" disabled=""');
    expect(markup).toContain('Analyzing');
    expect(markup.match(/<select disabled=""/g)?.length).toBe(3);
    expect(markup.match(/type="button" disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
