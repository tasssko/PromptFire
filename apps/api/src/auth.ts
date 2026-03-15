import { randomBytes, randomUUID } from 'node:crypto';

interface UserRecord {
  id: string;
  email: string;
  createdAt: number;
  lastSignInAt: number;
}

interface MagicLinkTokenRecord {
  token: string;
  userId: string;
  expiresAt: number;
  usedAt?: number;
}

interface SessionRecord {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

interface PasskeyRecord {
  id: string;
  userId: string;
  label: string;
  createdAt: number;
}

const usersById = new Map<string, UserRecord>();
const usersByEmail = new Map<string, string>();
const magicTokens = new Map<string, MagicLinkTokenRecord>();
const sessionsById = new Map<string, SessionRecord>();
const passkeysById = new Map<string, PasskeyRecord>();
const passkeysByUserId = new Map<string, Set<string>>();

function nowMs(): number {
  return Date.now();
}

function findOrCreateUserByEmail(email: string): UserRecord {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUserId = usersByEmail.get(normalizedEmail);
  if (existingUserId) {
    const user = usersById.get(existingUserId);
    if (user) {
      return user;
    }
  }

  const user: UserRecord = {
    id: `usr_${randomUUID()}`,
    email: normalizedEmail,
    createdAt: nowMs(),
    lastSignInAt: nowMs(),
  };

  usersById.set(user.id, user);
  usersByEmail.set(user.email, user.id);
  return user;
}

function createSession(userId: string): SessionRecord {
  const ttlMs = Number(process.env.AUTH_SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 14);
  const session: SessionRecord = {
    id: `ses_${randomUUID()}`,
    userId,
    createdAt: nowMs(),
    expiresAt: nowMs() + ttlMs,
  };

  sessionsById.set(session.id, session);
  const user = usersById.get(userId);
  if (user) {
    user.lastSignInAt = nowMs();
    usersById.set(user.id, user);
  }

  return session;
}

function sessionIsActive(session: SessionRecord): boolean {
  return session.expiresAt > nowMs();
}

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

export function createMagicLink(email: string): { token: string } {
  const user = findOrCreateUserByEmail(email);
  const ttlMs = Number(process.env.AUTH_MAGIC_LINK_TTL_MS ?? 1000 * 60 * 15);
  const token = randomToken('mlt');
  magicTokens.set(token, {
    token,
    userId: user.id,
    expiresAt: nowMs() + ttlMs,
  });

  return { token };
}

export function verifyMagicLink(token: string): { sessionId: string; user: UserRecord } | null {
  const record = magicTokens.get(token);
  if (!record || record.usedAt || record.expiresAt <= nowMs()) {
    return null;
  }

  const user = usersById.get(record.userId);
  if (!user) {
    return null;
  }

  record.usedAt = nowMs();
  magicTokens.set(token, record);

  const session = createSession(user.id);
  return { sessionId: session.id, user };
}

export function getSessionUser(sessionId: string | undefined): UserRecord | null {
  if (!sessionId) {
    return null;
  }

  const session = sessionsById.get(sessionId);
  if (!session) {
    return null;
  }

  if (!sessionIsActive(session)) {
    sessionsById.delete(sessionId);
    return null;
  }

  return usersById.get(session.userId) ?? null;
}

export function invalidateSession(sessionId: string | undefined): void {
  if (!sessionId) {
    return;
  }
  sessionsById.delete(sessionId);
}

export function hasValidSession(sessionId: string | undefined): boolean {
  return getSessionUser(sessionId) !== null;
}

export function getUserSummary(user: UserRecord): {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string;
  passkeyCount: number;
} {
  const passkeyCount = passkeysByUserId.get(user.id)?.size ?? 0;

  return {
    id: user.id,
    email: user.email,
    createdAt: new Date(user.createdAt).toISOString(),
    lastSignInAt: new Date(user.lastSignInAt).toISOString(),
    passkeyCount,
  };
}

export function createPasskeyRegistrationOptions(userId: string): {
  challenge: string;
  rpId: string;
  userId: string;
} {
  return {
    challenge: randomToken('challenge'),
    rpId: process.env.AUTH_RP_ID ?? 'localhost',
    userId,
  };
}

export function verifyPasskeyRegistration(userId: string, credentialId: string, label?: string): { ok: true } {
  const record: PasskeyRecord = {
    id: credentialId,
    userId,
    label: label?.trim() || 'Passkey',
    createdAt: nowMs(),
  };

  passkeysById.set(record.id, record);
  const current = passkeysByUserId.get(userId) ?? new Set<string>();
  current.add(record.id);
  passkeysByUserId.set(userId, current);

  return { ok: true };
}

export function createPasskeyAuthenticationOptions(email?: string): {
  challenge: string;
  allowCredentials: string[];
} {
  let allowCredentials: string[] = [];

  if (email) {
    const userId = usersByEmail.get(email.trim().toLowerCase());
    if (userId) {
      allowCredentials = [...(passkeysByUserId.get(userId) ?? [])];
    }
  }

  return {
    challenge: randomToken('challenge'),
    allowCredentials,
  };
}

export function verifyPasskeyAuthentication(params: {
  email?: string;
  credentialId: string;
}): { sessionId: string; user: UserRecord } | null {
  const passkey = passkeysById.get(params.credentialId);
  if (!passkey) {
    return null;
  }

  const user = usersById.get(passkey.userId);
  if (!user) {
    return null;
  }

  if (params.email && user.email !== params.email.trim().toLowerCase()) {
    return null;
  }

  const session = createSession(user.id);
  return { sessionId: session.id, user };
}

export function parseSessionIdFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'pf_session';
  const parts = cookieHeader.split(';').map((part) => part.trim());

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === cookieName && value) {
      return decodeURIComponent(value);
    }
  }

  return undefined;
}

export function createSessionCookie(sessionId: string): string {
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'pf_session';
  const secure = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';

  const attributes = [
    `${cookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(Number(process.env.AUTH_SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 14) / 1000)}`,
  ];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function clearSessionCookie(): string {
  const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? 'pf_session';
  const secure = (process.env.NODE_ENV ?? '').toLowerCase() === 'production';
  const attributes = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}
