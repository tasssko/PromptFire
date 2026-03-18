# PromptFire Rewrite Ladder Spec v0.1

## 1. Purpose

Add a deterministic internal rewrite-ladder layer to PromptFire so that rewrites are generated as bounded improvement steps rather than one generic “better prompt” attempt.

The rewrite ladder should:

* preserve PromptFire’s score-first model
* respect existing rewrite gating
* sit on top of pattern-fit rather than replacing it
* align with rewrite-integrity safeguards
* reduce rubric-echo rewrites and over-jumped rewrites
* make rewrites easier to explain, test, and monetize

This phase should help PromptFire answer not only:

* should this prompt be rewritten?
* what pattern best fits the task?

but also:

* how weak or strong is this prompt in rewrite terms?
* what is the next justified improvement step?
* how far should this rewrite go before stopping?

---

## 2. Why this phase matters

PromptFire already has the right foundation:

* score-first analysis and rewrite gating
* strong-prompt suppression by default when expected improvement is low
* deterministic pattern-fit selection before rewrite generation
* rewrite evaluation that blocks rubric echo and rewards grounded improvement

The remaining gap is not “more rewrite power.”
It is “more rewrite control.”

Right now the system can decide:

* whether rewrite is worthwhile
* what structural rewrite pattern best fits the task

But it does not yet explicitly encode:

* the prompt’s current rung
* the next safe target rung
* the maximum safe rewrite jump
* the stop condition after a bounded rewrite step

The ladder fills that gap.

---

## 3. Product principles

### 3.1 The ladder is a control layer, not a separate scorer

The rewrite ladder should be derived from the existing analysis, score bands, gating signals, and rewrite-integrity rules.

It should not become a second independent scoring system.

### 3.2 Default behavior should improve only one justified rung

PromptFire should usually generate the next useful rewrite step, not the most idealized possible prompt.

Examples:

* poor -> weak
* weak -> good
* good -> strong

It should not usually jump:

* poor -> excellent
* weak -> excellent

unless later, explicit premium or force flows allow that.

### 3.3 Strong prompts remain protected

The ladder must not weaken the current strong-prompt suppression rules.

If PromptFire already concludes that a prompt is strong enough and expected improvement is low, the ladder should stop rather than invent refinement work.

### 3.4 Pattern-fit chooses shape, ladder chooses distance

Pattern-fit already identifies whether the rewrite should stay direct, break work into phases, use a decision rubric, request missing context, and so on.

The ladder should not duplicate that logic.

Instead:

* pattern-fit determines rewrite style
* ladder determines how much change is justified

### 3.5 Ladder progress must be earned by grounded improvement

A rung jump must not be granted merely because the rewrite:

* sounds more polished
* becomes longer
* adds scorer-shaped instructions
* looks more “prompt engineered”

A rung jump is only valid when the rewrite adds real, task-grounded control.

---

## 4. Non-goals

This spec does not require:

* a new public API version by itself
* a full scorer redesign
* replacing existing score bands
* embeddings or semantic similarity models
* an iterative “rewrite until score target is reached” loop
* arbitrary user editing of ladder rungs
* exposing full ladder internals in the UI

This is an internal behavior layer inside the current architecture.

---

## 5. Current architecture assumptions

This spec assumes the following current behaviors remain true:

1. Rewrite gating remains score-first.
2. Strong prompts can suppress rewrite by default.
3. Pattern-fit is computed deterministically before rewrite generation.
4. Rewrite generation may be inference-backed or mock-composed.
5. Rewrite evaluation remains available after generation.
6. Rewrite-integrity rules continue to block rubric echo and intent drift.

The ladder extends these behaviors rather than replacing them.

---

## 6. New internal concept

### 6.1 Rewrite ladder rung

Add a new internal enum:

```ts
export type RewriteLadderRung =
  | 'poor'
  | 'weak'
  | 'good'
  | 'strong'
  | 'excellent';
```

This is rewrite-oriented and may map to existing public score bands, but it remains an internal control concept.

### 6.2 Rewrite ladder state

```ts
export interface RewriteLadderState {
  current: RewriteLadderRung;
  target: RewriteLadderRung | null;
  next: RewriteLadderRung | null;
  maxSafeTarget: RewriteLadderRung;
  stopReason:
    | 'already_strong'
    | 'already_excellent'
    | 'rewrite_not_recommended'
    | 'force_required_for_further_rewrite'
    | null;
}
```

