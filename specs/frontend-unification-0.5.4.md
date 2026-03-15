# PromptFire frontend unification draft

## Goal

Bring the frontend into one coherent, score-first product experience that matches the current PromptFire direction:

* lead with a single overall score
* explain only the most important findings first
* show rewrites only when they are genuinely useful
* validate strong prompts instead of rewriting them by default
* keep detailed internals available, but secondary

## Product position

PromptFire should feel like a prompt quality inspector, not a prompt decoration machine.

The frontend should communicate:

1. **How strong is this prompt?**
2. **What is the main thing to do next?**
3. **Should I keep the original or use the rewrite?**

Everything else is supporting detail.

---

## Current problem

The current frontend already has the right data shape, but the presentation is still too engineering-facing.

It exposes:

* score hero
* raw sub-scores
* issue list
* opportunities
* gating block
* rewrite block
* evaluation block
* trace metadata

That is useful for debugging, but it does not yet feel like one product story. It feels like all response sections are being rendered in sequence.

---

## Core frontend principle

The frontend should be organized around a **primary decision card**.

The user should understand the result in under five seconds.

That card should answer:

* score
* band
* recommendation
* whether a rewrite is shown
* one-sentence explanation

Everything below that card should support the decision, not compete with it.

---

## Proposed page structure

## 1. Input panel

Keep the current top panel simple.

### Contents

* product title
* short sentence explaining score-first analysis
* prompt textarea
* role selector
* mode selector
* rewrite preference control
* primary action button

### UX notes

* rename the action from **Analyze + Rewrite** to **Analyze prompt**
* rewrite should not be implied in the CTA because rewrite is no longer the default outcome for strong prompts
* keep fixtures for internal/testing use, but visually demote them below the main CTA or hide them behind a small “Load example” control

---

## 2. Result hero

This becomes the main product surface.

### Layout

* large numeric score
* score band pill
* short decision headline
* short supporting sentence
* one primary next action

### Example headlines by state

#### Strong prompt

* **Strong prompt**
* Supporting text: “This prompt is already well scoped and well directed.”
* Primary action: **Copy original prompt**
* Secondary action: **Force rewrite**

#### Usable prompt

* **Usable, with room to improve**
* Supporting text: “The prompt is clear, but tightening constraints or differentiation could improve the output.”
* Primary action: **Show suggested rewrite**

#### Weak prompt

* **Rewrite recommended**
* Supporting text: “This prompt is likely to produce generic output unless it is narrowed and better directed.”
* Primary action: **Use rewritten prompt**

### Decision mapping

* `no_rewrite_needed` → hero emphasizes validation and strengths
* `rewrite_optional` → hero emphasizes weaknesses and optional improvement
* `rewrite_recommended` → hero emphasizes problems and recommended rewrite

---

## 3. Key findings strip

Directly below the hero, show 3–4 concise findings.

### Purpose

This replaces the feeling of a long raw issue list.

### Content types

Use a mix of:

* strengths
* weaknesses
* risk calls
* boundary/constraint observations

### Example strong prompt findings

* Clear audience and deliverable
* Good trade-off framing
* Useful constraints and exclusions
* Low generic-output risk

### Example weak prompt findings

* Audience not defined
* Constraints are too thin
* Likely to produce generic output
* Rewrite should improve boundedness

---

## 4. Sub-score panel

Keep sub-scores, but make them clearly secondary.

### Display

* 6 compact score tiles
* grouped as quality and risk

### Grouping

#### Quality

* Scope
* Contrast
* Clarity
* Constraint quality

#### Risk

* Generic output risk
* Token waste risk

### UX note

These should help users understand *why* the overall score landed where it did, without taking over the page.

---

## 5. Action area

This is where the page should branch depending on recommendation.

### A. Strong prompt path

Show a compact **Why no rewrite?** panel.

Contents:

* short explanation of strengths
* optional note that expected improvement is low
* button: **Copy original**
* link/button: **Generate rewrite anyway**

Do **not** show a large empty rewrite block.

If `rewritePreference = suppress`, the UI should treat that as a user choice, not an absence.

Suggested copy:

* “Rewrite suppressed because this prompt already appears strong.”
* or “Rewrite suppressed by your preference.”

### B. Usable prompt path

Show a **Suggested improvement** panel.

Contents:

* top 2–3 opportunities
* optional rewrite preview behind an expand action
* button: **Generate or show rewrite**

This is the middle state where the product should feel advisory rather than forceful.

### C. Weak prompt path

Show a prominent **Recommended rewrite** panel.

Contents:

* rewritten prompt
* short explanation of why it is stronger
* copy button
* optionally a before/after comparison summary

