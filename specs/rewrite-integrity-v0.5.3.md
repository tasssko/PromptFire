# PromptFire Rewrite Integrity Spec v0.5.3

## 1. Purpose

Define a narrow, deterministic extension to PromptFire's current scoring and rewrite-gating model so that:

- rewrite evaluation remains available
- weak prompts can still be improved
- strong prompts remain protected
- rewrites cannot easily manufacture score deltas by echoing scorer language
- changes remain explainable and testable in advance

This spec extends the existing score-first model and rewrite evaluation flow. It does **not** replace the current public scoring dimensions or rewrite preference controls.

---

## 2. Problem Statement

PromptFire currently supports:

- score-first prompt analysis
- optional rewrite gating
- rewrite evaluation based on rescoring the rewritten prompt and comparing deltas

That capability is useful, but it creates a known failure mode:

**the rewrite engine can gain credit by adding scorer-facing language instead of adding concrete task-grounded specificity.**

Examples of problematic rewrite behavior include adding phrases such as:

- improve clarity, scope, or contrast
- add constraints
- include exclusions
- lead with operational tension
- use a specific lead angle
- include one proof point
- measurable outcome
- differentiated positioning

These may be useful internal concepts, but they must not be treated as strong evidence of actual prompt improvement unless the rewrite also adds concrete task detail.

---

## 3. Core Principle

**A rewrite may only claim material improvement when it adds concrete, task-grounded specificity, not when it merely adds abstract optimization language.**

Corollary:

**PromptFire must not reward a rewrite for saying the rubric back to the grader.**

---

## 4. Non-Goals

This spec does **not** require:

- a full scorer redesign
- embeddings or semantic similarity models
- role-specific public score dimensions
- a new public API version by itself
- replacing rewrite evaluation with manual review

This is a deterministic behavior correction inside the current architecture.

---

## 5. Definitions

### 5.1 Concrete task-grounded improvement

A rewrite adds concrete task-grounded improvement when it introduces usable detail that directly narrows or clarifies the job.

Examples:

- specific audience added
- explicit output structure added
- concrete example count or example type added
- real comparison frame added
- explicit exclusion added
- trade-off boundary added
- business or technical context added
- narrowing from broad request to bounded deliverable

### 5.2 Abstract optimization language

Abstract optimization language refers to scorer-facing or prompt-engineering language that gestures toward improvement without supplying the actual detail.

Examples:

- improve clarity
- improve contrast
- improve scope
- add constraints
- include exclusions
- use a lead angle
- add proof
- add measurable outcome
- differentiated positioning
- audience tension
- keep the same deliverable and audience

These phrases are not forbidden, but they do **not** count as strong evidence of improvement on their own.

### 5.3 Rubric echo

Rubric echo occurs when a rewrite introduces abstract scorer-shaped constructs rather than concrete task detail.

### 5.4 Intent preservation

Intent preservation measures whether the rewrite keeps the same underlying job.

A rewrite preserves intent when it:

- keeps the same core deliverable
- keeps the same subject domain
- avoids importing a new buyer/problem frame unless it is latent in the original prompt
- narrows rather than redirects

---

## 6. New Internal Evaluation Concepts

PromptFire should add the following internal concepts to rewrite evaluation.

### 6.1 `rubricEchoRisk`

Possible values:

- `low`
- `medium`
- `high`

### 6.2 `groundedImprovementCount`

Count of concrete task-grounded improvements introduced by the rewrite.

### 6.3 `abstractInstructionCount`

Count of abstract optimization constructs introduced by the rewrite.

### 6.4 `intentPreservation`

Possible values:

- `high`
- `medium`
- `low`

These values are internal. They do not need to be exposed publicly unless later versioned into the API.

---

## 7. Rubric Echo Rules

### 7.1 Detection goal

PromptFire must detect when a rewrite adds abstract scorer-facing scaffolding without adding equivalent concrete detail.

### 7.2 Example abstract constructs

