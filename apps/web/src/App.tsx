import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AccountHomeResponse,
  AnalyzeAndRewriteV2Response,
  AuthUser,
  Mode,
  PromptRunDetail,
  PromptRunListItem,
  PromptRunRewrite,
  RewritePreference,
  Role,
  SessionResponse,
} from '@promptfire/shared';
import { fixtures, modes, roles } from './config';
import {
  LoadingCard,
  ResultsCard,
  TopShell,
  panelForState,
  resolveResultsPresentation,
  resolveSuccessState,
  type AnalysisUiState,
} from './components/results';
import { applyTheme, resolveInitialTheme, type ThemeMode } from './theme';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

interface RouteState {
  pathname: string;
  search: string;
}

interface SessionState {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
}

interface PasskeyAuthenticateOptionsResponse {
  ok: true;
  challenge: string;
  allowCredentials: string[];
}

interface PasskeyRegisterOptionsResponse {
  ok: true;
  challenge: string;
  rpId: string;
  userId: string;
}

type LoginUiState =
  | 'idle'
  | 'email_validation_error'
  | 'sending_magic_link'
  | 'magic_link_sent'
  | 'passkey_in_progress'
  | 'passkey_failed'
  | 'generic_error'
  | 'already_authenticated';

type CallbackUiState = 'verifying' | 'expired' | 'invalid' | 'already_used' | 'generic_failure' | 'redirecting';

function readRouteState(): RouteState {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

function textToBuffer(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function safeObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function scoreBandClass(scoreBand: PromptRunListItem['scoreBand']): string {
  if (scoreBand === 'excellent' || scoreBand === 'strong') {
    return 'bg-emerald-100 text-emerald-900';
  }
  if (scoreBand === 'usable') {
    return 'bg-amber-100 text-amber-900';
  }
  if (scoreBand === 'weak' || scoreBand === 'poor') {
    return 'bg-rose-100 text-rose-900';
  }
  return 'bg-slate-100 text-slate-700';
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absSeconds < 60) {
    return formatter.format(diffSeconds, 'second');
  }
  if (absSeconds < 3600) {
    return formatter.format(Math.round(diffSeconds / 60), 'minute');
  }
  if (absSeconds < 86400) {
    return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  }
  return formatter.format(Math.round(diffSeconds / 86400), 'day');
}

function formatFullDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

async function parseError(response: Response): Promise<{ message: string; details?: Record<string, unknown> }> {
  try {
    const payload = await response.json();
    const fallback = response.status >= 500 ? 'Server error.' : 'Request failed.';
    const message = payload?.error?.message ?? fallback;
    const details = payload?.error?.details;
    return {
      message,
      details: details && typeof details === 'object' ? (details as Record<string, unknown>) : undefined,
    };
  } catch {
    return {
      message: response.status >= 500 ? 'Server error.' : 'Request failed.',
    };
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
  });

  if (!response.ok) {
    const parsed = await parseError(response);
    throw new Error(parsed.message);
  }

  return (await response.json()) as T;
}

async function getSession(): Promise<SessionState> {
  const payload = await apiFetch<SessionResponse>('/v1/auth/session');
  return {
    loading: false,
    authenticated: payload.authenticated,
    user: payload.authenticated ? payload.user ?? null : null,
  };
}

async function beginPasskeyAuthentication(email?: string): Promise<string | null> {
  const normalized = email && isValidEmail(email) ? normalizeEmail(email) : undefined;
  const options = await apiFetch<PasskeyAuthenticateOptionsResponse>('/v1/auth/passkey/authenticate/options', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(normalized ? { email: normalized } : {}),
  });

  if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials?.get) {
    try {
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: textToBuffer(options.challenge),
          allowCredentials: options.allowCredentials.map((credentialId) => ({
            id: textToBuffer(credentialId),
            type: 'public-key',
          })),
          timeout: 60000,
          userVerification: 'preferred',
        },
      })) as PublicKeyCredential | null;

      if (credential?.id) {
        return credential.id;
      }
    } catch {
      // Fallback to server-issued credential IDs in local/testing mode.
    }
  }

  return options.allowCredentials[0] ?? null;
}

