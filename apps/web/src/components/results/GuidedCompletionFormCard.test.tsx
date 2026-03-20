import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GuidedCompletionForm } from '@promptfire/shared';
import { GuidedCompletionFormCard, normalizeGuidedAnswersForSubmission } from './GuidedCompletionFormCard';

const form: GuidedCompletionForm = {
  enabled: true,
  title: 'Complete the missing details',
  summary: 'This prompt is too open-ended for a strong rewrite. Answer the missing details below and PeakPrompt will build a better version.',
  submitLabel: 'Build stronger prompt',
  skipLabel: 'Skip and rewrite anyway',
  blocks: [
    {
      id: 'goal',
      kind: 'radio',
      label: 'What should the output mainly do?',
      required: true,
      mapsTo: 'goal',
      options: [{ id: 'explain', label: 'Explain', value: 'explain' }],
    },
    {
      id: 'includes',
      kind: 'checkbox',
      label: 'What should the output include?',
      mapsTo: 'includes',
      options: [{ id: 'examples', label: 'Examples', value: 'examples' }],
    },
    {
      id: 'audience',
      kind: 'text',
      label: 'Who is this for?',
      mapsTo: 'audience',
      placeholder: 'For example: CTOs',
    },
  ],
};

describe('GuidedCompletionFormCard', () => {
  it('renders interactive controls instead of passive fallback copy', () => {
    const markup = renderToStaticMarkup(
      <GuidedCompletionFormCard
        prompt="Write better copy."
        view={{
          title: 'Best structural fix',
          lead: 'Complete the missing details',
          reasons: [],
          eyebrow: 'Before rewriting',
          primaryActionLabel: 'Build stronger prompt',
          formSubmitLabel: 'Build stronger prompt',
          formSkipLabel: 'Skip and rewrite anyway',
          forceRewriteLabel: 'Rewrite anyway',
          rewritePreviewTitle: 'Rewrite preview',
          previewCopyLabel: 'Copy rewrite anyway',
        }}
        form={form}
        submitting={false}
        onSubmitGuidedRewrite={vi.fn(async () => undefined)}
        onForceRewrite={vi.fn(async () => undefined)}
        onCopyPrompt={vi.fn()}
      />,
    );

    expect(markup).toContain('Before rewriting');
    expect(markup).toContain('Build stronger prompt');
    expect(markup).toContain('Skip and rewrite anyway');
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('type="text"');
  });

  it('normalizes answers before submission', () => {
    expect(
      normalizeGuidedAnswersForSubmission(form, {
        goal: ' explain ',
        includes: ['examples', 'examples', ''],
        audience: ' CTOs ',
      }),
    ).toEqual({
      goal: 'explain',
      includes: ['examples'],
      audience: 'CTOs',
    });
  });
});
