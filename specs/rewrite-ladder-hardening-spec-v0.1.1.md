# PromptFire Rewrite Ladder Hardening Spec v0.1.1

## 1. Purpose

Harden the newly implemented internal rewrite ladder so it behaves consistently across evaluation, generation, presentation, and debugging paths.

This is a follow-up to `rewrite ladder v0.1`, not a new feature branch.

The purpose of v0.1.1 is to make sure the ladder is not only present in the rewrite pipeline, but is also:

* enforced during rewrite evaluation
* regression-safe at rung boundaries
* observable enough to debug real runs
* correctly subordinated to pattern-fit and existing rewrite gating
* compatible with rewrite presentation fallback logic

This phase should improve trust in ladder behavior without changing the public API contract.

---

## 2. Why this hardening pass matters

The current PromptFire architecture already has the right high-level structure:

* deterministic scoring and rewrite gating
* deterministic pattern-fit before rewrite generation
* internal strategy layers that influence behavior without becoming public score keys
* rewrite evaluation that can label outputs as `material_improvement`, `minor_improvement`, `no_significant_change`, `possible_regression`, or `already_strong`
* rewrite presentation fallbacks that avoid showing weak or misleading rewrites as full successes

That architecture is strong, but the ladder adds a new internal control concept: bounded rewrite distance.

Once that exists, the system should be able to answer not only:

* did the rewrite help?

but also:

* did the rewrite earn the claimed rung step?
* did it stop when it should have stopped?
* did pattern-fit still control shape while the ladder controlled distance?
* did a boundary case behave stably near rung cutoffs?

v0.1.1 is the pass that makes those answers reliable.

---

## 3. Guiding principles

### 3.1 Keep the ladder internal-first

The ladder should remain an internal control layer.

This phase must not introduce a new public score, public rung badge, or required response field.

### 3.2 Preserve the score-first product

The ladder must continue to support PromptFire’s score-first UX rather than competing with it.

Users should still primarily experience:

* score
* recommendation
* findings
* rewrite or fallback guidance

The ladder should refine those behaviors behind the scenes.

### 3.3 Pattern-fit still chooses shape

The hardening pass must not let ladder rules override pattern-fit structure.

Pattern-fit determines rewrite style.
Ladder determines rewrite distance.

### 3.4 Strong-prompt suppression remains intact

The ladder must not weaken the existing rule that strong prompts are usually validated rather than rewritten.

### 3.5 Ladder progress must be earned

A claimed step such as `weak -> good` must be validated against grounded improvement, not just score movement or smoother wording.

---

## 4. Scope of v0.1.1

This hardening pass includes four areas:

1. ladder-aware rewrite evaluation
2. rung-boundary regression coverage
3. internal ladder observability
4. presentation and fallback integration checks

This pass does not include:

* public ladder UI
* user-selectable rung targets in the API
* multi-step automatic climb loops
* billing or quota logic
* persistent ladder analytics dashboards

---

## 5. Current architecture assumptions

This spec assumes the following existing behaviors remain true:

1. score-first rewrite gating is already implemented
2. strong prompts default to `no_rewrite_needed` under the existing threshold logic
3. pattern-fit is computed deterministically before rewrite generation
4. rewrite generation can be real-provider or mock-provider backed
5. rewrite evaluation already classifies the result quality after generation
6. rewrite presentation can suppress weak rewrites or replace them with questions/templates/examples

v0.1.1 extends those paths; it does not replace them.

---

## 6. Problems this hardening pass should solve

### 6.1 Claimed rung progress may not yet influence evaluation outcome enough

Today, PromptFire can already say whether a rewrite materially improved the prompt.

After the ladder, it should also be able to say whether the claimed rung step was actually justified.

Example problem:

* ladder state says `weak -> good`
* rewrite comes back mostly as paraphrase or abstract scaffolding
* evaluation says `minor_improvement` or `no_significant_change`
* but ladder metadata is not yet used to sharpen that judgment

### 6.2 Boundary behavior may drift near score cutoffs

The initial ladder implementation likely maps rung states from score thresholds.

That creates natural sensitivity near:

* poor / weak
* weak / good
* good / strong
* strong / excellent

These transitions need explicit tests so small score shifts do not cause unstable rewrite behavior.

### 6.3 Internal debugging may be too opaque

