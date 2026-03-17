
---
# PromptFire Spec v0.5.3 — Config-Driven Result Recommendations and UI Messaging

## 1. Purpose

Introduce a **config-driven recommendation and results messaging system** for PromptFire so that:

* verdict copy
* key findings copy
* next-step recommendations
* section visibility
* state-specific UI actions

can be edited in one place without rewriting rendering logic.

This change should make the results page easier to tune across many prompt types while preserving PromptFire’s deterministic scoring and rewrite-gating behavior.

Primary goal:

* keep **analysis and gating rules in code**
* move **user-facing recommendation wording and UI state mapping into config**
* support many result shapes without bespoke per-screen customization
* make the score-first interface easier to calibrate and iterate

---

## 2. Problem Statement

PromptFire now supports:

* deterministic prompt analysis
* public sub-scores
* overall score and score band
* rewrite recommendation and rewrite preference
* nullable rewrite and evaluation payloads in v2
* best-next-move behavior
* a frontend that already centralizes result rendering into helpers and dedicated result components rather than inline `App.tsx` logic.    

But the product still has a practical tuning problem:

> the results page must handle many different prompt shapes, yet one-off copy and piecemeal UI customization do not scale.

Current risks:

* result messaging becomes brittle if each state is hand-tuned in code
* changing hero copy, findings, or CTA priority requires code edits
* the product can drift into inconsistent voice across strong / usable / weak / no-rewrite / forced-rewrite states
* product iteration becomes slower than it needs to be
* frontend logic becomes cluttered with content decisions that are not true business logic

This is especially important because PromptFire’s current product direction depends on:

* a **single primary score**
* a **small set of consistent verdict states**
* **rewrite suppression for strong prompts**
* **clear next-step guidance**
* **controlled language that rewards composition over decoration**.  

---

## 3. Core Principle

**PromptFire should treat recommendation copy and result-state messaging as configuration, not embedded rendering logic.**

Corollary:

**Deterministic analysis decides what the result means. Configuration decides how that result is presented.**

This means:

* scoring stays deterministic
* rewrite gating stays deterministic
* issue detection stays deterministic
* best-next-move selection stays deterministic

But:

* headlines
* supporting copy
* findings phrasing
* recommendation modules
* visible section sets
* CTA labels
* optional explanatory templates

should become configurable.

---

## 4. Design Goals

### 4.1 Preserve deterministic product behavior

This spec must not weaken:

* score calculation
* score-band assignment
* rewrite gating
* best-next-move ranking
* rewrite evaluation logic

Those remain formal product behavior defined by code and spec.  

### 4.2 Make recommendation tuning easy

A product/operator should be able to change:

* a strong-prompt headline
* the supporting sentence for weak prompts
* which sections appear for usable prompts
* the label for a next-step module
* the wording of a finding
* the default action labels by state

without touching the rendering architecture.

### 4.3 Support many prompt/result shapes through a stable UI shell

The UI should remain structurally consistent:

* score hero
* key findings
* sub-scores
* next-step or best-next-move block
* rewrite/evaluation section only when relevant
* technical details secondary

This aligns with the current score-first UI direction. 

### 4.4 Avoid freeform copy generation

The system should not assemble arbitrary prose at render time from the model or from ad hoc heuristics.

Instead it should compose from:

* stable verdict IDs
* stable finding IDs
* stable action module IDs
* stable visibility rules

This keeps output testable and consistent.

---

## 5. Non-Goals

Not part of this phase:

* replacing heuristic scoring
* replacing `bestNextMove`
* replacing `improvementSuggestions`
* introducing live CMS editing
* user-specific personalization of UI copy
* localization/internationalization framework
* remote config delivery
* model-generated UI text as the primary source of result copy

---

## 6. High-Level Design

The current frontend already maps backend recommendation state into a product state and helper-driven UI behavior, rather than rendering everything inline. `App.tsx` imports `ResultsCard`, `TopShell`, `heroCopy`, `suggestedFindings`, and `toProductState`, which is the right direction for this change. 

