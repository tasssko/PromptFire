import type { Mode, RewritePreference, Role } from '@promptfire/shared';
import type { FormEvent } from 'react';
import type { ThemeMode } from '../../theme';

type TopShellProps = {
  prompt: string;
  role: Role;
  mode: Mode;
  rewritePreference: RewritePreference;
  theme: ThemeMode;
  roles: readonly Role[];
  modes: readonly Mode[];
  loading: boolean;
  canSubmit: boolean;
  error: string | null;
  onSubmit: (event: FormEvent) => void;
  onPromptChange: (value: string) => void;
  onRoleChange: (value: Role) => void;
  onModeChange: (value: Mode) => void;
  onRewritePreferenceChange: (value: RewritePreference) => void;
  onThemeChange: (value: ThemeMode) => void;
  onLoadGeneral: () => void;
  onLoadMarketer: () => void;
  onLoadDeveloper: () => void;
};

export function TopShell({
  prompt,
  role,
  mode,
  rewritePreference,
  theme,
  roles,
  modes,
  loading,
  canSubmit,
  error,
  onSubmit,
  onPromptChange,
  onRoleChange,
  onModeChange,
  onRewritePreferenceChange,
  onThemeChange,
  onLoadGeneral,
  onLoadMarketer,
  onLoadDeveloper,
}: TopShellProps) {
  return (
    <section className="grid gap-4 rounded-xl border border-pf-border-subtle bg-shell p-6 shadow-none max-sm:p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-2">
          <h1 className="text-[clamp(1.5rem,2vw,1.8rem)] font-bold text-pf-text-primary">PeakPrompt</h1>
          <p className="text-pf-text-secondary">
            Paste a prompt, get one clear score, and only see rewrites when they are worth using.
          </p>
        </div>

        <div className="rounded-full border border-pf-border-default bg-pf-bg-cardElevated p-1">
          <div className="flex gap-1">
            {(['light', 'dark'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={theme === option ? 'pf-button-primary !min-h-9 !px-3 !py-1' : 'pf-button-secondary !min-h-9 !px-3 !py-1'}
                onClick={() => onThemeChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>

      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid w-full gap-1 font-semibold text-pf-text-primary">
          Prompt
          <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} rows={7} disabled={loading} />
        </label>

        <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
          <label className="grid w-auto gap-1 font-semibold text-pf-text-primary">
            Role
            <select value={role} onChange={(e) => onRoleChange(e.target.value as Role)} disabled={loading}>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid w-auto gap-1 font-semibold text-pf-text-primary">
            Mode
            <select value={mode} onChange={(e) => onModeChange(e.target.value as Mode)} disabled={loading}>
              {modes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid w-auto gap-1 font-semibold text-pf-text-primary">
            Rewrite preference
            <select
              value={rewritePreference}
              onChange={(e) => onRewritePreferenceChange(e.target.value as RewritePreference)}
              disabled={loading}
            >
              <option value="auto">auto</option>
              <option value="force">force</option>
              <option value="suppress">suppress</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button type="submit" className="pf-button-primary" disabled={!canSubmit}>
            {loading ? 'Analyzing…' : 'Analyze prompt'}
          </button>
        </div>

        <details className="border-t border-pf-border-subtle pt-3">
          <summary className="cursor-pointer text-pf-text-muted">Load example</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="pf-button-secondary" onClick={onLoadGeneral} disabled={loading}>
              General
            </button>
            <button type="button" className="pf-button-secondary" onClick={onLoadMarketer} disabled={loading}>
              Marketer
            </button>
            <button type="button" className="pf-button-secondary" onClick={onLoadDeveloper} disabled={loading}>
              Developer
            </button>
          </div>
        </details>
      </form>

      {error && <p className="text-pf-status-danger-text">{error}</p>}
    </section>
  );
}