Once the ladder exists, developers need enough metadata to answer:

* what rung was chosen?
* what target rung was selected?
* why did the ladder stop?
* did generation follow the ladder?
* did evaluation accept or reject the claimed rung step?

Without that, debugging real rewrite behavior becomes slower and more speculative.

### 6.4 Presentation logic may not yet fully exploit ladder outcomes

PromptFire already has rewrite presentation modes such as:

* full rewrite
* template with example
* questions only
* suppressed

The ladder should strengthen those decisions by distinguishing:

* claimed rung step succeeded
* claimed rung step under-delivered
* ladder said stop, so no rewrite should be shown as if it were valuable

---

## 7. Core design change: ladder-aware evaluation

### 7.1 New rule

Every rewrite that runs through a ladder-guided path should also produce a ladder-aware evaluation result.

This does not replace the current evaluation object.

Instead, it augments the internal evaluation process with a second question:

> Did this rewrite earn the rung step it claimed to perform?

### 7.2 New internal object

```ts
export interface LadderEvaluation {
  claimedStep: {
    from: RewriteLadderRung;
    to: RewriteLadderRung;
  };
  accepted: boolean;
  reason:
    | 'grounded_improvement_sufficient'
    | 'insufficient_grounded_improvement'
    | 'rubric_echo_risk'
    | 'intent_drift'
    | 'already_strong'
    | 'no_significant_change';
  groundedImprovementCount: number;
  rubricEchoRisk: 'low' | 'medium' | 'high';
  intentPreservation: 'low' | 'medium' | 'high';
}
```

This object may remain internal in v0.1.1.

### 7.3 Evaluation integration rule

If the ladder step is rejected, PromptFire should not treat the rewrite as having successfully climbed that rung, even if the rewrite is slightly nicer wording.

Examples:

* a `weak -> good` rewrite with only one minor gain should not be treated as a successful step
* a `good -> strong` rewrite with high rubric-echo risk should be downgraded
* a `strong -> excellent` forced rewrite that adds little should be allowed to remain `already_strong`

### 7.4 Minimum acceptance thresholds

Suggested acceptance rules:

* `poor -> weak`: at least 1 grounded improvement
* `weak -> good`: at least 2 grounded improvements
* `good -> strong`: at least 2 grounded improvements
* `strong -> excellent`: at least 1 grounded improvement and low rubric-echo risk

Any step should fail if:

* intent preservation is low
* rubric-echo risk is high
* deliverable drift is detected

### 7.5 Mapping to existing evaluation statuses

The current evaluation statuses should remain authoritative for public behavior.

But ladder evaluation should influence how those statuses are interpreted internally.

Recommended interaction:

* ladder accepted + strong gains -> `material_improvement`
* ladder accepted + smaller gains -> `minor_improvement`
* ladder rejected for insufficient gains -> `no_significant_change`
* ladder rejected for drift or quality drop -> `possible_regression`
* ladder rejected because source already strong -> `already_strong`

---

## 8. Presentation integration

### 8.1 Goal

Use ladder-aware evaluation to improve rewrite presentation decisions without changing the public response schema.

### 8.2 New rule

If a ladder step is rejected, PromptFire should prefer an existing fallback mode rather than presenting the rewrite as a confident full success.

Examples:

* rejected `weak -> good` step on a developer prompt -> `template_with_example`
* rejected speculative thin prompt -> `questions_only`
* `strong` or `excellent` stop state -> `suppressed`

### 8.3 Strong stop integration

If ladder state says stop because the prompt is already `strong` or `excellent`, presentation should align with the current strong-prompt suppression path.

This is especially important for forced rewrites where the rewrite technically exists but may still not deserve prominent display.

### 8.4 No new public field required

This pass should not add a new required `ladderEvaluation` field to the API response.

Presentation logic can use it internally first.

---

## 9. Boundary hardening

### 9.1 Why boundary fixtures are needed

Because rung assignment likely comes from score thresholds, prompts near a boundary can flip behavior too easily unless explicitly tested.

### 9.2 Required boundary zones

Add regression fixtures for prompts that land near:

* `poor <-> weak`
* `weak <-> good`
* `good <-> strong`
* `strong <-> excellent`

### 9.3 Expected properties

Boundary fixtures should prove that:

