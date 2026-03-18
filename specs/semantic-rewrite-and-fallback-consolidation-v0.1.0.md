Below is a draft spec in the same style as your existing semantic decision docs, but focused on the next consolidation seam: making rewrite presentation and fallback cleanup obey semantic ownership.

You could drop this in as:

`specs/semantic-rewrite-and-fallback-consolidation-v0.1.0.md`

---

# PromptFire Spec v0.1.0 — Semantic Rewrite And Fallback Consolidation

## Status

Draft

## Owner

PromptFire

## Summary

PromptFire has already moved core recommendation ownership toward the semantic path. The server now prefers semantic findings and semantic `bestNextMove` when a routed semantic decision exists, instead of letting legacy `generateBestNextMove` compete in parallel. 

The next phase is to finish that ownership model on the rewrite and fallback surfaces.

Today, rewrite presentation still has its own decision logic based on evaluation status, score band, issue codes, prompt thinness, and effective analysis context. It can decide between `full_rewrite`, `template_with_example`, `questions_only`, and `suppressed` independently of the semantic decision core.  Meanwhile, the existing migration plan says the end state is to make semantic interpretation the internal source of truth before removing rescue logic, and to delete late rescue branches that duplicate semantic interpretation.  

This spec defines the next consolidation phase so that:

* semantically owned prompts cannot tell one story in recommendation and another in rewrite presentation
* fallback logic is narrowed to real recovery cases rather than semantic reinterpretation
* rewrite generation and rewrite presentation become downstream consumers of semantic state rather than alternate decision systems

---

## Problem

The current repo shape is improved, but still allows dual truth in two places.

First, rewrite presentation is currently decided by `selectRewritePresentationMode`, which uses local rules such as evaluation status, score delta, issue sets, score band, prompt thinness, and effective-context missing-context type. That is useful UI logic, but it is not yet clearly subordinate to semantic state. 

Second, the migration plan explicitly calls for deleting rescue branches that duplicate semantic interpretation after semantic parity is stable. That means any remaining fallback behavior that reinterprets semantically owned prompts is now technical debt, not product architecture. 

The product failure mode from here is no longer mainly bad family classification. It is contradiction:

* semantic path says the prompt is usable or strong
* rewrite presentation still chooses an aggressive fallback mode from local heuristics
* fallback or legacy rescue logic still nudges output copy in a different direction

That weakens trust because the user sees one verdict, one set of findings, and a different rewrite behavior.

---

## Goals

1. Make semantic state the upstream authority for rewrite presentation on semantically owned prompts.
2. Restrict fallback logic to true recovery and non-semantic cases.
3. Ensure findings, `bestNextMove`, rewrite recommendation, rewrite presentation mode, and guided completion all describe the same semantic gap.
4. Preserve the current API and UI contract.
5. Keep evaluation useful, but make it advisory beneath semantic ownership rather than a parallel verdict engine.

---

## Non-Goals

This phase does not:

* redesign rewrite evaluation
* change public rewrite preference semantics
* remove guided completion
* replace all rewrite-presentation heuristics with semantic logic in one step
* delete every fallback branch immediately
* change the public scoring categories or UI structure

Those are intentionally out of scope because the current migration principle is to keep public behavior stable while internal ownership changes. 

---

## Core Principle

For semantically owned prompts, rewrite behavior must be a projection of semantic interpretation, not an alternate interpretation.

### Implications

* `rewriteRecommendation` comes from semantic `DecisionState` first. 
* `bestNextMove` should already come from semantic findings when available, and that pattern should be extended to rewrite presentation behavior. 
* rewrite evaluation can refine display choice within semantic bounds, but should not overturn semantic ownership
* fallback branches must not reinterpret a prompt family that semantic has already classified and routed

---

## Architecture Shift

### Current shape

```text
prompt
  -> semantic classification / decision
  -> score projection
  -> semantic findings
  -> rewrite generation
  -> evaluation
  -> rewritePresentation local mode selection
  -> optional fallback / effective-context rescue
  -> UI
```

### Target shape

```text
prompt
  -> semantic classification / decision
  -> score projection
  -> semantic findings
  -> semantic rewrite policy
  -> rewrite generation
  -> evaluation as evidence
  -> rewrite presentation selection within semantic policy
  -> UI
```

