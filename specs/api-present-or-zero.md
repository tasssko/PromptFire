# PromptFire scoring spec v0.5.2

## Purpose

This spec simplifies PromptFire scoring by moving to a **present-or-zero** interpretation for core quality ingredients.

The goal is to make scores easier to trust, easier to explain, and more useful when comparing original prompts with rewrites.

Core principle:

**A sub-score should increase only when a functionally meaningful signal is present. Missing signals contribute zero.**

This is especially important for:

* contrast
* constraint quality
* scope components

This change is intended to:

* reduce soft partial credit for weak prompts
* create larger and more intuitive rewrite deltas
* keep scoring deterministic and explainable
* avoid overcomplicated heuristics that are difficult to reason about

---

## 1. General scoring philosophy

PromptFire should reward **composition over decoration**.

It should not award points simply because:

* the prompt is short
* the prompt is direct
* the prompt uses common domain terms
* the prompt includes more words

It should award points when the prompt includes signals that do real work, such as:

* defining audience
* shaping angle
* constraining output
* blocking default framing
* specifying useful context

### Present-or-zero rule

For all core ingredient checks:

* if a functionally meaningful signal is present, it can contribute positive score
* if the signal is absent, it contributes zero
* signals should not receive partial credit merely because a nearby word or topic appears

### Functional presence rule

“Present” means **functionally present**, not merely keyword present.

Examples:

* “for CTOs at mid-sized SaaS companies” = audience present
* “avoid hype” = exclusion present
* “use one startup example and one enterprise example” = example constraint present
* “security, compliance, and integration” = topic coverage present, but not automatically contrast present
* “IAM service” = subject present, but not automatically contrast present

---

## 2. Public sub-scores

PromptFire continues to expose these public sub-scores:

* scope
* contrast
* clarity
* constraintQuality
* genericOutputRisk
* tokenWasteRisk

Definitions remain:

* **scope** = task boundedness, not length
* **contrast** = meaningful differentiation, not just rarity of words
* **clarity** = directness and readability
* **constraintQuality** = usefulness of requirements
* **genericOutputRisk** = likelihood of bland default output
* **tokenWasteRisk** = likelihood of reruns or waste from broad or vague prompts

---

## 3. Scope

### Definition

`scope` measures how well the prompt bounds the task.

Scope should be built from presence checks for these internal components:

* deliverable clarity
* audience/context specificity
* output/task boundaries
* manageable task shape

### Scope component rules

#### Deliverable clarity

Positive score only when the deliverable is actually specified.

Examples:

* “write landing page copy” = present
* “help with marketing” = absent or weak

#### Audience/context specificity

Positive score only when audience or operating context is actually specified.

Examples:

* “for IT decision-makers in medium to large enterprises” = present
* “for businesses” = weak or absent depending on implementation threshold
* no audience = zero contribution

#### Output/task boundaries

Positive score only when the prompt meaningfully narrows the output.

Examples:

* “avoid hype” = present
* “focus on real trade-offs” = present
* “use one startup example and one enterprise example” = present
* no boundaries = zero contribution

#### Manageable task shape

Positive score when the prompt asks for a bounded job rather than an overloaded one.

Examples:

* one bounded landing page = positive
* “complete guide” covering many major topics = low or zero contribution for this component

### Scope guidance

Scope remains additive across components, but each component should follow present-or-zero logic.

This avoids overcomplication while preserving a useful distinction between:

* prompts that define a real job
* prompts that define a well-bounded job

### Example

“Write landing page copy for our IAM service.”

* deliverable clarity = present
* audience/context specificity = absent
* output/task boundaries = absent
* manageable task shape = present

This should still earn some scope, but not high scope.

---

## 4. Contrast

### Definition

`contrast` measures whether the prompt contains a **non-default differentiating angle**.

A positive contrast score should mean that some meaningful differentiating signal is actually present.

If no differentiating signal is present, contrast should be zero.

### What counts as contrast presence

Contrast should be driven primarily by these signals:

* audience specificity that changes likely framing
* business tension
* trade-off framing
* comparison framing
* distinctive lead angle
* exclusions that block default copy paths
* specific scenario context or operating context

### What does not count as contrast by itself

These should not create positive contrast on their own:

* naming the deliverable
* naming the subject category
* naming broad topic areas
* direct wording alone
* proof/example/structure requirements alone

Examples:

* “landing page copy” = not contrast
* “IAM service” = not contrast
* “security, compliance, and ease of use” = not automatically contrast

### Contrast and present-or-zero

Contrast should follow this strict rule:

* if meaningful differentiation is absent, `contrast = 0`
* if a differentiating signal is present, contrast can rise
* stronger and more numerous differentiating signals can raise it further

### Contrast band guidance

#### 0

No meaningful differentiating signal present.

Example:

* “Write landing page copy for our IAM service.”

This has a deliverable and subject, but no audience, no angle, no tension, no exclusions, and no scenario context.

#### 1–2

A weak differentiating signal is present.

Examples:

* broad audience only
* one light exclusion
* one light directional framing hint

#### 3–4

Some useful differentiation is present, but the framing still leans on default category language.

#### 5–6

Clear differentiating angle is present, but the prompt still has some generic drag.

#### 7–8

Strong audience plus tension/angle/exclusion/context make output meaningfully non-default.

#### 9–10

Very strong and explicit differentiated framing makes generic output unlikely.

### Important overlap rule

Contrast must not become a general “good prompt features” bucket.

Signals such as:

* proof requested
* examples requested
* measurable outcomes
* structure requirements

should contribute primarily to `constraintQuality`, not to contrast, unless they reinforce an already present differentiated angle.

---

## 5. Constraint quality

### Definition

`constraintQuality` measures whether the prompt includes requirements that genuinely shape the output.

### Present-or-zero rule

Each useful requirement type should be scored when present, and zero when absent.

Useful requirement types include:

* audience constraints
* example requirements
* proof requirements
* exclusions
* structure requirements
* tone boundaries
* framing boundaries
* comparison boundaries

### Constraint quality must not collapse to “missing or not missing”

The score can still be additive across present ingredients.

This means:

* no meaningful requirements = very low score
* some broad but real requirements = medium score
* several useful shaping requirements = high score

### Important distinction

Broad topic inclusions can count as requirement presence, but they should not score like strong narrowing constraints.

Examples:

* “highlight security, user-friendly management, and compliance” = requirements present
* “avoid technical jargon” = exclusion present
* “for IT decision-makers in medium to large enterprises” = audience present

So a prompt with those ingredients should not score like a no-constraints prompt.

---

## 6. Overlap between contrast and constraint quality

This is a critical implementation rule.

### Constraint quality answers:

**Do the requirements shape the output?**

### Contrast answers:

**Do those requirements create a non-default angle?**

A signal may affect both, but each signal must have a primary home.

### Primary-home rules

Primarily `constraintQuality`:

* proof requirements
* examples
* measurable outcomes
* structure requirements
* tone constraints
* “must include” content requirements

Primarily `contrast`:

* audience specificity
* business tension
* trade-offs
* comparison framing
* exclusions that block default framing
* scenario-specific context
* lead angle

### Example distinctions

* “include one proof point” = mostly constraint quality
* “lead with audit pressure after acquisitions” = mostly contrast
* “avoid generic cybersecurity buzzwords” = both, but primarily contrast because it blocks default framing
* “use one startup example and one enterprise example” = mostly constraint quality unless it creates a meaningful comparison frame

This rule exists to prevent double-counting and to keep contrast narrowly defined.

---

## 7. Clarity

### Definition

`clarity` measures directness and readability.

Clarity should not act as a proxy for:

* boundedness
* differentiation
* usefulness of constraints

A prompt can be very clear and still be weak.

Example:

* “Write landing page copy for our IAM service.”

This is clear, but it is still weak on contrast and constraints.

---

## 8. Generic output risk

### Definition

`genericOutputRisk` measures the likelihood that the prompt will produce plausible but interchangeable output.

### Relationship to present-or-zero

This score should be driven by the absence or presence of differentiating control signals.

Signals that reduce generic-output risk:

* audience specificity
* business tension
* lead angle
* exclusions
* comparison framing
* scenario context
* useful constraints

Signals that do not reduce generic-output risk much on their own:

* deliverable alone
* subject category alone
* directness alone
* broad topical inclusions alone