This spec changes the result presentation layer from:

```text
analysis result
  -> frontend helper functions
  -> hardcoded switch statements
  -> rendered result cards
```

to:

```text
analysis result
  -> deterministic derived UI state ids
  -> config lookup
  -> rendered result cards
```

Important:

* the backend still returns facts
* the frontend still decides only lightweight presentation state
* config supplies wording, labels, section visibility, and module structure
* rendering components remain stable

---

## 7. Proposed Artifact

Recommended file:

`apps/web/src/config/resultsUiConfig.ts`

Possible adjacent files:

* `apps/web/src/config/resultsUiConfig.ts`
* `apps/web/src/config/resultsUiConfig.test.ts`
* `apps/web/src/components/results/configResolvers.ts`

If the team prefers domain separation, this may also be split into:

* `verdicts.ts`
* `findings.ts`
* `actions.ts`
* `sectionVisibility.ts`

But one typed config file is acceptable for first rollout.

---

## 8. Configuration Model

The config should support five layers.

### 8.1 Product state config

This is the top-level visual state already implied by `rewriteRecommendation`.

Current simplified product states:

* `strong`
* `usable`
* `weak`

These are already present in frontend helpers. 

Each state should define:

* `headline`
* `supporting`
* `primaryAction`
* `secondaryAction`
* `showSections`
* `heroToneOverride` optional
* `emptyRewriteMessage`
* `rewritePanelTitle`
* `bestNextMoveTitle`

Example:

```ts
strong: {
  headline: "Strong prompt",
  supporting: "This prompt is already well scoped and well directed.",
  primaryAction: "copy_original",
  secondaryAction: "force_rewrite",
  showSections: ["findings", "subscores", "why_no_rewrite", "technical_details"],
  rewritePanelTitle: "Optional rewrite",
  bestNextMoveTitle: "Optional next move"
}
```

### 8.2 Verdict override config

PromptFire needs more nuance than only `strong | usable | weak`.

A result may also depend on:

* `rewritePreference`
* whether rewrite exists
* whether evaluation exists
* whether expected improvement is low
* whether rewrite was suppressed
* whether rewrite was forced
* evaluation status such as `already_strong`, `possible_regression`, `material_improvement`

So the UI layer should support **verdict variants** within a product state.

Suggested verdict ids:

* `strong_default`
* `strong_suppressed`
* `strong_forced`
* `usable_default`
* `usable_with_rewrite`
* `weak_default`
* `weak_without_rewrite`
* `rewrite_possible_regression`
* `rewrite_already_strong`
* `rewrite_material_improvement`

These do not replace backend contracts. They are frontend presentation ids.

### 8.3 Findings library

Findings shown in the result page should be resolved from stable IDs instead of emitted as hardcoded English strings.

Suggested finding ids:

* `clear_scope`
* `clear_instruction`
* `strong_contrast`
* `useful_constraints`
* `low_generic_risk`
* `low_token_risk`
* `constraints_missing`
* `audience_missing`
* `high_generic_risk`
* `rewrite_low_value`
* `rewrite_forced_by_user`
* `rewrite_suppressed_by_user`
* `rewrite_possible_regression`
* `already_strong_before_rewrite`

Each finding entry should define:

* `text`
* optional `priority`
* optional `appliesToStates`
* optional `category`

Example:

```ts
clear_instruction: {
  text: "Instructions are clear and direct.",
  category: "strength"
}
```

### 8.4 Action / recommendation module config

This is the most important part.

Each action module represents a reusable next-step block.

Suggested action ids:

* `keep_as_is`
* `add_constraints`
* `add_audience`
* `add_examples`
* `add_exclusions`
* `reduce_filler`
* `rewrite_optional`
* `rewrite_recommended`
* `force_rewrite`
* `review_possible_regression`
* `use_rewrite`
* `show_best_next_move`

Each action entry may define:

