# PromptFire Spec v0.6.0 — Semantic Decision Core

## Status

Draft

## Owner

PromptFire

## Summary

PromptFire should move from a score-first architecture with late rescue logic to a semantic decision core.

Instead of deriving recommendation from raw score bands and then trying to repair incorrect outcomes with inference and guardrails, the system should first determine what functional narrowing signals are present in the prompt, decide what the prompt actually needs, and only then project that interpretation into public scores and UI messaging.

This keeps the current score-first UI while making semantics the source of truth.

---

## Problem

The current system has a recurring failure mode:

* semantically bounded prompts can be scored too harshly
* recommendation can vary too much based on wording
* guardrails are forced to rescue misclassified prompts late in the pipeline
* the visible UI can display messages that contradict what the prompt clearly contains

This is especially visible for bounded developer prompts where runtime, validation, status-code behavior, exclusions, and other real constraints are present, but the system still falls back to generic missing-constraints advice.

The product promise is simple:

> Paste a prompt, get one clear score, and only see rewrites when they are worth using.

To keep that promise, recommendation state must come from semantic interpretation, not from brittle lexical scoring.

---

## Goals

1. Make semantically equivalent prompts land in the same recommendation state.
2. Make rewrite recommendation semantic-first rather than score-first.
3. Keep the current public scoring categories and score-first UI.
4. Remove the need for most late rescue guardrails.
5. Ensure findings and best-next-move advice match what the prompt actually contains.

---

## Non-Goals

This phase does not:

* replace the current UI
* remove public sub-scores
* remove deterministic heuristics
* require embeddings or a learned model
* redesign rewrite evaluation
* change rewrite preference semantics
* introduce personalization or memory

---

## Core Principle

PromptFire should decide what a prompt needs by understanding what functional narrowing signals are present, then derive scores, findings, and rewrite behavior from that shared interpretation.

### Implications

* Reward composition over decoration.
* Treat common category language as acceptable when it does real work.
* Treat semantically equivalent phrasing as equivalent.
* Use the score as a summary view, not as the primary decision-maker.
* Suppress rewrites by default when semantic sufficiency is already high and expected improvement is low.

---

## Architecture Shift

### Current shape

```text
prompt -> heuristic scores -> inference rescue -> guardrail rescue -> recommendation
```

### New shape

```text
prompt -> semantic context inventory -> decision state -> score projection -> UI
```

This means:

* semantics become the source of truth
* score becomes a projection of semantics
* findings, next move, and rewrite gating must all align with the same internal interpretation

---

## Internal Model

### SemanticDecisionCore

```ts
type SemanticDecisionCore = {
  taskClass: TaskClass;
  methodPattern: PromptPattern | null;
  contextInventory: ContextInventory;
  decisionState: DecisionState;
  scoreProjection: ScoreProjection;
};
```

### TaskClass

```ts
type TaskClass =
  | 'implementation'
  | 'persuasion'
  | 'explanation'
  | 'comparison'
  | 'decision_support'
  | 'transformation'
  | 'analysis'
  | 'unknown';
```

Purpose:

* normalize prompt families before scoring
* stop marketer assumptions leaking into developer prompts
* stop developer prompts being judged only through audience-style logic

Examples:

* webhook handler prompt -> `implementation`
* landing page copy prompt -> `persuasion`
* compare two approaches prompt -> `comparison`
* when X helps vs hurts prompt -> `decision_support`

### ContextInventory

```ts
type ContextInventory = {
  deliverable: {
    present: boolean;
    type: string | null;
    strength: 'none' | 'weak' | 'clear';
  };
  executionContext: {
    present: boolean;
    runtimeOrEnvironment: string[];
    frameworkOrSurface: string[];
  };
  inputOutputContext: {
    present: boolean;
    inputShape: string[];
    outputShape: string[];
    successFailureBehavior: string[];
  };
  validationContext: {
    present: boolean;
    validationType: string[];
    contractDefined: boolean;
  };
  boundaryContext: {
    present: boolean;
    inclusions: string[];
    exclusions: string[];
    limits: string[];
    toneOrStyleBounds: string[];
  };
  audienceContext: {
    present: boolean;
    audience: string[];
    orgOrScenario: string[];
  };
  differentiationContext: {
    present: boolean;
    framing: string[];
    comparisonAxes: string[];
    tensions: string[];
    examples: string[];
    proofRequirements: string[];
  };
  methodFit: {
    currentPattern: PromptPattern | null;
    recommendedPattern: PromptPattern | null;
    fit: 'strong' | 'acceptable' | 'weak';
  };
  overload: {
    present: boolean;
    reasons: string[];
  };
};
```

### Functional Presence Rule

A signal is present only when it does narrowing work.

Examples:

* `TypeScript for Node.js` -> execution context present
* `validate request body against schema` -> validation context present
* `leave authorization out of scope` -> exclusion present
* `avoid hype` -> exclusion present
* `use one startup example and one enterprise example` -> example requirement present
* a topic label alone is not enough to count as differentiation

---

## Decision Pipeline