### Meaning

The rewrite layer is still allowed to decide how to present help, but only inside a semantic policy envelope.

---

## New Internal Concept

### SemanticRewritePolicy

Add a semantic-side internal object that sits between `DecisionState` and rewrite presentation.

```ts
type SemanticRewritePolicy = {
  semanticOwned: boolean;
  allowFullRewrite: boolean;
  allowTemplateFallback: boolean;
  allowQuestionsFallback: boolean;
  preferSuppression: boolean;
  primaryGap:
    | 'criteria'
    | 'boundary'
    | 'execution'
    | 'io'
    | 'audience'
    | 'source'
    | 'context_linkage'
    | 'example_transfer'
    | 'unknown';
  rationale: string;
};
```

Purpose:

* translate semantic state into rewrite-presentation constraints
* stop local rewrite heuristics from inventing a different missing-context story
* make guided completion generation match family-specific semantic gaps

---

## Ownership Rules

### Rule 1: semantic ownership gate

If semantic produced a routed decision and semantic findings are available, the prompt is semantically owned for downstream recommendation surfaces. This is already the effective server direction for `bestNextMove`, where semantic findings suppress the legacy generator. 

### Rule 2: rewrite presentation must respect semantic ownership

For semantically owned prompts:

* `no_rewrite_needed` may only yield `suppressed`
* `rewrite_optional` may yield `suppressed`, `template_with_example`, or `questions_only`, but not `full_rewrite` unless evaluation shows real material improvement and semantic policy allows it
* `rewrite_recommended` may yield `full_rewrite`, `template_with_example`, or `questions_only` depending on evaluation and semantic gap type

### Rule 3: evaluation is advisory, not sovereign

Evaluation remains useful evidence for:

* whether a full rewrite is actually worth showing
* whether regression risk is high
* whether template or questions are safer than a full rewrite

But evaluation must not create a stronger rewrite action than semantic policy allows.

### Rule 4: guided completion must use semantic gaps first

If semantic findings expose a family-specific gap, guided completion should be driven from that gap rather than generic issue-code heuristics.

The current guided completion builder still infers questions from role, `bestNextMove` text, improvement suggestions, and `missingContextType`.  That should be refactored so semantic gap typing is the first input and text parsing is a fallback.

---

## Semantic Rewrite Policy Rules

### For `strong` semantic state

If `rewriteRecommendation === 'no_rewrite_needed'`:

* `preferSuppression = true`
* `allowFullRewrite = false`
* `allowTemplateFallback = false`
* `allowQuestionsFallback = false`

This matches the existing semantic direction where strong prompts can already suppress `bestNextMove` and recommend no rewrite. 

### For `usable` semantic state

If `rewriteRecommendation === 'rewrite_optional'`:

* `preferSuppression = false`
* `allowFullRewrite = false` by default
* `allowTemplateFallback = true`
* `allowQuestionsFallback = true`

Exception:

* allow `full_rewrite` only when evaluation shows material improvement and semantic rewrite risk is not elevated for the family

### For `weak` semantic state

If `rewriteRecommendation === 'rewrite_recommended'`:

* `preferSuppression = false`
* `allowFullRewrite = true`
* `allowTemplateFallback = true`
* `allowQuestionsFallback = true`

Selection depends on:

* evaluation status
* rewrite risk
* whether the missing semantic gap is foundational or clarifying

---

## Family-specific mapping

### `implementation`

Primary semantic gaps:

* `execution`
* `io`
* `boundary`

Preferred fallback behavior:

* use `template_with_example` when missing bounded contract detail
* use `questions_only` only when the prompt is extremely thin and assumptions would be unsafe
* suppress if semantic state is strong and rewrite recommendation is `no_rewrite_needed`

This aligns with current guided-completion behavior for developer prompts, which already asks about runtime, payload, validation, success/failure, auth, retry, and setup boundaries. 

### `comparison`

Primary semantic gap:

* `criteria`

Preferred fallback behavior:

* prefer `template_with_example` over full rewrite when the prompt is usable but needs sharper evaluation axes
* use `questions_only` only when the comparison object is too underdefined to safely rewrite
* suppress by default when semantic state is strong and evaluation improvement is low

