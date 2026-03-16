Absolutely. Here is an engineering-ready spec you can drop into the repo as the next spec doc.

It is designed to fit the current PromptFire shape:

* v2 already returns `overallScore`, `scoreBand`, `rewriteRecommendation`, `analysis`, `improvementSuggestions`, `gating`, and optional `rewrite` / `evaluation` payloads. 
* improvement suggestions are already generated from analysis and rewrite recommendation, then surfaced in the API and UI. 
* the current heuristics layer already uses theme inference, issue codes, low-score prioritization, and bounded suggestion counts by score band. 
* PromptFire’s existing direction is score-first, deterministic, and cautious about rewarding rubric echo rather than concrete improvement.  

---

# PromptFire Spec v0.5.2 — Best Next Move

## 1. Purpose

Add a deterministic **Best Next Move** feature to PromptFire so the system can identify the **single highest-leverage structural improvement** a user could make to the current prompt without requiring a full rewrite.

This spec extends the existing score-first and rewrite-gating model by introducing one additional decision layer between prompt analysis and rewrite presentation.

Primary goal:

* make PromptFire more actionable without making it more rewrite-heavy
* help users understand the **best method** for improving a prompt
* reduce unnecessary full rewrites when one structural change would do most of the work
* keep behavior deterministic, testable, and explainable

---

## 2. Problem Statement

PromptFire already supports:

* deterministic prompt analysis
* public sub-scores
* overall score and score band
* rewrite recommendation and rewrite preference
* optional rewrite generation
* optional improvement suggestions
* rewrite evaluation and strong-prompt protection   

That means PromptFire can currently answer:

* how strong the prompt is
* what issues exist
* whether rewrite is recommended
* several useful opportunities

But it does not yet answer one of the most important user questions:

> **What is the single most valuable change I should make first?**

Today, the closest feature is `improvementSuggestions`, which can return multiple suggestions such as audience, proof, exclusion, structure, task load, or framing. Those are useful, but they are still a list. They do not force prioritization, and they do not tell the user which single move is expected to create the largest gain. 

This becomes especially important when:

* the prompt is weak but recoverable with one strong structural edit
* the prompt is broad and generic, but the main issue is not wording
* the prompt is using the wrong prompting method for the job
* a rewrite may help, but the user would benefit more from understanding the **key structural fix**

---

## 3. Core Principle

**PromptFire should not only explain what is weak. It should identify the one structural change most likely to improve usefulness.**

Corollary:

**Best Next Move must reward composition over decoration.**
It must prefer changes that improve boundedness, method fit, or differentiation, not changes that merely make the prompt sound nicer. This aligns with the existing scoring and rewrite-quality principles.  

---

## 4. Non-Goals

Not part of this phase:

* replacing `improvementSuggestions`
* replacing rewrite generation
* adding a new public score dimension
* embeddings or semantic search
* multi-step planning
* multi-move optimization
* automatic iterative prompt editing loops
* user history or saved improvement paths
* model-based move generation as a first requirement

This should ship as a deterministic extension inside the current architecture.

---

## 5. Product Definition

### 5.1 Best Next Move

`bestNextMove` is a structured object that identifies the one change PromptFire believes would produce the highest practical improvement for the current prompt.

It must answer:

* what to change
* why that change matters
* which dimensions it is expected to improve
* whether the change is small or structural
* whether the change is about **method fit** rather than just missing detail

### 5.2 What counts as a move

A valid best next move is a **structural improvement class**, not a full rewrite.

Examples:

* add a specific audience
* narrow the task load
* add one exclusion
* specify output structure
* change from broad guide framing to comparison framing
* change from role-based framing to decision-frame prompting
* add concrete examples
* add decision criteria
* add a framing boundary

### 5.3 Method fit

Method fit refers to whether the prompt is using an appropriate prompting pattern for the job.

Examples:

* a role-based prompt may be a weak fit for a comparison task
* a broad explainer may be a weak fit for a decision task
* a generic landing-page prompt may be a weak fit for a persuasion task unless buyer pain and proof are present

Method fit is internal in this phase. It should influence `bestNextMove`, but does not need to become a public score.

---

## 6. High-Level Design

The existing flow is roughly:

```text
validate request
  -> analyze original prompt
  -> compute overallScore / scoreBand
  -> compute rewriteRecommendation / gating
  -> generate improvementSuggestions
  -> maybe generate rewrite
  -> maybe evaluate rewrite
```

This spec changes the v2 flow to:

```text
validate request
  -> analyze original prompt
  -> compute overallScore / scoreBand
  -> compute rewriteRecommendation / gating
  -> generate improvementSuggestions
  -> compute bestNextMove
  -> maybe generate rewrite
  -> maybe evaluate rewrite
```

Important:

