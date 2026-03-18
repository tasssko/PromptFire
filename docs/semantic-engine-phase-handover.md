Here’s a project handover note you can drop into the repo or use as the next-chat restart context.

---

# PromptFire Semantic Engine Handover — Rewrite Policy And Late-Branch Cleanup Phase

## Purpose of this handover

This note captures the completed phase where PromptFire finished the semantic consolidation work for rewrite presentation and late-branch cleanup.

It is meant to let a new chat or new contributor restart work without losing:

* what problem this phase was solving
* what was implemented
* what changed architecturally
* what is now considered complete
* what should happen next

---

## Phase summary

This phase completed the shift from “semantic recommendation plus parallel rewrite heuristics” to “semantic state as the source of truth for covered families across recommendation, findings, best-next-move, rewrite policy, rewrite presentation, and guided completion.”

The driving architecture for this phase was:

* rewrite presentation must become a downstream consumer of semantic state rather than an alternate verdict engine
* guided completion must follow semantic family and gap first
* late rescue logic must be reduced so it no longer reinterprets semantically owned prompts
* public API shape must remain stable throughout the migration  

The target end state for the phase was:

* semantic interpretation governs recommendation, findings, `bestNextMove`, rewrite recommendation, and rewrite presentation for owned families
* evaluation refines presentation but does not override semantic truth
* guided completion is semantically aligned
* fallback is mostly recovery-oriented rather than interpretive 

That phase is now complete.

---

## Why this phase was needed

Before this work, the server already gave semantic findings authority over `bestNextMove`, but rewrite display still had its own local posture logic and guided completion still relied too heavily on role/text heuristics. The result was a dual-truth seam:

* semantic recommendation could say one thing
* rewrite display could still imply another
* fallback and late rescue logic could still restate weakness generically

The rewrite/fallback consolidation spec defined the fix:

* add an internal semantic rewrite policy
* make rewrite presentation operate inside semantic policy bounds
* drive guided completion from semantic gaps
* narrow or delete late branches that duplicate semantic interpretation  

---

## What was implemented in this phase

This phase was delivered in a sequence of focused slices.

### 1. Semantic rewrite policy was introduced

A semantic-side rewrite policy layer was added so rewrite presentation could operate inside semantic bounds rather than reinterpreting prompts locally.

The design goal from the spec was:

* semantic decision
* semantic findings
* semantic rewrite policy
* evaluation as evidence
* presentation selection within policy  

The policy model established these rules:

* `no_rewrite_needed` can only surface as `suppressed`
* `rewrite_optional` can yield bounded optional help, but not an unbounded full rewrite unless policy explicitly allows it
* `rewrite_recommended` can still use full rewrite, template, or questions depending on policy and evaluation
* evaluation is advisory, not sovereign 

### 2. Guided completion became semantic-gap-first

Guided completion was refactored so semantically owned prompts use family plus semantic gap first, with role/text heuristics only as fallback when semantic data is absent.

That behavior matches the spec requirement that guided completion stop inferring too much from role, `bestNextMove` text, and generic missing-context heuristics, and instead follow family-specific semantic gaps.  

### 3. Canonical `primaryGap` selection was added

A deterministic semantic gap selector was introduced so equivalent prompts with equivalent semantic inventory no longer drift into different downstream guided-completion or rewrite-presentation behavior.

This was necessary because the cleanup phase is only truly stable if equivalent prompts land on the same family, semantic state, rewrite recommendation, and primary semantic gap. The spec explicitly made deterministic gap selection part of the cleanup contract. 

### 4. Late owned-path reinterpretation was fenced and then reduced

The late-branch cleanup work proceeded in stages:

* first, make the semantic-owned path explicit
* then reduce owned-path reinterpretation in rewrite presentation
* then leave only downgrade, suppress, or operational recovery behavior for owned prompts

The intended fallback shape from the spec was:

* keep provider failure, malformed-output handling, and non-owned fallback
* narrow issue-copy, rewrite-display, and effective-context rescue logic
* delete branches whose only purpose is to reinterpret prompts already covered by semantic routing 

### 5. Package-boundary and repo-surface cleanup was completed

