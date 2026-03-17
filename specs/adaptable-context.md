Yes — here is a repo-aligned draft spec focused on **adaptable context across roles and patterns**.

It is designed to fit the current PromptFire shape:

* public roles remain `general`, `developer`, `marketer` 
* public rewrite modes remain separate from roles 
* role guidance already differs by domain, with developer emphasizing implementation boundaries/runtime/failure handling and marketer emphasizing audience/positioning/proof 
* scope already uses **audience/context specificity**, not just audience alone 
* rewrite generation already prioritizes preserving the job, tightening boundedness, adding concrete constraints, and only then adding audience or structure if clearly missing 

---

# PromptFire Spec — Adaptable Context by Role and Pattern v0.1

## Status

Draft

## Purpose

Define how PromptFire should interpret and improve **context** across roles and prompt patterns without assuming that **audience** is always the main missing ingredient.

This spec exists to fix a calibration problem:

* marketer prompts often do need audience specificity
* developer prompts often need **execution context** instead
* general prompts may need either audience, operating situation, source context, or comparison frame
* the system should choose the **most useful kind of missing context**, not default to audience-first language

This spec is intended to align:

* scoring
* issue emission
* best-next-move suggestions
* rewrite generation
* rewrite evaluation

around one principle:

**context should be adaptable in every mode.**

---

## Problem statement

PromptFire’s current foundations already support:

* role-based rewrite behavior 
* scope scoring that includes audience/context specificity 
* rewrite generation that adds boundedness, constraints, and only then audience or structure if clearly missing 

However, some current rewrite and suggestion behavior still leans too heavily on **audience-first filling**, especially in balanced mode, which currently says to improve boundedness with concrete audience, structure, and exclusions. 

That can produce the wrong next step for developer prompts, especially code-generation prompts, where the better fix is often:

* runtime
* language
* framework
* input/output shape
* validation expectations
* failure handling
* deployment context
* exclusions

rather than “define the audience.”

---

## Core rule

**PromptFire must not assume that audience is the primary missing context for every prompt.**

Instead, PromptFire should infer the **most relevant missing context type** for the current:

* role
* mode
* internal `PromptPattern`

### Short form

**Ask “what kind of context is missing?” not “where is the audience?”**

---

## Definitions

### Context

Any information that narrows the task in a practically useful way.

Context may include:

* reader audience
* operating context
* business situation
* runtime environment
* technical stack
* deployment model
* source/input context
* comparison frame
* task boundary context
* example frame

### Audience

A subtype of context describing **who the output is for**.

Audience remains important, but is only one form of context.

### Context adaptability

The rule that PromptFire should choose the most useful form of context for the prompt at hand, rather than applying a single universal context model.

---

## Non-goals

This spec does not:

* add new public score keys
* add a new public issue code
* require exposing internal `PromptPattern`
* remove audience from marketer mode
* prevent audience suggestions entirely in developer or general mode

---

## Public contract impact

No public contract change is required in this phase.

This remains consistent with the repo’s current contract policy:

* keep public score dimensions stable
* allow internal signals to influence behavior
* avoid expanding the public API unless separately versioned 

