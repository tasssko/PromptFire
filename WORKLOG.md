# WORKLOG

## 2026-03-17: Semantic Decision Core spec added

### Summary
Added the new architecture spec:

- `specs/semantic-decision-core-v0.6.0.md`
- `specs/semantic-decision-core-migration-plan-v0.6.0.md`

### Why this matters
This introduces a semantic-first direction for prompt analysis. The intended shift is from score-first recommendation with late rescue logic to an internal decision pipeline based on task class, context inventory, and decision state.

### Immediate repo impact
- The main spec now points to a real follow-on migration-plan file instead of a dangling path.
- The migration plan captures a phased implementation path without changing the current API or UI contract yet.

### Next implementation targets
1. Define the semantic decision core internal types.
2. Add deterministic semantic inventory extraction.
3. Move recommendation logic ahead of score projection.

## 2026-03-16: Postgres migration issue on a different machine

### Summary
Running `pnpm --filter @promptfire/db db:migrate` failed with:

`Can't find meta/_journal.json file`

As a workaround, the SQL migration file was applied directly:

- `packages/db/drizzle/0000_auth_init.sql`

Postgres verification confirmed these tables were created:

- `users`
- `sessions`
- `magic_link_tokens`
- `passkey_credentials`

### Why this happened
`drizzle-kit migrate` expects a migration journal at:

- `packages/db/drizzle/meta/_journal.json`

In this repository, `packages/db/drizzle` currently contains only `0000_auth_init.sql` and no `meta` directory. On a machine that already had locally generated Drizzle metadata, migration might have worked. On a fresh machine, it fails because the required journal file is missing.

### Impact
- Automated migration command fails on clean environments.
- Team members must apply SQL manually unless metadata is fixed.
- Onboarding and CI reliability are reduced.

### Immediate workaround used
Apply the migration SQL directly in Postgres:

```bash
psql "$DATABASE_URL" -f packages/db/drizzle/0000_auth_init.sql
```

### Recommended fix
Use one migration strategy consistently and commit all required files.

Option A (keep `drizzle-kit migrate`):
- Generate/repair Drizzle metadata so `packages/db/drizzle/meta/_journal.json` exists.
- Commit the `meta` directory alongside migration SQL files.

Option B (SQL-first flow):
- Treat SQL files as the source of truth.
- Replace `db:migrate` script with a SQL runner (or document manual `psql -f` usage).

### Action items
1. Decide whether the team uses Drizzle journal migrations or SQL-first migrations.
2. Update `packages/db/package.json` scripts to match that decision.
3. Add a short setup section in docs for fresh machine DB bootstrapping.
4. Add a CI check that validates migration files are complete for the selected workflow.
