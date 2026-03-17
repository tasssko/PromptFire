# PromptFire Migration Plan v0.6.0 — Semantic Decision Core

## Status

Draft

## Purpose

Translate the semantic decision core spec into an implementation plan that can be executed incrementally without breaking the current PromptFire product contract.

This plan assumes:

* the current score-first UI stays in place
* the current public API stays mostly stable in the first phase
* the current system already contains scoring, findings, rewrite recommendation, best-next-move, gating, rewrite generation, and evaluation
* the current issue is architectural brittleness, not just a bad threshold

---

## Migration Goal

Move PromptFire from this shape:

```text
prompt -> heuristic scores -> inference rescue -> guardrail rescue -> recommendation
```

to this shape:

```text
prompt -> semantic context inventory -> decision state -> score projection -> UI
```

The migration should preserve user-facing behavior where it is already correct, while removing cases where equivalent prompts produce different recommendations because of wording.

---

## Principles

1. Do not break the public response contract in phase 1.
2. Introduce the semantic core behind the existing interface first.
3. Compare old and new behavior side by side before switching recommendation logic.
4. Rebase recommendation and findings before rebasing score projection.
5. Delete rescue guardrails only after the new path is stable.

---

## Current Problem Areas To Replace

These are the behaviors the migration is designed to eliminate:

* score categories inferred independently from overlapping heuristics
* recommendation derived mainly from score bands
* inference used as a rescue layer rather than part of a single shared interpretation
* guardrails compensating for upstream brittleness
* issue copy generated from fallback templates rather than semantic gaps
* semantically equivalent prompt variants landing in different states

---

## Target Architecture

### New internal pipeline

```text
request
  -> classify task
  -> extract semantic tags
  -> build context inventory
  -> determine method fit
  -> determine missing-context and blocking state
  -> determine expected improvement and rewrite risk
  -> determine rewrite recommendation
  -> project to public scores
  -> generate findings and best-next-move
  -> maybe generate rewrite
  -> maybe evaluate rewrite
```

### New core internal objects

```ts
type SemanticDecisionCore = {
  taskClass: TaskClass;
  semanticTags: SemanticTagSet;
  contextInventory: ContextInventory;
  decisionState: DecisionState;
  scoreProjection: ScoreProjection;
};
```

---

## Workstreams

The migration is split into five workstreams.

### Workstream A — Semantic foundation

Build shared internal representations.

### Workstream B — Recommendation and findings

Make recommendation and findings depend on semantic interpretation.

### Workstream C — Score projection

Make public scores depend on semantic interpretation.

### Workstream D — Rewrite and evaluation integration

Align rewrite generation and evaluation with the new decision state.

### Workstream E — Cleanup and guardrail removal

Remove obsolete rescue logic once the new path is stable.

---

## Phase 0 — Baseline and Safety Net

### Goal

Document current behavior and add fixtures that expose brittleness before changing logic.

### Tasks

* identify the current server entrypoints for:

  * prompt analysis
  * score calculation
  * recommendation
  * findings generation
  * best-next-move
  * rewrite generation
  * evaluation
* identify where inference is invoked today
* identify where late guardrails modify score or recommendation
* capture a baseline set of current outputs for representative prompts

### Add fixture families now

#### Implementation equivalence family

Use prompts that mean the same thing but vary wording:

* validate against schema
* check against defined contract
* enforce payload shape
* exclude authorization
* leave auth out of scope
* no signature verification

#### Strong decision-support family

Use prompts that mean the same thing but vary constraint phrasing:

* use one startup example and one enterprise example
* include one startup example and one enterprise example
* focus on trade-offs rather than hype
* keep the tone grounded
* avoid hype

#### Pattern-fit family

Use prompts with similar intent but different structure:

* role-based framing
* comparison framing
* decision-frame framing

### Deliverables

* fixture inventory
* snapshot of current outputs
* list of current brittle cases

### Exit criteria

* at least one brittle family is reproducible in tests
* baseline outputs are stored for comparison

---

## Phase 1 — Introduce Semantic Tags

### Goal

Create a shared internal layer of semantic tags without changing product behavior.

### Why first

The current system appears to rediscover the same facts multiple times using different heuristics. This phase creates one reusable representation.

### New internal type

```ts
type SemanticTag =
  | 'has_deliverable'
  | 'has_runtime_context'
  | 'has_framework_context'
  | 'has_input_shape'
  | 'has_output_shape'
  | 'has_success_failure_behavior'
  | 'has_validation_contract'
  | 'has_boundary_exclusion'
  | 'has_boundary_limit'
  | 'has_audience'
  | 'has_org_or_scenario'
  | 'has_examples'
  | 'has_comparison_axis'
  | 'has_tradeoff_frame'
  | 'has_proof_requirement'
  | 'has_tone_bound'
  | 'has_overload_signal'
  | 'has_internal_contradiction';

type SemanticTagSet = Set<SemanticTag>;
```

### Tasks

* add a semantic tag extractor module
* make it deterministic
* support synonym groups, not just literal phrases
* log extracted tags in debug output only
* do not change recommendation yet

### Detection design guidance

