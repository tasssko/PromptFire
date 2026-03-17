# PromptFire Migration Plan v0.6.0 — Semantic Decision Core

## Status

Draft

## Purpose

Translate the `semantic-decision-core-v0.6.0.md` architecture spec into an incremental implementation plan that can ship without breaking the current API or results UI.

---

## Rollout Principles

1. Keep public API and UI behavior stable while internal decisioning changes.
2. Make semantic interpretation the internal source of truth before removing rescue logic.
3. Ship behind test coverage and fixture parity, not by replacing everything at once.

---

## Phase 1: Internal Types And Inventory

Scope:

* define `TaskClass`
* define `ContextInventory`
* define `DecisionState`
* define `ScoreProjection`
* add shared semantic tags for reusable narrowing signals

Expected output:

* internal types exist in deterministic analysis code
* no public contract change yet

---

## Phase 2: Deterministic Semantic Extraction

Scope:

* derive task class from prompt intent
* detect functional narrowing signals rather than raw keyword presence
* normalize semantically equivalent phrasing into shared tags
* capture method fit and overload state in one inventory

Expected output:

* one semantic inventory builder feeds downstream decisions
* duplicated detector logic starts collapsing into one path

---

## Phase 3: Semantic-First Recommendation

Scope:

* derive recommendation from `DecisionState` before score projection
* align missing-context logic with semantic gaps
* align best-next-move with task class, method fit, and missing functional context
* gate rewrites from semantic sufficiency and expected improvement

Expected output:

* recommendation stops depending primarily on score bands
* semantically bounded prompts stop falling into generic missing-constraints advice

---

## Phase 4: Score Projection Rebase

Scope:

* project current public scores from semantic inventory
* preserve existing score shape where possible
* prevent public score from overriding the semantic recommendation state

Expected output:

* current UI keeps working
* visible scores become a summary of semantic interpretation

---

## Phase 5: Guardrail Reduction

Scope:

* identify inference and rescue logic made obsolete by the semantic core
* keep only guardrails that still protect against real regressions
* delete late rescue branches that duplicate semantic interpretation

Expected output:

* less contradictory messaging
* fewer special-case patches in recommendation flow

---

## Test Plan

Add fixture families for:

* semantically equivalent implementation prompts with different wording
* bounded developer prompts with runtime, validation, exclusions, and status behavior
* persuasion prompts with real audience and proof requirements
* comparison and decision-support prompts with explicit criteria
* overloaded prompts that should still trigger rewrite or narrowing guidance

Success criteria:

* recommendation state is stable across wording variants
* best-next-move aligns with actual missing semantic context
* scores can vary modestly, but recommendation should not contradict semantic sufficiency

---

## Implementation Order

1. Add internal types and semantic tag vocabulary.
2. Build semantic inventory extraction.
3. Route recommendation and best-next-move through decision state.
4. Rebase score projection onto semantic inventory.
5. Remove obsolete rescue logic after fixture parity is stable.

---

## Risks

* hidden coupling between current score logic and UI messaging
* duplicated heuristics that appear separate but encode the same semantic fact
* regression risk if score projection changes before recommendation logic is stabilized

---

## Exit Criteria

This migration is complete when:

* semantic inventory is the internal source of truth
* recommendation is derived before score projection
* best-next-move and findings come from semantic gaps
* rescue logic is materially reduced
* existing UI contract still works without contradiction
