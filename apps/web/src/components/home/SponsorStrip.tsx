import stackTrackLogoLight from '../../logos/primary/horizontal/StackTrack_logo_fullcolor_rgb.svg';
import stackTrackLogoDark from '../../logos/primary/horizontal/StackTrack_logo_white_rgb.svg';
import type { ThemeMode } from '../../theme';
import { SurfaceCard } from '../ui';

export function SponsorStrip({
  content,
  theme,
}: {
  content: typeof import('./content').sponsorStripContent;
  theme: ThemeMode;
}) {
  const logoSrc = theme === 'dark' ? stackTrackLogoDark : stackTrackLogoLight;

  return (
    <SurfaceCard tone="default" className="gap-4 border-pf-border-subtle bg-pf-bg-cardSubtle p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(13rem,0.72fr)] md:items-center">
        <div className="grid gap-3">
          <div className="grid gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-pf-text-muted">{content.eyebrow}</p>
            <h2 className="text-lg font-semibold text-pf-text-primary">{content.headline}</h2>
            <p className="max-w-[34rem] text-sm text-pf-text-secondary">{content.supporting}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {content.chips.map((chip) => (
              <span key={chip} className="pf-app-chip text-xs font-semibold">
                {chip}
              </span>
            ))}
          </div>
          <div>
            <a className="pf-button-secondary inline-flex items-center justify-center text-sm font-semibold no-underline" href={content.primaryCtaHref} target="_blank" rel="noreferrer">
              {content.primaryCtaLabel}
            </a>
          </div>
        </div>

        <aside className="grid gap-2 rounded-lg border border-pf-border-subtle bg-transparent p-3 md:justify-items-end">
          <img src={logoSrc} alt={content.sponsorLogoAlt} className="h-auto w-36 max-w-full opacity-80" />
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-pf-text-primary md:text-right">{content.sponsorName}</p>
            <p className="text-sm text-pf-text-secondary md:text-right">{content.sponsorDescriptor}</p>
          </div>
        </aside>
      </div>
    </SurfaceCard>
  );
}
