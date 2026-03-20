import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRightFromBracket, faHouse, faMoonStars, faSparkles, faSunBright } from '@fortawesome/pro-solid-svg-icons';
import type { AuthUser } from '@promptfire/shared';
import type { ThemeMode } from '../theme';

type PrimaryNavProps = {
  pathname: string;
  theme: ThemeMode;
  user?: AuthUser | null;
  onNavigate: (to: string) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onLogout?: () => Promise<void>;
  publicPrimaryCtaLabel?: string;
  onPublicPrimaryCtaClick?: () => void;
};

function navButtonClass(active: boolean): string {
  return active ? 'pf-nav-button pf-nav-button-active' : 'pf-nav-button';
}

export function PrimaryNav({
  pathname,
  theme,
  user,
  onNavigate,
  onThemeChange,
  onLogout,
  publicPrimaryCtaLabel,
  onPublicPrimaryCtaClick,
}: PrimaryNavProps) {
  const inApp = pathname.startsWith('/app');
  const homePath = inApp ? '/app/' : '/';
  const analyzePath = inApp ? '/app/analyze' : '/';
  const homeActive = inApp && (pathname === '/app/' || pathname === '/app');
  const analyzeActive = pathname === '/app/analyze' || pathname === '/';

  return (
    <header className="pf-top-nav sticky top-0 z-10 backdrop-blur">
      <div className="pf-top-nav-shell">
        <div className="pf-top-nav-row">
          <button className="pf-top-nav-brand" onClick={() => onNavigate(homePath)}>
            <span className="pf-top-nav-brand-copy">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-pf-text-muted">PeakPrompt</span>
              <span className="text-sm font-semibold text-pf-text-primary">{inApp ? 'Prompt workspace' : 'Analyze prompts'}</span>
            </span>
          </button>

          <nav className="pf-top-nav-actions text-sm">
            <button className={navButtonClass(homeActive)} onClick={() => onNavigate(homePath)}>
              <FontAwesomeIcon icon={faHouse} className="text-sm" />
              <span>Home</span>
            </button>
            <button className={navButtonClass(analyzeActive)} onClick={() => onNavigate(analyzePath)}>
              <FontAwesomeIcon icon={faSparkles} className="text-sm" />
              <span>Analyze</span>
            </button>
            {inApp && (
              <>
                <button className={navButtonClass(pathname === '/app/history')} onClick={() => onNavigate('/app/history')}>
                  <span>History</span>
                </button>
                <button className={navButtonClass(pathname === '/app/settings/security')} onClick={() => onNavigate('/app/settings/security')}>
                  <span>Security</span>
                </button>
              </>
            )}
            <div className="pf-nav-theme-toggle" role="group" aria-label="Theme mode">
              <button
                type="button"
                className={`pf-nav-icon-button ${theme === 'light' ? 'pf-nav-icon-button-active' : ''}`}
                onClick={() => onThemeChange('light')}
                aria-label="Use light mode"
                title="Light mode"
              >
                <FontAwesomeIcon icon={faSunBright} />
              </button>
              <button
                type="button"
                className={`pf-nav-icon-button ${theme === 'dark' ? 'pf-nav-icon-button-active' : ''}`}
                onClick={() => onThemeChange('dark')}
                aria-label="Use dark mode"
                title="Dark mode"
              >
                <FontAwesomeIcon icon={faMoonStars} />
              </button>
            </div>
            {user?.email && <span className="pf-nav-pill hidden text-xs sm:inline-flex">{user.email}</span>}
            {!inApp && publicPrimaryCtaLabel && onPublicPrimaryCtaClick && (
              <button className="pf-nav-primary-button text-sm font-semibold" onClick={onPublicPrimaryCtaClick}>
                {publicPrimaryCtaLabel}
              </button>
            )}
            {onLogout && (
              <button className="pf-nav-button" onClick={() => void onLogout()}>
                <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-sm" />
                <span>Logout</span>
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
