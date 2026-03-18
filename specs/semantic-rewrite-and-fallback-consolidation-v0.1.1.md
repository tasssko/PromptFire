Yes — here is the tightened spec, updated to match your review and the current repo shape.

The main adjustment is to make this explicitly a **server/rewrite consolidation spec**, not a generic fallback cleanup spec. In the current code, semantic findings already suppress the legacy `generateBestNextMove` path in `server.ts`, while the broader semantic architecture and migration docs already require downstream consumers like rewrite display suppression to use the shared semantic decision object and to keep the public API stable during migration.  

---

# PromptFire Spec v0.1.1 — Semantic Rewrite Policy And Downstream Consolidation

## Status

Draft

## Owner

PromptFire

## Summary

PromptFire has already moved recommendation ownership substantially onto the semantic path.

The server now prefers semantic findings for `bestNextMove` and suppresses the legacy generator when semantic findings exist, rather than allowing both systems to compete in parallel. 

The next architectural gap is downstream consistency:

* rewrite display still behaves like a parallel verdict engine
* guided completion still relies too heavily on role/text heuristics
* late server/rewrite branches can still pick a stronger rewrite posture than semantic routing intended

This phase introduces an internal `SemanticRewritePolicy` in heuristics and makes rewrite display, guided completion, and late rescue behavior subordinate to semantic ownership.

The public API response shape stays unchanged, consistent with the existing migration principles and spec direction.  

---

## Problem

PromptFire’s architecture is now asymmetric.

Upstream semantic interpretation is already authoritative enough to drive recommendation, findings, score projection, and `bestNextMove` for in-scope families. The current semantic docs also state that downstream consumers including rewrite recommendation, top findings, score projection, and rewrite display suppression logic must derive from the same shared decision object where semantic coverage exists. 

But the rewrite surface is not yet fully aligned with that model.

The remaining failure mode is dual truth:

* semantic state says the prompt is strong or usable
* rewrite display still escalates from local heuristics
* guided completion asks generic or role-derived questions instead of family-specific semantic gaps
* late server/rewrite rescue logic can still reinterpret semantically owned prompts

That creates contradictory UX even when task classification is correct.

---

## Goals

1. Make semantically owned prompts use one shared semantic story across recommendation, findings, rewrite display, and guided completion.
2. Keep `SemanticRewritePolicy` internal to heuristics.
3. Preserve the current public API contract.
4. Make rewrite evaluation advisory within semantic bounds, not a competing verdict engine.
5. Reduce late-stage reinterpretation in server and rewrite branches.
6. Keep operational fallback behavior, but stop semantic override behavior for owned prompts.

---

## Non-Goals

This phase does not:

* add `SemanticRewritePolicy` to `contracts.ts`
* change the response shape returned by the API
* redesign rewrite evaluation from scratch
* remove forced rewrites
* remove guided completion
* rename shared semantic tags broadly
* delete all fallback logic in one pass

These remain out of scope because the current migration plan explicitly keeps the public API stable while internal decisioning changes and removes rescue logic only after semantic ownership is proven. 

---

## Core Principle

For semantically owned prompts, rewrite behavior must be a bounded projection of semantic interpretation.

### Rule

If semantic routing produced a valid semantic decision and findings, downstream rewrite behavior must not contradict that interpretation.

### Implications

* `bestNextMove` already follows this rule and should remain the model for downstream consolidation. 
* rewrite display must operate inside semantic policy bounds
* guided completion must use family-specific semantic gaps first
* late rescue logic must not choose a stronger rewrite posture than semantic policy allows

---

## New Internal Type

Add a new internal module in heuristics:

```ts
type SemanticRewritePolicy = {
  semanticOwned: boolean;
  allowedPresentationModes: Array<'suppressed' | 'full_rewrite' | 'template_with_example' | 'questions_only'>;
  primaryGap:
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
  family: TaskClass;
  semanticState: 'weak' | 'usable' | 'strong';
  rewriteRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed';
  rewriteRisk: 'low' | 'medium' | 'high';
};
```

### Placement

This type belongs in heuristics, not in the public shared contract.

### File

```text
packages/heuristics/src/semantic/buildRewritePolicy.ts
```

### Export

Export it from:

```text
packages/heuristics/src/index.ts
```

---

## Inputs To Policy Builder

The policy builder must not infer semantics again.

It should be built strictly from existing semantic objects already established in the repo’s architecture:

* `ContextInventory`
* `DecisionState`

That matches the semantic direction already in place, where `buildDecisionState` derives `semanticState`, `expectedImprovement`, `majorBlockingIssues`, `rewriteRisk`, and `rewriteRecommendation` from semantic inventory before downstream consumption. 

### Required Inputs

```ts
buildRewritePolicy(context: ContextInventory, decision: DecisionState): SemanticRewritePolicy
```

### Important Rule

