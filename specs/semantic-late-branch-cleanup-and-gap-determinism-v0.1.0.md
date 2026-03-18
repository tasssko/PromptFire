# PromptFire Spec v0.1.0 — Semantic Late-Branch Cleanup And Gap Determinism

## Status

Draft

## Owner

PromptFire

## Summary

PromptFire has already moved core semantic ownership substantially upstream.

Semantic classification, semantic inventory, semantic decision state, score projection, findings, and semantic rewrite policy now exist as the main internal interpretation layer for covered prompt families. Rewrite presentation has begun to respect semantic policy bounds, and guided completion has begun shifting toward semantic family and gap awareness.

The next gap is narrower and more structural:

- late server and rewrite branches can still reinterpret semantically owned prompts
- some downstream rescue logic can still choose a stronger rewrite posture than semantic routing intended
- `primaryGap` selection now matters more, because it directly influences guided completion and policy-bounded presentation behavior
- if `primaryGap` is not deterministic, equivalent prompts can still feel inconsistent even when recommendation state is stable

This phase tightens the final ownership boundary.

It makes semantically owned prompts resistant to late reinterpretation and makes semantic gap selection deterministic enough to support stable guided completion, stable rewrite posture, and stable wording-equivalence behavior.

---

## Problem

The architecture has already shifted from score-first recommendation with late rescue logic toward semantic interpretation as the main internal decision path.

That solved the largest earlier problem: semantically bounded prompts being misread by raw score bands and then rescued late.

The remaining contradiction seam is now downstream.

### Current failure modes

1. A prompt is semantically owned and bounded, but a late branch still escalates rewrite posture based on score band, issue copy, or effective-context rescue logic.

2. Two semantically equivalent prompts land in the same `taskClass`, similar `semanticState`, and similar rewrite recommendation, but choose different `primaryGap` values because the gap selection logic is not deterministic enough.

3. Guided completion still risks drift if semantic gap selection is weak, because even policy-bounded rewrite presentation will feel inconsistent if the questions asked do not match the real family-specific gap.

The risk is no longer mainly wrong task classification.

The risk is contradictory projection from the same semantic interpretation.

---

## Goals

1. Prevent semantically owned prompts from being escalated or reinterpreted by late server or rewrite rescue branches.
2. Make `primaryGap` a deterministic projection from semantic inventory and decision state.
3. Make guided completion stable across semantically equivalent wording variants.
4. Keep public API and UI response shape unchanged.
5. Preserve operational fallback behavior while removing interpretive fallback behavior for semantically owned prompts.

---

## Non-Goals

This phase does not:

- introduce a new public API field
- change the current response contract
- redesign rewrite evaluation
- expand semantic family coverage further
- rename shared semantic tags across the repo
- remove all fallback logic in one pass
- redesign the score-first UI

This is a cleanup and consistency phase, not a new architecture phase.

---

## Core Principle

For semantically owned prompts, late branches may only downgrade, suppress, or safely recover within semantic bounds.

They may not reinterpret the prompt.

### Meaning

Once the system has:

- a semantic `taskClass`
- a semantic `ContextInventory`
- a semantic `DecisionState`
- semantic findings
- semantic rewrite policy

then no downstream branch should be allowed to act as a second decision engine.

---

## Definitions

### Semantically owned prompt

A prompt is semantically owned when all are true:

- semantic classification is in scope
- semantic routing produced a valid `DecisionState`
- semantic findings or equivalent semantic downstream state exist
- semantic rewrite policy exists

### Late reinterpretation

Late reinterpretation means any branch after semantic decisioning that changes the effective rewrite posture, missing-context framing, or guided-completion framing as though semantic interpretation were absent.

Examples:

- score-band rewrite escalation after semantic recommendation already exists
- issue-copy rescue that restates the prompt as broadly underconstrained when semantic inventory already shows boundedness
- effective-context rescue that changes rewrite posture for a semantically owned prompt
- guided-completion generation that ignores semantic family and `primaryGap`

### Deterministic gap mapping

Deterministic gap mapping means equivalent prompts with equivalent semantic inventory and equivalent decision state should resolve to the same `primaryGap`, unless there is a real semantic difference in missing context.

---

## Late-Branch Cleanup Rules

### Keep

Keep late-stage fallback for:

- provider failure
- malformed rewrite output
- malformed evaluation output
- prompts outside semantic ownership
- operational safety defaults
- transport or orchestration failures
- null or absent semantic state

These are recovery behaviors, not reinterpretation behaviors.

### Narrow

Narrow late-stage branches that currently:

- escalate rewrite posture from score band alone
- escalate rewrite posture from issue copy alone
- treat effective-context absence as stronger than semantic ownership
- generate generic guided completion without consulting semantic family/gap
- suppress or replace semantic gap framing with fallback wording

These branches may still exist temporarily, but only as bounded downgrades or recovery helpers.