Detect by meaning clusters, for example:

* validation cluster: schema, contract, payload shape, validate, verify structure, enforce format
* exclusion cluster: exclude, without, do not include, out of scope, leave out
* trade-off cluster: when X helps and when it hurts, pros and cons, real trade-offs, rather than hype
* example cluster: use one example, include one example, startup example, enterprise example

### Deliverables

* semantic tag extractor
* unit tests for tag extraction
* debug logging support

### Exit criteria

* known equivalent prompts produce similar tag sets
* tags can explain at least the main brittle webhook and strong-prompt cases

---

## Phase 2 — Build Context Inventory

### Goal

Build a richer internal context inventory from the tag set.

### Tasks

* define `TaskClass`
* define `ContextInventory`
* define `MethodFit`
* map tag sets into grouped context buckets
* add a deterministic task classifier
* add a deterministic method-fit classifier

### Implementation note

Task classification should be lightweight and deterministic. It does not need to be perfect to add value. It only needs to be better than using one shared set of audience-style assumptions for every prompt.

### Deliverables

* task classifier
* context inventory builder
* method-fit classifier
* unit tests for context inventory mapping

### Exit criteria

* prompts from the same semantic family produce equivalent context inventory summaries
* developer implementation prompts stop depending on marketer-style interpretation internally

---

## Phase 3 — Introduce Decision State In Shadow Mode

### Goal

Compute a semantic decision state alongside the current system, but do not switch behavior yet.

### New internal type

```ts
type DecisionState = {
  semanticState: 'blocked' | 'weak' | 'usable' | 'strong';
  missingContextType: MissingContextType | null;
  majorBlockingIssues: boolean;
  expectedImprovement: 'low' | 'medium' | 'high';
  rewriteRisk: 'low' | 'medium' | 'high';
  rewriteRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed';
};
```

### Tasks

* derive decision state from context inventory
* derive task-aware missing-context rules
* derive expected improvement from semantic gaps
* derive rewrite risk from semantic sufficiency plus rewrite preference context
* keep current public outputs unchanged
* write side-by-side comparison tests between old and new recommendation state

### Deliverables

* decision-state builder
* shadow-mode comparison tests
* telemetry or debug comparison output

### Exit criteria

* decision state matches intended result for key brittle families
* shadow mode shows fewer false rewrite escalations than the current path

---

## Phase 4 — Rebase Recommendation And Findings

### Goal

Make recommendation and findings use the semantic decision state as the source of truth.

### Tasks

* switch `rewriteRecommendation` to semantic decision state
* switch `majorBlockingIssues` derivation to semantic decision state
* rework issue generation so issues are emitted from semantic gaps
* update summary copy generation so it reflects semantic interpretation
* update best-next-move generation so it aligns with method fit and decision state
* keep the public score projection on the old path for now if needed

### Important rule

Findings must describe what is insufficient, ambiguous, or missing semantically.
They must not claim total absence when the prompt already clearly contains a category.

### Deliverables

* semantic recommendation path
* semantic issue-generation path
* semantic best-next-move path
* updated regression tests

### Exit criteria

* stale missing-constraints messages disappear for bounded prompts
* semantically equivalent prompts land in the same recommendation state
* best-next-move no longer contradicts recommendation

---

## Phase 5 — Rebase Score Projection

### Goal

Make public scores a projection of semantic interpretation.

### Tasks

* define score projection rules from context inventory
* implement projection for:

  * scope
  * contrast
  * clarity
  * constraintQuality
  * genericOutputRisk
  * tokenWasteRisk
* rework overall score to summarize semantic state
* clamp and round at the final projection layer only
* compare score stability across semantic-equivalence fixtures

### Important rule

Overall score becomes a summary metric.
It must not overturn the already-derived recommendation state.

### Deliverables

* score projection module
* projection tests
* score-drift comparison report for regression fixtures

### Exit criteria

* semantically equivalent prompts have low score variance
* public score aligns better with recommendation state
* contrast no longer depends on decorative rarity

---

## Phase 6 — Align Rewrite Generation And Evaluation

### Goal

Make rewrite behavior reflect the new decision state instead of fighting it.

### Tasks

* feed semantic decision state into rewrite gating
* suppress default rewrite display for `no_rewrite_needed`
* ensure forced rewrites can still happen when requested
* feed semantic inventory into rewrite generation prompts where useful
* align evaluation language with rewrite risk and expected improvement

### Deliverables

* updated rewrite gating
* updated rewrite evaluation integration
* regression tests for forced rewrite versus default suppression

### Exit criteria

* strong prompts are not auto-rewritten by default
* forced rewrites still work
* evaluation no longer implies rewrite necessity when the prompt is already sufficient

---

## Phase 7 — Remove Obsolete Rescue Logic

### Goal

Delete late-stage logic that only exists to rescue earlier brittle stages.

### Candidates for removal

* score-only recommendation overrides
* narrow inference rescue branches that duplicate semantic interpretation
* stale category-specific message suppression hacks
* recommendation guardrails that only exist because raw score was untrustworthy

### Tasks