The detector may treat phrases or equivalent formulations such as the following as abstract optimization language:

- improve clarity
- improve scope
- improve contrast
- add constraints
- include exclusions
- lead with operational tension
- use a specific lead angle
- include one proof point
- include measurable outcome
- differentiated positioning
- avoid generic buzzwords

### 7.3 High-risk rule

Set `rubricEchoRisk = high` when both are true:

1. the rewrite adds two or more abstract optimization constructs
2. the rewrite does **not** add sufficient concrete task-grounded detail

Examples of sufficient concrete detail include:

- named audience
- explicit section structure
- named example shape
- concrete exclusion tied to the task
- actual comparison boundary
- actual business or technical condition
- actual trade-off framing

### 7.4 Medium-risk rule

Set `rubricEchoRisk = medium` when:

- the rewrite adds some abstract optimization language
- and some concrete detail
- but the abstract layer appears to dominate

### 7.5 Low-risk rule

Set `rubricEchoRisk = low` when:

- the rewrite is primarily concrete
- or abstract guidance is minimal and clearly subordinate to real task shaping

---

## 8. Intent Preservation Rules

### 8.1 High intent preservation

Set `intentPreservation = high` when the rewrite:

- keeps the same deliverable
- stays in the same domain
- does not import a new problem frame
- mainly tightens audience, structure, exclusions, boundaries, or examples

### 8.2 Medium intent preservation

Set `intentPreservation = medium` when the rewrite:

- preserves the job overall
- but introduces some framing drift or extra assumptions

### 8.3 Low intent preservation

Set `intentPreservation = low` when the rewrite:

- changes the implied buyer problem
- imports a new positioning frame not latent in the source
- changes the task from informative to persuasive or vice versa without evidence
- broadens into extra channels or extra jobs
- redirects the output instead of narrowing it

Example:

A generic Kubernetes guide prompt should not suddenly gain audit-pressure, identity-sprawl, or compliance-specific framing unless the original prompt clearly points there.

---

## 9. Rewrite Evaluation Rules

### 9.1 Existing delta evaluation remains

PromptFire may continue to compute:

- score deltas
- weighted overall delta
- improvement status candidates

### 9.2 Delta is necessary but not sufficient

A positive score delta does **not** by itself justify `material_improvement`.

### 9.3 New material improvement rule

A rewrite may be classified as `material_improvement` only when all are true:

1. `overallDelta` meets the material threshold
2. `groundedImprovementCount >= 2`
3. `rubricEchoRisk != high`
4. `intentPreservation != low`

### 9.4 Minor improvement rule

Use `minor_improvement` when:

- score movement is positive
- there is at least one grounded improvement
- but the rewrite does not meet the stronger material standard

### 9.5 No significant change rule

Use `no_significant_change` when any of the following are true:

- score movement is small
- the rewrite mostly paraphrases
- abstract scaffolding dominates
- the rewrite instructs a future model to add specificity rather than adding it itself

### 9.6 Possible regression rule

Use `possible_regression` when:

- score movement is materially negative
- or intent preservation is low enough that the rewrite appears to redirect the task

### 9.7 Already strong rule

Existing already-strong behavior remains intact for strong prompts with low expected improvement.

---

## 10. Expected Improvement Rules

Expected improvement must not be driven primarily by abstract scorer-friendly markers.

### 10.1 High expected improvement

Use `expectedImprovement = high` only when the likely rewrite gain comes from at least two concrete dimensions such as:

- audience specificity
- output structure
- scope boundedness
- task decomposition
- concrete exclusions
- concrete examples or comparisons

### 10.2 Low expected improvement

Low expected improvement should remain available for strong, already-bounded prompts.

### 10.3 Rubric echo interaction

If `rubricEchoRisk = high`, expected improvement should be reduced or capped unless there is strong evidence of concrete task-grounded improvement.

---

## 11. Rewrite Generation Rules

### 11.1 Generation order

