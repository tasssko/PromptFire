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

## 11. Typography and font loading

PromptFire should use **HelveticaNowText** as the canonical UI font.

### Typography rule

Use HelveticaNowText for:

* headings
* body text
* labels
* buttons
* pills
* score numerals
* form controls

Reserve monospace only for:

* rewritten prompt/code-like blocks
* technical details
* trace/request IDs

### Implementation rule

Do not leave font choice as an ad hoc stylesheet decision.

Make HelveticaNowText the single source of truth for PromptFire UI typography and ensure the live frontend is the authoritative rendering source.

### React font include

Include the following font assets in the React app so typography renders consistently:

```tsx
<link rel="preconnect" href="https://cdn.fonts.net" />
<link
  rel="stylesheet"
  type="text/css"
  href="https://cdn.fonts.net/kit/3321c769-42e0-48c8-848a-f9a46828c148/3321c769-42e0-48c8-848a-f9a46828c148_enhanced.css"
/>
<Script
  strategy="lazyOnload"
  src="https://cdn.fonts.net/kit/3321c769-42e0-48c8-848a-f9a46828c148/3321c769-42e0-48c8-848a-f9a46828c148_enhanced.js"
/>
```

### Follow-through

* remove leftover IBM Plex Sans references
* define one UI font token and one mono font token
* keep generated mockups directional, but let the browser implementation define the final typography

---

## 12. Copy direction

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

## 13. Primary UI draft in plain language

Here is the intended user experience in one sentence:

**Paste a prompt, get one clear score, understand the main issues, and only see a rewrite when it is actually worth seeing.**

---

## 14. Frontend 0.5.5 plan

### Summary

The current `0.5.4` behavior-level UX work is already in place:

* hero-first layout
* state-based action panels
* rewrite verdict gating
* technical details drawer

`0.5.5` introduces one main delta: canonical typography with HelveticaNowText and explicit font asset loading.

This should be implemented **without changing API contracts or response data flow**.

### Implementation changes

#### 1. Make HelveticaNowText the canonical UI font

Add font loading tags in `apps/web/index.html`:

```html
<link rel="preconnect" href="https://cdn.fonts.net" />
<link
  rel="stylesheet"
  type="text/css"
  href="https://cdn.fonts.net/kit/3321c769-42e0-48c8-848a-f9a46828c148/3321c769-42e0-48c8-848a-f9a46828c148_enhanced.css"
/>
<script
  src="https://cdn.fonts.net/kit/3321c769-42e0-48c8-848a-f9a46828c148/3321c769-42e0-48c8-848a-f9a46828c148_enhanced.js"
  defer
></script>
```

Use the Vite-compatible global load pattern so all app screens inherit the same font baseline.

#### 2. Centralize typography tokens in CSS

In `apps/web/src/styles.css`, define root tokens:

```css
:root {
  --font-ui: "HelveticaNowText", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
```

Then:

* replace existing `IBM Plex Sans` references with `var(--font-ui)`
* apply `font-family: var(--font-ui)` to body-level UI surfaces and interactive controls

#### 3. Enforce mono usage only where intended

Keep monospace styling limited to technical/readout surfaces:

* `pre`
* `code`
* technical details values
* trace-like IDs

Ensure normal labels, buttons, pills, and score numerals remain on `--font-ui`.

#### 4. Copy and recommendation polish pass

Review existing labels and headlines against the guidance that PromptFire copy should feel:

* confident
* plainspoken
* practical

Keep the current structure.
Only tighten wording where it still feels internal or debug-oriented on user-facing panels.

### Public interfaces and contracts

* no API/schema/type changes
* no changes to `@promptfire/shared` contracts
* no changes to backend endpoints
* frontend-only presentation and asset-loading update

### Test plan

1. Run `pnpm --filter @promptfire/web typecheck`
2. Run `pnpm --filter @promptfire/web test`
3. Manual verification in browser:

   * confirm HelveticaNowText loads from fonts.net using network inspection and computed font family
   * confirm UI controls, headings, and score numerals use the UI font
   * confirm only `pre/code` and technical detail value fields render monospace
   * verify no regression to strong / usable / weak rendering and rewrite visibility logic

