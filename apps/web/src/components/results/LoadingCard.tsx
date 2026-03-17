import { SurfaceCard } from '../ui';
import { loadingCopy, loadingStepLabels } from './loadingState';

type LoadingCardProps = {
  state: 'loading-local' | 'loading-inference';
};

export function LoadingCard({ state }: LoadingCardProps) {
  const copy = loadingCopy(state);
  const [step1, step2, step3] = loadingStepLabels(state);

  return (
    <section className="grid gap-4 rounded-xl border border-pf-border-default bg-pf-bg-card p-6 shadow-md max-sm:p-4">
      <SurfaceCard tone="default">
        <h2 className="text-[1.2rem] font-semibold text-pf-text-primary">{copy.headline}</h2>
        <p>{copy.supporting}</p>

        <ol className="mt-1 grid gap-2">
          <li className="rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle px-3 py-2 text-sm">
            <strong>1.</strong> {step1}
          </li>
          <li className="rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle px-3 py-2 text-sm">
            <strong>2.</strong> {step2}
          </li>
          <li className="rounded-md border border-pf-border-subtle bg-pf-bg-cardSubtle px-3 py-2 text-sm">
            <strong>3.</strong> {step3}
          </li>
        </ol>
      </SurfaceCard>

      <SurfaceCard tone="default">
        <div className="h-7 w-36 animate-pulse rounded bg-pf-loading-strong" />
        <div className="h-4 w-full animate-pulse rounded bg-pf-loading-soft" />
        <div className="h-4 w-[85%] animate-pulse rounded bg-pf-loading-soft" />
      </SurfaceCard>

      <SurfaceCard tone="default">
        <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-2">
          <div className="h-16 animate-pulse rounded bg-pf-loading-soft" />
          <div className="h-16 animate-pulse rounded bg-pf-loading-soft" />
          <div className="h-16 animate-pulse rounded bg-pf-loading-soft" />
        </div>
      </SurfaceCard>
    </section>
  );
}