* `bestNextMove` is computed from existing analysis outputs plus new deterministic rules
* it does not replace rewrite gating
* it does not require rewrite generation in order to exist
* it may exist even when rewrite is `null`

This fits the current server architecture, where v2 already computes analysis, score band, rewrite recommendation, gating, and improvement suggestions before constructing the response payload. 

---

## 7. Public API Contract

## 7.1 New response field

Add a new optional top-level field to the v2 response:

```ts
bestNextMove?: BestNextMove | null
```

Default expectation for v0.5.2:

* weak and usable prompts: usually present
* strong prompts with `no_rewrite_needed`: optional, and may be `null`
* if present for strong prompts, it should be low-pressure and clearly optional

## 7.2 Proposed schema

```ts
type BestNextMoveType =
  | 'add_audience'
  | 'add_exclusion'
  | 'add_proof_requirement'
  | 'clarify_output_structure'
  | 'reduce_task_load'
  | 'add_framing_boundary'
  | 'add_decision_criteria'
  | 'require_examples'
  | 'shift_to_comparison_pattern'
  | 'shift_to_decision_frame'
  | 'shift_to_audience_outcome_pattern';

type BestNextMoveStrength = 'high' | 'medium' | 'low';

type BestNextMove = {
  id: string;
  type: BestNextMoveType;
  title: string;
  rationale: string;
  expectedImpact: BestNextMoveStrength;
  targetScores: Array<
    'scope' |
    'contrast' |
    'clarity' |
    'constraintQuality' |
    'genericOutputRisk' |
    'tokenWasteRisk'
  >;
  methodFit?: {
    currentPattern: string | null;
    recommendedPattern: string | null;
    confidence: 'high' | 'medium' | 'low';
  };
  exampleChange?: string;
};
```

## 7.3 Public contract rule

This spec does **not** require:

* a new public score
* a numeric “expected delta”
* exposing internal pattern-fit scores
* exposing internal simulation artifacts

Those may be added later if explicitly versioned.

---

## 8. Internal Concepts

Add the following internal concepts.

### 8.1 Candidate move

A deterministic candidate improvement derived from analysis, issue codes, theme, and method-fit heuristics.

### 8.2 Pattern

An internal classification of the prompt’s current method.

Initial recommended internal pattern set:

* `role_based`
* `audience_outcome`
* `comparison`
* `decision_frame`
* `example_constrained`
* `section_structured`
* `technical_explainer`
* `persuasive_marketing`
* `generic`

### 8.3 Pattern fit

An internal assessment of whether the current prompt method appears well suited to the underlying task.

Possible values:

* `high`
* `medium`
* `low`

### 8.4 Move leverage

An internal ranking signal used to choose the single best candidate move.

Move leverage should reflect:

* whether the move addresses one of the weakest dimensions
* whether the move relieves a major issue code
* whether the move improves method fit
* whether the move reduces generic-output risk or token-waste risk
* whether the move is structurally meaningful rather than cosmetic

---

## 9. Deterministic Method-Fit Model

## 9.1 Why method fit is needed

The current suggestion system already infers themes such as `landing_page`, `blog_post`, `comparison`, `explainer`, `email`, and `generic`, and uses that to change suggestion priority. 

Best Next Move should extend that idea by identifying when the prompt is not just missing detail, but using a weaker method than the task deserves.

## 9.2 Observed pattern

Infer `observedPattern` from prompt wording.

Examples:

* contains `act as`, `as a`, `role:` → `role_based`
* contains `compare`, `versus`, `trade-off`, `evaluate` → `comparison` or `decision_frame`
* contains explicit sections, steps, bullets, or output format → `section_structured`
* contains audience + outcome + constraints → `audience_outcome`
* generic topic ask without clear method → `generic`

## 9.3 Recommended pattern

Infer `recommendedPattern` from the task and theme.

Examples:

* blog/explainer with “when X helps and when it hurts” → `decision_frame`
* “compare A vs B” → `comparison`
* landing page / conversion task → `persuasive_marketing`
* technical guide with broad topic load → `technical_explainer` or `decision_frame`, depending on whether the prompt asks for explanation or trade-offs
* weak broad topic prompt with no clear angle → `audience_outcome` or `example_constrained`

## 9.4 Pattern-fit rule

Set pattern fit to low when:

1. the prompt strongly signals one observed pattern
2. the task signals a better recommended pattern
3. the mismatch is likely to increase generic output or ambiguity

Example:

* observed: `role_based`
* recommended: `decision_frame`
* result: `patternFit = low`

---

## 10. Candidate Move Generation

## 10.1 Inputs

Candidate move generation should consume:

* prompt
* role
* mode
* context
* theme
* detected issue codes
* public scores
* rewrite recommendation
* score band
* optional internal pattern-fit result

This aligns with how `generateImprovementSuggestions` is currently derived from input, analysis, overall score, score band, and rewrite recommendation. 