### 6.3 Rewrite ladder step

```ts
export interface RewriteLadderStep {
  from: RewriteLadderRung;
  to: RewriteLadderRung;
  rewrittenPrompt: string;
  explanation: string;
  groundedAdditions: string[];
  rejectedAbstractAdditions: string[];
}
```

### 6.4 Ladder evaluation

```ts
export interface LadderEvaluation {
  claimedStep: { from: RewriteLadderRung; to: RewriteLadderRung };
  accepted: boolean;
  reason:
    | 'grounded_improvement_sufficient'
    | 'insufficient_grounded_improvement'
    | 'rubric_echo_risk'
    | 'intent_drift'
    | 'already_strong'
    | 'no_significant_change';
}
```

---

## 7. Ladder semantics

### 7.1 `poor`

A prompt is `poor` when the task is too vague, too broad, or too unbounded to produce a reliably useful result.

Typical symptoms:

* unclear deliverable
* no meaningful audience or context
* no real boundaries
* very high generic-output risk
* task overload without structure

Rewrite goal:

* rescue the prompt into a minimally usable request

### 7.2 `weak`

A prompt is `weak` when the task is visible but the output is likely to be generic, broad, or inconsistent.

Typical symptoms:

* some task intent is present
* deliverable may be implied but under-bounded
* audience, structure, examples, exclusions, or frame are missing

Rewrite goal:

* add concrete control that materially reduces ambiguity

### 7.3 `good`

A prompt is `good` when it is usable and bounded enough to work, but is still missing one or two anchors that would materially improve output reliability.

Typical symptoms:

* deliverable is clear
* some constraints or audience detail exist
* still missing stronger frame, structure, exclusions, comparisons, or proof requirements

Rewrite goal:

* strengthen precision without changing the job

### 7.4 `strong`

A prompt is `strong` when it is already well directed and likely to produce good output without rewrite.

Typical symptoms:

* clear deliverable
* clear audience
* useful framing
* meaningful constraints
* low expected improvement

Rewrite goal:

* normally stop
* only allow mild force rewrite or premium refinement

### 7.5 `excellent`

A prompt is `excellent` when it is tightly directed, concrete, realistic, and appropriately constrained for the task.

Typical symptoms:

* explicit deliverable
* explicit audience
* governing frame or clear structural control
* meaningful examples, exclusions, or proof conditions
* low generic-output risk
* low token waste risk

Rewrite goal:

* stop by default

---

## 8. Mapping from current scoring and gating

The ladder should be derived from existing PromptFire outputs rather than independently scored.

### 8.1 Initial mapping

Use the current public score bands as the initial ladder mapping:

* `0–34` -> `poor`
* `35–54` -> `weak`
* `55–74` -> `good`
* `75–89` -> `strong`
* `90–100` -> `excellent`

This keeps the ladder aligned with the current score-first product shape.

### 8.2 Suggested function

```ts
export function ladderRungFromOverallScore(overallScore: number): RewriteLadderRung {
  if (overallScore <= 34) return 'poor';
  if (overallScore <= 54) return 'weak';
  if (overallScore <= 74) return 'good';
  if (overallScore <= 89) return 'strong';
  return 'excellent';
}
```

### 8.3 Gating interaction

The ladder must still respect rewrite recommendation and expected-improvement signals.

Examples:

* if rung is `strong` and rewrite recommendation is `no_rewrite_needed`, stop
* if rung is `excellent`, stop unless forced
* if rung is `good` and rewrite recommendation is `rewrite_optional`, allow a bounded optional step
* if rung is `poor` or `weak`, generate next-step rewrite by default when normal rewrite generation is enabled

---

## 9. Ladder policy

### 9.1 Default next-step behavior

PromptFire should default to one-step rewrite generation.

Suggested defaults:

* `poor` -> `weak`
* `weak` -> `good`
* `good` -> `strong`
* `strong` -> stop
* `excellent` -> stop

### 9.2 No default multi-step climbing

PromptFire should not internally loop:

* rewrite
* rescore
* rewrite again
* rescore again
* continue until target score is reached

This is explicitly out of scope for the default path.

The ladder should be a planner for one bounded rewrite step, not a score-chasing iteration loop.

