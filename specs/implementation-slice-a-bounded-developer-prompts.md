# PromptFire Implementation Slice A — Bounded Developer Prompts

## Status

Draft

## Purpose

Define the first implementation slice for the semantic decision core migration.

This slice is intentionally narrow. It applies only to **developer implementation prompts**, with a first focus on **bounded webhook / handler style prompts**.

The goal is to prove the new architecture on the prompt family currently exposing the strongest brittleness:

* bounded technical prompts being treated as weak because wording differs
* stale `CONSTRAINTS_MISSING` style messaging appearing when real constraints are already present
* recommendation being driven by score-first logic instead of semantic sufficiency

This slice should be small enough to implement without redesigning PromptFire all at once.

---

## Why This Slice First

This domain is a good first slice because:

* it is already causing visible trust problems
* the prompts are specific and easier to normalize semantically
* there are already regression examples in the repo direction
* it exercises the full pipeline: classification, context extraction, recommendation, findings, and score projection
* it lets us prove the architecture with a bounded problem before expanding to general and marketer modes

---

## Scope

## Included

This slice applies to prompts that are all of the following:

* role or inferred role is `developer`
* task class is `implementation`
* deliverable is code or a handler / endpoint / function / module implementation
* prompt is in the family of bounded server-side implementation requests

Primary examples:

* webhook handler
* endpoint
* API handler
* request handler
* Express route / Node handler / server function

## Excluded

This slice does not yet attempt to solve:

* marketer prompts
* general prompts outside technical implementation
* broad architecture prompts
* debugging / troubleshooting prompts
* refactoring prompts
* comparison or decision-support prompts
* rewrite generation redesign
* all prompt families in one pass

---

## Problem To Solve In Slice A

PromptFire currently misclassifies some bounded developer prompts because the system still depends too much on exact wording.

Examples of semantically equivalent phrases that should behave similarly:

* validate against schema

* check against defined contract

* enforce payload shape

* exclude authorization

* leave auth out of scope

* do not include signature verification

* return HTTP 200 on success

* respond with 200 when valid

* fail with 400 on invalid input

The first slice must make recommendation and findings robust across these wording variants.

---

## Slice Goal

For bounded developer implementation prompts, PromptFire should:

1. recognize real technical constraints even when phrased differently
2. avoid stale missing-constraints findings when the prompt is already bounded
3. avoid escalating bounded prompts to `rewrite_recommended` when there are no blocking issues
4. produce recommendation and findings from semantic interpretation, not raw score alone
5. keep the current public API and UI behavior stable where possible

---

## Success Definition

Slice A is successful if all of the following are true for bounded developer implementation prompts:

* semantically equivalent wording variants land in the same recommendation state
* `CONSTRAINTS_MISSING` is not emitted when sufficient implementation context is present
* stale copy like “runtime, input, validation, or failure constraints are missing” disappears for bounded prompts
* `bestNextMove` points to the next useful contract detail rather than generic missing-runtime advice
* score band variance across equivalent webhook fixtures is small
* default rewrite escalation is suppressed for usable bounded prompts with no blocking issues

---

## Product Rules For Slice A

### Rule 1 — Semantic sufficiency beats lexical phrasing

If a prompt clearly specifies enough of the implementation boundary through meaning, wording variants should not change the recommendation state.

### Rule 2 — Recommendation comes before score projection

For slice A prompts, recommendation must be derived from semantic interpretation first.

### Rule 3 — Bounded implementation prompts are not weak by default

A prompt should not be treated as weak just because it omits some optional implementation detail.

### Rule 4 — Findings must describe the actual gap

If the prompt already includes runtime, validation behavior, and success/failure behavior, findings must not say those categories are missing.

### Rule 5 — Rewrite should not be the default rescue path

If the prompt is already usable and bounded, the system should prefer keeping the original and offering one precise improvement path.

---

## Supported Prompt Family In Slice A

A prompt is considered in-scope for Slice A when it matches all of the following:

### A. Implementation task

The prompt is asking for code to be produced, not analysis or comparison.

### B. Server-side handler family

The deliverable is one of:

* webhook handler
* endpoint
* HTTP handler
* route
* API handler
* request processor
* serverless function handler

### C. Boundedness signals

The prompt contains enough signal across implementation context groups.

At minimum, sufficient boundedness exists when meaningful signal is present across at least **3 of these 5 groups**:

1. **Execution context**

   * runtime
   * environment
   * framework
   * language