### Delete

Delete late-stage branches whose only purpose is to reinterpret semantically owned prompts.

Examples:

- score-only rewrite escalation for owned prompts
- generic issue-copy rescue for owned prompts
- best-next-move fallback that replaces semantic findings
- guided-completion rescue that ignores semantic policy and family/gap state
- stale contradiction-suppression hacks that semantic findings already made obsolete

---

## Deterministic Primary Gap Rules

`primaryGap` must be a pure projection from semantic structures that already exist.

### Allowed inputs

`primaryGap` may be derived from:

- `taskClass`
- `semanticState`
- `rewriteRecommendation`
- `rewriteRisk`
- boundedness signals
- relevant context-group presence
- semantic missing-context classification
- semantic method-fit information where applicable

### Disallowed inputs

`primaryGap` must not be derived primarily from:

- free-text issue messages
- parsed `bestNextMove` strings
- score bands
- role heuristics alone
- evaluation status alone
- improvement-suggestion text parsing

These may be fallback hints only when semantic data is absent.

### Rule

If two prompts produce materially equivalent semantic inventory and decision state, they should produce the same `primaryGap`.

---

## Family-Specific Gap Precedence

The system should use explicit precedence by family rather than loosely inferred text heuristics.

### `implementation`

Preferred precedence:

1. `execution`
2. `io`
3. `boundary`
4. `criteria`
5. `unknown`

Use `execution` when runtime, environment, framework, or execution surface is missing in a way that limits correct output.

Use `io` when input shape, output shape, or success/failure behavior is the most important missing narrowness.

Use `boundary` when scope, exclusions, or constraints are the main missing piece.

### `comparison`

Preferred precedence:

1. `criteria`
2. `boundary`
3. `audience`
4. `unknown`

The default semantic gap for comparison should be evaluative framing, not generic underconstraint.

### `decision_support`

Preferred precedence:

1. `criteria`
2. `boundary`
3. `audience`
4. `unknown`

If a decision object exists but the trade-off frame is weak, prefer `criteria`.

### `context_first`

Preferred precedence:

1. `context_linkage`
2. `deliverable`
3. `boundary`
4. `unknown`

The main question is whether the existing context is being tied clearly enough to the requested output.

### `few_shot`

Preferred precedence:

1. `example_transfer`
2. `deliverable`
3. `boundary`
4. `unknown`

The semantic question is what should carry over from the examples and what should change.

### `analysis`

Preferred precedence:

1. `criteria`
2. `source`
3. `boundary`
4. `unknown`

If the target is present but the evaluation lens is missing, prefer `criteria`.
If the lens is present but evidence or grounding is missing, prefer `source`.

---

## Primary Gap Selection Contract

Add or tighten an internal helper that resolves `primaryGap` from semantic inputs.

### Requirement

The selector must be:

- deterministic
- family-aware
- free of downstream text parsing
- testable in isolation

### Preferred shape

