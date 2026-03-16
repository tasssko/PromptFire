Absolutely — here’s a paste-ready spec draft that fits the current PromptFire direction.

It stays aligned with the existing v2 model where the overall score is primary, strong prompts should skip rewrite by default, internal signals can influence behavior without becoming public score keys, and rewrites only count when they materially improve boundedness or differentiation.   

````md
# PromptFire Pattern-Fit and Pattern-Aware Rewrite Spec v0.1

## 1. Purpose

Add a deterministic internal layer that identifies the best prompt pattern for a given task and weakness profile, then uses that pattern to guide rewrite behavior.

This layer should help PromptFire answer not only:

- is this prompt weak or strong?

but also:

- what kind of prompt structure would improve it most?

The goal is to make rewrites more useful, more explainable, and less likely to become generic “polish” rewrites.

---

## 2. Why this phase matters

PromptFire already has the right product foundation:

- score-first prompt analysis
- explicit rewrite gating
- validation of strong prompts without automatic rewrite
- rewrite evaluation that distinguishes material improvement from paraphrase
- targeted improvement suggestions instead of one undifferentiated rewrite style

That means the next useful step is not “add more rewrite power.”
It is:

- detect the right intervention type
- adapt the rewrite to that intervention type
- keep strong direct prompts direct when they are already working

This phase should improve rewrite usefulness while preserving PromptFire’s core principle:

**reward composition over decoration**

---

## 3. Product principles

### 3.1 Choose the lightest pattern that solves the problem

PromptFire should not automatically rewrite prompts into more elaborate structures.

A stronger prompt pattern should only be chosen when it is likely to improve output quality in a meaningful way.

Examples:

- do not turn a strong direct prompt into a staged reasoning prompt for no reason
- do not add examples unless examples would clearly reduce ambiguity
- do not decompose the task unless task overload is the real issue

### 3.2 Pattern fit is internal first

Pattern detection should initially be an internal strategy layer.

It may influence:

- rewrite generation
- suggestion generation
- explanation text
- evaluation interpretation

It should not be exposed as a new public score.

### 3.3 Pattern fit must respect existing rewrite gating

Pattern-aware rewriting does not override strong-prompt suppression.

If PromptFire already determines:

- overall score is high
- major blocking issues are false
- expected improvement is low
- rewritePreference is not force

then rewrite should still be skipped by default.

### 3.4 Rewrites should improve task fit, not prompt sophistication

A rewrite should not be considered better merely because it:

- sounds more advanced
- introduces more structure
- adds formal prompting language
- looks more “prompt engineered”

A rewrite is better only if it improves likely output quality for the task.

---

## 4. New internal concept

### 4.1 Prompt pattern

Add a new internal enum:

```ts
export type PromptPattern =
  | 'direct_instruction'
  | 'few_shot'
  | 'stepwise_reasoning'
  | 'decomposition'
  | 'decision_rubric'
  | 'context_first';
````

### 4.2 Pattern fit result

```ts
export interface PatternFit {
  primary: PromptPattern;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  rejectedPatterns?: PromptPattern[];
}
```

This object is internal and deterministic.

---

## 5. Pattern definitions

### 5.1 `direct_instruction`

Use when the prompt has one clear job and mainly needs tighter direction.

Best for:

* clear single-deliverable tasks
* prompts that mainly need audience, boundaries, exclusions, or proof constraints
* already-strong prompts that do not need structural transformation

Typical rewrite effect:

* clarify audience
* tighten scope
* add exclusions
* add proof/example requirements
* preserve direct style

### 5.2 `few_shot`

Use when the task is easier to demonstrate than describe.

Best for:

* style imitation
* formatting consistency
* classification or transformation tasks with subtle distinctions
* output patterns where examples reduce ambiguity better than extra prose

Typical rewrite effect:

* short task instruction
* 1 to 3 compact examples
* final instruction to follow the demonstrated pattern

### 5.3 `stepwise_reasoning`

Use when the task depends on structured judgment.

Best for:

* comparison
* prioritization
* diagnosis
* evaluation
* trade-off analysis
* recommendation tasks with interacting constraints

Typical rewrite effect:

* first identify dimensions or trade-offs
* then compare options or factors
* then produce the final answer

Note:
PromptFire should use the product term `stepwise_reasoning` rather than exposing “chain of thought” as a user-facing category.

### 5.4 `decomposition`

Use when the prompt is overloaded or combines multiple jobs.

Best for:

* multi-deliverable prompts
* broad “complete guide” prompts
* prompts with many directive verbs
* prompts likely to create reruns or sprawl

Typical rewrite effect:

* split into stages
* break work into ordered steps
* narrow the first output
* optionally turn one large request into phased output

### 5.5 `decision_rubric`

Use when the task is about scoring, reviewing, comparing, or applying criteria consistently.

Best for:

* QA and review tasks
* rubric-based evaluation
* policy checking
* ranking options
* side-by-side comparison

Typical rewrite effect:

* define evaluation criteria
* define scoring basis
* specify output shape for verdict or ranking

### 5.6 `context_first`

Use when the real problem is missing source material, not prompt wording.

Best for:

* tasks requiring grounded specifics
* tasks asking for proof or examples that are not supplied
* domain-sensitive tasks where context is missing
* cases where rewrite would otherwise fabricate specificity

Typical rewrite effect:

* request missing context
* require source inputs
* frame the task around supplied material instead of invented detail

---

## 6. Detection philosophy

Pattern fit should be derived from the same deterministic analysis philosophy already used in PromptFire.

It should rely on:

* prompt text
* existing analysis outputs
* existing issue codes
* existing internal signals
* simple structural detection rules

It must not require an LLM call.

---

## 7. Candidate internal signals

Add derived internal signals such as:

```ts
export interface PatternSignals {
  hasClearDeliverable: boolean;
  hasSingleDeliverable: boolean;
  hasTaskOverload: boolean;
  hasStyleImitationIntent: boolean;
  hasFormatConsistencyNeed: boolean;
  hasTradeoffFraming: boolean;
  hasComparisonIntent: boolean;
  hasEvaluationIntent: boolean;
  hasDecisionIntent: boolean;
  hasStrongExampleRequirement: boolean;
  hasMissingContextForSpecificity: boolean;
}
```

These can be computed from existing analysis plus lightweight text rules.

---

## 8. Pattern selection rules

v0.1 should use deterministic rule ordering rather than weighted classification.

### 8.1 Rule order

Apply in this order:

1. `context_first`
2. `decomposition`
3. `decision_rubric`
4. `stepwise_reasoning`
5. `few_shot`
6. `direct_instruction`

### 8.2 Suggested logic

```ts
if (signals.hasMissingContextForSpecificity) {
  return patternFit('context_first');
}