2. **Input / output behavior**

   * accepts JSON
   * request body / payload
   * returns / responds / status code behavior

3. **Validation / contract behavior**

   * validate
   * schema
   * contract
   * payload shape
   * enforce structure

4. **Boundary / exclusion behavior**

   * exclude
   * out of scope
   * do not include
   * without
   * leave out

5. **Operational behavior**

   * logging
   * idempotency
   * retries
   * error handling shape

This threshold is only for Slice A.
It is a practical implementation boundary, not a global PromptFire rule.

---

## Semantic Tags For Slice A

Add a narrow first semantic tag extractor for this prompt family.

```ts
type SliceASemanticTag =
  | 'has_code_deliverable'
  | 'has_handler_deliverable'
  | 'has_runtime_context'
  | 'has_framework_context'
  | 'has_language_context'
  | 'has_input_shape'
  | 'has_output_behavior'
  | 'has_success_failure_behavior'
  | 'has_validation_contract'
  | 'has_boundary_exclusion'
  | 'has_operational_logging'
  | 'has_operational_retry_or_idempotency'
  | 'has_internal_contradiction';
```

### Detection guidance

Support semantic variants, not only exact phrases.

#### Validation contract cluster

Match concepts such as:

* validate against schema
* validate request body
* check against contract
* enforce payload shape
* verify structure
* body must match

#### Exclusion cluster

Match concepts such as:

* exclude auth
* without authorization
* do not include auth
* leave auth out of scope
* omit signature verification
* no business-rule validation

#### Success / failure behavior cluster

Match concepts such as:

* return 200 on success
* respond with HTTP 400 on invalid input
* fail contract mismatches with 400
* accepted payload returns 200

#### Handler deliverable cluster

Match concepts such as:

* webhook handler
* endpoint
* API handler
* request handler
* route
* server function

---

## Task Classification For Slice A

Do not solve all task classification yet.

Add only the minimum classification needed for this slice:

```ts
type SliceATaskClass = 'implementation' | 'other';
```

Classification rule:

* `implementation` when the prompt asks for code construction or implementation of a handler / endpoint / function
* otherwise `other`

Only prompts classified as `implementation` and matching the handler family use the Slice A semantic path.

All others stay on the existing path for now.

---

## Context Inventory For Slice A

Build only the fields needed for this domain.

```ts
type SliceAContextInventory = {
  deliverable: {
    handlerLike: boolean;
    codeLike: boolean;
  };
  executionContext: {
    present: boolean;
    runtime: string[];
    framework: string[];
    language: string[];
  };
  ioContext: {
    present: boolean;
    input: string[];
    successFailure: string[];
  };
  validationContext: {
    present: boolean;
    contractSignals: string[];
  };
  boundaryContext: {
    present: boolean;
    exclusions: string[];
  };
  operationalContext: {
    present: boolean;
    logging: boolean;
    retryOrIdempotency: boolean;
  };
  contradictions: {
    present: boolean;
    reasons: string[];
  };
  boundedness: {
    satisfiedGroups: number;
    isBounded: boolean;
  };
};
```

### Boundedness rule

`isBounded = true` when:

* handler-like deliverable is present
* code-like deliverable is present
* and at least 3 of the 5 boundedness groups are satisfied
* and no severe contradiction invalidates the interpretation

---

## Decision State For Slice A

```ts
type SliceADecisionState = {
  semanticState: 'weak' | 'usable' | 'strong';
  missingContextType: 'constraints_missing' | null;
  majorBlockingIssues: boolean;
  expectedImprovement: 'low' | 'medium' | 'high';
  rewriteRisk: 'low' | 'medium' | 'high';
  rewriteRecommendation: 'rewrite_recommended' | 'rewrite_optional' | 'no_rewrite_needed';
};
```

### Decision rules

#### Weak

Use when:

* handler/code deliverable is present
* but boundedness is not satisfied
* or contradiction materially weakens interpretation

#### Usable

Use when:

* boundedness is satisfied
* no major contradiction exists
* some useful detail is still missing

#### Strong

Use when:

* boundedness is satisfied
* useful exclusions are present
* success/failure behavior is explicit
* validation/contract behavior is explicit
* execution context is explicit
* expected improvement is low

### Missing context rule

For Slice A:

* `constraints_missing` applies only when boundedness is not satisfied
* it must not apply when the prompt already has enough signal across the boundedness groups

### Rewrite recommendation rule

