
---
# PromptFire Role, Mode, and Pattern-Fit Spec v0.1

## Status

Draft

## Objective

Define a clean PromptFire classification model that separates:

* **public roles**
* **public rewrite modes**
* **internal pattern-fit types**

This spec exists to prevent PromptFire from overloading the role system, while still allowing the engine to become smarter about different prompt shapes.

The main design goal is:

**keep the UI simple, while letting the engine use richer internal strategies.**

---

## Summary of decision

PromptFire should treat these as three different layers:

### 1. Public role

Answers:

**What kind of prompt is this?**

Examples:

* general
* developer
* marketer

### 2. Public rewrite mode

Answers:

**What kind of improvement does the user want?**

Examples:

* balanced
* tight_scope
* high_contrast
* low_token_cost

### 3. Internal pattern-fit

Answers:

**What intervention strategy best fits this prompt?**

Examples:

* direct_instruction
* decomposition
* stepwise_reasoning
* decision_rubric
* context_first
* few_shot
* compare_and_contrast
* extraction_or_transformation

---

## Why this split is needed

PromptFire already has a stable public role/mode surface:

* roles: `general`, `developer`, `marketer`
* modes: `balanced`, `tight_scope`, `high_contrast`, `low_token_cost` 

The product is also already committed to:

* a score-first UI
* rewrite gating
* explicit rewrite preference controls
* internal signals being allowed without becoming public score keys. 

That means PromptFire should avoid using **public roles** as a catch-all for every useful prompt behavior.

If every new intervention style becomes a visible mode or role, the product will become harder to understand, harder to calibrate, and harder to keep consistent.

---

## Core principle

**Role is the domain lens.**
**Mode is the user’s rewrite preference.**
**Pattern-fit is the engine’s internal strategy.**

PromptFire should not create a new public role merely because it discovers a new kind of prompt structure.

---

## Goals

* Preserve a small, understandable public UI.
* Keep current role and mode selectors stable.
* Allow richer internal rewrite and scoring behavior.
* Reduce the risk that one role, especially marketer mode, becomes the hidden default lens for all prompt quality judgment.
* Make future expansion possible without UI sprawl.

## Non-goals

This spec does not:

* add new public score keys
* change the current v2 API contract
* redefine the existing score formula
* replace role-specific logic
* require embeddings or a learned classifier
* require exposing pattern-fit publicly

---

## Definitions

### Public role

A user-visible selector representing the **domain lens** used for scoring and rewriting.

A role may influence:

* what counts as strong differentiation
* what kinds of constraints are most valuable
* what kinds of rewrites are helpful
* what kinds of generic output are risky

A role should **not** be used to represent every prompt structure or workflow.

### Public rewrite mode

A user-visible selector representing the **kind of rewrite preference** or improvement emphasis.

A mode should influence:

* narrowing behavior
* contrast sharpening behavior
* brevity behavior

A mode is not a domain type.

### Internal pattern-fit

An internal classification representing the **best intervention strategy** for the prompt.

Pattern-fit may influence:

* analysis emphasis
* rewrite structure
* rewrite evaluation
* expected improvement logic

Pattern-fit is internal and should not be exposed in the public response unless explicitly versioned later.

---

## Public role model

### Current public roles

PromptFire should keep the current public roles:

* `general`
* `developer`
* `marketer` 

These remain the top-level user-facing domain lenses.

### Role responsibilities

#### `general`

Use for broad prompts that are not clearly specialized for software implementation or marketing persuasion.

Primary emphasis:

* boundedness
* clarity
* practical constraints
* useful framing
* reduction of ambiguity

#### `developer`

Use for technical prompts where implementation quality depends on operational or engineering specificity.

Primary emphasis:

* implementation boundaries
* runtime and environment
* architecture
* failure modes
* trade-offs
* exclusions
* concrete deliverables

This is already the direction used in the rewrite behavior requirements for developer prompts. 

#### `marketer`

Use for prompts where output quality depends strongly on audience, positioning, proof, tension, and avoiding generic promotional language.

Primary emphasis:

* audience specificity
* positioning
* proof expectations
* differentiation
* exclusions
* anti-generic framing

This matches the current marketer role expectations in the rewrite spec and the existing use of internal signals like audience specificity, positioning strength, and proof specificity.

---

## Public rewrite mode model

PromptFire should keep the current public rewrite modes:

* `balanced`
* `tight_scope`
* `high_contrast`
* `low_token_cost`