1. tiny score changes do not create wild rewrite differences
2. a boundary-crossing prompt still respects rewrite gating
3. strong-prompt suppression remains stable above the strong threshold
4. a near-strong prompt does not get treated like a poor prompt just because of one low sub-score
5. forced rewrites on strong prompts remain bounded and mild

### 9.4 Specific boundary fixture examples

#### Weak / good edge

Input pair:

* a sparse but usable prompt at score ~54
* a slightly better version at score ~55 or ~56

Expected:

* first maps to `weak`, second to `good`
* rewrite distance changes at most one rung
* pattern-fit remains stable
* neither prompt jumps to an idealized final rewrite

#### Good / strong edge

Input pair:

* a usable technical prompt at score ~74
* a nearly strong version at score ~75 or ~76

Expected:

* first may still allow bounded rewrite
* second should more often stop by default when expected improvement is low

#### Strong / excellent edge

Input pair:

* strong bounded prompt at score ~89
* excellent prompt at score ~90+

Expected:

* both suppress rewrite by default
* forced rewrite remains mild
* evaluation can still return `already_strong` or `no_significant_change`

---

## 10. Pattern-fit interaction hardening

### 10.1 Goal

Ensure the ladder does not flatten pattern-aware rewriting.

### 10.2 Required rule

For ladder-aware rewrites:

* pattern-fit must still determine rewrite shape
* ladder must only determine rewrite distance and patch budget

### 10.3 Required regression cases

Add explicit fixtures for:

* `decision_rubric`
* `context_first`
* `decomposition`

Expected:

#### `decision_rubric`

A `weak -> good` step should add criteria or verdict structure, not generic prose-tightening only.

#### `context_first`

A `good -> strong` step should request or structure missing source material rather than fabricating specifics.

#### `decomposition`

A `poor -> weak` or `weak -> good` step should narrow and stage the task rather than adding polish to an overloaded request.

### 10.4 Anti-regression rule

If a ladder patch budget reduces the rewrite to generic tightening and suppresses the structural move that pattern-fit would otherwise demand, that is a bug.

---

## 11. Internal observability

### 11.1 Goal

Add enough internal metadata to debug real runs without exposing new public API concepts.

### 11.2 Recommended internal metadata

At minimum, capture internally:

```ts
interface InternalLadderTrace {
  current: RewriteLadderRung;
  next: RewriteLadderRung | null;
  target: RewriteLadderRung | null;
  maxSafeTarget: RewriteLadderRung;
  stopReason: RewriteLadderState['stopReason'];
  pattern: PromptPattern | null;
  claimedStep: { from: RewriteLadderRung; to: RewriteLadderRung } | null;
  ladderAccepted: boolean | null;
  ladderReason: LadderEvaluation['reason'] | null;
}
```

### 11.3 Where it should be available

Recommended internal locations:

* server logs / debug logs
* test fixtures and snapshots
* optional `meta.technicalDetails` or equivalent debug-only plumbing if such an internal surface already exists

### 11.4 Rule

This metadata should be optional and non-breaking.
It must not become a required public response object in v0.1.1.

---

## 12. Suggested code changes

### 12.1 Heuristics module

In `packages/heuristics/src/rewriteLadder.ts`:

Add or extend:

* `validateLadderStep(...)`
* `deriveRewriteLadderState(...)`
* helper functions for rung-threshold acceptance

Suggested shape:

```ts
export function validateLadderStep(input: {
  originalPrompt: string;
  rewrittenPrompt: string;
  from: RewriteLadderRung;
  to: RewriteLadderRung;
  evaluation: EvaluationLike;
  analysis?: Analysis;
}): LadderEvaluation
```

### 12.2 Server integration

In `apps/api/src/server.ts`:

* derive ladder state as today
* after rewrite generation and evaluation, run ladder validation
* use ladder validation to influence internal presentation selection and technical diagnostics
* do not change the public contract

### 12.3 Rewrite presentation integration

In `apps/api/src/rewrite/rewritePresentation.ts`:

* optionally accept ladder stop and ladder validation inputs
* prefer fallback modes when ladder step is rejected
* keep current rules for `already_strong`, `possible_regression`, and weak/no-significant-change paths intact

### 12.4 Mock engine tests

In `apps/api/src/rewrite/mockRewriteEngine.test.ts`:

