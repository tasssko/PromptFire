import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDb, hasDatabaseUrl, magicLinkTokens, passkeyCredentials, sessions, users } from '@promptfire/db';

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

function nowDate(): Date {
  return new Date();
}

function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('base64url')}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function findOrCreateUserByEmail(email: string): Promise<UserRecord> {
  const normalizedEmail = normalizeEmail(email);

  if (!hasDatabaseUrl()) {
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

  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: (table, operators) => operators.eq(table.email, normalizedEmail),
  });

  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      createdAt: existing.createdAt.getTime(),
      lastSignInAt: existing.lastLoginAt?.getTime() ?? existing.createdAt.getTime(),
    };
  }

  const timestamp = nowDate();
  const userId = `usr_${randomUUID()}`;
  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastLoginAt: timestamp,
  });

  return {
    id: userId,
    email: normalizedEmail,
    createdAt: timestamp.getTime(),
    lastSignInAt: timestamp.getTime(),
  };
}

async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const ttlMs = Number(process.env.AUTH_SESSION_TTL_MS ?? 1000 * 60 * 60 * 24 * 14);
  const sessionId = `ses_${randomUUID()}`;
  const expiresAt = new Date(nowMs() + ttlMs);

  if (!hasDatabaseUrl()) {
    const session: SessionRecord = {
      id: sessionId,
      userId,
      createdAt: nowMs(),
      expiresAt: expiresAt.getTime(),
    };
    sessionsById.set(session.id, session);

    const user = usersById.get(userId);
    if (user) {
      user.lastSignInAt = nowMs();
      usersById.set(user.id, user);
    }

    return { id: sessionId, expiresAt };
  }

  const db = getDb();
  const timestamp = nowDate();
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    createdAt: timestamp,
    expiresAt,
    lastSeenAt: timestamp,
  });

  await db
    .update(users)
    .set({
      lastLoginAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(users.id, userId));

  return { id: sessionId, expiresAt };
}

export async function createMagicLink(email: string): Promise<{ token: string }> {
  const user = await findOrCreateUserByEmail(email);
  const ttlMs = Number(process.env.AUTH_MAGIC_LINK_TTL_MS ?? 1000 * 60 * 15);
  const token = randomToken('mlt');

  if (!hasDatabaseUrl()) {
    magicTokens.set(token, {
      token,
      userId: user.id,
      expiresAt: nowMs() + ttlMs,
    });
    return { token };
  }

  const db = getDb();
  await db.insert(magicLinkTokens).values({
    id: `mlk_${randomUUID()}`,
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(nowMs() + ttlMs),
    createdAt: nowDate(),
  });

  return { token };
}

export async function verifyMagicLink(token: string): Promise<{ sessionId: string; user: UserRecord } | null> {
  if (!hasDatabaseUrl()) {
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

    const session = await createSession(user.id);
    return { sessionId: session.id, user };
  }

  const db = getDb();
  const tokenHash = hashToken(token);
  const record = await db.query.magicLinkTokens.findFirst({
    where: and(eq(magicLinkTokens.tokenHash, tokenHash), isNull(magicLinkTokens.usedAt), gt(magicLinkTokens.expiresAt, nowDate())),
  });

  if (!record) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, record.userId),
  });

  if (!user) {
    return null;
  }

  const updated = await db
    .update(magicLinkTokens)
    .set({ usedAt: nowDate() })
    .where(and(eq(magicLinkTokens.id, record.id), isNull(magicLinkTokens.usedAt)))
    .returning({ id: magicLinkTokens.id });

  if (updated.length === 0) {
    return null;
  }

  const session = await createSession(user.id);

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.getTime(),
      lastSignInAt: user.lastLoginAt?.getTime() ?? user.createdAt.getTime(),
    },
  };
}