### Practical interpretation

A marketer prompt with:

* no audience
* no exclusions
* no angle
* no scenario context
* no useful shaping constraints

should usually remain high risk for generic output.

---

## 9. Token waste risk

### Definition

`tokenWasteRisk` measures the likelihood of wasted cycles from:

* broadness
* ambiguity
* reruns
* diffuse or overloaded asks

### Guidance

This score should not be strongly influenced by present-or-zero ingredient logic.

It should still reflect:

* overly broad requests
* likely reruns due to missing direction
* overloaded tasks
* unnecessary breadth

---

## 10. Language and wording guidance

PromptFire should avoid vague praise words in scoring explanations.

In particular, the system should be careful with words like:

* specific
* specific
* clear

These words can become empty unless tied to what exactly is missing or present.

### Preferred wording

Instead of:

* “the prompt needs more specific details”

Prefer:

* “the prompt needs a more specific audience”
* “the prompt needs a clearer lead angle”
* “the prompt needs a more specific operating context”
* “the prompt needs exclusions that block default category framing”

### Rule for “specific”

Do not use “specific” as a standalone positive label.

If used at all, it should refer to a specific type of specificity, such as:

* specific audience
* specific scenario context
* specific proof requirement
* specific comparison frame

---

## 11. Scoring impact expectations

A present-or-zero model is expected to have these effects:

### Weak prompts

* scores become more honest
* soft partial credit decreases
* rewrite deltas become larger and easier to justify

### Broad but partially shaped prompts

* prompts with real requirements should separate more clearly from truly empty prompts
* constraint quality should improve when real shaping ingredients are present

### Strong prompts

* scores should remain stable or improve slightly in relative separation
* strong prompts should stand further apart from minimal prompts

### Highest impact dimensions

* contrast
* constraintQuality
* genericOutputRisk

### Lower impact dimensions

* clarity
* tokenWasteRisk

---

## 12. Calibration examples

### Example A: bare IAM prompt

“Write landing page copy for our IAM service.”

Expected interpretation:

* scope: some credit
* contrast: 0
* clarity: high
* constraintQuality: very low
* genericOutputRisk: high
* tokenWasteRisk: low to moderate depending on rerun policy

### Example B: stronger but still generic IAM prompt

“Create engaging landing page copy for our Identity and Access Management (IAM) service, targeting IT decision-makers in medium to large enterprises. Highlight key features such as enhanced security, user-friendly management interfaces, and compliance with industry standards. Exclude any technical jargon that may confuse non-technical stakeholders.”

Expected interpretation:

* scope: high
* contrast: low to moderate
* clarity: high
* constraintQuality: medium
* genericOutputRisk: moderate
* tokenWasteRisk: low

Important note:
This prompt should not score like a no-constraints prompt. The issue is not absence of constraints. The issue is that the constraints remain somewhat category-default rather than strongly differentiating.

### Example C: differentiated IAM prompt

“Write landing page copy for CTOs and IT directors at mid-sized enterprises dealing with identity sprawl and audit pressure after acquisitions. Lead with operational control and compliance readiness, require one customer proof point and one measurable outcome, and avoid generic value-prop buzzwords.”

Expected interpretation:

* scope: high
* contrast: high
* clarity: high
* constraintQuality: high
* genericOutputRisk: low
* tokenWasteRisk: low

---

## 13. Acceptance criteria

The updated model should satisfy all of these:

* a missing signal contributes zero
* a positive score means a functionally meaningful signal is actually present
* contrast does not increase merely because the task and subject are named
* broad topic mentions alone do not count as high contrast
* broad topic mentions can still count as requirement presence
* prompts with real shaping requirements do not collapse to `constraintQuality = 2`
* explanations avoid vague praise words unless tied to specific missing or present signal types
* rewrite deltas become more intuitive because rewrites add real ingredients rather than receiving credit for polish alone

---

## 14. Summary

This spec simplifies PromptFire scoring without making it shallow.

The key idea is:

**score the ingredients that are actually present and functionally meaningful. Missing ingredients contribute zero.**

This keeps the model:

* simpler
* more testable
* easier to trust
* better aligned with rewrite delta evaluation
* better aligned with PromptFire’s principle of rewarding composition over decoration
