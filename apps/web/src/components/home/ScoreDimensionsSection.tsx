import { Section, SurfaceCard } from '../ui';

export function ScoreDimensionsSection({ content }: { content: typeof import('./content').scoreDimensionsContent }) {
  return (
    <Section title={content.title} className="gap-3" titleClassName="text-[1.05rem]">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {content.dimensions.map((dimension) => (
          <SurfaceCard key={dimension.key} tone="default" className="gap-1.5 bg-pf-bg-cardSubtle p-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-pf-text-muted">Score dimension</p>
            <h3 className="text-[0.98rem] font-semibold text-pf-text-primary">{dimension.label}</h3>
            <p className="text-sm leading-5 text-pf-text-secondary">{dimension.description}</p>
          </SurfaceCard>
        ))}
      </div>
    </Section>
  );
}
