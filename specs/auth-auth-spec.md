# PromptFire Auth Spec v0.6

## Status

Draft

## Objective

Introduce a minimal, app-owned authentication system for PromptFire using passwordless sign-in.

This version is intentionally narrow. It adds only the infrastructure needed to support:

* user sign-in
* session management
* magic link authentication
* passkey registration and sign-in

It does **not** introduce broader account management, team/workspace permissions, billing, or prompt history persistence.

---

## Summary of decisions

### Authentication model

PromptFire will use a hybrid passwordless authentication model:

* **magic links** for universal sign-in and account bootstrap
* **passkeys** for fast repeat sign-in

### Identity ownership

Authentication is **app-owned**, not delegated to Keycloak or another external identity provider.

### Database

PromptFire will use:

* **local Postgres** for development
* **serverless Postgres** for hosted environments

### ORM

PromptFire will use **Drizzle ORM** for schema definition, migrations, and database access.

### Scope boundary

This spec covers **auth only**.

Out of scope for this version:

* team/workspace model
* role hierarchy beyond a minimal internal flag if needed
* billing or subscriptions
* saved prompt history
* external SSO / enterprise identity
* password-based login
* SMS-based auth

---

## Goals

* Add real user authentication without introducing password management.
* Keep implementation proportional to the current PromptFire architecture.
* Allow fast initial sign-in via email.
* Allow low-friction repeat sign-in via passkeys.
* Use a minimal schema that can grow later.
* Preserve simple local development.

## Non-goals

* Full IAM or enterprise identity.
* Organisation/group administration.
* Fine-grained authorization.
* Social login.
* OAuth/OIDC provider support.
* Sync with external directories.

---

## Product rationale

PromptFire does not currently have a user/session model. Earlier versions intentionally deferred authentication, persistence, and user accounts in order to keep the initial product surface narrow.

Now that PromptFire is moving toward real user access, a lightweight passwordless model is preferred over a full identity platform.

### Why not Keycloak right now

Keycloak would add substantial complexity:

* separate runtime and operational surface
* realm/client setup
* external login flows and theming work
* user/group/role administration that PromptFire does not yet need

### Why not passwords

Passwords would require:

* credential storage
* reset flows
* password policy
* password-related security work

That is unnecessary for the current product stage.

### Why magic links + passkeys

This hybrid model gives the best trade-off:

* magic links work for any user with email
* passkeys improve repeat-login UX and security
* no password flows are needed
* the app remains simple and self-contained

---

## High-level architecture

### Components

* `apps/web` — sign-in UI, logged-in app shell, auth callback handling
* `apps/api` — auth endpoints, session creation, session validation, protected API access
* `packages/db` — Drizzle schema, migrations, shared database access layer
* Postgres — local in development, serverless in hosted environments
* Email provider — sends magic link emails

### Authentication primitives

The system will use:

* one-time magic link tokens for email sign-in
* WebAuthn passkeys for passwordless authentication
* secure session cookies for authenticated app usage

### Session model

The browser app will authenticate via an **HttpOnly session cookie**.

PromptFire will not rely on storing long-lived bearer tokens in browser storage.

---

## User journeys

### 1. First sign-in via magic link

1. User visits the PromptFire login page.
2. User enters email address.
3. App calls `POST /v1/auth/magic-link/request`.
4. Backend creates or finds a user record.
5. Backend creates a one-time login token with short expiry.
6. Backend sends a magic link email.
7. User clicks the link.
8. App calls `GET /v1/auth/magic-link/verify` or equivalent callback flow.
9. Backend validates token, marks it as used, and creates a session.
10. Session cookie is set.
11. User is redirected into the app.
12. App may prompt the user to register a passkey.

### 2. Repeat sign-in via passkey

1. User visits login page.
2. User chooses passkey sign-in.
3. App requests authentication options from backend.
4. Browser performs WebAuthn authentication.
5. Backend verifies assertion.
6. Backend creates session.
7. Session cookie is set.
8. User is redirected into the app.

### 3. Passkey registration

1. User is already signed in.
2. User chooses to add a passkey.
3. App requests registration options from backend.
4. Browser performs WebAuthn registration ceremony.
5. Backend verifies attestation/registration response.
6. Credential is stored against the user.
7. User sees passkey registered successfully.