Public score dimensions remain:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk` 

---

## Context taxonomy

PromptFire should internally treat context as one of these primary types:

### 1. Audience context

Who the output is for.

Examples:

* for CTOs at mid-sized SaaS companies
* for engineering managers
* for IT decision-makers

### 2. Operating context

The real-world situation or pressure shaping the task.

Examples:

* under audit pressure
* after acquisitions
* for a fast-growing startup
* when team autonomy matters more than architectural purity

### 3. Execution context

The technical environment in which the output must work.

Examples:

* Node.js
* AWS Lambda
* native browser APIs only
* PostgreSQL-backed service
* webhook endpoint receiving signed POST requests

### 4. Input/output context

The shape of the material or output being worked on.

Examples:

* JSON payload with retry-safe processing
* use exactly three sections
* summarize this transcript
* extract the API surface only

### 5. Comparison context

A trade-off frame, alternative, or decision lens.

Examples:

* startup vs enterprise
* monolith vs microservices
* TypeScript value vs added complexity
* compare immediate vs batched processing

### 6. Source context

External material or evidence needed before the task can be done well.

Examples:

* based on this document
* using the customer brief
* grounded in attached logs
* cite the supplied transcript

### 7. Boundary context

Explicit limits on what to include or exclude.

Examples:

* avoid third-party dependencies
* do not use hype
* exclude migration strategy
* focus only on validation and error handling

---

## Main product rule

### Context adaptability rule

In every role and pattern, PromptFire should prefer the form of context that most directly improves task usefulness.

This means:

* audience is sometimes the best missing context
* execution context is sometimes the best missing context
* comparison frame is sometimes the best missing context
* source context is sometimes the best missing context
* exclusions and boundaries are sometimes the best missing context

### Priority rule

When multiple context types are missing, PromptFire should prioritize the one that:

1. most reduces ambiguity
2. most reduces generic output risk
3. most improves task boundedness
4. best matches the role and internal `PromptPattern`

---

## Role-specific context priorities

### `general`

General role should remain flexible and should not assume domain-specific framing unless supported by the prompt. This matches the current rewrite guidance for general mode. 

Preferred context order in general role:

1. operating context
2. output/input context
3. comparison context
4. audience context
5. source context
6. boundary context

General role should choose whichever context best narrows the task without inventing a new domain frame.

### `developer`

Developer role should prioritize execution usefulness over audience-first framing. Current rewrite guidance already says developer mode should emphasize implementation boundaries, runtime, failure modes, architecture, and exclusions. 

Preferred context order in developer role:

1. execution context
2. input/output context
3. boundary context
4. operating context
5. comparison context
6. audience context
7. source context

Audience is allowed in developer mode, but should usually be secondary unless the prompt is explicitly for explanation, documentation, or communication.

### `marketer`

Marketer role should continue to treat audience as primary more often, because marketer-specific rewrite behavior is explicitly built around audience clarity, positioning, proof, and concrete buyer context. 

Preferred context order in marketer role:

1. audience context
2. operating context
3. comparison context
4. proof/source context
5. boundary context
6. output context

---

## Pattern-aware context behavior

Because `PromptPattern` is now the canonical internal taxonomy, context priorities should also vary by pattern.

### `direct_instruction`

Prefer the single missing context type that most cleanly narrows the task.

### `decomposition`

Prefer output/input context and boundary context.
The best fix is often to split or structure the job, not invent an audience.

### `stepwise_reasoning`

Prefer comparison context, operating context, or decision context.

### `decision_rubric`

Prefer comparison context, boundary context, and evaluation criteria context.

### `context_first`

Prefer source context before other enrichments.
Do not fill with audience language if the real issue is missing material.

### `few_shot`

Prefer example context and output-shape context.

### `compare_and_contrast`

Prefer comparison context and operating context.

### `extraction_or_transformation`

Prefer source context, input/output context, and boundary context.

---

## Scoring implications

This spec does not change public score names, but it changes how internal logic should interpret missing context.

### `scope`

Scope already includes audience/context specificity, which is the right abstraction. 
Update the implementation interpretation so that:

* scope can be improved by audience specificity
* or by operating context
* or by execution context
* or by comparison frame
* or by source context
* or by boundary context

A prompt should not be treated as weakly scoped merely because it lacks an audience if it already has strong operating or execution context.

### `contrast`

Contrast should reward meaningful differentiation, not just audience presence.
Comparison context, trade-off framing, source grounding, exclusions, and operating conditions can all increase contrast without any audience addition.

### `constraintQuality`

Constraint quality should continue to reward functional narrowing, including:

* exact sections
* example count
* exclusions
* runtime constraints
* proof requirements
* comparison requirements
* validation/failure requirements

### `genericOutputRisk`

Generic-output risk should rise when the prompt lacks **useful narrowing context**, not only when audience is missing.

---

## Issue emission rules

### `AUDIENCE_MISSING`

Keep the issue code for compatibility, but narrow its intended meaning.

Rule:

* emit `AUDIENCE_MISSING` only when audience is materially important for the prompt’s usefulness
* do not emit it merely because an audience field is absent

Examples where it may still apply:

* landing page copy
* email campaign copy
* explainer article for a named reader group
* documentation intended for a specific reader segment

Examples where it should usually not apply:

* code-generation prompts
* implementation tasks
* transformation/extraction tasks
* prompts already bounded by execution or operating context

### `CONTEXT_MISSING`

Do not add a new public issue code in this phase.

Instead, missing non-audience context should influence:

* `scope`
* `constraintQuality`
* `genericOutputRisk`
* `bestNextMove`
* rewrite instructions

without changing the public issue enum.

### `CONSTRAINTS_MISSING`

Should remain conservative.
If a prompt has meaningful runtime, exclusion, validation, example, or output-shape constraints, it should not be treated as constraint-free just because it lacks audience. This matches the existing direction to be conservative when functional requirements are present. 

---

## Best-next-move rules

Because `methodFit` remains the public-facing suggestion layer, best-next-move suggestions should use adaptable context as well.

### Required rule

`bestNextMove` must recommend the most useful missing context type, not default to audience-first advice.

### Developer examples

For a developer implementation prompt like:

* “Write a webhook handler.”

Prefer next steps like:

* specify runtime or language
* define payload/validation expectations
* define retry/error behavior
* define whether third-party dependencies are allowed
* define output shape or tests

Do not default to:

* define the audience

### Marketer examples

For a marketer landing-page prompt, “define the audience” may still be the right next move.

### General examples

For general prompts, prefer whichever context most directly narrows the task:

* audience
* scenario
* structure
* trade-off frame
* source material

---

## Rewrite-generation rules

Current rewrite generation order already says:

1. preserve original job
2. tighten boundedness
3. add missing concrete constraints
4. add audience or structure if clearly missing
5. only then apply stylistic sharpening 

This spec updates step 4.

### Revised generation order

Rewrite generation should prioritize:

1. preserve original job
2. tighten boundedness
3. add missing concrete constraints
4. add the most relevant missing context or structure
5. only then apply stylistic sharpening

### Replacement rule

Replace:

* “add audience or structure if clearly missing”

With:

* “add the most relevant missing context, structure, or boundary if clearly missing”

### Developer rewrite rule

For developer prompts, prefer:

* runtime
* language/framework
* interface assumptions
* input/output shape
* validation requirements
* failure/retry behavior
* exclusions

before audience.

### Marketer rewrite rule

For marketer prompts, audience may still be first-class, but must remain grounded and must not introduce unsupported framing. This is consistent with the repo’s rewrite-integrity protections against rubric echo and imported framing. 

---

## Rewrite-evaluation rules

Rewrite evaluation currently penalizes rubric echo and framing import when the rewrite adds scorer-facing language or imports unsupported framing. 

This spec extends that logic:

### New evaluation guardrail

A rewrite must not gain credit merely by adding an audience if the more relevant missing context was non-audience context.

Examples:

* developer implementation prompt gains little credit from “for engineering managers”
* extraction prompt gains little credit from “for product leaders”
* technical task gains more credit from runtime, boundary, schema, tests, or failure conditions

### Positive-credit rule

A rewrite should gain credit when it adds the right kind of context for the role and pattern:

* developer implementation → execution context
* compare/contrast → comparison context
* context-first → source context
* few-shot → example/output context
* marketer persuasion → audience + operating context

---

## Acceptance criteria

This spec is complete when all of the following are true.

### 1. Audience is no longer the default missing-context assumption

Developer and general prompts can improve through execution, operating, source, comparison, or boundary context without needing an audience suggestion first.

### 2. Scope rewards adaptable context

Prompts with strong execution or operating context can score well on scope even without named audience.

### 3. Best-next-move suggestions become role-appropriate

Code-generation prompts do not default to “define the audience.”

### 4. Rewrite generation remains grounded

Rewrites add the most relevant missing context rather than audience-by-default.

### 5. Rewrite evaluation does not over-credit audience fills

Audience additions only help when they are actually the right intervention.

---

## Required regression fixtures

Add fixtures proving the following behavior.

### Fixture A — developer implementation

Prompt:

* “Write a webhook handler.”

Expected behavior:

* low score is acceptable
* `AUDIENCE_MISSING` should not be the primary diagnosis
* best next move should prioritize execution context
* rewrite should add runtime/boundary context before audience

### Fixture B — developer implementation with useful execution constraints

Prompt:

* “Develop a webhook handler in Node.js that processes incoming HTTP POST requests. Ensure it validates the request payload against a predefined schema and handles errors gracefully by returning appropriate HTTP status codes. Exclude any third-party dependencies and focus solely on native Node.js functionality.”

Expected behavior:

* `constraintQuality` must be above zero
* “lacks constraints” should not fire
* if improvement is suggested, it should focus on payload shape, signature validation, retry/idempotency, or runtime boundaries
* audience should not be the first suggested fix

### Fixture C — developer explainer

Prompt:

* “Write a practical blog post for engineering managers about when TypeScript improves maintainability and when it adds unnecessary complexity.”

Expected behavior:

* technical audience is relevant
* comparison context is also relevant
* audience may remain a valid suggestion, but not buyer-style audience logic

### Fixture D — marketer landing page

Prompt:

* “Write landing page copy for our IAM service.”

Expected behavior:

* audience may be a valid next step
* operating context and exclusions may also improve quality
* marketer audience logic remains intact

### Fixture E — source-context task

Prompt:

* “Summarize this transcript into five bullets.”

Expected behavior:

* missing source context is primary
* audience should not be the leading suggestion

---

## Implementation notes

### Internal-only

This spec should be implemented through:

* internal `PromptPattern`
* role-aware scoring helpers
* method-fit projection logic
* rewrite prompt-builder rules
* evaluation adjustments

### No public API expansion

Do not add a public `contextType` field in this phase.

### Suggested internal helper

Add a helper such as:

```ts
inferMissingContextType({
  prompt,
  role,
  patternFit,
  analysis,
  context
}) => 'audience' | 'operating' | 'execution' | 'io' | 'comparison' | 'source' | 'boundary' | null
```

That helper should become the shared source for:

* best-next-move
* rewrite prompt building
* parts of scoring interpretation
* evaluation notes

---

## Summary

This spec keeps PromptFire aligned with its current architecture while fixing an important calibration problem.

The key change is simple:

**PromptFire should treat audience as one kind of context, not the universal default.**

That lets:

* marketer prompts stay audience-aware
* developer prompts become execution-aware
* general prompts stay flexible
* pattern-fit choose the right intervention
* scores and suggestions become more credible

If you want, I can turn this into a tighter Codex-ready version next, with explicit enum proposals, pseudocode, and fixture JSON.
