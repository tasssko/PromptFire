import { relations } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
});

export const passkeyCredentials = pgTable('passkey_credentials', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: text('transports'),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

export const promptRuns = pgTable(
  'prompt_runs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    requestId: text('request_id'),
    endpoint: text('endpoint').notNull(),
    originalPrompt: text('original_prompt').notNull(),
    normalizedPrompt: text('normalized_prompt'),
    role: text('role').notNull(),
    mode: text('mode').notNull(),
    rewritePreference: text('rewrite_preference'),
    overallScore: integer('overall_score'),
    scoreBand: text('score_band'),
    rewriteRecommendation: text('rewrite_recommendation'),
    inferenceData: jsonb('inference_data').notNull(),
    responseData: jsonb('response_data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index('prompt_runs_user_created_at_idx').on(table.userId, table.createdAt),
    sessionCreatedAtIdx: index('prompt_runs_session_created_at_idx').on(table.sessionId, table.createdAt),
    requestIdIdx: index('prompt_runs_request_id_idx').on(table.requestId),
  }),
);

export const promptRewrites = pgTable(
  'prompt_rewrites',
  {
    id: text('id').primaryKey(),
    promptRunId: text('prompt_run_id')
      .notNull()
      .references(() => promptRuns.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    position: integer('position').notNull(),
    role: text('role').notNull(),
    mode: text('mode').notNull(),
    rewrittenPrompt: text('rewritten_prompt').notNull(),
    explanation: text('explanation'),
    changes: jsonb('changes'),
    evaluationData: jsonb('evaluation_data'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    promptRunPositionIdx: index('prompt_rewrites_run_position_idx').on(table.promptRunId, table.position),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  magicLinkTokens: many(magicLinkTokens),
  passkeys: many(passkeyCredentials),
  promptRuns: many(promptRuns),
}));

export const sessionsRelations = relations(sessions, ({ many, one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  promptRuns: many(promptRuns),
}));

export const magicLinkTokensRelations = relations(magicLinkTokens, ({ one }) => ({
  user: one(users, {
    fields: [magicLinkTokens.userId],
    references: [users.id],
  }),
}));

export const passkeyCredentialsRelations = relations(passkeyCredentials, ({ one }) => ({
  user: one(users, {
    fields: [passkeyCredentials.userId],
    references: [users.id],
  }),
}));

export const promptRunsRelations = relations(promptRuns, ({ many, one }) => ({
  user: one(users, {
    fields: [promptRuns.userId],
    references: [users.id],
  }),
  session: one(sessions, {
    fields: [promptRuns.sessionId],
    references: [sessions.id],
  }),
  rewrites: many(promptRewrites),
}));

export const promptRewritesRelations = relations(promptRewrites, ({ one }) => ({
  promptRun: one(promptRuns, {
    fields: [promptRewrites.promptRunId],
    references: [promptRuns.id],
  }),
}));
