# PromptFire Login Page and Account Home Spec v0.1

## Status

Draft

## Objective

Define the first authenticated product surfaces for PromptFire:

* the **login page**
* the **account home**
* the **prompt history view** within account home

This spec is intended to sit on top of the existing auth and prompt persistence work.

It should give PromptFire a coherent first-run and returning-user experience without adding unnecessary account complexity.

---

## Product principles

### 1. Keep the entry path simple

The default login path should be obvious to any user without explanation.

That means:

* email-first sign-in
* no password
* no forced passkey usage

### 2. Treat passkeys as an accelerator, not a requirement

Passkeys are valuable, but they are still unfamiliar to many users.

PromptFire should:

* allow passkey sign-in
* recommend passkeys after successful email sign-in
* avoid making passkeys the primary entry point for first-time or uncertain users

### 3. Make account home feel like a useful workspace immediately

The first authenticated screen should not feel like a generic profile page.

It should:

* show recent prompt runs
* make it easy to reopen a previous run
* make it easy to start a new prompt analysis
* reinforce the score-first product model

### 4. History is run-based, not prompt-library based

PromptFire stores **runs**, not saved prompt documents.

The account home should therefore present:

* recent analyses
* score and recommendation context
* reopen/review behavior

It should not initially pretend to be a full prompt-management system.

---

## Scope

This spec covers:

* unauthenticated login page UX
* auth callback outcomes
* signed-in account home layout
* recent prompt history list
* passkey management entry point
* empty states and error states
* initial API needs for these surfaces

This spec does **not** introduce:

* billing
* teams/workspaces
* organization switching
* password login
* social login
* profile editing beyond minimal identity display
* saved prompt folders or collections
* cross-user sharing

---

## Existing foundation this spec assumes

### Authentication model

PromptFire auth is app-owned and passwordless.

Supported auth paths:

* magic links
* passkeys
* HttpOnly cookie-backed sessions

### Authorization model

For now:

* any authenticated user can access the authenticated app surface
* no complex roles or team permissions are required

### Persistence model

PromptFire persists prompt analysis history as **runs**.

Core entities already assumed by this spec:

* `users`
* `sessions`
* `prompt_runs`
* `prompt_rewrites`

The account home is therefore a read surface over persisted prompt runs for the authenticated user.

---

## Route model

Assumed product base path:

* `/app/`

Recommended first routes:

* `/app/login`
* `/app/auth/callback`
* `/app/`
* `/app/history`
* `/app/history/:runId`
* `/app/settings/security`

Notes:

* `/app/` should function as the authenticated account home
* `/app/history` may initially be the same screen as account home with fuller filtering later
* `/app/history/:runId` should reopen a historical run detail view

---

## 1. Login page

## Objective

Allow a user to sign in with the least friction possible while preserving the existing passwordless auth direction.

## Primary UX decision

The login page should be **email-first**.

Passkey should be available, but not forced and not visually dominant for new users.

## Page structure

### Header area

Elements:

* PromptFire wordmark/logo
* short headline
* one-line explanation of passwordless sign-in

Recommended headline direction:

* "Sign in to PromptFire"
* "Continue to your prompt workspace"

Recommended support copy:

* "Use your email for a sign-in link, or use a passkey if you already set one up."

### Main auth card

Primary section:

* email input
* primary CTA: **Email me a sign-in link**

Secondary section:

* divider or subtle alternative section
* secondary CTA: **Use a passkey instead**

Optional small footer text:

* no password required
* secure browser session note

## Content hierarchy

Order should be:

1. email input
2. primary email CTA
3. secondary passkey option
4. help/support/error text

Not:

* passkey first by default
* dual equal-weight CTAs competing for attention

## Form behavior

### Email input

Requirements:

* type=email
* trimmed and normalized client-side where appropriate
* validate basic email format before submission
* preserve entered email on recoverable errors

### Email submit success state

After successful `magic-link/request`:

* replace the form emphasis with a success state
* tell the user to check their inbox
* allow resend after a cooldown or controlled retry
* optionally show "Use a different email" action

Suggested state copy:

* "Check your email"
* "We’ve sent a secure sign-in link if that address can be used to access PromptFire."

This preserves the rule that the product should not disclose account existence.

### Passkey action

When user selects passkey:

* call passkey authenticate options endpoint
* begin browser WebAuthn flow
* show in-progress UI
* on success, establish session and redirect to account home
* on failure, return to login state with a clear message and an easy email fallback