### Assumptions

* use CSS + JS global kit loading in `index.html`
* fonts.net availability is acceptable as a runtime dependency
* existing `0.5.4` functionality remains authoritative and should not be restructured during `0.5.5`

---

## 15. Frontend 0.5.6 plan — integrated page shell and product rename

### Summary

The next frontend change should make the prompt input area feel like part of the product surface rather than a separate form block above the results.

The desired treatment is:

* a single default page shell
* the prompt input embedded directly in that shell
* a distinct results card rendered below it
* consistent spacing, typography, and visual rhythm between input and output
* product rename from **PromptFire** to **PeakPrompt** in the UI

This is a presentation and layout change, not an API or scoring-model change.

### Design intent

What works well in the proposed layout:

* the top prompt area feels embedded into the default page rather than detached from it
* the page looks like one product surface before any result is shown
* the results card below gives the score and verdict a clear stage without breaking continuity

The overall effect should be:

* one continuous product page
* one embedded input shell
* one elevated results surface

### Layout specification

#### 1. Default page shell

The default page should be a single centered application surface with:

* product name at top left
* one-line product promise beneath it
* embedded prompt input block
* compact controls row
* primary CTA

This full top region should feel like the stable home state of the product.

#### 2. Embedded prompt area

The prompt area should remain part of the page shell rather than being visually separated into a different panel style.

Requirements:

* prompt label above textarea
* large textarea as the dominant control
* controls directly beneath in a compact horizontal row
* CTA centered or visually anchored below the controls
* no heavy visual interruption between title, prompt, controls, and CTA

#### 3. Compact controls row

Reduce the visual weight of configuration controls.

Preferred arrangement:

* role select
* mode select
* advanced options trigger or compact select

The controls should support the prompt, not dominate the page.

#### 4. Results card below shell

When analysis is available, render a separate results card below the embedded page shell.

The results card should:

* have a distinct container treatment
* preserve the hero-first result structure
* feel like the output area of the same product screen
* maintain strong spacing separation from the input shell without feeling like a different application

#### 5. Visual continuity rules

To keep the page consistent:

* use the same typography system across shell and results
* maintain consistent horizontal alignment
* use one spacing scale
* keep border radius and stroke treatment in the same family
* ensure results card elevation is subtle and intentional

### Product rename

Change the product name from **PromptFire** to **PeakPrompt** across the frontend.

#### Rename scope

Update:

* page heading / product wordmark
* browser title if set in frontend
* empty-state product references
* any user-facing copy where PromptFire is named

Do not change package names, internal namespaces, or API identifiers as part of this UI rename unless separately planned.

### Non-goals

This change does not include:

* score model changes
* recommendation logic changes
* rewrite policy changes
* backend changes
* package rename or repo rename

### Public interfaces and contracts

* no API/schema/type changes
* no backend endpoint changes
* no shared contract changes
* frontend-only name and layout update

### Test plan

1. Verify default page looks coherent before analysis is run
2. Verify prompt shell and results card feel visually related after analysis
3. Verify rename from PromptFire to PeakPrompt appears consistently in visible UI
4. Verify no regression to strong / usable / weak result branching
5. Verify typography and spacing remain consistent after the rename and layout update

### Acceptance criteria

This change is successful when:

* the top of the page feels embedded and product-like rather than like a detached form
* the results area feels like a deliberate card beneath the shell
* the whole screen reads as one coherent product
* the visible product name is PeakPrompt
* the layout improves cohesion without disturbing the existing score-first result behavior

---

## 16. Acceptance criteria for frontend cohesion

The frontend feels brought together when:

* the user can understand the result in under five seconds
* the page communicates one primary recommendation
* strong prompts do not look like failed rewrite requests
* rewrite is shown as a tool, not the default product output
* the page no longer feels like raw API fields stacked vertically
* technical/debug information is still available, but clearly secondary

---

## 17. Suggested next artifact

Turn this draft into:

1. a page-level component map
2. a wireframe for strong / usable / weak states
3. a concrete implementation brief for `apps/web/src/App.tsx`

That would make the next coding pass much easier.