if (signals.hasTaskOverload) {
  return patternFit('decomposition');
}

if (signals.hasEvaluationIntent || signals.hasDecisionIntent) {
  return patternFit('decision_rubric');
}

if (signals.hasTradeoffFraming || signals.hasComparisonIntent) {
  return patternFit('stepwise_reasoning');
}

if (signals.hasStyleImitationIntent || signals.hasFormatConsistencyNeed || signals.hasStrongExampleRequirement) {
  return patternFit('few_shot');
}

return patternFit('direct_instruction');
```

### 8.3 Interpretation rule

Pattern selection should prefer the most structurally necessary pattern, not the most sophisticated one.

---

## 9. How pattern fit affects rewrite behavior

### 9.1 General rule

If PromptFire decides to generate a rewrite, it should rewrite into the selected pattern.

This means PromptFire should not have a single generic rewrite style.

### 9.2 Pattern-specific rewrite guidance

#### `direct_instruction`

Rewrite by tightening:

* audience
* scope
* exclusions
* proof/example requirements
* output structure

Do not materially change task shape.

#### `few_shot`

Rewrite into:

* compact task instruction
* compact examples
* final replication instruction

Do not add few-shot examples unless examples are likely to solve the prompt’s actual weakness.

#### `stepwise_reasoning`

Rewrite into:

* identify dimensions first
* evaluate or compare second
* conclude third

Use for judgment-heavy tasks.
Do not use just to make the prompt look more advanced.

#### `decomposition`

Rewrite into:

* ordered phases
* staged deliverables
* narrowed first output

Use when task breadth or multi-job structure is a core problem.

#### `decision_rubric`

Rewrite into:

* criteria
* scoring or judgment basis
* required verdict format

#### `context_first`

Rewrite into:

* source request
* required context fields
* grounded instruction based on provided inputs

Avoid fabricated specificity.

---

## 10. Gating interaction

Pattern fit must not weaken existing rewrite suppression logic.

### 10.1 Strong prompt rule remains unchanged

If all of the following are true:

* `overallScore >= 80`
* `majorBlockingIssues = false`
* `expectedImprovement = "low"`
* `rewritePreference != "force"`

then PromptFire should still default to:

* `rewriteRecommendation = "no_rewrite_needed"`
* `rewrite = null`
* `evaluation = null`

### 10.2 Forced rewrite behavior

If `rewritePreference = "force"`, PromptFire may generate a rewrite using the selected pattern.

In that case:

* pattern fit should guide rewrite style
* evaluation should still be allowed to say:

  * `already_strong`
  * `no_significant_change`
  * `possible_regression`

### 10.3 Suppressed rewrite behavior

If `rewritePreference = "suppress"`, PromptFire should compute pattern fit internally if useful for findings or suggestions, but must not generate a rewrite.

---

## 11. Suggestion generation

Pattern fit should also influence non-rewrite guidance.

Example mapping:

* `direct_instruction` -> “Clarify the request directly”
* `few_shot` -> “Add one or two examples of the pattern you want”
* `stepwise_reasoning` -> “Break the reasoning into explicit steps”
* `decomposition` -> “Split the task into stages”
* `decision_rubric` -> “Add evaluation criteria”
* `context_first` -> “Supply the missing context or source material”

This works especially well for strong prompts where PromptFire currently returns 0 to 2 low-pressure optional suggestions rather than rewrite-like advice.

---

## 12. UI guidance

v0.1 should not expose the full pattern taxonomy as a prominent public UI object.

Instead, use it to generate human-readable guidance such as:

* “Best improvement path: clarify the request directly”
* “Best improvement path: add examples”
* “Best improvement path: break the task into steps”
* “Best improvement path: use an evaluation framework”
* “Best improvement path: supply missing context”

This keeps the UI lightweight and score-first.

---

## 13. Evaluation interaction

Pattern fit should influence how rewrites are judged.

Examples:

* a direct prompt rewritten into a more elaborate but not more useful structure should not be rewarded automatically
* a few-shot rewrite should only be treated as materially better if examples actually improve likely output control
* a decomposition rewrite should be rewarded when it reduces task overload and token waste
* a stepwise reasoning rewrite should be rewarded when it improves task handling for judgment-heavy prompts

This remains consistent with the existing rule that rewrites should only be rewarded when they materially improve boundedness or differentiation.

---

## 14. Non-goals

Not part of v0.1:

* public pattern score
* user-configurable pattern selection
* LLM-based classifier for pattern fit
* prompt library or templates
* multi-pattern blended rewrites
* persistent user pattern preferences

---

## 15. Initial regression fixtures

### 15.1 Strong direct prompt stays direct

Input:

“Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.”

Expected:

* `primary = direct_instruction` or `stepwise_reasoning`
* rewrite recommendation remains `no_rewrite_needed`
* no rewrite in auto mode

### 15.2 Few-shot candidate

Input:

“Rewrite these support replies in our house style.”

Expected:

* `primary = few_shot`

### 15.3 Stepwise reasoning candidate

Input:

“Help me decide whether to split this monolith into services.”

Expected:

* `primary = stepwise_reasoning`

### 15.4 Decomposition candidate

Input:

“Create a strategy, roadmap, launch plan, and messaging for our new product.”

Expected:

* `primary = decomposition`

### 15.5 Decision rubric candidate

Input:

“Score these landing page drafts and rank them from strongest to weakest.”

Expected:

* `primary = decision_rubric`

### 15.6 Context-first candidate

Input:

“Write a detailed case study about our customer migration and include the measurable business outcomes.”

Expected:

* `primary = context_first` when no source context is supplied

---

## 16. Engineering integration points

### 16.1 Suggested module

```text
packages/heuristics/src/patternFit.ts
```

### 16.2 Suggested function

```ts
export function detectPatternFit(input: {
  prompt: string;
  role: 'general' | 'marketer' | 'developer';
  mode: 'balanced' | 'high_contrast';
  analysis: Analysis;
  context?: Record<string, unknown>;
}): PatternFit
```

### 16.3 Suggested server flow

```ts
const analysis = analyzePrompt(input);
const patternFit = detectPatternFit({ ...input, analysis });