async function registerPasskeyForUser(user: AuthUser): Promise<void> {
  const options = await apiFetch<PasskeyRegisterOptionsResponse>('/v1/auth/passkey/register/options', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });

  if (!window.PublicKeyCredential || !navigator.credentials?.create) {
    throw new Error('Passkeys are not supported in this browser.');
  }

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: textToBuffer(options.challenge),
      rp: {
        name: 'PromptFire',
        id: options.rpId,
      },
      user: {
        id: textToBuffer(options.userId),
        name: user.email,
        displayName: user.email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential?.id) {
    throw new Error('Passkey registration did not complete.');
  }

  await apiFetch('/v1/auth/passkey/register/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      credentialId: credential.id,
      label: 'This device',
    }),
  });
}

function AppTopBar(props: {
  user: AuthUser;
  pathname: string;
  onNavigate: (to: string) => void;
  onLogout: () => Promise<void>;
}) {
  const { user, pathname, onNavigate, onLogout } = props;
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3 max-sm:px-3">
        <button className="text-left" onClick={() => onNavigate('/app/')}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PromptFire</p>
          <p className="text-sm font-semibold text-slate-900">Prompt workspace</p>
        </button>
        <nav className="flex items-center gap-2 text-sm">
          <button
            className={`rounded-md px-3 py-2 ${pathname === '/app/' || pathname === '/app' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            onClick={() => onNavigate('/app/')}
          >
            Home
          </button>
          <button
            className={`rounded-md px-3 py-2 ${pathname === '/app/history' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            onClick={() => onNavigate('/app/history')}
          >
            History
          </button>
          <button
            className={`rounded-md px-3 py-2 ${pathname === '/app/settings/security' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
            onClick={() => onNavigate('/app/settings/security')}
          >
            Security
          </button>
          <span className="hidden rounded-full bg-slate-100 px-3 py-2 text-xs text-slate-700 sm:inline">{user.email}</span>
          <button className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" disabled={loggingOut} onClick={handleLogout}>
            {loggingOut ? 'Signing out...' : 'Logout'}
          </button>
        </nav>
      </div>
    </header>
  );
}

function HistoryList(props: {
  title: string;
  subtitle?: string;
  runs: PromptRunListItem[];
  onOpenRun: (runId: string) => void;
  emptyCtaLabel: string;
  onEmptyCtaClick: () => void;
}) {
  const { title, subtitle, runs, onOpenRun, emptyCtaLabel, onEmptyCtaClick } = props;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="text-sm text-slate-700">Your prompt history appears after the first analysis run.</p>
          <button className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={onEmptyCtaClick}>
            {emptyCtaLabel}
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {runs.map((run) => (
            <article key={run.id} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{formatRelativeDate(run.createdAt)}</span>
                <span aria-hidden="true">•</span>
                <span>{formatFullDate(run.createdAt)}</span>
                <span aria-hidden="true">•</span>
                <span>{run.role}</span>
                <span>/</span>
                <span>{run.mode}</span>
                {run.scoreBand && <span className={`rounded-full px-2 py-0.5 font-semibold ${scoreBandClass(run.scoreBand)}`}>{run.scoreBand}</span>}
              </div>
              <p className="pf-clamp-3 text-sm text-slate-900">{run.originalPrompt}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {run.overallScore !== null && <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Score {run.overallScore}</span>}
                {run.rewriteRecommendation && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{run.rewriteRecommendation.replaceAll('_', ' ')}</span>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{run.hasRewrite ? 'Has rewrite' : 'No rewrite saved'}</span>
              </div>
              <button className="mt-3 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" onClick={() => onOpenRun(run.id)}>
                Open run
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HomePage(props: {
  user: AuthUser;
  onNavigate: (to: string) => void;
  onSessionRefresh: () => Promise<void>;
}) {
  const { user, onNavigate, onSessionRefresh } = props;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<PromptRunListItem[]>([]);
  const [passkeyState, setPasskeyState] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);

  const fetchHome = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<AccountHomeResponse>('/v1/account/home');
      setRuns(payload.recentRuns);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load account home.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHome();
  }, [fetchHome]);

  async function handleAddPasskey() {
    setPasskeyState('working');
    setPasskeyMessage(null);
    try {
      await registerPasskeyForUser(user);
      await onSessionRefresh();
      setPasskeyState('success');
      setPasskeyMessage('Passkey added. You can now sign in faster next time.');
    } catch (registerError) {
      setPasskeyState('error');
      setPasskeyMessage(registerError instanceof Error ? registerError.message : 'Passkey registration failed.');
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-6 py-6 max-sm:px-3">
      <section className="rounded-xl bg-slate-900 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">PromptFire</p>
        <h1 className="mt-2 text-2xl font-semibold">Your prompt workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-200">
          Reopen recent runs, keep momentum on score improvements, and start a new analysis when you are ready.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900" onClick={() => (window.location.href = '/')}>
            Analyze a new prompt
          </button>
          <button className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/history')}>
            View full history
          </button>
        </div>
      </section>

      {user.passkeyCount === 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Add a passkey (optional)</h2>
          <p className="mt-1 text-sm text-slate-600">Keep email-first sign-in and add a passkey as a faster accelerator.</p>
          <button
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleAddPasskey}
            disabled={passkeyState === 'working'}
          >
            {passkeyState === 'working' ? 'Adding passkey...' : 'Add passkey'}
          </button>
          {passkeyMessage && <p className={`mt-2 text-sm ${passkeyState === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{passkeyMessage}</p>}
        </section>
      )}

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Loading recent history...</p>
        </section>
      ) : error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-700">{error}</p>
          <button className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void fetchHome()}>
            Retry
          </button>
        </section>
      ) : (
        <HistoryList
          title="Recent prompt history"
          subtitle="Runs are sorted newest first."
          runs={runs}
          onOpenRun={(runId) => onNavigate(`/app/history/${runId}`)}
          emptyCtaLabel="Analyze your first prompt"
          onEmptyCtaClick={() => (window.location.href = '/')}
        />
      )}
    </div>
  );
}

