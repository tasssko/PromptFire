# UI Copy Voice-Polish Spec

## Purpose

Use the OpenAI copy pass to improve short UI messages so they sound like PeakPrompt, without changing product logic.

This pass exists to make recommendation labels and short explanatory text feel more natural and less robotic.

It must **not** decide product behavior, scoring, or recommendation strategy.

---

## Core rule

The deterministic system decides:

* what the message means
* which recommendation is being shown
* severity / priority
* which UI state is active

The model only decides:

* how to phrase that message in product voice

---

## Scope

This copy-polish pass may be used for short UI text such as:

* recommendation headings
* “best next move” replacement text
* short supporting explanations
* short action-oriented helper text
* short rewrite verdict summaries
* short improvement labels

This copy-polish pass should **not** be used for:

* scoring
* issue detection
* rewrite gating
* severity assignment
* sub-score generation
* recommendation selection
* analytics labels
* internal rule names
* long-form educational text unless explicitly enabled

---

## Product voice goals

Polished UI copy should feel:

* confident
* plainspoken
* practical
* short
* human
* specific

It should not feel:

* robotic
* assistant-like
* hypey
* verbose
* rubric-driven
* like internal product logic leaked into UI

---

## Non-negotiable constraints

The model must preserve the original meaning.

It must **not**:

* change the recommendation itself
* weaken or strengthen severity
* add new advice
* remove important advice
* introduce new reasoning
* change UI state implications
* invent product language not present in meaning
* use internal rubric terms unless they are already user-facing copy

---

## Prompt contract

### System instruction

Use a constrained copy-polish prompt like this:

> Rewrite this UI message in our product voice. Keep the meaning identical. Keep it short. Avoid assistant-y language, hype, and internal rubric jargon.

### Recommended expanded system version

> You are polishing short UI copy for PeakPrompt.
> Rewrite the message in a confident, plainspoken, practical product voice.
> Preserve the meaning exactly.
> Do not change the recommendation, severity, or user intent.
> Keep it short.
> Avoid assistant-like phrasing, hype, marketing fluff, and internal rubric jargon.
> Prefer natural product language over robotic labels.
> Return only the rewritten text.

---

## Input format

Provide structured inputs to reduce drift.

### Required fields

* `messageType`
* `uiState`
* `originalText`
* `maxWords`
* `preserveMeaning`
* `disallowedStyles`

### Example input

```json
{
  "messageType": "recommendation_heading",
  "uiState": "weak",
  "originalText": "Best next move",
  "maxWords": 4,
  "preserveMeaning": true,
  "disallowedStyles": [
    "assistant_y",
    "hype",
    "internal_rubric_jargon",
    "robotic_product_labels"
  ]
}
```

### Example for explanatory body copy

```json
{
  "messageType": "recommendation_explainer",
  "uiState": "weak",
  "originalText": "This prompt tries to do too many jobs at once, which increases generic-output risk and token waste before wording quality matters.",
  "maxWords": 28,
  "preserveMeaning": true,
  "disallowedStyles": [
    "assistant_y",
    "hype",
    "internal_rubric_jargon"
  ]
}
```

---

## Output format

Return only:

```json
{
  "rewrittenText": "Next step"
}
```

Or:

```json
{
  "rewrittenText": "This prompt covers too much at once, which makes broad, generic output more likely."
}
```

No commentary.
No alternatives unless explicitly requested.
No explanation of edits.

---

## Good output characteristics

### Good heading examples

Original:

* Best next move

Good rewrites:

* Next step
* What to do next
* Main fix

### Good explanation examples

Original:

* This prompt tries to do too many jobs at once, which increases generic-output risk and token waste before wording quality matters.

Good rewrites:

* This prompt covers too much at once, so the output is more likely to stay broad and generic.
* This prompt is doing too many things at once, which makes it harder to get focused output.

These are good because they:

* keep the meaning
* reduce internal jargon
* sound more natural
* stay short

---

## Bad output characteristics

Reject outputs that:

* sound like a chat assistant
* add new advice
* become vague
* become more dramatic than the original
* become more “marketing” than product copy
* replace specific reasoning with generic encouragement

### Bad examples

Original:

* Best next move

Bad rewrites:

* Here’s the smartest thing to do next
* Let’s improve this prompt together
* Recommended optimization pathway

Original:

* This prompt tries to do too many jobs at once...

Bad rewrites:

* This prompt could benefit from some refinement for even better outcomes.
* Consider restructuring your request to maximize model performance.
* Let’s break this down into a clearer prompt.

These fail because they are:

* assistant-like
* inflated
* vague
* overly polished
* meaning-shifting

---

## Decision boundary

Use this pass only when:

* the underlying meaning is already final
* the text is user-facing
* the text sounds stiff, robotic, or overly internal

Do not use this pass when:

* product logic is still unresolved
* the message is already good enough
* the text is an internal label
* consistency matters more than stylistic polish for that field

---

## Recommended architecture

### Step 1: deterministic system decides

Example internal action:

```json
{
  "actionKey": "narrow_task_load",
  "uiState": "weak",
  "heading": "Best next move",
  "body": "This prompt tries to do too many jobs at once, which increases generic-output risk and token waste before wording quality matters."
}
```

### Step 2: voice-polish pass rewrites presentation only

Output:

```json
{
  "heading": "Next step",
  "body": "This prompt covers too much at once, so the output is more likely to stay broad and generic."
}
```

### Step 3: render polished copy

The UI should never depend on the model to determine:

* whether the recommendation exists
* which recommendation is most important
* whether rewrite is recommended
* whether the prompt is weak, usable, or strong

---

## Safety rules

If the rewritten output changes meaning, discard it and fall back to the original deterministic copy.

If the rewritten output:

* exceeds length limit
* introduces banned tone
* adds new advice
* removes core meaning

then reject it and use either:

* original copy
* approved fallback variant from a static map

---

## Validation rules

Before accepting polished output, validate:

* word count within limit
* no banned phrases
* no major semantic drift
* no severity drift
* no assistant-y framing
* no internal rubric leakage unless intended

A simple validator can check:

* exact state unchanged
* no new imperative beyond original meaning
* no banned terms like:

  * generic-output risk
  * token waste risk
  * rubric
  * heuristic
  * severity
  * optimization pathway

---

## Fallback strategy

For stability, keep approved static fallbacks for common messages.

Example:

```json
{
  "Best next move": "Next step",
  "How to improve this prompt": "How to improve it",
  "Rewrite recommended": "This prompt needs tightening"
}
```

Recommended approach:

* try model polish first
* validate
* if invalid, use approved fallback
* if no fallback exists, use original

---

## Suggested rollout

### Phase 1

Use only on:

* recommendation headings
* short recommendation explanations

### Phase 2

Expand to:

* rewrite verdict summaries
* issue summaries
* improvement labels

### Phase 3

Optionally expand to:

* state-specific helper text
* empty-state guidance
* success-state reinforcement

---

## Success criteria

This feature is working if:

* UI copy feels less robotic
* wording feels more like PeakPrompt
* users better understand the next action
* recommendation meaning stays stable
* no noticeable drift in product behavior
* fewer awkward labels like “Best next move”

---

## One-line implementation principle

**Keep decision-making deterministic. Use the model only to make the final UI wording sound like PeakPrompt.**

If you want, I can also turn this into a tighter engineering spec with request/response schemas and acceptance tests.