const shouldRewrite = decideRewrite(...);

if (!shouldRewrite) {
  return {
    ...result,
    patternFit: undefined, // internal only
  };
}

const rewrite = await rewriteEngine.rewrite({
  ...input,
  analysis,
  patternFit,
});
```

---

## 17. Acceptance criteria

v0.1 is complete when:

1. PromptFire can deterministically classify a prompt into one primary pattern.
2. Pattern fit does not require an LLM call.
3. Rewrite generation can branch by pattern.
4. Strong-prompt suppression remains unchanged.
5. Pattern fit improves rewrite usefulness without increasing rewrite pressure.
6. Tests cover at least one fixture for each pattern.
7. Strong direct prompts are not upgraded into more elaborate rewrites by default.

---

## 18. Summary

Pattern fit turns PromptFire from:

* “rewrite this prompt better”

into:

* “choose the prompt structure most likely to solve the actual problem”

This should make PromptFire:

* more trustworthy
* more explainable
* less rewrite-happy
* better at preserving already-strong prompts
* better at choosing the right intervention for weak ones

```

A couple of things in that draft are intentionally aligned with your current repo shape:

The draft keeps pattern-fit internal first because the current spec explicitly allows internal role-specific signals to influence public behavior without exposing them as public score keys. :contentReference[oaicite:3]{index=3}

It also keeps strong-prompt suppression intact, since the current v0.5.1 rules say strong prompts should skip rewrite by default when score, expected improvement, and blocking issues line up, and your test direction already reinforces low-pressure handling for strong prompts with no rewrite needed. :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}

And it treats rewrite adaptation as an extension of the existing evaluation philosophy, where rewrites should be judged by material improvement rather than by sounding more polished or more engineered. :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}

Next, I’d convert this into a shorter engineering version with:
- exact TypeScript interfaces
- rule pseudocode
- test fixture names
- recommended file changes in `packages/heuristics` and the API flow
```