### 4. Logout

1. User clicks logout.
2. App calls `POST /v1/auth/logout`.
3. Backend invalidates or deletes the session.
4. Session cookie is cleared.
5. User returns to logged-out state.

---

## API surface

### Auth endpoints

#### `POST /v1/auth/magic-link/request`

Purpose:

* request a sign-in link for an email address

Request:

* `email`

Behavior:

* always return a generic success response
* do not reveal whether the email already exists
* create user record if using auto-provisioning
* create one-time token
* send email

Response:

* generic success message

#### `GET /v1/auth/magic-link/verify`

Purpose:

* verify magic link token and create session

Query or payload:

* token
* optional return URL/state

Behavior:

* validate token
* ensure token is not expired
* ensure token is unused
* mark token used
* create session
* set session cookie
* redirect or return session success

#### `GET /v1/auth/session`

Purpose:

* return current session/user info for the web app

Response:

* authenticated boolean
* current user summary when logged in

#### `POST /v1/auth/logout`

Purpose:

* end the current session

Behavior:

* delete or invalidate session
* clear session cookie

#### `POST /v1/auth/passkey/register/options`

Purpose:

* begin passkey registration for signed-in user

#### `POST /v1/auth/passkey/register/verify`

Purpose:

* verify passkey registration response and persist credential

#### `POST /v1/auth/passkey/authenticate/options`

Purpose:

* begin passkey authentication ceremony

#### `POST /v1/auth/passkey/authenticate/verify`

Purpose:

* verify passkey authentication response and create session

---

## Database design

## Package structure

Create a new package:

* `packages/db`

This package should contain:

* Drizzle schema definitions
* migration files
* DB client/bootstrap
* minimal repository helpers or query helpers as needed

### Initial tables

#### `users`

Fields:

* `id`
* `email` (unique, normalized)
* `email_verified_at` (nullable)
* `created_at`
* `updated_at`
* `last_login_at` (nullable)

Notes:

* email should be normalized consistently
* this is the core identity record

#### `magic_link_tokens`

Fields:

* `id`
* `user_id`
* `token_hash`
* `expires_at`
* `used_at` (nullable)
* `created_at`

Notes:

* store only a hash of the token, not the raw token
* one-time use only

#### `sessions`

Fields:

* `id`
* `user_id`
* `expires_at`
* `created_at`
* `last_seen_at` (nullable)
* optional `user_agent`
* optional `ip_address`

Notes:

* session records back the HttpOnly session cookie
* expiry policy can be tuned later

#### `passkey_credentials`

Fields:

* `id`
* `user_id`
* `credential_id` (unique)
* `public_key`
* `counter`
* `transports` (nullable)
* `device_name` (nullable)
* `created_at`
* `last_used_at` (nullable)

Notes:

* stores WebAuthn credential information
* one user may have multiple passkeys

---

## Security requirements

### Magic links

* Tokens must be single-use.
* Tokens must expire quickly.
* Raw tokens must not be stored in the database.
* Request endpoint must be rate-limited by IP and email.
* Responses must not disclose whether an email exists.
* Links should use HTTPS in hosted environments.

### Sessions

* Use HttpOnly cookies.
* Use Secure cookies in non-local environments.
* Use SameSite policy appropriate to app deployment.
* Rotate or renew session state on sign-in.
* Clear session on logout.

### Passkeys

* Passkey registration requires an authenticated session.
* Credential IDs must be unique.
* Signature counter should be tracked and validated.
* Verification must happen server-side.

### General

* Add audit-friendly logs for sign-in success/failure without logging secrets.
* Do not log raw magic link tokens.
* Do not log WebAuthn secrets or credential material unsafely.

---

## Configuration

### Required environment variables

Initial expected configuration:

* `DATABASE_URL`
* `SESSION_COOKIE_SECRET`
* `APP_BASE_URL`
* `EMAIL_FROM`
* provider-specific email credentials

Potential auth-specific configuration:

* magic link expiry duration
* session expiry duration
* passkey RP ID
* passkey RP origin/name

