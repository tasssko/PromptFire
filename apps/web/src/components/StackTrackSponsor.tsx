import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRight, faDiagramSubtask, faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import type { ThemeMode } from '../theme';
import stackTrackLogoFullColor from '../logos/primary/horizontal/StackTrack_logo_fullcolor_rgb.svg';
import stackTrackLogoWhite from '../logos/primary/horizontal/StackTrack_logo_white_rgb.svg';
import stackTrackMark from '../logos/icon/StackTrack_logomark_inverted_rgb.svg';

const STACKTRACK_URL = 'https://stacktrack.com/';

const sponsorSignals = [
  {
    icon: faDiagramSubtask,
    label: 'Clear ownership',
  },
  {
    icon: faShieldCheck,
    label: 'Secure by design',
  },
] as const;

export function StackTrackSponsor({ theme }: { theme: ThemeMode }) {
  const logoSrc = theme === 'dark' ? stackTrackLogoWhite : stackTrackLogoFullColor;

  return (
    <section className="pf-sponsor-spotlight">
      <div className="pf-sponsor-copy">
        <p className="pf-sponsor-eyebrow">Project sponsor</p>
        <h2 className="pf-sponsor-headline">Escape maintenance pergatory?</h2>
        <p className="pf-sponsor-support">
          Unblock your developers and ship software faster
        </p>
        <div className="pf-sponsor-chip-row">
          {sponsorSignals.map((signal) => (
            <span key={signal.label} className="pf-sponsor-chip">
              <FontAwesomeIcon icon={signal.icon} className="text-xs" />
              {signal.label}
            </span>
          ))}
        </div>
        <div className="mt-4">
          <a className="pf-sponsor-primary-link" href={STACKTRACK_URL} target="_blank" rel="noreferrer">
            Visit StackTrack
            <FontAwesomeIcon icon={faArrowUpRight} className="text-xs" />
          </a>
        </div>
      </div>

      <aside className="pf-sponsor-brand-panel" aria-label="StackTrack sponsor panel">
        <div className="pf-sponsor-brand-mark">
          <div className="min-w-0">
            <p className="pf-sponsor-brand-name">StackTrack Inc</p>
            <p className="pf-sponsor-brand-desc">Full managed, reliable software build and delivery infrastructure.</p>
          </div>
        </div>
        <img src={logoSrc} alt="StackTrack" className="h-auto w-full max-w-[12rem]" />
      </aside>
    </section>
  );
}