The current semantic tests already expect comparison prompts to remain stable across wording variants and to avoid stale `CONSTRAINTS_MISSING` output. 

### `decision_support`

Primary semantic gap:

* `criteria`

Preferred fallback behavior:

* same as comparison, but allow more scenario-driven question prompts when a decision object exists and criteria are thin

### `context_first`

Primary semantic gap:

* `context_linkage`

Preferred fallback behavior:

* prefer `template_with_example` or targeted clarification
* do not treat existing context as equivalent to missing constraints
* keep rewrite modest unless evaluation shows strong gains

### `few_shot`

Primary semantic gap:

* `example_transfer`

Preferred fallback behavior:

* prefer `template_with_example`
* avoid aggressive full rewrite because few-shot prompts often have higher rewrite risk once examples exist

The current semantic decision code already treats few-shot as a higher-risk rewrite family than most others, especially when strong. 

### `analysis`

Primary semantic gap:

* `criteria` or `source`, depending on the prompt

Preferred fallback behavior:

* prefer `template_with_example` when the analysis target is present but evaluation standard is missing
* suppress or stay optional when the target is bounded and semantic ownership is already clear

---

## Rewrite Presentation Contract

Do not change public response fields in this phase.

Existing response behavior already supports:

* `rewritePresentationMode`
* `guidedCompletion`
* `rewrite`
* `evaluation`

The contract remains stable; only internal ownership changes. This matches the existing migration-plan rollout principle. 

### Internal selection order

For semantically owned prompts:

```text
semantic decision
  -> semantic findings
  -> semantic rewrite policy
  -> evaluation
  -> presentation mode selection within policy
```

### Selection constraints

#### `suppressed`

Allowed when:

* semantic recommendation is `no_rewrite_needed`
* or semantic recommendation is `rewrite_optional` and evaluation shows no meaningful gain and semantic policy prefers suppression

#### `full_rewrite`

Allowed only when:

* semantic policy allows full rewrite
* evaluation is `material_improvement`, or equivalent evidence of concrete gains exists
* no strong semantic rewrite-risk rule blocks it

#### `template_with_example`

Preferred when:

* semantic gap is real but bounded
* evaluation suggests full rewrite is risky or low-gain
* semantic state is `usable` or weak-but-clarifiable

#### `questions_only`

Preferred when:

* assumptions would be too speculative
* semantic gap is foundational
* prompt thinness plus gap type makes templated rewriting unsafe

---

## Fallback Reduction Rules

The migration plan already defines Phase 5 as guardrail reduction and deletion of late rescue branches that duplicate semantic interpretation. 

This spec narrows fallback in three classes.

### Keep

Keep fallback for:

* provider failure
* malformed or partial rewrite/evaluation payloads
* prompts outside semantic ownership
* transport or operational safety defaults
* truly unresolved effective-context gaps where semantic is absent

### Narrow

Narrow fallback for:

* issue-copy overrides that restate semantic gaps differently
* best-next-move generation when semantic findings already exist
* rewrite display downgrades that ignore semantic state
* effective-context rescue for families already semantically classified

### Delete

Delete branches whose only purpose is to reinterpret prompts already covered by semantic routing.

Examples include:

* score-only recommendation overrides
* narrow rescue branches that attempt to restate family meaning after semantic classification
* stale category-message suppression hacks kept only because raw scores were previously untrustworthy

Those are explicitly listed as removal candidates in the semantic-decision-core implementation notes. 

---

## Implementation Plan

### Phase A: introduce semantic rewrite policy

Add a new semantic-side module:

```text
packages/heuristics/src/semantic/buildRewritePolicy.ts
```

Inputs:

* `ContextInventory`
* `DecisionState`

Outputs:

* `SemanticRewritePolicy`

No public contract changes.

### Phase B: wire policy into server rewrite path

In `apps/api/src/server.ts`:

* build `semanticRewritePolicy` whenever semantic path is in scope and routed
* pass it into rewrite-presentation selection
* prevent presentation mode from violating semantic policy

This mirrors the server change already made for semantic findings replacing legacy `bestNextMove` generation. 

### Phase C: refactor rewrite presentation to become policy-aware

In `apps/api/src/rewrite/rewritePresentation.ts`:

* preserve current local heuristics
* make them subordinate to semantic policy
* stop using issue-code or score-band heuristics to invent a stronger action than semantic policy allows