No prompt-family detection, gap inference, or semantic rescue logic should be duplicated inside rewrite presentation.

---

## Ownership Rules

### Rule 1 — Semantic ownership gate

A prompt is semantically owned when:

* semantic classification is in scope
* semantic routing produced a `DecisionState`
* semantic findings exist or can be derived

This mirrors the current server direction where semantic findings already replace the legacy `bestNextMove` generator when available. 

### Rule 2 — Owned prompts disable reinterpretation

For semantically owned prompts:

* rewrite display cannot choose a stronger posture than semantic policy allows
* guided completion cannot ignore semantic family/gap
* late rescue logic cannot restate the prompt as if semantic interpretation were absent

### Rule 3 — Evaluation is advisory

Evaluation may:

* suppress a rewrite
* downgrade a rewrite mode
* choose a safer help mode inside policy bounds

Evaluation may not:

* escalate `no_rewrite_needed` into any visible rewrite mode other than `suppressed`
* escalate `rewrite_optional` into `full_rewrite` unless policy explicitly allows that family/state combination

---

## Semantic Rewrite Policy Rules

### `no_rewrite_needed`

If semantic recommendation is `no_rewrite_needed`, policy must allow only:

```ts
allowedPresentationModes = ['suppressed']
```

This keeps rewrite display aligned with the existing semantic architecture, where strong prompts should not be auto-rewritten by default and rewrite suppression logic is a downstream consumer of semantic decisioning. 

### `rewrite_optional`

If semantic recommendation is `rewrite_optional`, default policy should allow:

```ts
allowedPresentationModes = ['suppressed', 'template_with_example', 'questions_only']
```

`full_rewrite` is disallowed by default.

Exception:

* allow `full_rewrite` only when policy explicitly opts in for that family/state combination

### `rewrite_recommended`

If semantic recommendation is `rewrite_recommended`, policy may allow:

```ts
allowedPresentationModes = ['full_rewrite', 'template_with_example', 'questions_only']
```

Selection still depends on evaluation and rewrite risk, but only inside this allowed set.

---

## Primary Gap Mapping

`primaryGap` must be deterministic and derived from current semantic inventory.

This is the most important quality bar in the spec. If the gap mapping is sloppy, guided completion will remain inconsistent even after rewrite display is fixed.

### Family Mapping

#### `implementation`

Prefer:

* `execution`
* `io`
* `boundary`

Choose based on the first major missing semantic group from inventory.

#### `comparison`

Prefer:

* `criteria`

Fallback:

* `audience`
* `boundary`

#### `decision_support`

Prefer:

* `criteria`

Fallback:

* `audience`
* `boundary`

#### `context_first`

Prefer:

* `context_linkage`
* `deliverable`

#### `few_shot`

Prefer:

* `example_transfer`

Fallback:

* `deliverable`
* `boundary`

#### `analysis`

Prefer:

* `criteria`
* `source`

Fallback:

* `boundary`

### Mapping Rule

The policy builder must use existing inventory presence and boundedness signals rather than text parsing. That is consistent with the semantic core’s shift toward deriving semantic state and rewrite risk from `ContextInventory` rather than from raw issue strings or score bands. 

---

## Server Integration

### Location

Wire policy into `server.ts` immediately after semantic decision and semantic findings are available.

### Server Responsibilities

The server should:

1. build semantic classification
2. build semantic decision
3. build semantic findings
4. build semantic rewrite policy
5. pass policy into rewrite display selection
6. pass policy into guided completion generation
7. use semantic ownership to disable late reinterpretation branches

This follows the repo’s architecture requirement that one shared semantic object be constructed before score projection, findings, best-next-move, rewrite gating, and rewrite evaluation. 

### Server Rule

For semantically owned prompts, the server must not let:

* score-band heuristics
* issue-copy heuristics
* effective-context rescue heuristics

choose a stronger rewrite posture than the semantic rewrite policy.

---

## Rewrite Presentation Refactor

### Existing problem

Rewrite presentation currently acts too much like a parallel decision engine.

### Target behavior

`selectRewritePresentationMode` becomes policy-aware.

### New selection order

```text
semantic decision
  -> semantic findings
  -> semantic rewrite policy
  -> evaluation
  -> presentation mode selection inside policy
```

### Selection constraints

#### When policy allows only `suppressed`

Always return `suppressed`.

#### When policy allows optional help modes

Evaluation may choose among:

* `suppressed`
* `template_with_example`
* `questions_only`

It may not return `full_rewrite`.

#### When policy allows stronger rewrite modes

Evaluation may choose among the allowed modes, but must still respect rewrite risk.

---

## Guided Completion Refactor

### Current problem

Guided completion is too dependent on:

* role
* `missingContextType`
* parsed text from `bestNextMove`
* suggestion strings

### New rule

Guided completion must take semantic family and `primaryGap` as first-class inputs.

### Preferred function shape

