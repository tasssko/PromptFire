CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified_at" timestamptz,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "last_login_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "magic_link_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz,
  "user_agent" text,
  "ip_address" text
);

CREATE TABLE IF NOT EXISTS "passkey_credentials" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "credential_id" text NOT NULL UNIQUE,
  "public_key" text NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "transports" text,
  "device_name" text,
  "created_at" timestamptz NOT NULL,
  "last_used_at" timestamptz
);
