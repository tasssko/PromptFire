import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { GuidedCompletionForm, GuidedQuestionBlock } from '@promptfire/shared';
import { SurfaceCard, sectionTitleClass } from '../ui';
import type { ActionCardView } from './helpers';

type GuidedFormAnswers = Record<string, string | string[]>;

type GuidedCompletionFormCardProps = {
  prompt: string;
  view: ActionCardView;
  form: GuidedCompletionForm;
  submitting: boolean;
  onSubmitGuidedRewrite: (answers: GuidedFormAnswers) => Promise<void>;
  onForceRewrite: () => Promise<void>;
  onCopyPrompt: (value: string) => void;
};

function normalizeBlockAnswer(block: GuidedQuestionBlock, value: string | string[] | undefined): string | string[] | null {
  if (block.kind === 'checkbox') {
    const items = Array.isArray(value) ? [...new Set(value.map((item) => item.trim()).filter(Boolean))] : [];
    return items.length > 0 ? items : null;
  }

  if (Array.isArray(value)) {
    return null;
  }

  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function hasMeaningfulBoundary(normalized: GuidedFormAnswers): boolean {
  const boundaryKeys = ['audience', 'goal', 'format', 'includes', 'excludes'];
  return boundaryKeys.some((key) => {
    const value = normalized[key];
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value.length > 0;
  });
}

export function normalizeGuidedAnswersForSubmission(form: GuidedCompletionForm, answers: GuidedFormAnswers): GuidedFormAnswers {
  const normalizedEntries = form.blocks
    .map((block) => {
      const normalized = normalizeBlockAnswer(block, answers[block.id]);
      return normalized === null ? null : [block.id, normalized];
    })
    .filter((entry): entry is [string, string | string[]] => entry !== null);

  return Object.fromEntries(normalizedEntries);
}

export function GuidedCompletionFormCard({
  prompt,
  view,
  form,
  submitting,
  onSubmitGuidedRewrite,
  onForceRewrite,
  onCopyPrompt,
}: GuidedCompletionFormCardProps) {
  const [answers, setAnswers] = useState<GuidedFormAnswers>({});

  const normalizedAnswers = useMemo(() => normalizeGuidedAnswersForSubmission(form, answers), [answers, form]);
  const hasBoundary = hasMeaningfulBoundary(normalizedAnswers);
  const includeExcludeCount = ['includes', 'excludes'].reduce((count, key) => {
    const value = normalizedAnswers[key];
    return count + (Array.isArray(value) ? value.length : typeof value === 'string' && value.length > 0 ? 1 : 0);
  }, 0);
  const missingRequired = form.blocks.some((block) => block.required && normalizeBlockAnswer(block, answers[block.id]) === null);
  const canSubmit = !submitting && !missingRequired && hasBoundary;

  function setSingleValue(blockId: string, value: string) {
    setAnswers((current) => ({
      ...current,
      [blockId]: value,
    }));
  }

  function toggleCheckboxValue(blockId: string, value: string, checked: boolean) {
    setAnswers((current) => {
      const existing = Array.isArray(current[blockId]) ? current[blockId] : [];
      const next = checked ? [...existing, value] : existing.filter((item) => item !== value);
      return {
        ...current,
        [blockId]: [...new Set(next)],
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onSubmitGuidedRewrite(normalizedAnswers);
  }

  return (
    <SurfaceCard tone="suggestion">
      {view.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pf-text-muted">{view.eyebrow}</p>}
      <h2 className={sectionTitleClass}>{view.title}</h2>
      <p className="font-semibold text-pf-text-primary">{form.title}</p>
      <p>{form.summary}</p>
      {form.rationale && <p className="text-sm text-pf-text-secondary">{form.rationale}</p>}

      <form className="grid gap-4" onSubmit={handleSubmit}>
        {form.blocks.map((block) => (
          <fieldset key={block.id} className="grid gap-2 rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle px-3 py-3">
            <legend className="font-semibold text-pf-text-primary">
              {block.label}
              {block.required ? ' *' : ''}
            </legend>
            {block.help && <p className="text-sm text-pf-text-secondary">{block.help}</p>}

            {block.kind === 'radio' && block.options?.map((choice) => (
              <label key={choice.id} className="flex items-start gap-2 text-sm text-pf-text-secondary">
                <input
                  type="radio"
                  name={block.id}
                  value={choice.value}
                  checked={answers[block.id] === choice.value}
                  onChange={() => setSingleValue(block.id, choice.value)}
                  disabled={submitting}
                />
                <span>
                  {choice.label}
                  {choice.hint ? ` - ${choice.hint}` : ''}
                </span>
              </label>
            ))}

            {block.kind === 'checkbox' && block.options?.map((choice) => {
              const selected = Array.isArray(answers[block.id]) ? answers[block.id].includes(choice.value) : false;
              return (
                <label key={choice.id} className="flex items-start gap-2 text-sm text-pf-text-secondary">
                  <input
                    type="checkbox"
                    name={`${block.id}-${choice.id}`}
                    value={choice.value}
                    checked={selected}
                    onChange={(event) => toggleCheckboxValue(block.id, choice.value, event.currentTarget.checked)}
                    disabled={submitting}
                  />
                  <span>
                    {choice.label}
                    {choice.hint ? ` - ${choice.hint}` : ''}
                  </span>
                </label>
              );
            })}

            {block.kind === 'text' && (
              <input
                type="text"
                value={typeof answers[block.id] === 'string' ? answers[block.id] : ''}
                onChange={(event) => setSingleValue(block.id, event.currentTarget.value)}
                placeholder={block.placeholder}
                className="rounded-md border border-pf-border-default bg-pf-bg-card px-3 py-2 text-sm text-pf-text-primary"
                disabled={submitting}
              />
            )}

            {block.kind === 'textarea' && (
              <textarea
                value={typeof answers[block.id] === 'string' ? answers[block.id] : ''}
                onChange={(event) => setSingleValue(block.id, event.currentTarget.value)}
                placeholder={block.placeholder}
                className="min-h-24 rounded-md border border-pf-border-default bg-pf-bg-card px-3 py-2 text-sm text-pf-text-primary"
                disabled={submitting}
              />
            )}
          </fieldset>
        ))}

        {includeExcludeCount === 0 && (
          <p className="text-sm text-pf-text-muted">Adding one inclusion or exclusion usually improves the result.</p>
        )}

        {submitting && <p className="text-sm text-pf-text-secondary">Building a stronger prompt from your answers...</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="pf-button-primary" disabled={!canSubmit}>
            {form.submitLabel}
          </button>
          <button type="button" className="pf-button-secondary" onClick={() => void onForceRewrite()} disabled={submitting}>
            {form.skipLabel}
          </button>
          <button type="button" className="pf-button-secondary" onClick={() => onCopyPrompt(prompt)} disabled={submitting}>
            Copy original prompt
          </button>
        </div>

        {!hasBoundary && <p className="text-sm text-pf-text-muted">Add at least one boundary so PeakPrompt can build a stronger rewrite path.</p>}
      </form>
    </SurfaceCard>
  );
}
