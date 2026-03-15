import type { ReactNode } from 'react';

type SurfaceTone = 'default' | 'rewrite' | 'verdict' | 'suggestion';
type SuggestionImpact = 'high' | 'medium' | 'low';

const SECTION_TITLE_CLASS = 'text-[1.15rem]';
const SECTION_CLASS = 'grid gap-2';
const SURFACE_BASE_CLASS = 'grid gap-2 rounded-lg p-3';
const METRIC_TILE_CLASS = 'm-0 rounded-md border border-[#dbe5f0] bg-[#f8fbff] p-3';
const TECH_METRIC_CLASS = 'rounded-sm border border-[#e5ebf2] bg-[#f5f8fb] px-3 py-2';

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
        tone === 'default' && 'border border-[#dbe5f0] bg-[#f8fbff]',
        tone === 'rewrite' && 'border border-[#cddcf0] bg-[#eef4fb]',
        tone === 'verdict' && 'border border-[#dce6f2] bg-[#f6f9fd]',
        tone === 'suggestion' && 'border border-[#dde8c8] bg-[#f9fbf5]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <article className={METRIC_TILE_CLASS}>
      <p className="m-0 text-[0.86rem] text-[#4c5f76]">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </article>
  );
}

export function ImpactBadge({ impact }: { impact: SuggestionImpact }) {
  return (
    <span
      className={cx(
        'rounded-[999px] px-2 py-1 text-[0.78rem] uppercase tracking-[0.04em]',
        impact === 'high' && 'bg-[#f5d7d1] text-[#7f1d1d]',
        impact === 'medium' && 'bg-[#f4e8c8] text-[#7a4b00]',
        impact === 'low' && 'bg-[#d7ead7] text-[#215c27]',
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