The final cleanup restored API-side heuristics imports back to the package root, trimmed stale comments, and made the final authority model easier to read in code, without changing behavior.

This matches the phase exit goal of making the codepath simpler to explain as one semantic story with bounded downstream projections. 

---

## What is now true after this phase

For covered semantic families, the effective authority model is now:

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

This is the architecture the spec was targeting for semantically owned prompts. 

In practical product terms, that means:

* semantic recommendation is the source of truth for rewrite posture
* semantic findings are the source of truth for issue framing and `bestNextMove`
* guided completion follows semantic family and gap for owned prompts
* evaluation can still help choose between allowed display modes, but cannot override semantic intent
* fallback behavior is now mainly recovery-oriented rather than interpretive 

---

## Public contract impact

No public API shape change was made in this phase.

That was an explicit requirement of the rewrite/fallback consolidation work:

* keep `rewritePresentationMode`
* keep `guidedCompletion`
* keep `rewrite`
* keep `evaluation`
* change internal authority, not the response contract 

---

## Test posture and acceptance criteria

The key acceptance criteria for this phase were:

* semantically owned prompts cannot receive a rewrite presentation mode that contradicts semantic recommendation state
* guided completion aligns with semantic family gaps rather than generic issue-code drift
* fallback no longer reinterprets semantically classified prompts
* existing API fields remain unchanged
* regression coverage confirms lower contradiction across recommendation, findings, rewrite presentation, and guided completion 

Within the implementation work, the practical regression checks became:

* owned prompts can downgrade but not escalate
* owned prompts never regain stale generic missing-context messaging
* equivalent prompts keep the same `primaryGap`
* equivalent prompts get materially similar guided-completion behavior

Those checks now define the stability bar for this phase.

---

## Files and areas affected

The spec identified these as the main implementation surfaces for the phase:

* `apps/api/src/server.ts`
* `apps/api/src/rewrite/rewritePresentation.ts`
* `packages/heuristics/src/semantic/buildRewritePolicy.ts`
* `packages/heuristics/src/semantic/deriveFindings.ts`
* `apps/api/src/rewrite/rewritePresentation.test.ts`
* `apps/api/src/server.test.ts`
* `apps/api/src/semanticEval.test.ts` 

In the completed implementation sequence, this phase also introduced a canonical semantic gap selector and cleaned up package-boundary imports.

---

## What was intentionally not done

This phase did **not**:

* expand semantic family coverage further
* redesign rewrite evaluation
* redesign guided-completion templates/examples more broadly
* change public scoring categories or response shape
* remove all non-owned fallback behavior
* do broad semantic tag renames

Those were explicitly out of scope for the rewrite/fallback consolidation work. 

---

## Recommended next steps

Now that the rewrite policy and late-branch cleanup phase is complete, the next work should move away from cleanup and back toward product progress.

The best options are:

### Option 1: resume semantic coverage expansion

Continue adding remaining prompt families so more of the product runs on the semantic core rather than legacy fallback.

### Option 2: improve rewrite/template quality inside the new semantic bounds

Now that rewrite posture is semantically controlled, improve the quality of templates/examples and family-specific guided-completion content without reopening the authority question.

### Option 3: stabilization pass

Run one explicit end-to-end verification pass across:

* semantic core tests
* rewrite presentation tests
* server tests

This is the best immediate follow-up if you want to lock the phase down before starting new coverage work.

---

## Recommended one-line status

Use this as the phase status summary:

**The semantic rewrite policy and late-branch cleanup phase is complete: for covered families, semantic state now governs recommendation, findings, best-next-move, rewrite policy, rewrite presentation, and guided-completion framing, while late logic is limited to downgrade, suppress, or recovery.**

---

## Recommended restart prompt for the next chat

Use this when resuming work:

> PromptFire has completed the semantic rewrite policy and late-branch cleanup phase. For covered families, semantic state is now the source of truth for recommendation, findings, best-next-move, rewrite policy, rewrite presentation, and guided completion. Public API shape did not change. The next step is to either expand semantic family coverage or improve rewrite/template quality inside the current semantic bounds. Start by reviewing the current semantic architecture and identifying the highest-value next slice.

If you want, I can also turn this into a shorter `docs/phase-handover.md` version for direct commit.