```ts
type PrimaryGap =
  | 'criteria'
  | 'boundary'
  | 'execution'
  | 'io'
  | 'audience'
  | 'source'
  | 'context_linkage'
  | 'example_transfer'
  | 'deliverable'
  | 'unknown';

function selectPrimaryGap(
  context: ContextInventory,
  decision: DecisionState,
): PrimaryGap
````

### Design rule

If `buildRewritePolicy` currently assigns `primaryGap`, that assignment should either:

* become the canonical deterministic selector
* or delegate to a dedicated helper with equivalent purity and testability

There should be one canonical source for semantic gap selection.

---

## Server Integration Rules

### Ownership gate

After semantic classification, semantic decision, semantic findings, and semantic rewrite policy have been built, the server must treat semantic ownership as the gate that disables interpretive late-stage behavior.

### For semantically owned prompts

The server must not allow:

* score-band rescue to escalate rewrite posture
* issue-copy rescue to replace semantic gap framing
* effective-context rescue to choose a stronger rewrite mode than policy allows
* generic guided-completion rescue to override semantic family/gap behavior

### Allowed late behavior for owned prompts

The server may still:

* suppress a rewrite
* downgrade from `full_rewrite` to `template_with_example`
* downgrade from `template_with_example` to `questions_only`
* suppress guided completion when semantic state is already strong
* recover safely from malformed provider results

The distinction is:

* downgrade or suppress is allowed
* reinterpret or escalate is not

---

## Rewrite Presentation Rules

Rewrite presentation is now subordinate to semantic rewrite policy.

This phase tightens that boundary further.

### Rule 1

If `semanticOwned === true`, presentation mode must always remain within `allowedPresentationModes`.

### Rule 2

No late branch may add `full_rewrite` back into the allowed set.

### Rule 3

If semantic policy allows only `suppressed`, evaluation and rescue logic must not surface a visible rewrite.

### Rule 4

If semantic policy allows only bounded optional modes, evaluation may choose among those modes but may not escalate beyond them.

---

## Guided Completion Rules

Guided completion must be driven by semantic family and `primaryGap` first.

### Required precedence

1. semantic family
2. semantic `primaryGap`
3. semantic policy / semantic state
4. method-fit context if available
5. role heuristics
6. text heuristics only as last resort

### Rule

For semantically owned prompts, role/text heuristics may refine wording, but they may not determine the core question family unless semantic gap data is absent.

### Consequence

Equivalent prompts with equivalent family/gap should ask materially similar guided-completion questions, even if wording differs.

---

## Test Plan

This phase is primarily a test-backed cleanup phase.

### 1. Deterministic gap tests

Add focused tests for `primaryGap` selection.

Coverage should include:

* equivalent wording variants landing on the same `primaryGap`
* family-specific precedence behavior
* `analysis` target-plus-lens variants
* `comparison` criteria-vs-boundary variants
* `implementation` execution-vs-io variants

### 2. Late-branch suppression tests

Add server-level tests showing that semantically owned prompts are not escalated by:

* score bands
* issue copy
* effective-context rescue
* generic rewrite rescue

### 3. Guided completion consistency tests

Add rewrite-presentation tests showing that guided completion:

* follows family/gap first
* remains stable across equivalent wording
* does not regress into role-only questioning when semantic data exists

### 4. Policy-bound ownership tests

Add tests showing that:

* owned prompts stay within `allowedPresentationModes`
* late branches can downgrade but not escalate
* `suppressed` remains terminal when policy says so

### 5. Regression fixture extensions

Extend existing semantic fixture families so gap determinism becomes part of the expected contract, not just recommendation stability.

Expected assertions should include:

* same `taskClass`
* same or equivalent `semanticState`
* same rewrite recommendation
* same `primaryGap`
* similar guided-completion shape where applicable

---

## Implementation Plan

### Phase A — Canonicalize `primaryGap`

* isolate or tighten one canonical `primaryGap` selector
* remove duplicate gap-selection logic from rewrite or server helpers
* write unit tests for deterministic family-specific precedence

### Phase B — Audit late branches

Audit late-stage logic in:

* `server.ts`
* `rewritePresentation.ts`
* any inference bridge or rescue helper still used after semantic routing

Classify each branch as:

* keep
* narrow
* delete

### Phase C — Remove pure reinterpretation branches

Delete the first class of branches that only reinterpret semantically owned prompts and add no real recovery value.

### Phase D — Tighten downgrade-only behavior

For any late branch kept for product safety:

* enforce semantic ownership checks
* enforce downgrade-only or suppress-only behavior
* disallow escalation outside semantic policy

### Phase E — Rebase tests around gap determinism

Update older tests that still assume score or eval is the primary downstream driver.

Rewrite them around:

* semantic ownership
* semantic bounds
* deterministic gap selection
* wording stability

---

## Risks

### Risk 1 — Gap mapping is too shallow

If `primaryGap` mapping is vague, inconsistency simply moves from recommendation to guided completion.

### Risk 2 — Hidden escalation branches remain

Some late branches may look operational but still encode semantic reinterpretation.

### Risk 3 — Existing tests encode the wrong authority model

Older rewrite-presentation tests may still assume eval or issue-copy is the primary driver, which can hide real contradictions.

### Risk 4 — Over-aggressive cleanup removes valid safety behavior

Some late-stage behavior is still useful when provider output is malformed or missing. Cleanup must remove interpretive duplication, not operational resilience.

---

## Success Criteria

This phase is complete when all are true:

1. Semantically owned prompts cannot be escalated by late rescue logic.
2. Equivalent prompts with equivalent semantic inventory resolve to the same `primaryGap`.
3. Guided completion remains stable for equivalent prompts.
4. Rewrite presentation remains policy-bounded even under rescue scenarios.
5. Public API response shape stays unchanged.
6. Remaining fallback behavior is mostly operational, not interpretive.

---

## Exit Criteria

This cleanup phase is complete when the codepath can be described simply:

```text
prompt
  -> semantic inventory
  -> decision state
  -> semantic findings
  -> semantic rewrite policy
  -> bounded rewrite presentation
  -> optional safe downgrade or suppression
  -> UI
```

At that point:

* semantic ownership governs recommendation and downstream rewrite behavior
* `primaryGap` is stable enough to support trustworthy guided completion
* late corrective logic is materially reduced
* contradiction risk is lower without changing the public product surface

---

## Recommended Files

```text
packages/heuristics/src/semantic/buildRewritePolicy.ts
packages/heuristics/src/semantic/selectPrimaryGap.ts
packages/heuristics/src/semantic/semanticCore.test.ts
apps/api/src/server.ts
apps/api/src/server.test.ts
apps/api/src/rewrite/rewritePresentation.ts
apps/api/src/rewrite/rewritePresentation.test.ts
```
