Good. The next spec I’d add is:

## PromptFire Spec 0.2 — Real Rewrite Provider Integration

Why this one:

* the vertical slice already proves the loop
* the mock engine is enough for structure, but not enough to validate actual product value
* this spec adds the first real intelligence layer without dragging in billing, persistence, or auth complexity

---

# PromptFire v0.2 Spec — Real Rewrite Provider Integration

## Summary

Replace the mock-only rewrite path with a provider abstraction that supports both mock and real LLM-backed rewriting.

This phase keeps the current deterministic analysis model and existing API contract, but upgrades the rewrite stage so PromptFire can produce realistically useful rewritten prompts.

Primary goal:

* preserve the current vertical slice
* swap rewrite behavior from scaffold output to genuinely useful output
* keep provider selection environment-driven
* avoid persistence, quotas, or multi-provider orchestration for now

---

## Objectives

1. Keep the existing `POST /v1/analyze-and-rewrite` contract stable.
2. Introduce a real provider implementation behind the existing `RewriteEngine`.
3. Preserve the mock provider for local development and tests.
4. Ensure deterministic analysis findings are passed into rewrite generation.
5. Add clear provider-mode observability and failure handling.
6. Avoid changing product scope beyond rewrite quality.

---

## Non-goals

Not part of this phase:

* user accounts
* quota tracking
* billing
* prompt history
* saved rewrites
* team policies
* template libraries
* provider failover
* model selection in the public API
* asynchronous jobs
* streaming responses

---

## Functional changes

### 1. Rewrite provider abstraction stays stable

Keep the current interface shape:

```ts
rewrite({ prompt, role, mode, context, preferences, analysis })
```

This remains the only rewrite entrypoint used by the API layer.

### 2. Add a real provider implementation

Add a new implementation alongside `MockRewriteEngine`, for example:

* `RealRewriteEngine`
* or `OpenAIRewriteEngine`

Responsibilities:

* construct provider-safe rewrite instructions
* use deterministic analysis findings as structured inputs
* return a `Rewrite` object matching shared contracts
* avoid inventing business facts not present in input/context
* produce clearer and more realistic rewritten prompts than the mock engine

### 3. Keep provider mode environment-driven

Continue using provider mode from environment:

* `mock`
* `real`

Optional future values can be reserved, but not implemented yet.

Example env vars:

* `REWRITE_PROVIDER_MODE=mock|real`
* `REWRITE_PROVIDER_MODEL=<model-name>`
* `REWRITE_PROVIDER_API_KEY=<secret>`

### 4. Introduce a rewrite prompt-building layer

Do not let the API handler build provider instructions inline.

Add a dedicated prompt-builder or instruction-builder layer that:

* converts input into structured rewrite instructions
* includes role and mode behavior
* includes deterministic findings
* includes guardrails against generic filler
* keeps provider-specific text generation separate from API transport

### 5. Preserve response contract

No response shape change required for this phase.

Existing `rewrite` payload still returns:

* `role`
* `mode`
* `rewrittenPrompt`
* `explanation`
* `changes`

Optional improvement:
allow `changes` to become more meaningful and less placeholder-like.

### 6. Failure handling

If the provider call fails:

* return `UPSTREAM_MODEL_ERROR`
* preserve standard error response shape
* include request metadata
* log provider mode and failure type
* do not leak secrets or raw upstream payloads

---

## Rewrite behavior requirements

The real provider rewrite must:

1. preserve original user intent
2. improve scope clarity
3. improve contextual contrast
4. add constraints when they are implied by analysis, but not invent facts
5. respect `role`
6. respect `mode`
7. produce a prompt that looks usable in a real LLM workflow
8. keep output concise enough to remain practical

### Role expectations

#### `general`

* improve clarity and structure
* avoid domain-specific assumptions unless present in context

#### `developer`

* emphasize implementation boundaries
* emphasize runtime, failure modes, architecture, and exclusions where relevant

#### `marketer`

* emphasize audience, positioning, proof, tone, and avoidance of generic phrasing

### Mode expectations

#### `balanced`

* improve scope and contrast without over-narrowing

#### `tight_scope`

* reduce ambiguity and narrow to one clear deliverable

#### `high_contrast`

* strengthen differentiation, tension, and exclusions

#### `low_token_cost`

* keep the rewritten prompt lean while retaining critical constraints

---

## API behavior

## Existing endpoint remains primary

### `POST /v1/analyze-and-rewrite`

Behavior:

1. validate request
2. normalize preferences
3. run deterministic analysis
4. call rewrite engine using provider mode
5. return structured response

No new endpoint required in this phase.

---

## Shared contract additions

Minimal additions only.

### Meta

Keep:

* `version`
* `requestId`
* `latencyMs`
* `providerMode`

Optional addition:

* `providerModel` as optional field

If added, keep it optional to avoid breaking existing clients.

### Error codes

Keep existing:

* `UPSTREAM_MODEL_ERROR`

Optional addition:

* `PROVIDER_NOT_CONFIGURED`

Only add this if configuration failure needs to be distinguished from provider runtime failure.

---

## Implementation plan

### 1. Provider config module

Add a provider config loader for:

* mode
* model
* API key presence
* timeout if needed

### 2. Rewrite prompt builder

Add a pure function that takes:

* prompt
* role
* mode
* context
* preferences
* analysis

and returns provider instructions.

### 3. Real rewrite engine

Implement provider-backed rewrite generation.

### 4. Engine selector

Select between mock and real engine based on environment.

### 5. Response compatibility

Keep response contract unchanged.

### 6. Logging

Log:

* requestId
* providerMode
* provider model if configured
* endpoint
* status
* latency

Do not log:

* API keys
* full sensitive request payloads by default

---

## Testing plan

### Unit tests

* prompt-builder produces role-aware and mode-aware instructions
* engine selector chooses mock vs real correctly
* missing provider config fails cleanly
* rewrite output matches shared schema

### API integration tests

* mock mode still works
* real mode happy path works with provider mocked at network boundary
* provider error maps to `UPSTREAM_MODEL_ERROR`
* metadata includes provider mode

### Contract tests

* response shape remains compatible with v0.1 clients
* no regression in `analysis` output

---

## Acceptance criteria

This phase is complete when:

1. `POST /v1/analyze-and-rewrite` works in both `mock` and `real` modes
2. real mode returns materially better rewritten prompts than the mock engine
3. provider failures return structured errors
4. logs clearly indicate provider mode
5. no persistence or auth expansion was added
6. local development still works with mock mode by default

---

## Suggested follow-up specs after this

After this spec, the next likely ones are:

1. **OpenAPI and typed client generation**
2. **`POST /v1/analyze` endpoint extraction**
3. **provider evaluation fixtures and quality benchmarks**
4. **team policy / house rules support**