### 9.3 Forced rewrites remain bounded

If `rewritePreference = "force"`:

* allow one ladder step even for `strong` prompts
* do not automatically allow multi-rung jumps
* keep evaluation allowed to return `already_strong`, `no_significant_change`, or `possible_regression`

### 9.4 Optional premium path

A later premium path may support:

* “show me the next rung”
* “take this to strong”
* “refine once more”

But that should be explicit user intent, not background iteration.

---

## 10. How the ladder interacts with pattern-fit

Pattern-fit already exists as a deterministic internal layer.

The ladder should use that output rather than creating a competing rewrite-style system.

### 10.1 Core rule

Pattern-fit determines rewrite shape.
Ladder determines rewrite distance.

### 10.2 Examples

#### Weak direct prompt

* pattern-fit: `direct_instruction`
* ladder: `weak -> good`
* rewrite behavior: add audience, scope, structure, or exclusions directly

#### Overloaded broad prompt

* pattern-fit: `decomposition`
* ladder: `poor -> weak`
* rewrite behavior: split into phases and narrow the first deliverable

#### Comparison-heavy prompt

* pattern-fit: `stepwise_reasoning`
* ladder: `good -> strong`
* rewrite behavior: formalize dimensions, trade-offs, and conclusion order

#### Scoring/ranking prompt

* pattern-fit: `decision_rubric`
* ladder: `weak -> good`
* rewrite behavior: add criteria and verdict format

#### Missing-context prompt

* pattern-fit: `context_first`
* ladder: `good -> strong`
* rewrite behavior: request missing context instead of fabricating specifics

---

## 11. Generation rules by rung

### 11.1 `poor -> weak`

Goal:

* rescue the prompt into a usable ask

Prefer:

* explicit deliverable
* one bounded subject
* minimal audience if inferable
* light reduction of overload

Avoid:

* ornate phrasing
* invented business detail
* over-structuring too early
* premium-level polish

### 11.2 `weak -> good`

Goal:

* add concrete control that materially reduces generic output risk

Prefer:

* audience
* output shape
* one example requirement or comparison frame
* one exclusion
* one governing frame

This is the highest-value ladder step for many weak prompts.

### 11.3 `good -> strong`

Goal:

* add the last boundedness anchors that improve reliability

Prefer:

* sharpened structure
* explicit trade-off or comparison frame
* proof requirement
* realistic exclusion
* clearer tone or output control

Avoid:

* changing deliverable type
* importing a new buyer/problem frame

### 11.4 `strong -> excellent`

Goal:

* optional refinement only
* usually force-mode or premium path

Prefer:

* mild compression
* one realism anchor
* one ambiguous phrase clarified
* one soft constraint turned explicit

Avoid:

* visible over-engineering
* scorer-shaped meta language
* large scope changes

---

## 12. Rewrite-integrity interaction

The ladder must be compatible with the rewrite-integrity rules already in place.

### 12.1 Core rule

A rung jump may only be accepted when the rewrite adds concrete task-grounded improvement.

### 12.2 Required acceptance conditions

A ladder step may only count as valid when all are true:

1. intent preservation is not low
2. rubric echo risk is not high
3. grounded improvement count is sufficient for the claimed step
4. rewritten prompt adds actual task-shaped detail
5. the rewrite does not redirect the deliverable

### 12.3 Minimum grounded-improvement thresholds

Suggested thresholds:

* `poor -> weak`: at least 1 grounded improvement
* `weak -> good`: at least 2 grounded improvements
* `good -> strong`: at least 2 grounded improvements
* `strong -> excellent`: at least 1 grounded improvement and low rubric-echo risk

### 12.4 Multi-rung guardrail

If future flows ever allow larger jumps, require:

* at least 3 grounded improvements
* high intent preservation
* low rubric-echo risk
* an explicit code path that allows the jump

### 12.5 Abstract instruction cap

If a rewrite introduces two or more abstract optimization constructs without enough concrete additions, it must not claim upward ladder progress.

This keeps the ladder aligned with the current rubric-echo protections.

---

## 13. Rewrite input and engine integration

### 13.1 Extend rewrite input

```ts
export interface RewriteInput {
  prompt: string;
  role: Role;
  mode: Mode;
  preferences: Preferences;
  analysis?: Analysis;
  improvementSuggestions?: ImprovementSuggestion[];
  patternFit?: PatternFit;
  ladder?: RewriteLadderState;
}
```

