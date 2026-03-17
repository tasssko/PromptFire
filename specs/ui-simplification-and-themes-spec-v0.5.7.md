
You already have the right structural direction:

* one embedded top shell
* one results card
* score-first hierarchy
* semantic color roles
* canonical spacing, radius, border, and elevation tokens

You also already have the first generation of implementation tokens in Tailwind:

* text, border, CTA, shell, and hero colors
* radius scale
* shadow scale
* background gradients for score bands

The main problem is that the **token system and the UI behavior are not yet unified enough**:

* color usage is still partly hard-coded in components
* light mode exists implicitly, but there is no proper theme model
* rewrite/template/verdict surfaces can stack and repeat
* component roles exist, but their visual contract is not yet fully normalized

I’d frame the next spec as:

# PeakPrompt UI Simplification and Theming Spec v0.5.7

## 1. Goal

Simplify the results UI, normalize the visual system, and introduce first-class light and dark themes without changing scoring or rewrite policy. The UI should feel like one coherent product surface and should show only the minimum number of panels needed to communicate the result clearly. This stays consistent with the existing score-first shell + results-card direction.

## 2. Non-goals

No scoring model changes.
No rewrite policy changes.
No API contract changes unless needed only to support theme metadata later.
No expansion of result sections.

## 3. Core product rules

The screen should answer, in order:

1. How good is this prompt?
2. What should I do next?
3. Show me a rewrite only if it is worth using.

This matches the current score-first and rewrite-suppression direction already implemented in the app and in rewrite presentation logic.

## 4. Simplified page structure

The page should have only two primary surfaces:

* top shell
* results card

Inside the results card, sections should be reduced to this canonical order:

1. score hero
2. score breakdown
3. key findings
4. one next step card
5. one action surface
6. optional technical details drawer

This is a simplification of the current structure, which presently renders hero, findings, sub-scores, guided completion/template, rewrite result, and improvement cards in ways that can overlap semantically.

## 5. Section reduction rules

For weak or poor prompts:

* show **one** next-step card
* show **either** guided completion/template **or** a full rewrite
* do not show a separate rewrite verdict card if it only repeats “keep the original” or “use the template above”

For usable prompts:

* show one improvement card
* optional rewrite preview stays collapsed unless materially useful

For strong or excellent prompts:

* suppress rewrite by default
* show one validation card such as “No rewrite needed” or equivalent

This aligns with the existing presentation-mode logic:

* `full_rewrite`
* `template_with_example`
* `questions_only`
* `suppressed` 

## 6. Rewrite surface rules

A result may render only one of these primary action surfaces:

* `FullRewriteCard`
* `GuidedCompletionCard`
* `NoRewriteNeededCard`

Never render:

* guided completion + rewrite verdict repeating the same advice
* strong-state validation + default rewrite surface
* template/example + “might be worse” as equal-weight blocks

That directly addresses the current duplication path created by `guidedCompletion` plus the always-rendered evaluation card.

## 7. Canonical component set

Define these as the only major result components:

* `HeroCard`
* `MetricTile`
* `FindingsList`
* `NextStepCard`
* `FullRewriteCard`
* `GuidedCompletionCard`
* `NoRewriteNeededCard`
* `TechnicalDetailsDrawer`

You already started this normalization with `SurfaceCard`, `MetricTile`, `Section`, `ImpactBadge`, and `TechnicalMetric`; this spec should finish the job by making all result rendering use explicit component roles instead of ad hoc section combinations. 

## 8. Theme architecture

Introduce two first-class themes:

* `light`
* `dark`

Do not define colors directly inside components except for temporary migration shims. All UI colors must resolve from semantic theme tokens.

## 9. Semantic token model

Use semantic tokens only, not raw palette names in app code.

### Foundation tokens

* `bg.page`
* `bg.shell`
* `bg.card`
* `bg.cardSubtle`
* `bg.cardElevated`
* `text.primary`
* `text.secondary`
* `text.inverse`
* `border.subtle`
* `border.default`
* `border.strong`
* `border.focus`
* `shadow.sm`
* `shadow.md`

### Action tokens

* `action.primary.bg`
* `action.primary.text`
* `action.primary.bgHover`
* `action.secondary.bg`
* `action.secondary.text`
* `action.secondary.bgHover`

### State tokens

* `state.poor.hero`
* `state.weak.hero`
* `state.usable.hero`
* `state.strong.hero`
* `state.excellent.hero`

### Surface tokens

* `surface.default.bg`
* `surface.default.border`
* `surface.suggestion.bg`
* `surface.suggestion.border`
* `surface.rewrite.bg`
* `surface.rewrite.border`
* `surface.verdict.bg`
* `surface.verdict.border`

