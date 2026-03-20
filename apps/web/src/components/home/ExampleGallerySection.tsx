import { Section, SurfaceCard } from '../ui';
import type { HomepageExampleId } from './examples';

export function ExampleGallerySection({
  content,
  onLoadExample,
  loading,
}: {
  content: typeof import('./content').exampleGalleryContent;
  onLoadExample: (id: HomepageExampleId) => void;
  loading: boolean;
}) {
  return (
    <Section title={content.title} className="gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        {content.examples.map((example) => (
          <SurfaceCard
            key={example.id}
            tone="default"
            className="group gap-4 border-pf-border-default bg-pf-bg-card p-4 transition-colors duration-150 hover:border-pf-border-strong hover:bg-pf-bg-cardSubtle focus-within:border-pf-border-focus focus-within:bg-pf-bg-cardSubtle"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-2">
                <span className="inline-flex w-fit items-center rounded-full border border-pf-border-default bg-pf-bg-cardSubtle px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-pf-text-secondary">
                  {example.role}
                </span>
                <h3 className="text-base font-semibold text-pf-text-primary">{example.title}</h3>
              </div>
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-pf-text-muted transition-colors group-hover:text-pf-text-secondary group-focus-within:text-pf-text-secondary">
                Example
              </span>
            </div>

            <p className="pf-clamp-3 text-sm leading-6 text-pf-text-secondary">{example.excerpt}</p>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-pf-border-subtle pt-3">
              <p className="text-xs text-pf-text-muted">Loads this prompt into the analyzer.</p>
              <button
                type="button"
                className="pf-button-secondary inline-flex items-center justify-center text-sm font-semibold transition-colors"
                onClick={() => onLoadExample(example.id)}
                disabled={loading}
              >
                {loading ? 'Loading…' : example.actionLabel}
              </button>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </Section>
  );
}