function HistoryPage(props: { onNavigate: (to: string) => void }) {
  const { onNavigate } = props;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<PromptRunListItem[]>([]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{ ok: true; runs: PromptRunListItem[] }>('/v1/prompt-runs?limit=100');
      setRuns(payload.runs);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-6 py-6 max-sm:px-3">
      <section className="rounded-xl bg-slate-900 p-6 text-white shadow-md">
        <h1 className="text-2xl font-semibold">Prompt history</h1>
        <p className="mt-1 text-sm text-slate-200">Runs are persisted by analysis invocation, not as a saved prompt library.</p>
      </section>

      {loading ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Loading history...</p>
        </section>
      ) : error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-700">{error}</p>
          <button className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void fetchHistory()}>
            Retry
          </button>
        </section>
      ) : (
        <HistoryList
          title="All runs"
          runs={runs}
          onOpenRun={(runId) => onNavigate(`/app/history/${runId}`)}
          emptyCtaLabel="Analyze your first prompt"
          onEmptyCtaClick={() => (window.location.href = '/')}
        />
      )}
    </div>
  );
}

function RewriteCard(props: { rewrite: PromptRunRewrite }) {
  const { rewrite } = props;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
        <span>{rewrite.isPrimary ? 'Primary rewrite' : `Rewrite ${rewrite.position + 1}`}</span>
        <span aria-hidden="true">•</span>
        <span>{rewrite.role}</span>
        <span>/</span>
        <span>{rewrite.mode}</span>
      </div>
      <pre>{rewrite.rewrittenPrompt}</pre>
      {rewrite.explanation && <p className="mt-3 text-sm text-slate-700">{rewrite.explanation}</p>}
      {Array.isArray(rewrite.changes) && rewrite.changes.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {rewrite.changes.map((change, index) => (
            <li key={`${rewrite.id}-change-${index}`}>{change}</li>
          ))}
        </ul>
      )}
      {Boolean(rewrite.evaluationData) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Evaluation data</summary>
          <pre className="mt-2">{JSON.stringify(rewrite.evaluationData, null, 2)}</pre>
        </details>
      )}
    </article>
  );
}