* `title`
* `description`
* `ctaLabel`
* `secondaryCtaLabel`
* `improves`
* `questionList`
* `template`
* `tone`
* `whenRewriteExistsBehavior`

Example:

```ts
add_constraints: {
  title: "Define input and output boundaries",
  description: "Add runtime, payload shape, validation, and success/failure behavior.",
  ctaLabel: "Add missing details",
  improves: ["constraintQuality", "clarity", "genericOutputRisk"],
  questionList: [
    "What runtime or framework should be used?",
    "What input format is expected?",
    "What validation is required?",
    "What should happen on success?",
    "What should happen on failure?",
    "What should stay out of scope?"
  ],
  template: "Write a webhook handler in [runtime/framework]..."
}
```

### 8.5 Section visibility config

The UI should be able to show or hide sections by verdict/state without custom branches spread throughout components.

Suggested section ids:

* `findings`
* `subscores`
* `why_no_rewrite`
* `best_next_move`
* `rewrite_panel`
* `rewrite_verdict`
* `improvement_suggestions`
* `technical_details`

Visibility should be derived from config, not scattered conditionals.

---

## 9. Type System Requirements

Because the frontend and contracts are already TypeScript-based, this config should be typed, not plain JSON. The shared contracts already define core result types like `ScoreBand`, `RewriteRecommendation`, `Gating`, and `AnalyzeAndRewriteV2Response`, so typed config is the natural fit. 

Required characteristics:

* TypeScript module export
* literal union ids for verdicts, actions, findings, and sections
* compile-time validation that referenced ids exist
* no untyped stringly-typed lookups in components

Recommended approach:

```ts
export type ResultSectionId = ...
export type ResultFindingId = ...
export type ResultActionId = ...
export type ResultVerdictId = ...

export interface ResultsUiConfig { ... }
export const resultsUiConfig: ResultsUiConfig = { ... }
```

---

## 10. Source of Truth Rules

### 10.1 Code remains source of truth for analysis

The following remain code-derived:

* `overallScore`
* `scoreBand`
* `rewriteRecommendation`
* `analysis`
* `gating`
* `bestNextMove`
* `rewrite`
* `evaluation`

This matches the v2 API contract and current architecture. 

### 10.2 Config becomes source of truth for presentation language

The following become config-derived:

* hero headline
* hero supporting sentence
* action labels
* findings wording
* section titles
* no-rewrite messaging
* empty-state rewrite messaging
* optional templates and guidance questions

### 10.3 Code may still derive ids

The frontend may compute:

* `productState`
* `verdictId`
* `findingIds`
* `primaryActionId`
* `visibleSectionIds`

But it should not own the final English copy.

---

## 11. UI Resolution Flow

The intended frontend flow should be:

```text
AnalyzeAndRewriteV2Response
  -> derive productState from rewriteRecommendation
  -> derive verdictId from productState + gating + rewrite/evaluation presence
  -> derive findingIds from scores/issues/gating/evaluation
  -> derive primaryActionId
  -> lookup config entries
  -> render stable ResultsCard sections
```

This preserves the current “stable result shell” approach while removing most of the hardcoded content logic from helpers. That is consistent with the recent refactor that extracted result logic from `App.tsx` into dedicated result components/helpers.  

---

## 12. Mapping Rules

## 12.1 Product state mapping

This remains simple:

* `no_rewrite_needed` -> `strong`
* `rewrite_optional` -> `usable`
* `rewrite_recommended` -> `weak`

This mapping already exists in the frontend helper layer. 

## 12.2 Verdict mapping

Suggested rules:

### `strong_default`

Use when:

* `productState = strong`
* `rewritePreference = auto`
* `rewrite = null`

### `strong_suppressed`

Use when:

* `productState = strong`
* `rewritePreference = suppress`

### `strong_forced`

Use when:

* `productState = usable`
* `rewritePreference = force`
* original prompt appears strong by gating/evaluation context

### `usable_default`

Use when:

* `productState = usable`
* `rewrite = null`

### `usable_with_rewrite`