* identify rescue logic now made redundant by semantic decision state
* remove it in small steps
* preserve product-protective guardrails only
* rerun full regression suite after each removal step

### Exit criteria

* fewer late-stage corrections
* recommendation remains stable without rescue patches
* codepath is simpler to explain and maintain

---

## Suggested Module Plan

This is intentionally generic so it can be mapped onto the existing repo structure.

### New modules

```text
semantic/
  extractSemanticTags.ts
  classifyTask.ts
  buildContextInventory.ts
  assessMethodFit.ts
  buildDecisionState.ts
  projectScores.ts
  generateSemanticFindings.ts
  generateSemanticBestNextMove.ts
```

### Likely integration points

* analysis orchestration entrypoint
* current score calculation entrypoint
* current recommendation/gating logic
* current rewrite generation input builder
* current evaluation input builder

### Refactor direction

The long-term goal is for current heuristics to either:

* move into semantic tag extraction, or
* be deleted if duplicated elsewhere

---

## Testing Plan

### 1. Unit tests

Add targeted tests for:

* semantic tag extraction
* task classification
* context inventory mapping
* method fit
* decision state derivation
* score projection

### 2. Fixture-family tests

For each semantic-equivalence family, assert:

* same recommendation state
* similar score band
* similar issue family
* no stale missing-category message

### 3. Shadow comparison tests

Before switching recommendation logic, compare:

* old recommendation
* new decision state recommendation
* key issue-copy differences

### 4. End-to-end tests

Update existing end-to-end analysis tests so they validate:

* recommendation state
* top finding
* best-next-move
* rewrite suppression behavior

---

## Rollout Strategy

### Step 1

Ship semantic extraction and context inventory behind internal debug mode only.

### Step 2

Ship decision state in shadow mode and compare outputs in CI.

### Step 3

Switch recommendation and findings to the semantic path.

### Step 4

Switch score projection to the semantic path.

### Step 5

Remove obsolete guardrails and rescue branches.

### Optional

Expose a debug-only `decision` object during rollout for internal inspection.

---

## Success Metrics

The migration is successful if the following improve:

### Stability

* lower recommendation variance across semantically equivalent prompts
* lower issue-copy variance across semantic-equivalence fixtures

### Trust

* fewer false `CONSTRAINTS_MISSING` findings
* fewer rewrite recommendations for already-bounded prompts
* fewer rewrites that are weaker than the original

### Simplicity

* fewer late-stage guardrail edits
* fewer recommendation overrides based on special cases
* easier explanation of why a prompt got its verdict

---

## First Suggested Implementation Slice

Start small.

### Slice A

Implement only for bounded developer implementation prompts first:

* semantic tag extraction
* task classification for `implementation`
* context inventory for execution/input-output/validation/boundary
* decision state for `implementation`
* semantic recommendation in shadow mode

### Why this slice

* it hits the currently painful bug family directly
* it exercises the full architecture on a narrow domain
* it avoids redesigning all roles and modes at once

### First fixtures to ship

* bounded webhook canonical phrasing
* bounded webhook synonym phrasing
* bounded webhook out-of-scope phrasing
* thin webhook prompt baseline

---

## Risks

### Risk 1 — Parallel complexity during migration

Mitigation: keep the semantic path shadow-only until recommendation parity is good enough.

### Risk 2 — Task classification becomes another brittle layer

Mitigation: keep classification coarse and deterministic.

### Risk 3 — Score changes destabilize the UI

Mitigation: switch recommendation first, score projection second.

### Risk 4 — Too many moving pieces change at once

Mitigation: migrate by workstream and keep slices narrow.

---

## Open Questions

1. Should semantic tags be included in debug responses during rollout?
2. Should decision state be exposed in internal tooling before public API changes?
3. What score variance threshold is acceptable for semantically equivalent prompt families?
4. Which current modules should be treated as the orchestration boundary for the new pipeline?

---

## Recommended Next Docs

After this migration plan, create:

```text
specs/semantic-decision-core-implementation-slice-a.md
```

That follow-on doc should define:

* the first domain to migrate
* exact modules to touch
* exact tests to add
* what stays on the old path for now

---

## Implementation Checklist

### Baseline

* [ ] Capture current brittle fixtures
* [ ] Snapshot current outputs

### Semantic foundation

* [ ] Add semantic tag extractor
* [ ] Add semantic tag tests
* [ ] Add task classifier
* [ ] Add context inventory builder
* [ ] Add method-fit classifier

### Shadow mode

* [ ] Add decision-state builder
* [ ] Compute semantic recommendation in shadow mode
* [ ] Compare old and new outputs in tests

### Switch recommendation

* [ ] Move recommendation to semantic path
* [ ] Move findings to semantic path
* [ ] Move best-next-move to semantic path

### Switch scores

* [ ] Move score projection to semantic path
* [ ] Recalibrate score weights if needed only after projection is stable

### Rewrite alignment

* [ ] Align rewrite gating with semantic decision state
* [ ] Align evaluation language with rewrite risk

### Cleanup

* [ ] Remove obsolete rescue branches
* [ ] Remove obsolete recommendation guardrails
* [ ] Simplify orchestration path
