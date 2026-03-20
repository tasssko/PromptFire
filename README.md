# PromptFire

PromptFire is a TypeScript monorepo for analyzing prompts, deciding whether a rewrite is warranted, and generating higher-signal rewrites with a small web app, a local/serverless API, shared contracts, deterministic heuristics, and a Postgres persistence layer.

## What lives here

- `apps/web`: Vite + React frontend for prompt analysis, auth flows, and viewing results.
- `apps/api`: HTTP API used locally via `tsx` and in AWS Lambda via SST.
- `packages/shared`: shared Zod schemas, API contracts, and TypeScript types.
- `packages/heuristics`: deterministic prompt scoring, semantic classification, rewrite gating, and recommendation logic.
- `packages/db`: Drizzle ORM schema, client, and migrations for Postgres.
- `infra`: SST stacks for deploying the API and environment-level AWS resources.

## Architecture

The main product flow is:

1. The web app sends a prompt to `POST /v2/analyze-and-rewrite`.
2. The API validates the request with shared Zod schemas.
3. Heuristics score the prompt, classify issues, decide whether a rewrite should be shown, and generate suggestions.
4. If needed, the API calls the configured rewrite provider in `mock` or `real` mode.
5. When a signed-in user is present and `DATABASE_URL` is configured, the API stores the run and any generated rewrite in Postgres.

## Monorepo commands

From the repo root:

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Useful package-specific commands:

```bash
pnpm --filter @promptfire/api dev
pnpm --filter @promptfire/web dev
pnpm --filter @promptfire/db db:migrate
pnpm --filter @promptfire/db db:generate
```

## Local development

### Prerequisites

- Node.js 22+
- `pnpm`
- Docker, if you want the local Postgres container

### 1. Start Postgres

```bash
docker compose up -d postgres
```

Default local database:

```text
postgres://promptfire:promptfire@localhost:5432/promptfire
```

### 2. Configure environment variables

Copy the examples you need:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

For local development, the most important values are:

- API:
  - `PORT=3001`
  - `API_AUTH_BYPASS=true` for unauthenticated local use
  - `REWRITE_PROVIDER_MODE=mock` for deterministic local rewrites
  - `DATABASE_URL=postgres://promptfire:promptfire@localhost:5432/promptfire`
- Web:
  - `VITE_API_BASE_URL=http://localhost:3001`

If you want real model-backed rewrites, set:

```bash
REWRITE_PROVIDER_MODE=real
REWRITE_PROVIDER_API_KEY=...
```

### 3. Apply database migrations

```bash
pnpm --filter @promptfire/db db:migrate
```

### 4. Run the apps

In separate terminals:

```bash
pnpm --filter @promptfire/api dev
pnpm --filter @promptfire/web dev
```

Default local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:3001`

## API

The API is implemented in [`apps/api/src/server.ts`](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts) and served locally by [`apps/api/src/local.ts`](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/local.ts).

### Core endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/health` | Health check with v1 metadata |
| `GET` | `/v2/health` | Health check with v2 metadata |
| `POST` | `/v1/analyze-and-rewrite` | Original analyze + rewrite response shape |
| `POST` | `/v2/analyze-and-rewrite` | Current analysis pipeline with gating, suggestions, best next move, and optional rewrite suppression |

### Auth and account endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/auth/magic-link/request` | Start email sign-in |
| `GET` | `/v1/auth/magic-link/verify` | Verify token and create session |
| `GET` | `/v1/auth/session` | Return current session state |
| `POST` | `/v1/auth/logout` | End current session |
| `GET` | `/v1/account/home` | Return account summary and recent prompt runs |
| `GET` | `/v1/prompt-runs` | List prompt history for the current user |
| `GET` | `/v1/prompt-runs/:id` | Fetch a single stored run with rewrite details |
| `POST` | `/v1/auth/passkey/register/options` | Begin passkey registration |
| `POST` | `/v1/auth/passkey/register/verify` | Complete passkey registration |
| `POST` | `/v1/auth/passkey/authenticate/options` | Begin passkey sign-in |
| `POST` | `/v1/auth/passkey/authenticate/verify` | Complete passkey sign-in |

### Request model

Shared contracts live in [`packages/shared/src/contracts.ts`](/home/tasssko/Clients/Servana/PromptFire/packages/shared/src/contracts.ts).

Important request fields:

- `prompt`: required prompt text
- `role`: one of `general`, `developer`, `marketer`
- `mode`: one of `balanced`, `tight_scope`, `high_contrast`, `low_token_cost`
- `context`: optional structured context object
- `preferences`: optional response/rewrite preferences
- `rewritePreference` on v2: `auto`, `force`, or `suppress`

Example v2 request:

```json
{
  "prompt": "Write a webhook handler.",
  "role": "developer",
  "mode": "balanced",
  "rewritePreference": "auto"
}
```

### Response model

The v2 endpoint can return:

- `overallScore` and `scoreBand`
- `analysis` with scores, issues, signals, and a summary
- `improvementSuggestions`
- `bestNextMove`
- `gating` with expected improvement and blocking-issue state
- `rewrite`, which may be `null` when the system suppresses or withholds a rewrite
- `evaluation`, when a rewrite was generated and scored
- `rewritePresentationMode`
- `guidedCompletion`
- `inferenceFallbackUsed` and `resolutionSource`
- `meta`

This matters operationally: the API is not a simple “always rewrite” endpoint. It decides when to suppress a rewrite, when to present guidance instead, and when to escalate to model-backed inference for missing context.

### Auth behavior

`/v1/analyze-and-rewrite` and `/v2/analyze-and-rewrite` allow access when either:

- `API_AUTH_BYPASS=true`, or
- the request includes a valid `Bearer` token matching `API_STATIC_KEY`, or
- the caller has a valid session cookie

For local work, `API_AUTH_BYPASS=true` is the default.

## Web

The frontend is a Vite + React app in [`apps/web`](/home/tasssko/Clients/Servana/PromptFire/apps/web). The main app entry is [`apps/web/src/App.tsx`](/home/tasssko/Clients/Servana/PromptFire/apps/web/src/App.tsx).

### What the web app does

- exposes the prompt analyzer UI
- lets the user choose a role, mode, and rewrite preference
- calls `POST /v2/analyze-and-rewrite`
- shows loading states for local analysis and inference fallback
- renders rewrite results, suggestions, and guided-completion states
- supports magic-link and passkey auth flows
- shows recent prompt runs for authenticated users

### Web configuration

The only required frontend environment variable is:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

The analyzer hook is in [`apps/web/src/components/home/usePromptAnalyzer.ts`](/home/tasssko/Clients/Servana/PromptFire/apps/web/src/components/home/usePromptAnalyzer.ts) and currently posts directly to the v2 endpoint with cookies enabled.

## DB

The database package is in [`packages/db`](/home/tasssko/Clients/Servana/PromptFire/packages/db) and uses Drizzle ORM with PostgreSQL.

### Schema overview

Defined in [`packages/db/src/schema.ts`](/home/tasssko/Clients/Servana/PromptFire/packages/db/src/schema.ts):

- `users`: user identity and timestamps
- `magic_link_tokens`: hashed email sign-in tokens
- `sessions`: browser sessions
- `passkey_credentials`: stored passkey registrations
- `prompt_runs`: persisted analyze/rewrite requests and responses
- `prompt_rewrites`: generated rewrites attached to a prompt run

### Persistence behavior

Prompt runs are stored by [`apps/api/src/persistence/promptRuns.ts`](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/persistence/promptRuns.ts).

Current behavior:

- persistence only happens when `DATABASE_URL` is configured
- persistence currently requires an authenticated user id
- the API stores the original prompt, endpoint, role, mode, scores, rewrite recommendation, raw response payload, inference metadata, and generated rewrites

Read models for account history live in [`apps/api/src/persistence/promptRunsRead.ts`](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/persistence/promptRunsRead.ts).

### Migrations

Migration files live in [`packages/db/drizzle`](/home/tasssko/Clients/Servana/PromptFire/packages/db/drizzle):

- `0000_auth_init.sql`
- `0001_prompt_runs.sql`

Drizzle config is in [`packages/db/drizzle.config.ts`](/home/tasssko/Clients/Servana/PromptFire/packages/db/drizzle.config.ts).

## Shared packages

- [`packages/shared`](/home/tasssko/Clients/Servana/PromptFire/packages/shared): contracts, Zod schemas, enums, and response types
- [`packages/heuristics`](/home/tasssko/Clients/Servana/PromptFire/packages/heuristics): deterministic scoring, pattern-fit detection, semantic decision logic, improvement suggestions, and rewrite ladder behavior

These two packages are the core reason the web and API stay aligned: the request/response contracts are shared, and most of the product logic is isolated from transport and UI code.

## Deployment notes

Infrastructure is defined with SST in [`infra/sst.config.ts`](/home/tasssko/Clients/Servana/PromptFire/infra/sst.config.ts) and [`infra/lib/promptfire-stack.ts`](/home/tasssko/Clients/Servana/PromptFire/infra/lib/promptfire-stack.ts).

Important caveat: the current SST API stack only declares routes for:

- `GET /v1/health`
- `POST /v1/analyze-and-rewrite`

The local API implementation already supports additional v2, auth, account, and prompt-run routes. If you deploy the current infra as-is, those newer routes are not yet exposed by the SST route table.

## Testing

Run the full workspace tests:

```bash
pnpm test
```

There are targeted tests across:

- API request handling and persistence
- shared contracts
- heuristics and rewrite evaluation
- web UI components and result presentation

## Current state

This repo is beyond the original starter-spec stage. The root README had not kept pace with the implementation, so this document focuses on the code that actually exists today: a v2 prompt analysis API, a React frontend that consumes it, and a Postgres-backed auth and prompt history layer.