* add tests proving patch budgets still allow pattern-specific structural moves
* add tests around stop states and force mode behavior

### 12.5 Prompt builder tests

In `apps/api/src/rewrite/promptBuilder.test.ts`:

* verify ladder instructions remain bounded
* verify prompt builder does not request idealized final prompts for weak/good steps
* verify force mode on strong prompts still instructs mild refinement rather than major expansion

---

## 13. Suggested file targets

### New or expanded spec file

* `specs/rewrite-ladder-hardening-v0.1.1.md`

### Likely implementation files

* `packages/heuristics/src/rewriteLadder.ts`
* `packages/heuristics/src/rewriteLadder.test.ts`
* `apps/api/src/server.ts`
* `apps/api/src/rewrite/rewritePresentation.ts`
* `apps/api/src/rewrite/mockRewriteEngine.ts`
* `apps/api/src/rewrite/mockRewriteEngine.test.ts`
* `apps/api/src/rewrite/promptBuilder.test.ts`
* evaluation tests where rewrite statuses are asserted

---

## 14. Acceptance criteria

### 14.1 Ladder step can be rejected independently of rewrite existence

Given:

* a rewrite exists
* ladder claimed `weak -> good`

Expected:

* system can still reject the ladder step if grounded gains are insufficient
* public evaluation remains consistent with that outcome

### 14.2 Strong prompts still stop cleanly

Given:

* prompt score and gating indicate strong prompt suppression

Expected:

* ladder state stops
* presentation aligns with suppressed/no-rewrite-needed behavior
* forced rewrites remain mild and may still evaluate as `already_strong`

### 14.3 Boundary prompts behave stably

Given prompts near rung cutoffs

Expected:

* only bounded differences in rewrite behavior
* no sudden jump to idealized final prompts
* pattern-fit remains stable where task shape is unchanged

### 14.4 Pattern-fit still controls rewrite shape

Given:

* a `decision_rubric`, `context_first`, or `decomposition` candidate

Expected:

* ladder step respects the pattern-specific structural move
* ladder budget does not collapse the rewrite into generic tightening only

### 14.5 Rejected ladder steps influence presentation

Given:

* ladder step rejected with `no_significant_change` or similar outcome

Expected:

* PromptFire can prefer an existing fallback mode instead of presenting the rewrite as a confident full rewrite

### 14.6 No public response breakage

Expected:

* no required new response fields
* existing consumers continue to function unchanged

---

## 15. Required regression tests

Add at least the following tests.

### Ladder evaluation tests

1. `weak -> good` accepted when two grounded gains exist
2. `weak -> good` rejected when rewrite mostly paraphrases
3. `good -> strong` rejected on rubric-echo-heavy rewrite
4. `strong -> excellent` rejected as `already_strong` when change is negligible

### Boundary tests

5. score 54 vs 55 produces bounded rung shift
6. score 74 vs 75 preserves strong-gating expectations
7. score 89 vs 90 still suppresses default rewrite

### Pattern interaction tests

8. `decision_rubric` keeps criteria/verdict structure under ladder budget
9. `context_first` asks for source context instead of inventing detail
10. `decomposition` still stages a broad task under ladder control

### Presentation tests

11. rejected ladder step downgrades to `template_with_example` where appropriate
12. stop-state strong prompt remains `suppressed`
13. forced strong rewrite can still be shown less aggressively when ladder rejects meaningful advancement

---

## 16. Rollout recommendation

### v0.1.1 should ship as an internal hardening pass

Recommended order:

1. add ladder-aware evaluation
2. add boundary fixtures
3. wire ladder results into presentation selection
4. add internal ladder trace metadata
5. run mock and real-provider sanity checks

### Keep the public surface stable

Do not expose ladder rungs publicly yet.
Do not add user-facing controls in this phase.

---

## 17. Summary

`rewrite ladder v0.1` introduced bounded rewrite distance as an internal control layer.

`rewrite ladder v0.1.1` should make that control trustworthy by ensuring:

* claimed rung steps are validated
* boundary behavior is stable
* pattern-fit still controls rewrite shape
* strong-prompt suppression remains intact
* rejected ladder steps fall back cleanly in presentation
* developers can debug ladder decisions without public schema churn

This is the right hardening pass before any future public ladder UX or credit-aware step controls.
