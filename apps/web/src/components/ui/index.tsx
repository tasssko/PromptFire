import type { ReactNode } from 'react';

type SurfaceTone = 'default' | 'rewrite' | 'verdict' | 'suggestion';
type SuggestionImpact = 'high' | 'medium' | 'low';

const SECTION_TITLE_CLASS = 'text-[1.15rem] text-pf-text-primary';
const SECTION_CLASS = 'grid gap-2';
const SURFACE_BASE_CLASS = 'grid gap-2 rounded-lg border p-4';
const METRIC_TILE_CLASS = 'm-0 rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle p-3';
const TECH_METRIC_CLASS = 'rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle px-3 py-2';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={SECTION_CLASS}>
      <h2 className={SECTION_TITLE_CLASS}>{title}</h2>
      {children}
    </section>
  );
}

export function SurfaceCard({
  tone = 'default',
  className,
  children,
}: {
  tone?: SurfaceTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        SURFACE_BASE_CLASS,
        tone === 'default' && 'border-pf-surface-default-border bg-pf-surface-default-bg',
        tone === 'rewrite' && 'border-pf-surface-rewrite-border bg-pf-surface-rewrite-bg',
        tone === 'verdict' && 'border-pf-surface-verdict-border bg-pf-surface-verdict-bg',
        tone === 'suggestion' && 'border-pf-surface-suggestion-border bg-pf-surface-suggestion-bg',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MetricTile({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return (
    <article
      className={cx(
        METRIC_TILE_CLASS,
        emphasized
          ? 'border-pf-surface-suggestion-border bg-pf-surface-suggestion-bg'
          : 'opacity-75',
      )}
    >
      <p className={cx('m-0 text-[0.86rem]', emphasized ? 'text-pf-text-primary' : 'text-pf-text-muted')}>{label}</p>
      <p className={cx('mt-1 text-2xl font-bold', emphasized ? 'text-pf-text-primary' : 'text-pf-text-secondary')}>{value}</p>
    </article>
  );
}

export function ImpactBadge({ impact }: { impact: SuggestionImpact }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-1 text-[0.78rem] uppercase tracking-[0.04em]',
        impact === 'high' && 'bg-pf-feedback-high-bg text-pf-feedback-high-text',
        impact === 'medium' && 'bg-pf-feedback-medium-bg text-pf-feedback-medium-text',
        impact === 'low' && 'bg-pf-feedback-low-bg text-pf-feedback-low-text',
      )}
    >
      {impact}
    </span>
  );
}

export function TechnicalMetric({ children }: { children: ReactNode }) {
  return <p className={TECH_METRIC_CLASS}>{children}</p>;
}

export const sectionTitleClass = SECTION_TITLE_CLASS;