function RunDetailPage(props: { runId: string; onNavigate: (to: string) => void }) {
  const { runId, onNavigate } = props;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<PromptRunDetail | null>(null);

  const fetchRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{ ok: true; run: PromptRunDetail }>(`/v1/prompt-runs/${encodeURIComponent(runId)}`);
      setRun(payload.run);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load run.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    void fetchRun();
  }, [fetchRun]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6 max-sm:px-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Loading run...</p>
        </section>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6 max-sm:px-3">
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-700">{error ?? 'Run not found.'}</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/history')}>
              Back to history
            </button>
            <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => void fetchRun()}>
              Retry
            </button>
          </div>
        </section>
      </div>
    );
  }

  const responseData = safeObject(run.responseData);
  const evaluation = safeObject(responseData?.evaluation);

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-6 py-6 max-sm:px-3">
      <button className="w-fit rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => onNavigate('/app/history')}>
        Back to history
      </button>

      <section className="rounded-xl bg-slate-900 p-6 text-white shadow-md">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Run detail</p>
        <h1 className="mt-2 text-2xl font-semibold">Score-first review</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {run.overallScore !== null && <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">Overall score {run.overallScore}</span>}
          {run.scoreBand && <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">{run.scoreBand}</span>}
          {run.rewriteRecommendation && (
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">{run.rewriteRecommendation.replaceAll('_', ' ')}</span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Run metadata</h2>
        <div className="mt-2 grid gap-1 text-sm text-slate-700">
          <p>
            <span className="font-semibold">Created:</span> {formatFullDate(run.createdAt)}
          </p>
          <p>
            <span className="font-semibold">Role / mode:</span> {run.role} / {run.mode}
          </p>
          <p>
            <span className="font-semibold">Endpoint:</span> {run.endpoint}
          </p>
          {run.requestId && (
            <p>
              <span className="font-semibold">Request ID:</span> {run.requestId}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Original prompt</h2>
        <pre className="mt-3">{run.originalPrompt}</pre>
      </section>

      {evaluation && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Evaluation</h2>
          <pre className="mt-3">{JSON.stringify(evaluation, null, 2)}</pre>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Rewrites</h2>
        {run.rewrites.length > 0 ? (
          run.rewrites.map((rewrite) => <RewriteCard key={rewrite.id} rewrite={rewrite} />)
        ) : (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-700">No rewrite was persisted for this run.</p>
          </article>
        )}
      </section>
    </div>
  );
}

function SecuritySettingsPage(props: {
  user: AuthUser;
  onSessionRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const { user, onSessionRefresh, onLogout } = props;
  const [state, setState] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleAddPasskey() {
    setState('working');
    setMessage(null);
    try {
      await registerPasskeyForUser(user);
      await onSessionRefresh();
      setState('success');
      setMessage('Passkey added.');
    } catch (registerError) {
      setState('error');
      setMessage(registerError instanceof Error ? registerError.message : 'Passkey registration failed.');
    }
  }

  async function handleLogout() {
    await onLogout();
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-6 py-6 max-sm:px-3">
      <section className="rounded-xl bg-slate-900 p-6 text-white shadow-md">
        <h1 className="text-2xl font-semibold">Security settings</h1>
        <p className="mt-1 text-sm text-slate-200">Minimal account security controls for passwordless access.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Signed-in email</h2>
        <p className="mt-2 text-sm text-slate-700">{user.email}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Passkey status</h2>
        <p className="mt-2 text-sm text-slate-700">{user.passkeyCount > 0 ? 'Passkey configured' : 'No passkey configured yet'}</p>
        {user.passkeyCount === 0 && (
          <button
            className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={state === 'working'}
            onClick={handleAddPasskey}
          >
            {state === 'working' ? 'Adding passkey...' : 'Add passkey'}
          </button>
        )}
        {message && <p className={`mt-2 text-sm ${state === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{message}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => void handleLogout()}>
          Logout
        </button>
      </section>
    </div>
  );
}

function LoginPage(props: {
  session: SessionState;
  onNavigate: (to: string, replace?: boolean) => void;
  onSessionRefresh: () => Promise<void>;
}) {
  const { session, onNavigate, onSessionRefresh } = props;
  const [email, setEmail] = useState('');
  const [uiState, setUiState] = useState<LoginUiState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session.authenticated) {
      setUiState('already_authenticated');
      onNavigate('/app/', true);
    }
  }, [session.authenticated, onNavigate]);

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeEmail(email);

    if (!isValidEmail(normalized)) {
      setUiState('email_validation_error');
      setMessage('Enter a valid email address.');
      return;
    }

    setUiState('sending_magic_link');
    setMessage(null);

    try {
      await apiFetch('/v1/auth/magic-link/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      });
      setUiState('magic_link_sent');
      setMessage('Check your inbox. If the address can sign in, we sent a secure magic link.');
    } catch (requestError) {
      setUiState('generic_error');
      setMessage(requestError instanceof Error ? requestError.message : 'Failed to send magic link.');
    }
  }

  async function handlePasskeySignIn() {
    setUiState('passkey_in_progress');
    setMessage(null);

    try {
      const credentialId = await beginPasskeyAuthentication(email);
      if (!credentialId) {
        throw new Error('Passkey sign-in did not complete. Try again or use email instead.');
      }

      const normalized = isValidEmail(email) ? normalizeEmail(email) : undefined;
      await apiFetch('/v1/auth/passkey/authenticate/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          ...(normalized ? { email: normalized } : {}),
        }),
      });

      await onSessionRefresh();
      onNavigate('/app/', true);
    } catch (authError) {
      setUiState('passkey_failed');
      setMessage(authError instanceof Error ? authError.message : 'Passkey sign-in failed.');
    }
  }

  const isBusy = uiState === 'sending_magic_link' || uiState === 'passkey_in_progress';

  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-10">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PromptFire</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in to PromptFire</h1>
        <p className="mt-2 text-sm text-slate-600">Use email for a sign-in link, or passkey if you already set one up.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3" onSubmit={(event) => void handleEmailSubmit(event)}>
          <label className="text-sm font-semibold text-slate-700" htmlFor="email-input">
            Email
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (uiState !== 'idle') {
                setUiState('idle');
                setMessage(null);
              }
            }}
            placeholder="you@company.com"
            autoComplete="email"
            className="rounded-md px-3 py-2"
            disabled={isBusy}
          />
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isBusy}>
            {uiState === 'sending_magic_link' ? 'Sending link...' : 'Email me a sign-in link'}
          </button>
        </form>

        <div className="my-4 border-t border-slate-200" />

        <button
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void handlePasskeySignIn()}
          disabled={isBusy}
        >
          {uiState === 'passkey_in_progress' ? 'Checking passkey...' : 'Use a passkey instead'}
        </button>

        {message && (
          <p
            className={`mt-3 text-sm ${
              uiState === 'email_validation_error' || uiState === 'passkey_failed' || uiState === 'generic_error'
                ? 'text-rose-700'
                : 'text-emerald-700'
            }`}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

function AuthCallbackPage(props: { onNavigate: (to: string, replace?: boolean) => void }) {
  const { onNavigate } = props;
  const [state, setState] = useState<CallbackUiState>('verifying');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const url = new URL(window.location.href);
      const token = url.searchParams.get('token');
      const stateToken = url.searchParams.get('state');

      if (!token) {
        setState('invalid');
        return;
      }

      try {
        const verifyUrl = new URL(`${API_BASE_URL}/v1/auth/magic-link/verify`);
        verifyUrl.searchParams.set('token', token);
        if (stateToken) {
          verifyUrl.searchParams.set('state', stateToken);
        }

        const response = await fetch(verifyUrl.toString(), {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          const parsed = await parseError(response);
          const reason = parsed.details?.reason;
          if (reason === 'expired') {
            setState('expired');
          } else if (reason === 'already_used') {
            setState('already_used');
          } else if (reason === 'invalid') {
            setState('invalid');
          } else {
            setState('generic_failure');
          }
          return;
        }

        if (!cancelled) {
          setState('redirecting');
          window.setTimeout(() => onNavigate('/app/', true), 350);
        }
      } catch {
        setState('generic_failure');
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [onNavigate]);

  return (
    <main className="mx-auto grid max-w-md gap-4 px-4 py-10">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {state === 'verifying' && <p className="text-sm text-slate-700">Verifying your sign-in link...</p>}
        {state === 'redirecting' && <p className="text-sm text-emerald-700">Sign-in complete. Redirecting to your workspace...</p>}

        {state === 'expired' && (
          <div className="grid gap-3">
            <p className="text-sm text-rose-700">This sign-in link has expired.</p>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/login', true)}>
              Request a new sign-in link
            </button>
          </div>
        )}

        {state === 'already_used' && (
          <div className="grid gap-3">
            <p className="text-sm text-rose-700">This sign-in link has already been used.</p>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/login', true)}>
              Request a new sign-in link
            </button>
          </div>
        )}

        {state === 'invalid' && (
          <div className="grid gap-3">
            <p className="text-sm text-rose-700">This sign-in link is invalid.</p>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/login', true)}>
              Back to login
            </button>
          </div>
        )}

        {state === 'generic_failure' && (
          <div className="grid gap-3">
            <p className="text-sm text-rose-700">Sign-in could not be completed.</p>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/login', true)}>
              Back to login
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

function AuthenticatedApp(props: {
  route: RouteState;
  session: SessionState;
  onNavigate: (to: string, replace?: boolean) => void;
  onSessionRefresh: () => Promise<void>;
}) {
  const { route, session, onNavigate, onSessionRefresh } = props;

  const logout = useCallback(async () => {
    await apiFetch('/v1/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    await onSessionRefresh();
    onNavigate('/app/login', true);
  }, [onNavigate, onSessionRefresh]);

  if (route.pathname === '/app/login') {
    return <LoginPage session={session} onNavigate={onNavigate} onSessionRefresh={onSessionRefresh} />;
  }

  if (route.pathname === '/app/auth/callback') {
    return <AuthCallbackPage onNavigate={onNavigate} />;
  }

  if (session.loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-700">Loading session...</p>
        </section>
      </main>
    );
  }

  if (!session.authenticated || !session.user) {
    window.setTimeout(() => onNavigate('/app/login', true), 0);
    return null;
  }

  const runDetailMatch = route.pathname.match(/^\/app\/history\/([^/]+)$/);

  return (
    <div>
      <AppTopBar user={session.user} pathname={route.pathname} onNavigate={(to) => onNavigate(to)} onLogout={logout} />
      {(route.pathname === '/app/' || route.pathname === '/app') && (
        <HomePage user={session.user} onNavigate={(to) => onNavigate(to)} onSessionRefresh={onSessionRefresh} />
      )}
      {route.pathname === '/app/history' && <HistoryPage onNavigate={(to) => onNavigate(to)} />}
      {runDetailMatch && <RunDetailPage runId={decodeURIComponent(runDetailMatch[1] ?? '')} onNavigate={(to) => onNavigate(to)} />}
      {route.pathname === '/app/settings/security' && (
        <SecuritySettingsPage user={session.user} onSessionRefresh={onSessionRefresh} onLogout={logout} />
      )}
      {!runDetailMatch &&
        route.pathname !== '/app/' &&
        route.pathname !== '/app' &&
        route.pathname !== '/app/history' &&
        route.pathname !== '/app/settings/security' && (
          <main className="mx-auto max-w-3xl px-4 py-10">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-700">Page not found.</p>
              <button className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => onNavigate('/app/', true)}>
                Go to account home
              </button>
            </section>
          </main>
        )}
    </div>
  );
}

function AnalyzerWorkspace() {
  const [prompt, setPrompt] = useState(fixtures.general);
  const [role, setRole] = useState<Role>('general');
  const [mode, setMode] = useState<Mode>('balanced');
  const [rewritePreference, setRewritePreference] = useState<RewritePreference>('auto');
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());
  const [loading, setLoading] = useState(false);
  const [uiState, setUiState] = useState<AnalysisUiState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeAndRewriteV2Response | null>(null);
  const [showOptionalRewrite, setShowOptionalRewrite] = useState(false);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !loading, [prompt, loading]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  async function submitAnalysis(preferenceOverride?: RewritePreference) {
    setLoading(true);
    setUiState('loading-local');
    setResult(null);
    setError(null);
    const inferenceStageTimer = globalThis.setTimeout(() => {
      setUiState((value) => (value === 'loading-local' ? 'loading-inference' : value));
    }, 900);

    try {
      const response = await fetch(`${API_BASE_URL}/v2/analyze-and-rewrite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          role,
          mode,
          rewritePreference: preferenceOverride ?? rewritePreference,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(payload?.error?.message ?? 'Request failed.');
        setUiState('error');
      } else {
        setResult(payload);
        setShowOptionalRewrite(false);
        setUiState(resolveSuccessState(payload));
      }
    } catch {
      setResult(null);
      setError('Network error while calling API.');
      setUiState('error');
    } finally {
      clearTimeout(inferenceStageTimer);
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await submitAnalysis();
  }

  async function handleForceRewrite() {
    setRewritePreference('force');
    await submitAnalysis('force');
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value);
  }

  const presentation = result ? resolveResultsPresentation(result, role) : null;
  const topSuggestions = result ? result.improvementSuggestions.slice(0, 3) : [];
  const panel = panelForState(uiState, Boolean(result && presentation));

  return (
    <main className="mx-auto grid max-w-[980px] gap-4 p-6 text-pf-text-primary max-sm:p-3">
      <TopShell
        prompt={prompt}
        role={role}
        mode={mode}
        rewritePreference={rewritePreference}
        theme={theme}
        roles={roles}
        modes={modes}
        loading={loading}
        canSubmit={canSubmit}
        error={error}
        onSubmit={handleSubmit}
        onPromptChange={setPrompt}
        onRoleChange={setRole}
        onModeChange={setMode}
        onRewritePreferenceChange={setRewritePreference}
        onThemeChange={setTheme}
        onLoadGeneral={() => {
          setRole('general');
          setPrompt(fixtures.general);
        }}
        onLoadMarketer={() => {
          setRole('marketer');
          setPrompt(fixtures.marketer);
        }}
        onLoadDeveloper={() => {
          setRole('developer');
          setPrompt(fixtures.developer);
        }}
      />

      {panel === 'loading' && (
        <LoadingCard state={uiState === 'loading-inference' ? 'loading-inference' : 'loading-local'} />
      )}

      {panel === 'result' && result && presentation && (
        <ResultsCard
          prompt={prompt}
          result={result}
          presentation={presentation}
          topSuggestions={topSuggestions}
          showOptionalRewrite={showOptionalRewrite}
          onToggleOptionalRewrite={() => setShowOptionalRewrite((value) => !value)}
          onForceRewrite={handleForceRewrite}
          onCopyPrompt={copyText}
        />
      )}
    </main>
  );
}

export function App() {
  const [route, setRoute] = useState<RouteState>(() => readRouteState());
  const [session, setSession] = useState<SessionState>({
    loading: true,
    authenticated: false,
    user: null,
  });

  const navigate = useCallback((to: string, replace = false) => {
    const next = new URL(to, window.location.origin);
    if (replace) {
      window.history.replaceState(null, '', `${next.pathname}${next.search}`);
    } else {
      window.history.pushState(null, '', `${next.pathname}${next.search}`);
    }
    setRoute(readRouteState());
  }, []);

  const refreshSession = useCallback(async () => {
    setSession((current) => ({ ...current, loading: true }));
    try {
      const nextSession = await getSession();
      setSession(nextSession);
    } catch {
      setSession({ loading: false, authenticated: false, user: null });
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(readRouteState());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (route.pathname.startsWith('/app')) {
      void refreshSession();
    }
  }, [route.pathname, refreshSession]);

  if (route.pathname.startsWith('/app')) {
    return <AuthenticatedApp route={route} session={session} onNavigate={navigate} onSessionRefresh={refreshSession} />;
  }

  return <AnalyzerWorkspace />;
}