Use when:

* `productState = usable`
* `rewrite != null`

### `weak_default`

Use when:

* `productState = weak`
* `rewrite != null`

### `weak_without_rewrite`

Use when:

* `productState = weak`
* `rewrite = null`
* usually because user suppressed or generation was skipped

### `rewrite_material_improvement`

Use when:

* `evaluation.status = material_improvement`

### `rewrite_possible_regression`

Use when:

* `evaluation.status = possible_regression`

### `rewrite_already_strong`

Use when:

* `evaluation.status = already_strong`

---

## 13. Best Next Move Integration

PromptFire already added a deterministic `bestNextMove` layer to answer the single highest-leverage structural change a user should make. That spec explicitly says it should sit between analysis/gating and rewrite presentation, and that it should reward structural improvement rather than decorative polish. 

This spec should not replace that.

Instead:

* `bestNextMove` remains backend-derived
* UI config controls the section title, framing, and supporting copy for how it is displayed

Rules:

* if `bestNextMove` exists and state is non-strong, default title should be `Best next move`
* if `bestNextMove` exists and state is strong, default title should be `Optional next move`
* wording for explanatory chrome around `bestNextMove` should come from config
* the `bestNextMove` body itself remains data-driven

This is already close to the current `ResultsCard` behavior, where strong state changes the title from “Best next move” to “Optional next move.” 

---

## 14. Improvement Suggestions Integration

`improvementSuggestions` should remain structurally separate from `bestNextMove`.

Config should control:

* section title
* empty state message
* card labels
* impact badge label text if needed
* example-change intro wording

But the suggestions themselves remain backend facts.

---

## 15. Role / Mode Overrides

PromptFire has role and mode concepts, and recommendation wording may reasonably vary by role without changing the core structure.

So config should support optional overrides:

* `default`
* `general`
* `developer`
* `marketer`

Example:

```ts
add_constraints: {
  default: { ... },
  developer: {
    title: "Define runtime and failure behavior",
    description: "Specify framework, input shape, validation, and success/failure handling."
  }
}
```

Rules:

* use role override only for wording
* do not let role override change deterministic scoring or gating
* mode may affect which action id is chosen, but config should not change mode semantics

---

## 16. Rendering Rules

### 16.1 Stable layout

The results page must keep a stable layout:

* hero
* findings
* subscores
* one primary recommendation block
* optional supporting sections
* technical details secondary

### 16.2 Single dominant narrative

Even if many issues exist, the UI should emphasize one dominant next step.

Config should not encourage multiple competing primary CTAs.

### 16.3 No contradictory action hierarchy

For any verdict:

* one action is primary
* optional secondary action is subordinate
* copy should not imply equal recommendation weight unless intentional

This matters especially for strong prompts and no-rewrite states, which v0.5.1 explicitly treats as validated rather than failed rewrite requests. 

---

## 17. Backward Compatibility

This spec is frontend-facing and should not require a breaking API change.

It should work with the current v2 response shape:

* `overallScore`
* `scoreBand`
* `rewriteRecommendation`
* `analysis`
* `gating`
* nullable `rewrite`
* nullable `evaluation`
* optional `bestNextMove`
* `meta`  

No contract changes are required for first rollout.

Optional future contract addition:

* frontend-specific `presentationHints`
* not recommended in this phase

---

## 18. Implementation Plan

### Phase A — Introduce typed config

1. add `resultsUiConfig.ts`
2. define ids and interfaces
3. encode current existing copy into config
4. keep existing rendering output functionally equivalent

### Phase B — Add resolvers

1. replace `heroCopy(...)` hardcoded switch with config lookup
2. replace `suggestedFindings(...)` hardcoded text with id resolution + config lookup
3. replace section title branching with config-derived section metadata
4. replace action label hardcoding with action id resolution

### Phase C — Simplify components

1. keep `ResultsCard` stable
2. reduce conditional prose branches
3. use resolver outputs as props
4. leave technical details/data sections unchanged