#### `rewrite_recommended`

Use only when:

* semantic state is `weak`
* or boundedness is not satisfied

#### `rewrite_optional`

Use when:

* semantic state is `usable`
* expected improvement is medium
* no blocking issue exists

#### `no_rewrite_needed`

Use when:

* semantic state is `strong`
* expected improvement is low
* no blocking issue exists
* rewrite preference is not `force`

### Rewrite risk rule

For Slice A, rewrite risk is at least `medium` when:

* boundedness is satisfied
* exclusions are present
* success/failure behavior is already explicit

Rationale: rewriting bounded technical prompts often washes out useful detail.

---

## Findings Generation For Slice A

### Rule

Findings must be generated from the Slice A context inventory and decision state, not from raw score alone.

### Allowed finding types

#### Correct findings

* Clear scope and deliverable.
* Useful constraints improve precision.
* The prompt defines runtime and response behavior but does not define the request contract.
* The prompt defines validation behavior but not the specific schema details.
* The prompt is already bounded enough to use safely without a rewrite.

#### Forbidden stale findings for bounded prompts

Do not emit these when boundedness is satisfied:

* Runtime, input, validation, or failure constraints are missing.
* The prompt needs explicit runtime before a rewrite can help.
* The request is too open-ended.

### Best-next-move rule

For bounded prompts, `bestNextMove` should focus on the next contract detail likely to improve output quality.

Examples:

* define exact schema properties
* define error response payload shape
* define auth/signature scope if needed
* define retry/idempotency behavior if relevant

It must not revert to generic missing-runtime advice.

---

## Score Projection For Slice A

Do not redesign all scoring yet.

Instead, add a narrow semantic projection override for in-scope prompts.

### Minimum score behavior changes

When Slice A boundedness is satisfied:

* prevent `constraintQuality` from collapsing into weak-prompt ranges solely because canonical wording is absent
* prevent `contrast` from collapsing to zero when exclusions and real implementation boundaries are present
* prevent `genericOutputRisk` from behaving as though no real constraints exist

### Projection guidance

#### Scope

Should be high when deliverable and success/failure behavior are explicit.

#### Contrast

Should be non-zero when the prompt includes meaningful exclusions, validation behavior, and specific implementation boundaries.

#### Clarity

Should stay high when the prompt is direct and internally consistent.

#### Constraint quality

Should reflect functional usefulness of technical constraints, not just keyword literalism.

#### Generic output risk

Should decrease when the prompt is bounded across multiple implementation context groups.

#### Token waste risk

Should not be elevated for direct, bounded prompts.

### Important rule

Slice A does not require a new global scoring formula.
It only requires a bounded semantic projection override for in-scope prompts.

---

## Integration Plan

## Step 1 — Add Slice A semantic extractor

New module suggestion:

```text
semantic/sliceA/extractDeveloperImplementationTags.ts
```

Responsibilities:

* detect in-scope handler-family prompts
* extract Slice A semantic tags
* return tag set plus matched evidence

## Step 2 — Add Slice A context inventory builder

New module suggestion:

```text
semantic/sliceA/buildDeveloperImplementationContext.ts
```

Responsibilities:

* convert tags to boundedness groups
* determine `isBounded`
* collect contradiction state

## Step 3 — Add Slice A decision-state builder

New module suggestion:

```text
semantic/sliceA/buildDeveloperImplementationDecision.ts
```

Responsibilities:

* determine semantic state
* determine missing context
* determine rewrite recommendation
* determine rewrite risk and expected improvement

## Step 4 — Shadow mode integration

Wire the Slice A semantic path into analysis orchestration in debug/shadow mode only.

Responsibilities:

* compute current output as normal
* compute Slice A decision state for in-scope prompts
* emit debug comparisons in tests or logs

## Step 5 — Switch recommendation and findings for Slice A only

Once stable:

* use Slice A decision state as source of truth for recommendation
* use Slice A findings path as source of truth for issue copy and best-next-move
* leave the rest of PromptFire unchanged

## Step 6 — Add narrow score projection override

Only after recommendation and findings stabilize:

* apply semantic override to public sub-scores for Slice A prompts
* keep global scoring unchanged for all other prompts

---

## Files To Touch

This section is intentionally generic and should be mapped to the real repo.

### New files

```text
semantic/sliceA/extractDeveloperImplementationTags.ts
semantic/sliceA/buildDeveloperImplementationContext.ts
semantic/sliceA/buildDeveloperImplementationDecision.ts
semantic/sliceA/generateDeveloperImplementationFindings.ts
semantic/sliceA/projectDeveloperImplementationScores.ts
```