export async function getSessionUser(sessionId: string | undefined): Promise<UserRecord | null> {
  if (!sessionId) {
    return null;
  }

  if (!hasDatabaseUrl()) {
    const session = sessionsById.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expiresAt <= nowMs()) {
      sessionsById.delete(sessionId);
      return null;
    }

    return usersById.get(session.userId) ?? null;
  }

  const db = getDb();
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, nowDate())),
  });

  if (!session) {
    return null;
  }

  await db
    .update(sessions)
    .set({ lastSeenAt: nowDate() })
    .where(eq(sessions.id, session.id));

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.getTime(),
    lastSignInAt: user.lastLoginAt?.getTime() ?? user.createdAt.getTime(),
  };
}

export async function invalidateSession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    return;
  }

  if (!hasDatabaseUrl()) {
    sessionsById.delete(sessionId);
    return;
  }

  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function hasValidSession(sessionId: string | undefined): Promise<boolean> {
  return (await getSessionUser(sessionId)) !== null;
}

export async function getUserSummary(user: UserRecord): Promise<{
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string;
  passkeyCount: number;
}> {
  let passkeyCount = 0;

  if (!hasDatabaseUrl()) {
    passkeyCount = passkeysByUserId.get(user.id)?.size ?? 0;
  } else {
    const db = getDb();
    const list = await db.query.passkeyCredentials.findMany({
      where: eq(passkeyCredentials.userId, user.id),
      columns: { id: true },
    });
    passkeyCount = list.length;
  }

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

export async function verifyPasskeyRegistration(
  userId: string,
  credentialId: string,
  label?: string,
): Promise<{ ok: true }> {
  if (!hasDatabaseUrl()) {
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

  const db = getDb();
  await db
    .insert(passkeyCredentials)
    .values({
      id: `pkc_${randomUUID()}`,
      userId,
      credentialId,
      publicKey: 'placeholder-public-key',
      counter: 0,
      transports: null,
      deviceName: label?.trim() || null,
      createdAt: nowDate(),
      lastUsedAt: null,
    })
    .onConflictDoNothing({ target: passkeyCredentials.credentialId });

  return { ok: true };
}

export async function createPasskeyAuthenticationOptions(email?: string): Promise<{
  challenge: string;
  allowCredentials: string[];
}> {
  if (!hasDatabaseUrl()) {
    let allowCredentials: string[] = [];

    if (email) {
      const userId = usersByEmail.get(normalizeEmail(email));
      if (userId) {
        allowCredentials = [...(passkeysByUserId.get(userId) ?? [])];
      }
    }

    return {
      challenge: randomToken('challenge'),
      allowCredentials,
    };
  }

  const db = getDb();
  let allowCredentials: string[] = [];

  if (email) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizeEmail(email)),
      columns: { id: true },
    });
    if (user) {
      const credentials = await db.query.passkeyCredentials.findMany({
        where: eq(passkeyCredentials.userId, user.id),
        columns: { credentialId: true },
      });
      allowCredentials = credentials.map((credential) => credential.credentialId);
    }
  }

  return {
    challenge: randomToken('challenge'),
    allowCredentials,
  };
}

export async function verifyPasskeyAuthentication(params: {
  email?: string;
  credentialId: string;
}): Promise<{ sessionId: string; user: UserRecord } | null> {
  if (!hasDatabaseUrl()) {
    const passkey = passkeysById.get(params.credentialId);
    if (!passkey) {
      return null;
    }

    const user = usersById.get(passkey.userId);
    if (!user) {
      return null;
    }

    if (params.email && user.email !== normalizeEmail(params.email)) {
      return null;
    }

    const session = await createSession(user.id);
    return { sessionId: session.id, user };
  }

  const db = getDb();
  const passkey = await db.query.passkeyCredentials.findFirst({
    where: eq(passkeyCredentials.credentialId, params.credentialId),
  });

  if (!passkey) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, passkey.userId),
  });

  if (!user) {
    return null;
  }

  if (params.email && user.email !== normalizeEmail(params.email)) {
    return null;
  }

  await db
    .update(passkeyCredentials)
    .set({ lastUsedAt: nowDate() })
    .where(eq(passkeyCredentials.id, passkey.id));

  const session = await createSession(user.id);

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.getTime(),
      lastSignInAt: user.lastLoginAt?.getTime() ?? user.createdAt.getTime(),
    },
  };
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