### Phase D: guided completion from semantic gaps

Refactor `buildGuidedCompletionQuestions` and related helpers so they accept semantic gap type first, then fall back to role and local context only when semantic data is unavailable. Current logic still derives too much from role and text matching. 

### Phase E: narrow fallback resolver

In `apps/api/src/inference/fallbackResolver.ts` and adjacent server rescue branches:

* keep fallback for absence or failure
* remove semantic reinterpretation for owned prompts
* log when a fallback branch is skipped because semantic already owns the surface

---

## Test Plan

The existing migration plan already requires fixture parity and wording stability.  This phase adds rewrite/fallback-specific parity tests.

### 1. rewrite ownership tests

For each semantically owned family:

* semantic strong + `no_rewrite_needed` must produce `suppressed`
* presentation must not upgrade to `full_rewrite`
* guided completion must be absent

### 2. usable-state downgrade tests

For each family in usable state:

* `rewrite_optional` may produce `template_with_example` or `questions_only`
* `full_rewrite` is only allowed with explicit material improvement evidence and policy approval

### 3. family gap alignment tests

Assert that guided completion and presentation mode align with family-specific semantic gaps:

* implementation -> execution/io/boundary
* comparison -> criteria
* decision_support -> criteria/scenario
* context_first -> context linkage
* few_shot -> example transfer
* analysis -> target criteria or grounding

### 4. fallback suppression tests

For semantically owned prompts:

* legacy fallback must not change family
* legacy fallback must not change rewrite recommendation
* legacy fallback must not replace semantic `bestNextMove`
* legacy fallback must not emit stale generic missing-constraints copy

### 5. regression tests for current rewrite modes

Keep existing mode tests for:

* `possible_regression`
* `material_improvement`
* `no_significant_change`
* `already_strong`

But update them so they run under semantic policy constraints as well. Current rewrite-presentation tests already cover these mode branches. 

---

## Success Criteria

This phase is complete when all are true:

1. Semantically owned prompts cannot receive a rewrite presentation mode that contradicts semantic recommendation state.
2. Guided completion content matches semantic family gaps rather than generic issue-code drift.
3. Fallback no longer reinterprets semantically classified prompts.
4. Existing API fields remain unchanged.
5. Regression tests show lower contradiction across:

   * recommendation
   * best-next-move
   * rewrite presentation mode
   * guided completion
   * displayed findings

---

## Risks

* hidden coupling between rewrite evaluation and current UI expectations
* presentation regressions if policy constraints are too strict too early
* fallback branches that look operational but still encode semantic reinterpretation
* family-specific rewrite-risk rules becoming too conservative for some usable prompts

---

## Rollout Strategy

### Step 1

Ship `SemanticRewritePolicy` behind internal wiring only.

### Step 2

Keep current rewrite-presentation behavior, but log when local presentation mode would have violated semantic policy.

### Step 3

Enforce policy for semantically owned prompts in CI and tests.

### Step 4

Narrow fallback branches in small steps.

### Step 5

Delete obsolete semantic-duplication rescue logic once regression parity is stable.

This is consistent with the repo’s broader rollout strategy of moving ownership first, then removing rescue logic after parity is proven.  

---

## Exit Criteria

This consolidation is complete when:

* semantic interpretation governs recommendation, findings, `bestNextMove`, rewrite recommendation, and rewrite presentation for owned families
* evaluation refines presentation but does not override semantic truth
* guided completion is semantically aligned
* fallback is mostly recovery-oriented rather than interpretive
* the codepath is simpler to explain: one semantic story, many projections

---

## Recommended files

New spec:

```text
specs/semantic-rewrite-and-fallback-consolidation-v0.1.0.md
```

Likely implementation targets:

```text
apps/api/src/server.ts
apps/api/src/rewrite/rewritePresentation.ts
apps/api/src/rewrite/rewritePresentation.test.ts
apps/api/src/inference/fallbackResolver.ts
packages/heuristics/src/semantic/buildRewritePolicy.ts
packages/heuristics/src/semantic/deriveFindings.ts
apps/api/src/server.test.ts
apps/api/src/semanticEval.test.ts
```

If you want, I can turn this into the matching migration-plan doc next, with commit-sized slices and exact test additions.