### Existing integration points likely to change

* analysis orchestration entrypoint
* current recommendation/gating logic
* current findings generation path
* current best-next-move generation path
* current score projection path
* relevant test fixtures and server tests

---

## Test Plan For Slice A

### Unit tests

Add tests for semantic tag extraction:

* schema phrasing
* contract phrasing
* payload-shape phrasing
* exclude phrasing
* out-of-scope phrasing
* status code phrasing
* logging phrasing

Add tests for boundedness:

* exactly 3 satisfied groups -> bounded
* 2 groups only -> not bounded
* contradiction case -> weakened or not bounded depending on severity

Add tests for decision state:

* thin webhook prompt -> weak / rewrite recommended
* bounded canonical webhook prompt -> usable or strong / not rewrite recommended by default
* bounded synonym webhook prompt -> same recommendation state as canonical

### Integration tests

Add fixtures for:

#### Thin baseline

```text
Write a webhook handler.
```

Expected:

* weak
* constraints missing
* rewrite recommended

#### Canonical bounded webhook

```text
Write a webhook handler in TypeScript for Node.js that accepts JSON. Validate the request body against a schema. On success, return HTTP 200. On schema validation failure, return HTTP 400. Include error logging. Exclude authorization, signature verification, and business-rule validation.
```

Expected:

* usable or strong
* no constraints missing
* rewrite optional or no rewrite needed
* best-next-move focused on contract detail

#### Synonym bounded webhook

```text
Build a small Node.js endpoint in TypeScript for receiving webhook events as JSON. Check the body against a defined contract before processing it. Return HTTP 200 when the payload is accepted and HTTP 400 when the contract check fails. Log failures for debugging. Leave auth, signature checks, and business-rule enforcement out of scope.
```

Expected:

* same recommendation state as canonical bounded webhook
* no stale missing-constraints finding

#### Partial bounded webhook

```text
Write a Node.js webhook endpoint in TypeScript that accepts JSON and returns 200 on success and 400 on invalid input.
```

Expected:

* usable or borderline usable
* improvement path should ask for contract details
* no false claim that runtime is missing

### Comparison assertions

For canonical bounded and synonym bounded prompts, assert:

* same recommendation state
* same missing-context state
* same top finding family
* small score variance only

---

## Rollout Strategy For Slice A

### Phase A1

Add extractor, context builder, and decision builder in shadow mode only.

### Phase A2

Switch recommendation and findings for Slice A prompts only.

### Phase A3

Switch narrow score projection override for Slice A prompts only.

### Phase A4

Delete now-obsolete Slice A rescue guardrails.

---

## Risks

### Risk 1 — Overfitting Slice A to webhook wording

Mitigation: write tests around semantic families, not one prompt string.

### Risk 2 — Slice detection becomes too broad

Mitigation: keep handler-family gating narrow in the first pass.

### Risk 3 — Score changes destabilize unrelated prompts

Mitigation: do not change global scoring in Slice A.

### Risk 4 — Decision state duplicates existing logic poorly

Mitigation: keep Slice A logic local and deterministic, and compare in shadow mode before switching.

---

## Exit Criteria For Slice A

Slice A is complete when:

* bounded developer webhook-style prompts are stable across semantic wording variants
* stale missing-constraints findings are gone for in-scope bounded prompts
* recommendation is no longer driven by raw score for in-scope prompts
* score projection no longer collapses bounded prompts into obviously weak results
* at least one obsolete rescue rule can be removed without regression

---

## Follow-On After Slice A

After Slice A succeeds, the likely next slice is:

* broader developer implementation prompts beyond handlers

or:

* strong general decision-support prompts

Do not expand until Slice A shows stable semantic equivalence behavior in tests.

---

## Implementation Checklist

* [ ] Add Slice A handler-family detector
* [ ] Add Slice A semantic tag extractor
* [ ] Add Slice A context inventory builder
* [ ] Add Slice A decision-state builder
* [ ] Add Slice A findings generator
* [ ] Add Slice A score projection override
* [ ] Add thin/canonical/synonym/partial webhook fixtures
* [ ] Run shadow-mode comparisons
* [ ] Switch recommendation and findings for Slice A
* [ ] Switch score override for Slice A
* [ ] Remove obsolete Slice A rescue logic