```ts
buildGuidedCompletionQuestions({
  role,
  semanticPolicy,
  bestNextMove,
  improvementSuggestions,
  missingContextType,
})
```

### Priority order

1. semantic family
2. primary semantic gap
3. best-next-move metadata
4. role heuristics
5. text heuristics as final fallback only

### Examples

#### `comparison` / `decision_support`

Ask for:

* criteria
* trade-off axes
* one concrete scenario or case

#### `context_first`

Ask for:

* exact deliverable
* what in the provided context should drive the answer

#### `few_shot`

Ask for:

* what to preserve from the examples
* what should change
* output shape

#### `analysis`

Ask for:

* what standard or lens should be used
* whether evidence, diagnosis, audit criteria, or source grounding is required

---

## Late Rescue Narrowing

The biggest cleanup in this phase is not primarily `fallbackResolver.ts`.

The main cleanup is in late server/rewrite branches that still allow evaluation and effective-context heuristics to override semantic intent.

### Keep

Keep rescue behavior for:

* provider failure
* malformed rewrite/evaluation results
* prompts outside semantic ownership
* operational fallback cases

### Narrow

Narrow rescue behavior for:

* score-band-based rewrite escalation
* issue-copy-based rewrite escalation
* effective-context rescue that changes rewrite posture for owned prompts
* generic guided-completion branches that ignore semantic family/gap

### Delete

Delete branches whose only purpose is semantic reinterpretation after semantic routing already succeeded.

This is consistent with the migration plan’s guardrail-reduction phase and the semantic decision docs’ requirement to remove logic that duplicates semantic interpretation once parity is stable.  

---

## Tests

### 1. Heuristics policy tests

Add unit tests for `buildRewritePolicy.ts` covering:

* strong -> `no_rewrite_needed` -> only `suppressed`
* usable -> `rewrite_optional` -> no `full_rewrite` unless explicitly allowed
* weak -> `rewrite_recommended` -> family-specific allowed modes
* deterministic `primaryGap` mapping

### 2. Rewrite presentation tests

Rewrite existing tests so they assert:

* evaluation acts inside semantic bounds
* `no_rewrite_needed` cannot produce visible rewrite
* `rewrite_optional` cannot escalate to `full_rewrite` unless policy allows it
* family-specific policy produces the expected downgrade behavior

### 3. Guided completion tests

Add tests for:

* comparison gap -> criteria questions
* context-first gap -> deliverable/context linkage questions
* few-shot gap -> preservation/adaptation questions
* analysis gap -> evaluation-lens or evidence questions

### 4. Server ownership tests

Add server tests asserting that for semantically owned prompts:

* semantic policy suppresses late rewrite escalation
* guided completion follows semantic family and gap
* score-band or issue-copy rescue does not override semantic rewrite posture

### 5. Regression parity tests

Retain current eval-mode regression coverage, but reframe expectations as:

* eval inside semantic bounds
* not eval as primary driver

That aligns with the repo’s existing semantic test philosophy, which already checks stable recommendation state across equivalent prompts and guards against stale generic missing-constraints findings. 

---

## Implementation Plan

### Phase A — Build policy module

Add:

```text
packages/heuristics/src/semantic/buildRewritePolicy.ts
```

And export it from:

```text
packages/heuristics/src/index.ts
```

### Phase B — Server wiring

In `server.ts`:

* construct policy after semantic decision/findings
* pass policy into rewrite display selection
* pass policy into guided completion
* use `semanticOwned` as the gate for suppressing legacy reinterpretation

### Phase C — Rewrite selection refactor

In `rewritePresentation.ts`:

* make selection policy-aware
* keep evaluation logic
* prevent eval from escalating outside allowed modes

### Phase D — Guided completion refactor

Refactor guided completion so semantic family and `primaryGap` drive question generation first.

### Phase E — Late-branch cleanup

Reduce late-stage rewrite and effective-context rescue logic that can still contradict semantic ownership.

---

## Success Criteria

This phase is complete when all are true:

1. Semantically owned prompts cannot receive a rewrite display posture that contradicts semantic recommendation.
2. `no_rewrite_needed` always yields `suppressed`.
3. `rewrite_optional` cannot escalate to `full_rewrite` unless semantic policy explicitly allows it.
4. Guided completion aligns with semantic family and gap.
5. Late rewrite/server rescue logic no longer reinterprets owned prompts.
6. Public API response shape remains unchanged.

---

## Recommended file targets

```text
packages/heuristics/src/semantic/buildRewritePolicy.ts
packages/heuristics/src/index.ts
apps/api/src/server.ts
apps/api/src/rewrite/rewritePresentation.ts
apps/api/src/rewrite/rewritePresentation.test.ts
packages/heuristics/src/semantic/semanticCore.test.ts
apps/api/src/server.test.ts
```

If you want, I’ll turn this into the matching migration-plan doc next, with commit-sized steps and test cases only.