## 10.2 Candidate move families

At minimum, v0.5.2 should support these families:

* audience
* exclusion
* proof
* structure
* task load
* framing
* examples
* decision criteria
* pattern shift

## 10.3 Candidate move rules

Examples:

### Add audience

Create candidate when:

* `AUDIENCE_MISSING`
* scope is low
* generic-output risk is elevated
* theme implies a reader/buyer/operator but none is specified

### Reduce task load

Create candidate when:

* `TASK_OVERLOADED`
* token-waste risk is high
* prompt bundles many jobs or a long topic list

### Clarify structure

Create candidate when:

* constraints are weak
* clarity is low
* prompt asks for output but gives no form

### Add framing boundary

Create candidate when:

* prompt is broad
* generic-output risk is high
* prompt lacks explicit anti-generic or anti-hype guidance

### Add decision criteria

Create candidate when:

* prompt theme is comparison-like
* contrast is weak
* the task implies evaluation but lacks criteria

### Shift to comparison pattern

Create candidate when:

* the job is fundamentally comparative or trade-off based
* the current prompt uses generic explainer framing

### Shift to decision-frame pattern

Create candidate when:

* the task is about “when to use”, “when not to use”, trade-offs, choices, or suitability
* the current prompt does not frame those decisions explicitly

### Shift away from role-based prompt

Create candidate when:

* observed pattern is role-based
* the task would be better served by comparison, decision framing, or audience+outcome constraints
* role framing is doing little real work

---

## 11. Ranking and Selection

## 11.1 Single-move requirement

PromptFire must choose **one** best next move only.

This is the key behavior change from the existing improvement-suggestion list.

## 11.2 Ranking principles

Prefer candidates that:

1. address one of the weakest scores
2. reduce generic-output risk or token-waste risk
3. resolve high-severity issue codes
4. improve method fit
5. are easy to explain
6. do not require full rewrite semantics to be useful

## 11.3 Ranking rule

A move should rank above another move when it is more likely to produce practical user benefit, even if both target similar score dimensions.

For example:

* “reduce task load” should outrank “add one exclusion” for a sprawling Kubernetes mega-guide prompt
* “shift to decision-frame pattern” should outrank “add structure” when the main problem is that the prompt uses the wrong method for a trade-off task
* “add target buyer context” should outrank “require one proof point” when the landing-page prompt still does not define who it is for

## 11.4 Tie-breaks

Tie-break preference:

1. pattern-shift or task-load fixes
2. audience / decision criteria / structure
3. proof / exclusion / framing polish

Reason: structural boundedness and method fit generally matter more than decorative refinement, which is already consistent with PromptFire’s scoring philosophy. 

---

## 12. Relationship to Improvement Suggestions

## 12.1 Improvement suggestions remain

`improvementSuggestions` should remain in place.

They are still useful for:

* giving the user several possible directions
* showing breadth of opportunities
* supporting the current UI

## 12.2 Best Next Move is derived from the same system

For v0.5.2, `bestNextMove` should be generated using the same underlying analysis and candidate logic as `improvementSuggestions`, but with stricter prioritization and optional pattern-fit heuristics.

Recommended implementation approach:

* either reuse improvement-suggestion candidates and select the top move
* or introduce a shared internal candidate-generation layer used by both systems

## 12.3 Contract rule

`bestNextMove` should not contradict `improvementSuggestions`.

If both are present:

* `bestNextMove` should usually be a member of the same conceptual family as the top-ranked suggestion
* if `bestNextMove` is a pattern shift, the supporting suggestions may still include audience, examples, structure, or exclusions

---

## 13. Rewrite Interaction Rules

## 13.1 Weak prompts

When `rewriteRecommendation = "rewrite_recommended"`:

* `bestNextMove` should usually be present
* it should explain the main structural reason rewrite is recommended
* it should not be phrased like generic writing advice

## 13.2 Usable prompts

When `rewriteRecommendation = "rewrite_optional"`:

* `bestNextMove` should usually be present
* it should identify the highest-value move before full rewrite is attempted

## 13.3 Strong prompts

When `rewriteRecommendation = "no_rewrite_needed"`:

* `bestNextMove` may be `null`
* or it may be present as a clearly optional low-pressure suggestion
* it must not undermine the “already strong” message

This mirrors current strong-prompt behavior, where improvement suggestions are limited and low-pressure when no rewrite is needed. 

## 13.4 Rewrite generation

This spec does not require rewrite generation to consume `bestNextMove` immediately.

However, recommended future behavior is:

* rewrite generation should prefer to incorporate the best move first
* especially when that move is about task load, structure, or pattern shift

---

## 14. UI Behavior

## 14.1 Placement

Show `bestNextMove` near the score and findings, before the full list of opportunities.

