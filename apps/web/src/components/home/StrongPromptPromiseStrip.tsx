import { SurfaceCard } from '../ui';

export function StrongPromptPromiseStrip({ content }: { content: typeof import('./content').strongPromptPromiseContent }) {
  return (
    <SurfaceCard tone="suggestion" className="grid gap-3 px-5 py-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
      <span className="w-fit rounded-full border border-pf-surface-suggestion-border bg-pf-bg-card px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-pf-text-secondary">
        Principle
      </span>
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold text-pf-text-primary">{content.headline}</h2>
        <p className="text-sm text-pf-text-secondary">{content.supporting}</p>
      </div>
    </SurfaceCard>
  );
}
