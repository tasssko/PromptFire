import type { Mode, RewritePreference, Role } from '@promptfire/shared';
import type { FormEvent } from 'react';

type TopShellProps = {
  prompt: string;
  role: Role;
  mode: Mode;
  rewritePreference: RewritePreference;
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
  onLoadGeneral: () => void;
  onLoadMarketer: () => void;
  onLoadDeveloper: () => void;
};

export function TopShell({
  prompt,
  role,
  mode,
  rewritePreference,
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
  onLoadGeneral,
  onLoadMarketer,
  onLoadDeveloper,
}: TopShellProps) {
  return (
    <section className="grid gap-4 rounded-xl border border-pf-border-subtle bg-shell p-6 shadow-none max-sm:p-4">
      <header className="grid gap-2">
        <h1 className="text-[clamp(1.5rem,2vw,1.8rem)] font-bold">PeakPrompt</h1>
        <p className="text-pf-text-secondary">
          Paste a prompt, get one clear score, and only see rewrites when they are worth using.
        </p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid w-full gap-1 font-semibold">
          Prompt
          <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} rows={7} />
        </label>

        <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-sm:grid-cols-1">
          <label className="grid w-auto gap-1 font-semibold">
            Role
            <select value={role} onChange={(e) => onRoleChange(e.target.value as Role)}>
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid w-auto gap-1 font-semibold">
            Mode
            <select value={mode} onChange={(e) => onModeChange(e.target.value as Mode)}>
              {modes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid w-auto gap-1 font-semibold">
            Rewrite preference
            <select
              value={rewritePreference}
              onChange={(e) => onRewritePreferenceChange(e.target.value as RewritePreference)}
            >
              <option value="auto">auto</option>
              <option value="force">force</option>
              <option value="suppress">suppress</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button type="submit" disabled={!canSubmit}>
            {loading ? 'Analyzing…' : 'Analyze prompt'}
          </button>
        </div>

        <details className="border-t border-pf-border-divider pt-3">
          <summary className="cursor-pointer text-[#3f5066]">Load example</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onLoadGeneral}>
              General
            </button>
            <button type="button" onClick={onLoadMarketer}>
              Marketer
            </button>
            <button type="button" onClick={onLoadDeveloper}>
              Developer
            </button>
          </div>
        </details>
      </form>

      {error && <p className="text-[#b00020]">{error}</p>}
    </section>
  );
}