Suggested label:

* **Best next move**
* or **Most valuable change**

## 14.2 UX goal

The UI should make the user feel:

* “I understand the main thing wrong with this prompt”
* not “I have been given five cards and must guess which matters”

## 14.3 Strong prompt behavior

If the prompt is strong:

* either hide `bestNextMove`
* or show a low-pressure optional version such as:

  * “Optional next move: require one proof point”
  * “Optional next move: specify output structure”

Do not present it as a corrective intervention when the system has already concluded the prompt is strong.

---

## 15. Example Behaviors

## 15.1 Broad Kubernetes guide

Input:

“Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.”

Expected behavior:

* weak or usable classification remains acceptable
* rewrite recommendation may remain `rewrite_recommended`
* `bestNextMove` should likely be:

  * `reduce_task_load`
  * or `shift_to_decision_frame`
* title example:

  * “Narrow the task load”
* rationale example:

  * “This prompt is clear, but it tries to do too many jobs at once, which increases generic-output risk and token waste.”
* it should **not** default to a wording-only suggestion

This aligns with current Kubernetes fixtures, which already protect against rubric-heavy fake gains and treat broad-guide rewrites cautiously unless concrete task shaping is added. 

## 15.2 Strong microservices prompt

Input:

“Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.”

Expected behavior:

* `rewriteRecommendation = "no_rewrite_needed"`
* `bestNextMove = null` is acceptable
* if present, it must be clearly optional and low impact
* no pattern-shift move should be suggested

This stays consistent with the existing strong-prompt protection fixture. 

## 15.3 Weak role-based comparison task

Input:

“Act as a senior engineer and explain when TypeScript is better than JavaScript.”

Expected behavior:

* observed pattern: `role_based`
* recommended pattern: `decision_frame` or `comparison`
* `bestNextMove.type` should likely be:

  * `shift_to_decision_frame`
  * or `shift_to_comparison_pattern`
* rationale should explain that the task needs evaluation criteria more than persona framing

---

## 16. Engineering Notes

## 16.1 Recommended implementation shape

Keep this narrow and deterministic.

Recommended modules:

* `patternFit.ts`
* `bestNextMove.ts`

Or a shared internal module such as:

* `promptOpportunityEngine.ts`

## 16.2 Shared candidate layer

Recommended design:

* refactor improvement-suggestion candidate generation into a shared internal candidate set
* let `generateImprovementSuggestions` continue to slice and label multiple candidates
* let `generateBestNextMove` rank and return exactly one

This is preferable to duplicating audience / proof / structure / task-load logic in two places.

## 16.3 No LLM dependency required

Version 0.5.2 should not require:

* provider calls
* rewrite generation
* simulation by model

The feature should work off deterministic heuristics alone.

## 16.4 Future extension

Later phases may add:

* predicted score delta
* apply-best-move one-click rewrite
* multi-step move planning
* move simulation and rescoring
* full pattern-fit explanations

But none of that is required for this phase.

---

## 17. Required Test Cases

Add or update tests for:

1. weak broad prompt returns `bestNextMove` focused on task load or narrowing
2. weak prompt with missing audience returns `bestNextMove` focused on audience
3. comparison-like prompt without criteria returns `bestNextMove` focused on decision criteria
4. role-based prompt with comparison intent returns a pattern-shift move
5. strong prompt may return `bestNextMove = null`
6. strong prompt with optional move does not undermine `no_rewrite_needed`
7. `bestNextMove` target scores match the move category
8. `bestNextMove` does not use vague copywriting filler
9. `bestNextMove` does not contradict `improvementSuggestions`
10. Kubernetes broad-guide regression prefers structural narrowing over rubric-shaped meta advice
11. microservices strong prompt does not produce an aggressive or corrective best-next-move
12. landing-page weak prompt may prioritize buyer context over proof if audience fit is still missing

---

## 18. Acceptance Criteria

This spec is complete when:

1. v2 responses can include `bestNextMove`
2. weak and usable prompts usually return one meaningful move
3. strong prompts remain protected
4. best-next-move selection is deterministic and testable
5. pattern-fit mismatches can influence the chosen move
6. the feature improves user understanding without increasing rewrite churn
7. the chosen move is structurally meaningful, not cosmetic

---

## 19. Product Rule

**PromptFire should tell the user the single most valuable structural change first.**
**It should prefer method fit, boundedness, and differentiation over wording polish.**

---

## 20. Recommended rollout

1. add shared candidate-generation layer
2. add deterministic pattern-fit inference
3. add `generateBestNextMove`
4. add v2 contract field
5. render Best Next Move above Opportunities in the UI
6. add regression fixtures for broad prompts, role-pattern mismatch, and strong-prompt suppression

If you want, I can turn this into a tighter repo-ready version with suggested filenames and a minimal implementation checklist.
