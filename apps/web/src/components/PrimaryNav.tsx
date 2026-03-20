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
};

function navButtonClass(active: boolean): string {
  return active ? 'pf-nav-button pf-nav-button-active' : 'pf-nav-button';
}

export function PrimaryNav({ pathname, theme, user, onNavigate, onThemeChange, onLogout }: PrimaryNavProps) {
  const inApp = pathname.startsWith('/app');
  const homePath = inApp ? '/app/' : '/';
  const analyzePath = inApp ? '/app/analyze' : '/';
  const homeActive = inApp && (pathname === '/app/' || pathname === '/app');
  const analyzeActive = pathname === '/app/analyze' || pathname === '/';

  return (
    <header className="pf-top-nav sticky top-0 z-10 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3 max-sm:px-3">
        <button className="text-left" onClick={() => onNavigate(homePath)}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pf-text-muted">PeakPrompt</p>
          <p className="text-sm font-semibold text-pf-text-primary">{inApp ? 'Prompt workspace' : 'Analyze prompts'}</p>
        </button>

        <nav className="flex items-center gap-2 text-sm">
          <button className={`rounded-md px-3 py-2 ${navButtonClass(homeActive)}`} onClick={() => onNavigate(homePath)}>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faHouse} className="text-sm" />
              Home
            </span>
          </button>
          <button className={`rounded-md px-3 py-2 ${navButtonClass(analyzeActive)}`} onClick={() => onNavigate(analyzePath)}>
            <span className="flex items-center gap-2">
              <FontAwesomeIcon icon={faSparkles} className="text-sm" />
              Analyze
            </span>
          </button>
          {inApp && (
            <>
              <button
                className={`rounded-md px-3 py-2 ${navButtonClass(pathname === '/app/history')}`}
                onClick={() => onNavigate('/app/history')}
              >
                History
              </button>
              <button
                className={`rounded-md px-3 py-2 ${navButtonClass(pathname === '/app/settings/security')}`}
                onClick={() => onNavigate('/app/settings/security')}
              >
                Security
              </button>
            </>
          )}
          <div className="pf-nav-theme-toggle ml-1 flex items-center rounded-full p-1">
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
          {user?.email && <span className="pf-nav-pill hidden px-3 py-2 text-xs sm:inline">{user.email}</span>}
          {onLogout && (
            <button className="pf-nav-button" onClick={() => void onLogout()}>
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faArrowRightFromBracket} className="text-sm" />
                Logout
              </span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