```text
validate request
  -> derive taskClass
  -> derive contextInventory
  -> assess methodFit
  -> assess missing-context and blocking state
  -> assess expectedImprovement
  -> assess rewriteRisk
  -> decide rewriteRecommendation
  -> project to public scores
  -> generate findings, suggestions, bestNextMove
  -> maybe generate rewrite
  -> maybe evaluate rewrite
```

### Rule

Recommendation must be derived before score projection.

Public score must not be allowed to overturn a stronger semantic interpretation.

---

## Decision State

```ts
type SemanticState = 'blocked' | 'weak' | 'usable' | 'strong';

type RewriteRisk = 'low' | 'medium' | 'high';

type DecisionState = {
  semanticState: SemanticState;
  missingContextType: MissingContextType | null;
  majorBlockingIssues: boolean;
  expectedImprovement: 'low' | 'medium' | 'high';
  rewriteRisk: RewriteRisk;
  rewriteRecommendation: RewriteRecommendation;
};
```

### RewriteRecommendation

```ts
type RewriteRecommendation =
  | 'rewrite_recommended'
  | 'rewrite_optional'
  | 'no_rewrite_needed';
```

### Semantic-first rules

#### `no_rewrite_needed`

Use when all are true:

* the prompt is well bounded for its task class
* no major blocking issue is present
* method fit is strong or acceptable
* expected improvement is low
* rewrite risk is not lower than keep-original risk
* rewrite preference is not `force`

#### `rewrite_optional`

Use when:

* the prompt is usable
* one or two concrete improvements would help
* rewrite may help but is not clearly necessary

#### `rewrite_recommended`

Use when:

* foundational context is missing for the task class
* or generic-output risk is still high after semantic interpretation
* or method fit is weak enough that the current form is likely to underperform

---

## Missing Context Rules

Replace one-size-fits-all constraint messaging with task-aware missing-context classification.

### For `implementation`

Foundational context can be satisfied by enough signal across these groups:

* deliverable
* execution context
* input/output behavior
* validation or contract behavior
* exclusions or scope boundaries

A prompt does not need every group to avoid `CONSTRAINTS_MISSING`.

### For `persuasion`

Foundational context can be satisfied by enough signal across:

* audience
* business pressure or scenario
* framing or lead angle
* proof requirements or exclusions

### For `comparison` and `decision_support`

Foundational context can be satisfied by enough signal across:

* comparison or decision object
* evaluation frame or trade-off axis
* examples or scenario
* exclusions or framing boundaries

### Rule

Do not emit broad missing-constraints copy just because canonical words are absent.

The system should identify semantic insufficiency, not keyword absence.

---

## Method Fit

PromptFire already reasons about best-next-move patterns such as role-based versus comparison versus decision-frame prompts. This should become a first-class internal concept.

### Requirement

Every prompt gets a method-fit assessment:

```ts
methodFit: {
  currentPattern: PromptPattern | null;
  recommendedPattern: PromptPattern | null;
  fit: 'strong' | 'acceptable' | 'weak';
}
```

### Product use

Method fit influences:

* rewrite recommendation
* best-next-move
* findings
* rewrite generation style

Pattern shifts should be preferred over superficial polish when the current method is weak for the task.

---

## Score Projection

Public score categories remain unchanged:

* scope
* contrast
* clarity
* constraintQuality
* genericOutputRisk
* tokenWasteRisk

### Projection rules

Each public score is derived from the shared context inventory.

#### Scope

Derived from:

* deliverable clarity
* boundedness
* overload absence
* relevant context sufficiency

#### Contrast

Derived from:

* meaningful differentiation
* trade-off framing
* exclusions that steer away from default output
* scenario-specific framing
* comparison or tension signals

Do not use uncommon wording as a proxy.

#### Clarity

Derived from:

* directness
* internal consistency
* readability
* absence of contradictions

#### Constraint Quality

Derived from:

* usefulness of constraints
* examples, limits, exclusions, required structure
* functional narrowing rather than keyword count

#### Generic Output Risk

Derived from:

* what remains underspecified after semantic interpretation
* lack of differentiation
* lack of task-shaped boundaries

#### Token Waste Risk

Derived from:

* overload
* sprawl
* likely reruns caused by ambiguity

### Overall Score

Overall score summarizes the semantic decision state.

It should never override a stronger semantic recommendation.

---

## Issue Generation

Issues must come from semantic gaps, not directly from low score values.

### Good examples

* The prompt defines the implementation language and success/failure behavior, but not the request contract.
* The prompt defines the audience and topic, but not the decision criteria.
* The prompt includes useful exclusions, but the task load is still broad.

### Avoid

* Runtime, input, validation, or failure constraints are missing when those are visibly present.
* generic fallback wording that sounds templated
* issue copy that implies total absence when the real problem is insufficiency or ambiguity

---

## Best Next Move

Keep `bestNextMove`, but compute it from the same semantic core.

### Rule

`bestNextMove` must never contradict the recommendation state.

Examples:

* if recommendation is `no_rewrite_needed`, best-next-move must be optional and low-pressure
* if recommendation is `rewrite_recommended`, best-next-move should target the primary structural gap
* if method fit is weak, best-next-move should favor pattern change over wording polish