### Mode responsibilities

#### `balanced`

Default rewrite behavior.
Improve the prompt without over-narrowing or over-stylizing.

#### `tight_scope`

Prioritize boundedness and specificity.
Reduce ambiguity and extra surface area.

#### `high_contrast`

Prioritize differentiation and non-generic framing.
Must remain grounded and must not introduce scorer-shaped filler.

This safeguard is already consistent with current rewrite-integrity direction.

#### `low_token_cost`

Prefer leaner wording while keeping critical constraints.

---

## Internal pattern-fit model

Pattern-fit is the layer PromptFire should use to get smarter without adding UI complexity.

### Rule

Pattern-fit should be:

* inferred internally
* deterministic or semi-deterministic
* optional in the API response
* non-public by default

### Initial pattern-fit types

#### `direct_instruction`

Best when the prompt already has one clear job and mainly needs light tightening.

Use when:

* deliverable is already clear
* task is not overloaded
* constraints are present
* expected improvement is low to moderate

#### `decomposition`

Best when the prompt asks for too much at once or mixes multiple jobs.

Use when:

* task overload is present
* prompt bundles multiple outputs
* rewrite should split, sequence, or prioritize parts

This fits the existing concern with overloaded tasks and token waste. 

#### `stepwise_reasoning`

Best when the prompt asks for diagnosis, logic, trade-offs, prioritization, or structured thinking.

Use when:

* task is analytical
* output quality depends on explicit reasoning order
* the user is asking for explanation, diagnosis, or comparison

#### `decision_rubric`

Best when the prompt asks the model to evaluate, score, audit, rank, review, or compare against criteria.

Use when:

* output should apply criteria explicitly
* scoring or QA behavior is central
* evaluation consistency matters

#### `context_first`

Best when the real weakness is missing source context rather than poor wording.

Use when:

* task is broad because source material is absent
* output needs examples, evidence, or reference material
* rewrite should first ask for or organize context

#### `few_shot`

Best when the task benefits from pattern demonstration more than additional abstract instruction.

Use when:

* tone/style transfer matters
* formatting regularity matters
* transformation consistency matters

#### `compare_and_contrast`

Best when the prompt is strong only if it defines distinctions, trade-offs, or alternatives clearly.

Use when:

* task centers on “when X helps and when it hurts”
* trade-off framing matters
* the user needs non-binary treatment

This is especially relevant for prompts like your TypeScript and microservices examples.

#### `extraction_or_transformation`

Best when the prompt is primarily about converting, summarizing, restructuring, or extracting from existing content.

Use when:

* the job is format conversion
* audience differentiation matters less than transformation accuracy
* rewrite should emphasize input/output structure

---

## Relationship between role and pattern-fit

Role and pattern-fit are related but not identical.

Examples:

* a **developer** prompt may use `direct_instruction`, `decomposition`, `stepwise_reasoning`, or `decision_rubric`
* a **marketer** prompt may use `direct_instruction`, `few_shot`, `compare_and_contrast`, or `context_first`
* a **general** prompt may use any pattern-fit depending on task shape

### Important rule

**Role must not determine pattern-fit by itself.**

Role influences the scoring and rewrite lens.
Pattern-fit influences the intervention strategy.

This separation prevents marketer logic from becoming the hidden default for all prompt types.

---

## Suggested default mapping

### `general`

Prefer:

* direct_instruction
* decomposition
* stepwise_reasoning
* decision_rubric
* context_first
* compare_and_contrast

### `developer`

Prefer:

* direct_instruction
* decomposition
* stepwise_reasoning
* decision_rubric
* extraction_or_transformation

Developer mode should especially reward real implementation constraints, runtime boundaries, exclusions, and failure handling. That direction is already visible in the current rewrite expectations and in the broadened natural-language constraint handling.

### `marketer`

Prefer:

* direct_instruction
* compare_and_contrast
* few_shot
* context_first

Marketer mode may still use audience, positioning, proof, and contrast signals, but must not become the universal definition of quality. Current rewrite-integrity work already guards against scorer-language-only rewrites in marketer and high-contrast contexts.

---

## Candidate future public roles

PromptFire should be conservative about adding new public roles.

### Best candidate: `educator`

This is the strongest future public-role candidate because it has a genuinely different quality target:

* explanation quality
* sequencing
* scaffolding
* misconception handling
* example progression
* audience comprehension

