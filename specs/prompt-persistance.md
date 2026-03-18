# PromptFire Prompt Persistence Spec v0.1

## Status

Draft

## Objective

Introduce minimal persistence for PromptFire prompt analysis runs so the system can store:

* the original prompt
* the run context and request shape
* the analysis and inference payload
* the generated rewrite outputs
* the evaluation payload when present

This version is intentionally narrow. It adds only the persistence needed to support prompt history, debugging, replay, and future analytics.

It does **not** introduce:

* saved prompt libraries
* collaborative workspaces
* sharing between users
* billing or usage quotas
* team-level policy management
* public export APIs for history

---

## Summary of decisions

### Persistence model

PromptFire will persist one parent record per analysis invocation:

* `prompt_runs`

PromptFire will persist zero or more child rewrite records per run:

* `prompt_rewrites`

### Database

PromptFire will use:

* **local Postgres** for development
* **serverless Postgres** for hosted environments

### ORM

PromptFire will use **Drizzle ORM** for schema definition, migrations, and database access.

### Scope boundary

This spec covers **prompt run persistence only**.

It does not redesign scoring, rewrite generation, or auth. It stores the outputs of those systems.

---

## Product rationale

PromptFire already has a score-first analysis model and a combined analyze-and-rewrite flow. Existing specs define structured analysis, rewrite payloads, optional evaluation behavior, and rewrite gating rules. What is currently missing is durable storage of those results for authenticated users. Existing specs also explicitly left saved prompt history out of scope, which makes this a natural follow-on spec rather than a retrofit. 

Adding persistence now supports several product and engineering needs:

* user-visible prompt history
* debugging and replay of analysis results
* regression analysis across engine versions
* later analytics on rewrite usefulness
* safer iteration on semantic routing and rewrite strategies

The key design rule is:

**a persisted unit is a run, not a prompt string**

The same prompt text may produce different outcomes as scoring logic, routing, or rewrite behavior evolves. PromptFire should preserve that run history rather than collapsing records by prompt text.

---

## Goals

* Persist one durable record per analyze or analyze-and-rewrite invocation.
* Preserve the original prompt and enough request context to understand how the run happened.
* Preserve structured inference and response data without forcing every internal field into first-class columns.
* Preserve generated rewrites as separate child records.
* Allow prompt history to be tied to authenticated users.
* Keep the schema minimal and evolvable.

## Non-goals

* Full event sourcing for every internal scoring step.
* Cross-user prompt sharing.
* User-editable saved prompt collections.
* Fine-grained permissions beyond the existing authenticated-user model.
* Public history APIs beyond minimal product needs.
* Long-term warehouse or BI design.

---

## High-level model

### Parent-child model

Each PromptFire invocation that produces analysis output creates one `prompt_runs` row.

Each generated rewrite for that run creates one `prompt_rewrites` row linked by `prompt_run_id`.

This means:

* one run may have no rewrites
* one run may have one rewrite
* one run may have multiple rewrites, including alternatives
* rewrite and evaluation behavior may vary by score and preference, but the run record remains the stable parent

### Why runs, not prompts

PromptFire’s existing product model is request/response oriented. The API already treats analysis, rewrite, and evaluation as outputs of a single run, and rewrite generation may be omitted or included depending on score, gating, and preference. Persisting by run matches that existing behavior cleanly. 

---

## Data model

## Package structure

Use the existing:

* `packages/db`

This package should contain:

* Drizzle schema definitions
* migration files
* DB client/bootstrap
* minimal repository helpers or query helpers as needed

### New tables

#### `prompt_runs`

Fields:

* `id`
* `user_id` (nullable only if anonymous/local flows remain supported initially)
* `session_id` (nullable)
* `request_id` (nullable, for traceability)
* `endpoint`
* `original_prompt`
* `normalized_prompt` (nullable)
* `role`
* `mode`
* `rewrite_preference` (nullable)
* `overall_score` (nullable)
* `score_band` (nullable)
* `rewrite_recommendation` (nullable)
* `inference_data` (`jsonb`)
* `response_data` (`jsonb`)
* `created_at`
* `updated_at`