---

## Rewrite Gating

### Rewrite preference precedence

1. `suppress` -> never generate rewrite
2. `force` -> always generate rewrite
3. otherwise use semantic recommendation

### Semantic recommendation behavior

* `no_rewrite_needed` -> no rewrite by default
* `rewrite_optional` -> rewrite may be shown, but not framed as required
* `rewrite_recommended` -> rewrite is allowed and encouraged

### Rewrite risk

A prompt with high semantic sufficiency and low expected improvement may still have medium or high rewrite risk because rewrite could wash out useful detail.

This must be reflected in rewrite gating and evaluation language.

---

## API Approach

### First phase

Keep the current public response shape stable.

Optional debug-only addition:

```ts
decision?: {
  taskClass: TaskClass;
  methodFit: 'strong' | 'acceptable' | 'weak';
  semanticState: 'blocked' | 'weak' | 'usable' | 'strong';
  rewriteRisk: 'low' | 'medium' | 'high';
}
```

### Internal requirement

The server must construct one shared semantic object before:

* score projection
* findings generation
* improvement suggestions
* best-next-move
* rewrite gating
* rewrite evaluation

---

## Migration Plan

### Phase 1 — Introduce semantic core behind current API

* add `taskClass`
* add `contextInventory`
* add `decisionState`
* preserve public response contract
* compare old and new outputs in tests

### Phase 2 — Rebase recommendation and issue generation

* drive recommendation from decision state
* drive findings from semantic gaps
* stop using score band as recommendation source

### Phase 3 — Rebase score projection

* derive all public scores from context inventory
* remove duplicated detectors that guess the same fact in multiple places
* keep weighting only as a projection step

### Phase 4 — Simplify guardrails

* remove analysis-repair guardrails that only exist to rescue brittle earlier stages
* keep only product-protective guardrails

---

## Acceptance Criteria

### Stability

* semantically equivalent prompts with different wording land in the same recommendation state
* bounded developer prompts no longer depend on exact wording like `schema` versus `contract`
* `exclude` and `out of scope` style variants are treated consistently

### Trust

* findings no longer claim major categories are missing when they are visibly present
* best-next-move aligns with recommendation state
* strong prompts do not need narrow rescue logic to avoid rewrite escalation

### Simplicity

* recommendation can be explained without score arithmetic
* one internal interpretation feeds score, findings, best-next-move, and rewrite behavior
* late-stage corrective guardrails decrease over time

### UI alignment

* the current score-first interface still works
* public score remains stable enough to trust
* visible copy matches semantic state

---

## Regression Fixture Families

### Implementation family

Use semantically equivalent variants:

1. validate against schema
2. check against defined contract
3. enforce payload shape
4. leave auth out of scope
5. exclude authorization
6. no signature verification

Expected:

* same recommendation state
* no stale missing-constraints issue
* similar score band

### Decision-support family

Use semantically equivalent variants:

1. use one startup and one enterprise example
2. include one startup example and one enterprise example
3. compare startup and enterprise trade-offs
4. avoid hype / keep tone grounded / focus on real trade-offs

Expected:

* same strong-or-usable state
* no `CONSTRAINTS_MISSING`
* rewrite suppressed by default when expected improvement is low

### Pattern-fit family

Use structurally similar prompts across:

1. role-based framing
2. explicit comparison framing
3. explicit decision framing

Expected:

* method-fit differences influence best-next-move
* recommendation does not overreact when semantics are similar

---

## Engineering Notes

### Avoid duplicated detectors

Do not separately infer score presence, issue presence, recommendation state, and best-next-move triggers from unrelated local heuristics when they are describing the same semantic fact.

### Prefer normalized semantic tags

Examples:

* `has_validation_contract`
* `has_success_failure_behavior`
* `has_exclusion_boundary`
* `has_decision_frame`
* `has_example_requirement`
* `has_output_shape`

These tags should be reused everywhere.

### Deterministic implementation

This phase does not require opaque model judgment.
A deterministic semantic inventory is enough.

---

## Open Questions

1. Should `decision` remain internal-only in the first rollout?
2. Should method fit be visible in debug mode before it becomes a product concept?
3. How much score variance should be allowed across semantically equivalent fixtures?
4. Should rewrite risk become part of evaluation output later?

---

## Recommended Files

Suggested new spec file:

```text
specs/semantic-decision-core-v0.6.0.md
```

Suggested follow-on implementation plan file:

```text
specs/semantic-decision-core-migration-plan-v0.6.0.md
```

---

## Implementation Checklist

* [ ] Define `TaskClass`
* [ ] Define `ContextInventory`
* [ ] Define `DecisionState`
* [ ] Build deterministic semantic tag extraction
* [ ] Derive semantic recommendation before score projection
* [ ] Rework findings generation to use semantic gaps
* [ ] Rework best-next-move to use method fit and decision state
* [ ] Rebase score projection onto semantic inventory
* [ ] Add regression fixture families for semantic equivalence
* [ ] Remove obsolete rescue guardrails once stable