Suggested failure copy:

* "Passkey sign-in did not complete. You can try again or use email instead."

## Login page states

The page should support these explicit states:

* idle
* email validation error
* sending magic link
* magic link sent
* passkey in progress
* passkey failed
* generic server/network error
* already authenticated

### Already authenticated behavior

If session exists on page load:

* skip showing the login form
* redirect to `/app/`

## Error states

Need clear UX for:

### Expired magic link

Show a lightweight result page or inline callback error:

* message that the link expired
* CTA to request a new sign-in link

### Already-used magic link

Show:

* message that the link has already been used
* CTA to request a new sign-in link

### Invalid magic link

Show:

* message that sign-in could not be completed
* CTA back to login

### Passkey auth failure

Show:

* brief explanation
* retry passkey
* fallback to email sign-in

### No active session

Protected routes should redirect to login rather than leaving the user on a broken page.

---

## 2. Auth callback experience

## Objective

Handle magic-link verification cleanly and move the user into the authenticated app with as little confusion as possible.

## Callback route

Recommended route:

* `/app/auth/callback`

## Behavior

The callback page should:

1. read token/state from URL
2. call magic-link verification endpoint
3. wait for session establishment
4. redirect into `/app/`

## Callback states

* verifying sign-in
* success and redirecting
* expired link
* already-used link
* invalid link
* generic failure

The callback UI should be minimal and transitional, not a full page destination.

---

## 3. First-run post-login behavior

## Objective

Make the first successful login feel useful immediately and introduce passkeys only at the right moment.

## Recommended behavior after first successful magic-link sign-in

Land the user in account home.

Then optionally show a **non-blocking prompt**:

* "Add a passkey for faster sign-in next time"

This prompt should:

* be dismissible
* not interrupt access to prompt history or analysis
* be visible only when the user does not yet have a passkey

Do **not** force passkey setup during first login.

---

## 4. Account home

## Objective

The account home should function as the user’s starting workspace, not a generic account settings page.

It should answer three questions immediately:

* what did I do recently?
* what should I open again?
* how do I start a new prompt run?

## Core layout

Recommended sections:

### A. Top bar

Elements:

* PromptFire brand
* user email or minimal identity chip
* account/security menu
* logout action

### B. Hero / action area

Purpose:

* orient the user
* give a clear next action

Recommended content:

* heading: "Your prompt workspace"
* primary CTA: **Analyze a new prompt**
* optional secondary CTA: **View full history**

### C. Recent prompt history

This is the main content block.

Show a list or card stack of recent runs.

Each row/card should include at minimum:

* created time
* a prompt preview
* role
* mode
* overall score when available
* score band when available
* rewrite recommendation when available
* whether a rewrite exists
* action to reopen

### D. Empty state or onboarding state

If the user has no runs yet, replace recent history with a useful first-run state.

### E. Optional account/security prompt

Only when relevant:

* "Add a passkey"
* security settings shortcut

This should remain secondary to history and new analysis.

---

## 5. Prompt history presentation

## Core rule

History is a list of **runs**, not a list of unique prompts.

The same prompt text may appear multiple times across history if the user ran it multiple times.

## History item fields

Each history item should show:

* `runId`
* `createdAt`
* `originalPrompt` preview
* `role`
* `mode`
* `overallScore` when available
* `scoreBand` when available
* `rewriteRecommendation` when available
* indicator for rewrite present or suppressed

## Prompt preview rules

Show a short preview of the original prompt.

Recommended behavior:

* 1–3 lines max in list view
* preserve readability
* truncate long prompts with ellipsis
* do not try to render full prompt text in the list

## Sorting

Default sort:

* newest first

## Initial filtering

For v0.1, filtering can be minimal.

Optional light filters if easy:

* role
* score band

But filters are not required for first release.

## Reopen behavior

Each history item should have a clear action:

* **Open run**
* or row click opens detail

Opening a run should display:

* original prompt
* score and sub-score context if available
* recommendation
* rewrite, if one exists and was shown/stored
* evaluation summary, if present
* stable metadata such as role, mode, date

## Empty history state

If there are no persisted runs:

Show:

* concise explanation of what history will contain
* primary CTA: **Analyze your first prompt**

Suggested copy direction:

* "Your prompt history will appear here after you run an analysis."

---

## 6. Account home states

The account home should support:

* loading session
* loading history
* populated history
* empty history
* failed history load

### Failed history load state

If session is valid but history fetch fails:

* do not blank the whole page
* show page chrome and primary action
* show recoverable error card in the history section
* offer retry

---

## 7. Security and account settings entry point

## Objective

Keep settings narrow and relevant.

For the first release, the main account/security needs are:

* show signed-in email
* add passkey
* view passkey status/device names if available later
* logout

## Settings route

Recommended:

* `/app/settings/security`

## Security page initial scope

Should include:

* signed-in email
* whether passkey is configured
* CTA to add passkey if not configured
* optional list of registered passkeys later
* logout action

Do not turn this into a broad account management system yet.

---

## 8. API requirements for these surfaces

## Existing auth APIs assumed

* `POST /v1/auth/magic-link/request`
* `GET /v1/auth/magic-link/verify`
* `GET /v1/auth/session`
* `POST /v1/auth/logout`
* `POST /v1/auth/passkey/register/options`
* `POST /v1/auth/passkey/register/verify`
* `POST /v1/auth/passkey/authenticate/options`
* `POST /v1/auth/passkey/authenticate/verify`

## New history read APIs recommended

### `GET /v1/account/home`

Purpose:

* return the initial authenticated account-home payload

Recommended response contents:

* current user summary
* recent prompt runs (small page size)
* passkey status summary

This endpoint is optional but useful if you want a single efficient bootstrapping request.

### `GET /v1/prompt-runs`

Purpose:

* list recent prompt runs for the authenticated user

Recommended query options:

* `limit`
* `cursor` or page token later
* optional role filter later
* optional score band filter later

Default sort:

* `created_at desc`

### `GET /v1/prompt-runs/:id`

Purpose:

* read one historical run for the authenticated user

Response should include:

* run summary
* stored response data
* child rewrites ordered by position

## Authorization rule for history APIs

Only the authenticated owner of a run should be able to read it.

If the run does not belong to the current user:

* return not found or unauthorized according to the preferred API policy

---

## 9. Data mapping from persistence layer to UI

The account home should read from persisted `prompt_runs` and `prompt_rewrites`.

## Minimum list-view mapping

From `prompt_runs`:

* `id`
* `created_at`
* `original_prompt`
* `role`
* `mode`
* `overall_score`
* `score_band`
* `rewrite_recommendation`

Derived fields:

* `hasRewrite`
* prompt preview
* friendly relative timestamp

## Detail-view mapping

From `prompt_runs`:

* full original prompt
* score metadata
* recommendation
* inference/response-derived display fields as appropriate

From `prompt_rewrites`:

* rewritten prompt
* explanation
* changes
* evaluation data
* primary ordering

---

## 10. UX priorities

### Priority 1

A user can sign in by email without confusion.

### Priority 2

A signed-in user immediately sees recent prompt history.

### Priority 3

A user can reopen a previous run easily.

### Priority 4

A user can add a passkey after sign-in without friction.

### Priority 5

The product feels score-first and history-aware from the first authenticated session.

---

## 11. Recommended UI structure

## Login page

* brand/header
* email-first auth card
* subtle passkey option
* inline success/error messaging

## Account home

* top navigation bar
* workspace hero with new-analysis CTA
* recent prompt history section
* optional passkey setup card

## Run detail page

* header with timestamp and context
* original prompt block
* score/recommendation summary
* rewrite block if present
* evaluation/explanation block if present

---

## 12. Non-goals for first release

Do not add these unless they become clearly necessary:

* folders
* tags
* starred prompts
  n- delete/edit history before read-path is stable
* broad analytics dashboards in account home
* cross-device session management UI
* profile avatars and decorative account features

---

## 13. Rollout plan

### Phase 1 — login and session bootstrapping

* build `/app/login`
* build `/app/auth/callback`
* wire session bootstrap via `/v1/auth/session`
* protect authenticated routes

### Phase 2 — account home read path

* build `/app/`
* add recent prompt runs fetch
* show empty and populated history states

### Phase 3 — run detail

* build `/app/history/:runId`
* show original prompt, score summary, rewrite, evaluation

### Phase 4 — security polish

* add passkey setup prompt after email login
* add `/app/settings/security`
* support passkey registration flow from authenticated state

---

## 14. Recommendation

Proceed with:

* **email-first login UX**
* **optional passkey sign-in**
* **workspace-style account home**
* **recent run history as the primary authenticated content**
* **run detail reopen flow**
* **non-blocking passkey enrollment after sign-in**

This is the smallest coherent product surface that matches PromptFire’s real auth model, real persistence model, and score-first product direction.