Notes:

* `user_id` should reference `users.id` when the user is authenticated.
* `session_id` may reference `sessions.id` when browser-session attribution is useful.
* `endpoint` allows future support for multiple analysis endpoints.
* `inference_data` stores the structured internal reasoning payload used by PromptFire.
* `response_data` stores the shaped API output or response-ready payload for replay/debugging.
* `normalized_prompt` is optional and should not be required for v0.1.

#### `prompt_rewrites`

Fields:

* `id`
* `prompt_run_id`
* `kind`
* `position`
* `role`
* `mode`
* `rewritten_prompt`
* `explanation` (nullable)
* `changes` (`jsonb`, nullable)
* `evaluation_data` (`jsonb`, nullable)
* `is_primary`
* `created_at`

Notes:

* `prompt_run_id` references `prompt_runs.id`.
* `kind` distinguishes the main rewrite from alternatives or future rewrite classes.
* `position` preserves ordering when alternatives are returned.
* `evaluation_data` is nullable because evaluation may be absent when rewrite is skipped or not needed.
* `is_primary` should identify the default rewrite shown to the user when more than one rewrite exists.

---

## JSON payload strategy

### `inference_data`

`inference_data` should store the structured internal payload that explains how the run was classified and scored.

Expected contents may include:

* extracted semantic tags
* route/family candidates
* matched heuristics
* penalties and boosts
* sub-score contributors
* gating inputs such as expected improvement or blocking issues
* internal decision fields such as best-next-move style outputs
* engine/schema version markers where useful

This field is intended for:

* debugging
* evaluation
* future analytics
* replay support

### `response_data`

`response_data` should store the response-oriented payload returned by the API layer or the stable subset needed to reproduce it.

Expected contents may include:

* public analysis object
* public rewrite recommendation
* public meta fields
* optional rewrite and evaluation payloads as returned to the client

### Rationale for `jsonb`

PromptFire’s analysis and rewrite behavior is still evolving. Existing specs explicitly allow internal signals that are not part of the public contract, and response shape has already evolved across versions. Using `jsonb` avoids premature schema rigidity while preserving full traceability. 

---

## Field semantics

### `endpoint`

Initial expected values:

* `/v1/analyze`
* `/v1/analyze-and-rewrite`
* `/v2/analyze-and-rewrite`

This field helps preserve compatibility as PromptFire evolves versioned endpoints.

### `kind`

Initial expected values for `prompt_rewrites.kind`:

* `primary`
* `alternative`

Optional later values:

* `tight_scope`
* `high_contrast`
* `low_token_cost`
* `manual_retry`

For v0.1, `primary` and `alternative` are sufficient.

### `position`

Ordering field for rewrites.

Rules:

* main rewrite should usually be `0`
* alternatives should increment from there
* ordering should reflect API presentation order

### `is_primary`

Boolean convenience field for fast querying.

Rules:

* at most one rewrite per run should be primary
* a run with rewrites should usually have exactly one primary row

---

## Relationships

### To `users`

If the request is authenticated, `prompt_runs.user_id` should reference the authenticated user.

This enables:

* per-user history
* future account-level export
* user-level analytics boundaries

### To `sessions`

If a browser session exists, `prompt_runs.session_id` may reference the current session.

This enables:

* better traceability
* optional device/session debugging
* future session-aware activity views

This is optional in v0.1 but recommended if easy to wire.

---

## Write behavior

### Analyze-and-rewrite flow

For each successful analyze-and-rewrite request:

1. validate request
2. run analysis
3. determine rewrite gating behavior
4. generate rewrite output when applicable
5. assemble response payload
6. persist one `prompt_runs` row
7. persist zero or more `prompt_rewrites` rows
8. return response to client

### Failure behavior

If request validation fails:

* do not persist a run row

If internal processing fails before a meaningful result exists:

* optional: do not persist
* optional later: store failed runs separately

For v0.1, failed-run persistence is out of scope.

### Atomicity

The parent run row and child rewrite rows should be written in one transaction when possible.

This prevents orphan rewrites and partial history records.

---

## Read behavior

### Initial product behavior