### Phase D — Add overrides and polish

1. add role-specific wording overrides
2. add action templates/question lists
3. support optional empty states by config
4. add snapshot tests for major verdict states

---

## 19. Proposed Config Shape

```ts
export type ProductState = "strong" | "usable" | "weak";

export type VerdictId =
  | "strong_default"
  | "strong_suppressed"
  | "strong_forced"
  | "usable_default"
  | "usable_with_rewrite"
  | "weak_default"
  | "weak_without_rewrite"
  | "rewrite_material_improvement"
  | "rewrite_possible_regression"
  | "rewrite_already_strong";

export type FindingId =
  | "clear_scope"
  | "clear_instruction"
  | "strong_contrast"
  | "useful_constraints"
  | "low_generic_risk"
  | "low_token_risk"
  | "constraints_missing"
  | "audience_missing"
  | "high_generic_risk"
  | "rewrite_low_value"
  | "rewrite_forced_by_user"
  | "rewrite_suppressed_by_user";

export type ActionId =
  | "keep_as_is"
  | "add_constraints"
  | "add_audience"
  | "add_examples"
  | "add_exclusions"
  | "reduce_filler"
  | "rewrite_optional"
  | "rewrite_recommended"
  | "force_rewrite"
  | "review_possible_regression"
  | "use_rewrite";

export type SectionId =
  | "findings"
  | "subscores"
  | "why_no_rewrite"
  | "best_next_move"
  | "rewrite_panel"
  | "rewrite_verdict"
  | "improvement_suggestions"
  | "technical_details";

export interface ResultsUiConfig {
  states: Record<ProductState, StateConfig>;
  verdicts: Record<VerdictId, VerdictConfig>;
  findings: Record<FindingId, FindingConfig>;
  actions: Record<ActionId, ActionConfig>;
  sections: Record<SectionId, SectionConfig>;
}
```

---

## 20. Acceptance Criteria

This spec is successful when:

* changing a headline, supporting sentence, or CTA label no longer requires editing result components
* strong / usable / weak states remain structurally coherent
* the UI still communicates one primary recommendation in under five seconds
* best-next-move presentation remains consistent with the score-first model
* role-specific wording can be tuned without touching scoring code
* `App.tsx` and result helpers get smaller, not larger
* output language becomes more consistent across states
* strong prompts still render as validated, not failed rewrite requests
* rewrite remains a tool, not the default product output. 

---

## 21. Required Test Cases

1. strong prompt renders hero copy from config, not hardcoded helper text
2. usable prompt renders action labels from config
3. weak prompt renders rewrite panel title from config
4. `rewritePreference = suppress` uses suppressed-state verdict copy
5. forced rewrite uses forced-state verdict copy
6. `bestNextMove` section title changes by state through config
7. findings are resolved from finding ids, not inline prose constants
8. section visibility differs by verdict without branching in `App.tsx`
9. missing config ids fail at compile time or resolver validation
10. developer override wording is used for developer role without changing analysis output
11. existing v2 response with `rewrite: null` and `evaluation: null` still renders correctly
12. strong microservices calibration prompt still resolves to no-rewrite-needed state and uses strong-state config messaging, preserving the strong-prompt behavior already locked in by tests/spec.  

---

## 22. Recommendation

I would ship this as a separate spec, not bury it inside the scoring spec.

Suggested file name:

`specs/results-ui-config-spec-v0.5.3.md`

That keeps the boundary clean:

* scoring/gating spec defines product truth
* best-next-move spec defines structural recommendation truth
* results-ui-config spec defines presentation configuration

That separation matches the repo’s current direction:

* v0.5.1 defines the score-first, no-auto-rewrite behavior and Pagespeed-style UI expectations
* v0.5.2 defines deterministic best-next-move
* the frontend refactor already centralizes result rendering and is ready for config-based copy resolution next.   

If you want, I can turn this straight into the exact markdown file content you can paste into `specs/results-ui-config-spec-v0.5.3.md`.