### 13.2 Prompt-builder guidance

When the real rewrite engine is used, add ladder guidance to the system instructions.

Required guidance:

* preserve the same job
* rewrite only to the next justified rung
* do not jump to an idealized final prompt
* add concrete task-grounded detail
* do not add scorer-facing optimization language unless backed by real detail
* do not invent source facts
* do not import a new positioning frame unless latent

### 13.3 Mock rewrite engine support

The mock engine should branch on both:

* `patternFit.primary`
* `ladder.current -> ladder.target`

This will make tests more realistic and more deterministic.

---

## 14. Suggested implementation plan

### Phase 1 — Internal ladder state

Add:

* `RewriteLadderRung`
* `RewriteLadderState`
* `ladderRungFromOverallScore(...)`
* `deriveRewriteLadderState(...)`

Suggested file:

* `packages/heuristics/src/rewriteLadder.ts`

### Phase 2 — Server integration

In `apps/api/src/server.ts`:

* derive ladder state after scoring and before rewrite generation
* pass ladder state into the rewrite engine
* keep current gating logic intact
* stop rewrite generation when ladder says stop and current gating also suppresses rewrite

### Phase 3 — Prompt builder

In `apps/api/src/rewrite/promptBuilder.ts`:

* add ladder guidance to system instructions
* include ladder metadata in the user payload for debugging-friendly determinism

### Phase 4 — Mock rewrite engine

In `apps/api/src/rewrite/mockRewriteEngine.ts`:

* use the existing pattern-fit branches
* add rung-aware patch selection and boundedness rules
* avoid composing “final ideal prompts” for weak prompts by default

### Phase 5 — Evaluation layer

In heuristics and evaluation code:

* add `LadderEvaluation`
* validate claimed rung jumps against grounded-improvement counts, rubric-echo risk, and intent preservation
* keep existing `material_improvement`, `minor_improvement`, `no_significant_change`, `possible_regression`, and `already_strong` statuses

### Phase 6 — Optional UI metadata

Do not expose full ladder internals yet.

Optionally expose lightweight metadata later, such as:

```ts
rewriteLadder?: {
  current: RewriteLadderRung;
  next: RewriteLadderRung | null;
}
```

This should remain secondary to the score-first UI.

---

## 15. Suggested file targets

### New files

* `packages/heuristics/src/rewriteLadder.ts`
* `packages/heuristics/src/rewriteLadder.test.ts`
* `specs/rewrite-ladder-v0.1.md`

### Updated files

* `packages/heuristics/src/index.ts`
* `apps/api/src/server.ts`
* `apps/api/src/rewrite/types.ts`
* `apps/api/src/rewrite/promptBuilder.ts`
* `apps/api/src/rewrite/promptBuilder.test.ts`
* `apps/api/src/rewrite/mockRewriteEngine.ts`
* `apps/api/src/rewrite/mockRewriteEngine.test.ts`
* rewrite evaluation tests / fixtures where applicable

---

## 16. Deterministic behavior rules

### 16.1 The ladder itself must not require inference

The ladder must be derived deterministically from:

* current score band or overall score
* rewrite recommendation
* expected improvement
* major blocking issues
* force/suppress preference

### 16.2 Rewrite generation may still use inference

The real rewrite engine may use inference to generate the actual text for the bounded rung step.

But the following should remain deterministic:

* current rung
* next rung
* stop decision
* max safe target
* validation of whether the step was earned

### 16.3 No automatic internal rerun loop

The default ladder path should not repeatedly rewrite and rescore inside one request.

The system should:

1. analyze once
2. derive ladder state once
3. generate one rewrite step
4. evaluate that step once

Further climbing should require explicit product behavior.

---

## 17. UX and monetization fit

The ladder supports a clean product path for registered users and credits.

### 17.1 Free / analysis path

Show:

* score
* findings
* rewrite recommendation
* best next move
* optional hint of what the next rung would improve

### 17.2 Rewrite path

Charge for bounded rewrite steps rather than generic “rewrite” actions.

Suggested labels:

* `poor -> weak`: Rescue
* `weak -> good`: Strengthen
* `good -> strong`: Sharpen
* `strong -> excellent`: Refine

### 17.3 Credit model fit