### Feedback tokens

* `feedback.high.bg`
* `feedback.high.text`
* `feedback.medium.bg`
* `feedback.medium.text`
* `feedback.low.bg`
* `feedback.low.text`

That extends the current semantic direction already described in the UI spec and partially implemented in Tailwind config.

## 10. Palette normalization rule

Your palette images point toward a cleaner blue / cyan / violet family with neutral grayscale support. The right move is:

* use the bright palette as **brand/accent foundation**
* use the gray ramp as **UI neutral foundation**
* do not let every card become tinted
* reserve vivid color for hero states, CTAs, focus, and selected accents

So:

* **grays** drive layout, cards, text contrast, and borders
* **blue/cyan/violet** drive brand and selective emphasis
* **state colors** should still be semantic, not arbitrary brand fills

## 11. Light theme guidance

Light mode should feel:

* crisp
* spacious
* lightly elevated
* mostly neutral with controlled accents

Rules:

* page background may use a subtle branded wash
* shell and results card should remain mostly neutral
* sub-score tiles should be near-neutral
* suggestion/rewrite/verdict cards should differ mostly by border/accent treatment, not large background shifts

This would reduce the current “too many pastel surfaces” effect in the result stack.

## 12. Dark theme guidance

Dark mode should not invert the light theme mechanically. It should:

* reduce glare
* preserve score emphasis
* keep strong contrast for numerals and CTA labels
* avoid muddy low-contrast border states

Rules:

* page background uses deep neutral base with subtle cool gradient
* shell and results card use distinct but close dark surfaces
* metric tiles use low-elevation dark panels
* hero gradients should be darker, richer equivalents of light theme states
* borders become lower-luminance strokes, not bright outlines
* pre/code surfaces must remain distinct from surrounding cards

## 13. Hero rules across themes

The hero remains the strongest visual signal.
It must always include:

* overall score
* band pill
* headline
* supporting sentence
* one primary action

Optional secondary action only for strong/excellent:

* `Generate rewrite anyway`

The repo already defines state hero backgrounds and explicit hero action naming rules; this spec should keep that but move all hero styling behind theme tokens.

## 14. Copy simplification rules

Each result state gets one headline, one support sentence, one primary action.

Avoid repeating the same recommendation in:

* findings
* next step
* template rationale
* rewrite result

This follows your existing “short verdict-style headings” and plainspoken copy direction. 

## 15. Result-state rendering matrix

### Poor / weak

Show:

* HeroCard
* Metric tiles
* Key findings
* NextStepCard
* GuidedCompletionCard **or** FullRewriteCard
* Technical details

Hide:

* duplicate verdict card when no decision changes

### Usable

Show:

* HeroCard
* Metric tiles
* Key findings
* one improvement card
* optional rewrite preview only when beneficial
* Technical details

### Strong / excellent

Show:

* HeroCard
* Metric tiles
* Key findings
* NoRewriteNeededCard
* Technical details

Hide:

* default rewrite
* improvement stack unless explicitly needed

These rules are consistent with the current intended branching and suppression behavior.

## 16. Implementation rule for color migration

Current code still contains many literal values in components like:

* hard-coded borders
* hard-coded card backgrounds
* hard-coded hero text/button colors 

Migration should happen in this order:

1. replace raw component colors with semantic Tailwind theme keys or CSS variables
2. define light theme token values
3. define dark theme token values
4. add theme switcher
5. audit every result state for contrast and duplication

## 17. Acceptance criteria

This spec is successful when:

* the screen has fewer repeated panels
* every result state has one obvious next action
* rewrites appear only when they are worth using
* all colors come from semantic tokens
* light and dark mode both feel intentional
* component surfaces look like one system, not individually styled cards
* no major component uses hard-coded one-off colors except allowed temporary migration shims

## 18. My recommendation on the palette itself

Use the second image as the **brand accent palette**, not as the full UI palette.

Suggested direction:

* Royal Surge = primary brand / CTA / strong-state accent
* Aqua Horizon = secondary accent / links / focus / selection
* Violet Pulse = optional highlight / premium or experimental accents
* White + the gray scale from the first image = actual UI structure

That gives you a cleaner product:

* gray system for product chrome
* blue system for trust and action
* violet used sparingly so it feels special, not noisy

So yes: the next step should be a **combined UI simplification + theming/token spec**, because that solves both of the things you’ve now identified:

* repeated instructional surfaces
* inconsistent / under-normalized color behavior

I can turn this into a paste-ready implementation spec for Codex next.
