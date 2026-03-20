import { Section, SurfaceCard } from '../ui';

export function HowItWorksSection({ content }: { content: typeof import('./content').howItWorksContent }) {
  return (
    <Section title={content.title} className="gap-4" titleClassName="text-[1.05rem] text-pf-text-secondary">
      <div className="grid gap-3 md:grid-cols-3 md:gap-5">
        {content.steps.map((step) => (
          <SurfaceCard
            key={step.step}
            tone="default"
            className="gap-3 border-pf-border-subtle bg-transparent p-4 shadow-none"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-pf-border-subtle bg-pf-bg-card text-[0.7rem] font-semibold tracking-[0.12em] text-pf-text-muted">
              {step.step}
            </span>
            <div className="grid gap-1">
              <h3 className="text-base font-semibold text-pf-text-primary">{step.title}</h3>
              <p className="text-sm text-pf-text-secondary">{step.body}</p>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </Section>
  );
}