Suggested pricing shape:

* next-rung rewrite: 1 credit
* extra rung request: 1 credit
* force rewrite on strong prompt: 2 credits
* premium refinement: paid-only or premium credit

The ladder makes rewrite value explicit instead of opaque.

---

## 18. Acceptance criteria

### 18.1 Poor prompt is rescued, not idealized

Input:

`Write about AI agents.`

Expected:

* current rung = `poor` or `weak` depending on score
* default target = next rung only
* rewrite adds bounded task clarity
* rewrite does not jump straight to a fully polished expert prompt by default

### 18.2 Weak prompt strengthens by one rung

Input:

`Write about cloud cost optimization.`

Expected:

* current rung = `weak`
* target rung = `good`
* rewrite adds at least two grounded improvements such as audience, structure, comparison, or exclusion
* no high rubric-echo risk

### 18.3 Good prompt can sharpen without drift

Input:

A usable, partly bounded comparison or technical prompt

Expected:

* `good -> strong` adds the final high-value controls
* deliverable remains the same
* no new buyer/problem frame is imported

### 18.4 Strong prompt remains protected

Input:

A strong bounded technical prompt

Expected:

* rung = `strong` or `excellent`
* no rewrite by default when current gating suppresses rewrite
* optional suggestions remain lightweight

### 18.5 Rubric echo cannot fake ladder progress

Input:

A rewrite that adds phrases such as:

* improve clarity
* add constraints
* include exclusions
* add proof

without concrete task detail

Expected:

* no valid ladder advancement
* likely `no_significant_change` or `possible_regression`

### 18.6 Pattern-fit still controls rewrite shape

Input:

A scoring/ranking prompt

Expected:

* pattern-fit = `decision_rubric`
* ladder decides rung step
* rewrite adds criteria and verdict format rather than generic prose tightening

---

## 19. Required test cases

Add deterministic tests for at least:

1. `poor -> weak` does not jump to excellent
2. `weak -> good` requires real grounded additions
3. rubric-heavy weak rewrite does not advance rung
4. `good -> strong` preserves intent
5. `strong` prompt does not auto-rewrite
6. forced `strong -> excellent` remains mild
7. `excellent` prompt remains unchanged by default
8. decomposition prompt uses ladder plus pattern-fit correctly
9. context-first prompt requests missing context instead of inventing specifics
10. decision-rubric prompt adds criteria and verdict structure

---

## 20. Example progression

### Source prompt

`Write about cloud cost optimization.`

### Default ladder state

* current: `weak`
* next: `good`
* target: `good`
* maxSafeTarget: `strong`

### Weak -> good rewrite

`Write a practical blog post for engineering managers about cloud cost optimization. Focus on where teams can reduce spend quickly and where cost savings create trade-offs.`

### Good -> strong rewrite, only if explicitly requested later

`Write a practical blog post for engineering managers at mid-sized SaaS companies about cloud cost optimization. Use exactly three sections: quick wins, trade-offs, and measurement plan. Include one startup vs enterprise comparison and avoid vendor marketing claims.`

Important:

The default path should normally stop after the first justified step.

---

## 21. Suggested internal instruction

Use the following internal rewrite rule:

> Improve the prompt only to the next justified rung. Preserve the original job. Prefer audience, framing, structure, examples, exclusions, and concrete operational detail over abstract prompt-engineering language. Do not reward decorative wording or rubric echo. Stop when the prompt is already strong enough that expected improvement is low.

---

## 22. Recommended rollout

### v0.1

* internal ladder derivation
* ladder-aware rewrite generation
* ladder-aware evaluation
* tests and fixtures
* no major public API/UI change

### v0.2

Optional:

* lightweight ladder metadata in API
* next-rung UX labels
* credit-aware rewrite-step UI

### v0.3

Optional:

* explicit user action to request another rung
* premium refine flow

---

## 23. Implementation summary

The rewrite ladder should make PromptFire more controlled, not more complicated.

Current PromptFire already knows:

* whether rewrite is warranted
* what rewrite pattern best fits the task
* whether the resulting rewrite materially improved the prompt

The ladder adds the missing control:

* how far to rewrite
* when to stop
* how to keep rewrites bounded, explainable, and monetizable

That makes rewrites more predictable, more trustworthy, and easier to test inside the existing architecture.