### Local development

For local development:

* run standard Postgres locally
* use the same Drizzle schema and migrations as hosted environments
* support local email preview/dev transport if possible
* secure-cookie rules may be relaxed locally as needed

---

## UI requirements

### Login page

The login page should present two primary options:

* Sign in with passkey
* Email me a sign-in link

### Post-magic-link experience

After a successful magic-link sign-in, PromptFire should encourage the user to add a passkey for faster future sign-in.

### Logged-in state

The app should:

* load current session on startup
* show logged-in user identity where appropriate
* support logout cleanly

### Error states

Need clear UX for:

* expired magic link
* already-used magic link
* failed passkey registration
* failed passkey authentication
* no active session

---

## Authorization

This version does not introduce a complex permission system.

For now:

* any authenticated user can access the authenticated app surface
* minimal internal admin behavior may be added later if required

Explicit role/group modeling is out of scope for this spec.

---

## Migration and rollout plan

### Phase 1 — database and session groundwork

* add `packages/db`
* add Drizzle
* create auth tables
* add DB bootstrap/config
* add session cookie infrastructure

### Phase 2 — magic link login

* implement request-link endpoint
* implement verify-link endpoint
* add email sending
* add login page and callback flow
* protect authenticated app surface

### Phase 3 — passkey support

* implement WebAuthn registration endpoints
* implement WebAuthn authentication endpoints
* add passkey registration prompt for signed-in users
* add passkey sign-in option to login page

### Phase 4 — cleanup and hardening

* tighten rate limiting
* review cookie/security settings
* add auth-related observability
* de-emphasize legacy static-key browser auth paths where appropriate

---

## Backward compatibility and transition

PromptFire currently uses a static API key / local auth bypass approach for MVP flows.

This auth spec introduces a new browser-facing session model without requiring every internal or local development path to be removed immediately.

Recommended transition:

* keep local bypass available during development while auth is introduced
* add session-based browser auth first
* later decide whether static API-key paths remain for internal/non-browser use

---

## Open questions

* What session lifetime should be used initially?
* Should magic-link verification create users automatically, or only for invited/allowed emails?
* What local dev email experience should be used?
* Should passkey registration be optional forever, or prompted more strongly after first login?
* Should authenticated users be allowed multiple passkeys from day one?

---

## Resolved decisions

* Primary product domain: `peakprompt.ai`
* Magic-link email delivery provider: Amazon SES
* Branded auth emails should be sent from the PeakPrompt domain

### Domain assumptions

Initial production assumptions:

* Primary public host: `peakprompt.ai`
* Product application base path: `https://peakprompt.ai/app/`
* Marketing site and product experience will share a single host
* Auth callbacks and magic-link URLs should be generated from the configured app base URL
* Cookie settings should be reviewed against the final path and host behavior, but the single-host setup simplifies cookie handling

Implications of the single-host approach:

* homepage can link directly into the product experience without cross-subdomain transitions
* authenticated and unauthenticated experiences can coexist on the same domain
* app routing should clearly separate marketing pages from product routes under `/app/`
* auth callback routes should also live under the app path, for example `/app/auth/callback`
* logout and post-login redirects should return users into `/app/` by default

### SES assumptions

Amazon SES will be used for:

* magic link delivery
* future verification or account-related emails if needed

Initial SES-related implementation expectations:

* verify the sending domain and required DNS records
* configure a production sender address such as `login@peakprompt.ai` or `no-reply@peakprompt.ai`
* use a separate local/dev email transport when appropriate
* keep email delivery behind a small provider abstraction so SES can be swapped later if needed

### Additional configuration

Expected configuration now includes:

* `APP_BASE_URL`
* `EMAIL_FROM`
* SES credentials / IAM-backed runtime access
* region configuration for SES if required by deployment

---

## Recommendation

Proceed with the following implementation stack:

* passwordless auth owned by PromptFire
* magic links + passkeys
* local Postgres in development
* serverless Postgres in hosted environments
* Drizzle ORM
* auth-only schema in the first implementation

This is the smallest implementation that gives PromptFire a modern, secure, and extensible authentication foundation without prematurely adopting enterprise IAM complexity.