This is more distinct than analyst/reviewer/researcher, which are usually better represented as pattern-fit types.

### Not recommended as public roles yet

These are better treated as internal pattern-fit types for now:

* analyst
* evaluator
* reviewer
* researcher
* editor

These describe intervention strategies more than domain lenses.

---

## Scoring implications

This spec does not change the public scoring categories.

PromptFire should continue to expose:

* scope
* contrast
* clarity
* constraintQuality
* genericOutputRisk
* tokenWasteRisk 

But internal scoring logic may vary by:

* role
* pattern-fit
* mode

### Guardrail

Internal pattern-fit must influence scoring only in ways that remain consistent with the public definitions.

Example:

* `developer + direct_instruction` may reward runtime/exclusion/failure constraints
* `marketer + high_contrast` may reward audience/proof/differentiation
* `general + compare_and_contrast` may reward trade-off framing and explicit boundaries

This remains consistent with the current rule that internal signals are allowed, but public score keys should remain stable unless separately versioned.

---

## Rewrite implications

Pattern-fit should influence rewrite generation order.

### Proposed rewrite order

1. preserve original job
2. detect role
3. infer pattern-fit
4. apply mode emphasis
5. add missing concrete specificity
6. avoid meta-instruction stuffing
7. keep rewrite proportional to expected improvement

This is consistent with the existing rewrite rules that prioritize preserving intent, tightening boundedness, adding concrete constraints, and avoiding scorer-vocabulary stuffing.

### Example

A prompt could be:

* role: `developer`
* mode: `balanced`
* patternFit: `direct_instruction`

PromptFire should then prefer:

* runtime
* input/output boundaries
* error handling
* exclusions
* architecture assumptions
* concrete deliverable shape

rather than marketer-style differentiation language.

---

## Evaluation implications

Pattern-fit should also influence rewrite evaluation.

### Rule

A rewrite should be judged against the **right intervention type**, not just against generic “improvement” language.

Examples:

* `decomposition` should get credit for splitting overloaded jobs
* `decision_rubric` should get credit for adding evaluative criteria
* `context_first` should get credit for identifying missing source material
* `direct_instruction` should get credit for cleaner boundedness and usable constraints
* `few_shot` should only get credit when examples materially improve usability

### Guardrail

Pattern-fit must not let rewrites win by echoing PromptFire’s internal rubric.
That is already a major product rule in the rewrite-integrity work.

---

## API behavior

This spec does not require a public API change.

### Optional future internal field

PromptFire may later add an internal-only or debug-only field such as:

```json
"internal": {
  "patternFit": "direct_instruction"
}
```

This field should remain:

* absent from normal public responses
* non-contractual unless versioned
* optional in developer/debug environments only

---

## UI behavior

No new public selector is required for pattern-fit.

### UI rule

The user should continue to see:

* role selector
* mode selector
* rewrite preference selector
* score-first results

This is already the direction of the current v2 UI. 

Pattern-fit should remain invisible unless later surfaced in an advanced/debug interface.

---

## Decision rules

### Add a new internal rule

When PromptFire detects a prompt behavior that is better explained by pattern-fit than by role, it should:

* keep the public role stable
* choose the internal pattern-fit
* avoid inventing a new public role

### Product rule

**Do not use public roles to solve pattern-selection problems.**

---

## Acceptance criteria

This spec is successful when:

1. PromptFire can explain its architecture internally as:

   * role = domain lens
   * mode = user preference
   * pattern-fit = engine strategy

2. No additional public roles are required to support:

   * decomposition
   * analysis
   * evaluation
   * context-first prompting
   * few-shot prompting

3. Developer and general prompts are no longer forced through marketer-shaped differentiation logic by default.

4. Marketer mode remains valuable but no longer acts as the implicit universal model of prompt quality.

5. The current public UI remains simple.

---

## Recommended immediate follow-up

1. Keep public roles as:

   * general
   * developer
   * marketer

2. Add an internal `patternFit` classifier.

3. Start with these internal values:

   * direct_instruction
   * decomposition
   * stepwise_reasoning
   * decision_rubric
   * context_first
   * few_shot
   * compare_and_contrast
   * extraction_or_transformation

4. Add regression fixtures showing that:

   * a strong developer/general prompt is not penalized for lacking marketer-style signals
   * a decomposition case improves by splitting or narrowing
   * a decision-rubric case improves by adding criteria
   * a context-first case is recognized as missing source material rather than merely vague

---