This spec does not require a broad history API, but it should support the likely next product needs:

* list recent runs for the current user
* read one run with its rewrites
* show original prompt, score, recommendation, and created time
* optionally reopen a historical run in the UI

### Query expectations

Common queries should include:

* recent runs by `user_id`
* one run by `id`
* rewrites by `prompt_run_id`
* runs filtered by score band or created date

Recommended indexes:

* `prompt_runs(user_id, created_at desc)`
* `prompt_runs(session_id, created_at desc)` if `session_id` is used
* `prompt_runs(request_id)` if request tracing is used
* `prompt_rewrites(prompt_run_id, position)`

---

## Versioning

PromptFire should persist enough version information to explain why two runs for similar prompts may differ.

Recommended approach:

* include version fields inside `inference_data`
* optionally duplicate high-value version fields into columns later if querying requires it

Examples:

* analysis/scoring version
* semantic engine version
* rewrite strategy version
* response schema version
* provider mode/model where relevant

For v0.1, these may remain inside `jsonb`.

---

## Privacy and security

### Stored content

This spec intentionally stores full prompt content and rewrite content because that is the product feature being added.

### Logging rule

Even though runs are persisted, PromptFire should still avoid logging full raw prompt content by default in production logs. Existing API guidance already recommends logging request and runtime metadata without unnecessarily storing sensitive prompt content in logs. Persistence is the product data store; logs should remain narrower. :contentReference[oaicite:4]{index=4}

### Access rule

Only the authenticated owner of a run should be able to access that run through product surfaces, unless future admin behavior is explicitly introduced.

### Retention

Retention policy is out of scope for v0.1.

---

## Backward compatibility and transition

Existing PromptFire behavior already supports analyze-and-rewrite without persistence. This spec adds persistence underneath that flow without changing the core scoring or rewrite rules. Existing public behavior around rewrite gating, nullable rewrite/evaluation fields, and score-first responses remains unchanged. 

Recommended transition:

* keep current response contracts stable
* add persistence as an internal implementation enhancement
* introduce user-visible history only after persistence is in place
* do not block current local/mock workflows on full history UI

---

## Migration and rollout plan

### Phase 1 — schema groundwork

* add `prompt_runs` table
* add `prompt_rewrites` table
* add foreign keys to `users` and optionally `sessions`
* add indexes for recent-user-history queries
* add migration files

### Phase 2 — API persistence wiring

* persist successful analyze-and-rewrite runs
* persist primary rewrite and alternatives when present
* store inference payload in `inference_data`
* store response-oriented payload in `response_data`

### Phase 3 — read-path support

* add internal query helpers for recent runs
* add internal query helper for run + rewrites
* support simple history views in authenticated app flows

### Phase 4 — hardening and cleanup

* review payload size and indexing
* review which fields deserve first-class columns later
* add observability around persistence success/failure
* add cleanup/retention policy only if needed

---

## Open questions

* Should anonymous or unauthenticated runs be persisted in v0.1, or only authenticated runs?
* Should `session_id` be stored from day one, or added only if debugging needs it?
* Should failed provider runs be stored later for diagnostics?
* Should `response_data` store the exact client payload, or a normalized replay payload?
* Which version fields need promotion from `jsonb` into first-class columns later?
* Should history support soft delete in the first user-facing release?

---

## Resolved decisions

* persistence model is **run-based**
* parent table is `prompt_runs`
* child table is `prompt_rewrites`
* database remains **Postgres**
* ORM remains **Drizzle**
* inference and response payloads are stored in **jsonb**
* rewrites are stored as separate rows, not only embedded JSON

---

## Recommendation

Proceed with the following implementation stack:

* `packages/db` schema expansion
* Drizzle migrations
* `prompt_runs` as the stable persisted parent
* `prompt_rewrites` as child rows
* `jsonb` storage for evolving inference/response structures
* authenticated-user linkage through `user_id`
* transactional writes from the analyze-and-rewrite path

This is the smallest persistence design that gives PromptFire durable prompt history, replay/debug value, and room for future analytics without prematurely over-modeling the scoring and rewrite internals.