Rewrite generation should prioritize:

1. preserve original job
2. tighten boundedness
3. add missing concrete constraints
4. add audience or structure if clearly missing
5. only then apply stylistic sharpening

### 11.2 Preferred additions

Prefer concrete additions such as:

- specify audience
- specify output shape
- specify example type or count
- specify comparison frame
- add one concrete exclusion
- add real operational or business context
- clarify when the task should emphasize trade-offs

### 11.3 Avoid meta-instruction stuffing

Avoid rewrites that mainly append directions such as:

- improve clarity, scope, and contrast
- add non-negotiable constraints
- include explicit exclusions
- require proof
- add tension
- sharpen differentiation

unless those directives are accompanied by the actual concrete content.

### 11.4 New positioning-frame rule

**Do not introduce a new positioning frame unless it is latent in the source prompt.**

This rule applies especially to marketer and high-contrast modes.

---

## 12. Role and Mode Compatibility

### 12.1 General mode

General mode must not earn rewrite credit for abstract meta-instructions like:

- improve clarity
- add constraints
- include exclusions

unless the rewrite also adds actual concrete task detail.

### 12.2 Marketer mode

Marketer mode may still reward real:

- audience specificity
- proof requirements
- exclusions
- differentiation
- tension

But these must be task-grounded, not placeholder phrasing.

### 12.3 High contrast mode

High contrast mode should still prefer stronger differentiation, but it must not do so by importing canned scorer vocabulary that is not supported by the original prompt.

---

## 13. Public Contract Behavior

This spec does not require new public score keys.

Optional internal signals may include:

- `REWRITE_RUBRIC_ECHO`
- `LOW_INTENT_PRESERVATION`

If exposed later, they must be versioned explicitly.

Public rewrite recommendation behavior remains:

- weak: `rewrite_recommended`
- usable: `rewrite_optional`
- strong with gating satisfied: `no_rewrite_needed`

---

## 14. Acceptance Criteria

### 14.1 Kubernetes weak prompt

Input:

"Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses."

Expected behavior:

- weak classification is acceptable
- rewrite recommendation is acceptable
- rewrite may be generated
- but a rewrite that mainly says:

  - emphasize tension
  - add a requirement
  - add an exclusion
  - require proof
  - improve clarity/scope/contrast
    must **not** be classified as `material_improvement`

### 14.2 Strong technical prompt remains protected

For strong prompts with real natural-language constraints:

- `CONSTRAINTS_MISSING` should remain conservative
- strong prompts should still default to no rewrite when gating conditions are met
- forced rewrites should remain mild
- evaluation must not inflate minor rewrites into material improvement

### 14.3 Concrete rewrite can still win

A clearly weak prompt whose rewrite adds real:

- audience
- structure
- exclusion
- example shape

may still be classified as `material_improvement`.

---

## 15. Required Test Cases

Add or update tests for:

1. rubric-heavy marketer rewrite does not get `material_improvement` without concrete detail
2. rubric-heavy general rewrite does not get `material_improvement` without concrete detail
3. concrete weak-prompt rewrite can still get `material_improvement`
4. strong prompt remains `no_rewrite_needed` by default
5. forced rewrite of strong prompt does not get inflated by meta-instruction scaffolding
6. Kubernetes regression fixture blocks scorer-language-only improvement
7. intent drift lowers evaluation confidence
8. high contrast mode still supports real differentiation when grounded

---

## 16. Engineering Notes

Recommended implementation shape:

- keep existing score and delta computation
- add a small helper layer inside rewrite evaluation for:

  - abstract optimization detection
  - grounded improvement counting
  - intent preservation checks
- adjust improvement status after delta computation
- keep the change set narrow and deterministic

This should be implemented as a behavior correction, not a new subsystem.

---

## 17. Product Rule

**PromptFire should reward rewrites that make the prompt more usable.**
**It should not reward rewrites that merely make the prompt sound more like PromptFire's scoring rubric.**