---

## 6. Evaluation panel

The current evaluation data is valuable, but it should not always appear as a separate full section.

### New rule

Only elevate evaluation when it materially helps the user decide between original and rewrite.

### When rewrite exists

Show a compact **Rewrite verdict** card:

* Material improvement
* Minor improvement
* No significant change
* Already strong
* Possible regression

Then support it with:

* overall delta
* short recommendation message
* limited score comparison

### Preferred comparison format

Instead of long sentences, use compact rows:

* Scope: 6 → 8
* Contrast: 4 → 7
* Clarity: 8 → 8

### When rewrite is absent

Hide the evaluation section entirely unless needed for explanation.

For strong prompts, the hero and action panel should already explain the decision.

---

## 7. Opportunities panel

The current opportunities section is useful, but it should be renamed and simplified.

### Rename

Use **How to improve this prompt**

### Behavior

* show for usable and weak prompts
* suppress or heavily minimize for strong prompts

### Card structure

Each card should answer:

* what to add or change
* why it matters
* which score dimension it improves

Avoid making this section feel like a backlog of internal heuristics.

---

## 8. Gating panel

The raw gating block should not appear as a primary user-facing section.

### Current issue

Fields like:

* rewritePreference
  n- expectedImprovement
* majorBlockingIssues

are product-useful but too internal when displayed raw.

### Recommendation

Absorb gating into natural UI copy.

Examples:

* “No rewrite needed because the prompt is already strong and expected gains are low.”
* “Rewrite remains optional because the prompt is usable but not blocked by major issues.”
* “Rewrite recommended because foundational issues are limiting output quality.”

### Dev mode

If needed, keep a collapsible **Technical details** area for:

* gating fields
* raw issue codes
* trace metadata

That is useful for internal testing without making the main product feel diagnostic-heavy.

---

## 9. Technical details drawer

Move the following into an expandable drawer at the bottom:

* raw issue codes
* raw gating fields
* full evaluation signals
* request ID
* provider mode
* latency

### Why

This keeps PromptFire clean for normal users while preserving the debugging surface you clearly still need during calibration.

---

## 10. State-by-state rendering model

## Strong state

### Show

* input panel
* result hero
* 3–4 strengths/findings
* compact sub-scores
* why no rewrite panel
* technical details drawer

### Hide or suppress

* large rewrite panel
* improvement opportunities list
* evaluation comparison block unless forced rewrite exists

## Usable state

### Show

* input panel
* result hero
* key findings
* compact sub-scores
* how to improve panel
* optional rewrite area
* technical details drawer

## Weak state

### Show

* input panel
* result hero
* key problems
* compact sub-scores
* recommended rewrite panel
* rewrite verdict card if available
* how to improve panel
* technical details drawer

---

## 11. Copy direction

The frontend copy should feel:

* confident
* plainspoken
* practical
* not overly “AI assistant” sounding

### Good examples

* Strong prompt
* Rewrite recommended
* Rewrite optional
* Clear audience and useful constraints
* Likely to produce generic output
* Rewrite may have removed useful specificity

### Avoid

* excessive celebration language
* fluffy encouragement
* too many internal labels
* over-explaining scoring mechanics inline

---

## 12. Primary UI draft in plain language

Here is the intended user experience in one sentence:

**Paste a prompt, get one clear score, understand the main issues, and only see a rewrite when it is actually worth seeing.**

---

## 13. Suggested implementation order

### Phase A — consolidation

1. keep existing API contract and data usage
2. redesign result layout around hero + decision
3. demote raw gating/evaluation/trace into secondary UI
4. rename opportunities section
5. change CTA to “Analyze prompt”

### Phase B — branching states

1. implement distinct strong / usable / weak layouts
2. suppress empty rewrite and evaluation blocks
3. add rewrite verdict card only when rewrite exists
4. add “Generate rewrite anyway” action for strong prompts

### Phase C — polish

1. improve copywriting
2. add lightweight visual hierarchy for findings and score tiles
3. add before/after comparison treatment for rewrite cases
4. add collapsible technical details drawer

---

## 14. Acceptance criteria for frontend cohesion

The frontend feels brought together when:

* the user can understand the result in under five seconds
* the page communicates one primary recommendation
* strong prompts do not look like failed rewrite requests
* rewrite is shown as a tool, not the default product output
* the page no longer feels like raw API fields stacked vertically
* technical/debug information is still available, but clearly secondary

---

## 15. Suggested next artifact

Turn this draft into:

1. a page-level component map
2. a wireframe for strong / usable / weak states
3. a concrete implementation brief for `apps/web/src/App.tsx`

That would make the next coding pass much easier.
