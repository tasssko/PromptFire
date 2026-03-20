Yes — here is a paste-ready spec for tuning the sponsor component so it supports PeakPrompt instead of competing with it.

This should align with your existing UI direction: token-driven styling, a two-surface page structure, semantic color usage, and a rule that vivid color should be reserved for hero states, CTAs, focus, and selected accents rather than every card.  

# PeakPrompt Sponsor Component Visual Spec v0.1

## 1. Goal

Tune the sponsor component so it feels:

* credible
* premium
* clearly secondary to PeakPrompt
* visually integrated with the rest of the UI

The sponsor block should add brand support and commercial context without outranking the analyzer experience.

## 2. Primary problem to solve

The current sponsor area is visually stronger than the product card beneath it.

This creates two risks:

* the page reads as a sponsor landing page with a tool attached
* the sponsor surface feels like a separate product rather than part of one coherent PeakPrompt page

This conflicts with the current product direction where the screen should communicate one primary recommendation and feel like one unified product surface.  

## 3. Component role

The sponsor component is a **supporting promotional surface**, not the page hero.

It should behave like:

* a contextual partner banner
* a sponsorship spotlight
* a commercial endorsement strip

It should not behave like:

* the main product hero
* a competing landing-page section
* a second primary action zone

## 4. Hierarchy rule

PeakPrompt must remain visually dominant.

Hierarchy order must be:

1. PeakPrompt analyzer intent
2. input and primary action
3. result hero when present
4. sponsor component

If the sponsor appears above the analyzer, it must still read as lighter-weight than the analyzer card through reduced height, reduced contrast, reduced CTA emphasis, and reduced copy density.

## 5. Layout specification

### Desktop

Use a horizontal banner layout.

Recommended structure:

* outer sponsor surface
* left content block
* optional right identity block or logo tile

Preferred proportions:

* left content: 60–70%
* right identity panel: 30–40%

Maximum height:

* 220px ideal
* 240px hard max

The current sponsor block appears too tall and too dominant. The revised component should feel more like a compact premium banner.

### Tablet

Keep two columns if space allows, but reduce internal padding and copy length.

### Mobile

Stack vertically:

1. sponsor eyebrow
2. sponsor message
3. one primary CTA
4. optional logo tile beneath

Do not preserve the full desktop visual complexity on mobile.

## 6. Visual weight rules

The sponsor component must be visually lighter than the score hero and analyzer shell.

Therefore:

* less saturated background than the score hero
* lower text contrast intensity than hero states
* fewer badges/chips
* only one primary sponsor CTA visible by default
* secondary CTA should be subdued or removed

This follows the existing UI direction that vivid accents should be selective, not spread across all surfaces.  

## 7. Surface treatment

Use one canonical sponsor surface variant.

### Sponsor surface rules

Background:

* deep brand-tinted surface or subtle gradient
* must be calmer than hero-state gradients
* avoid looking like a second hero state

Border:

* subtle or none
* if used, use a tokenized border, not a bright outline

Radius:

* match existing card system
* no custom radius unique to sponsorship

Shadow:

* equal to or lighter than standard card shadow
* never heavier than the main analyzer/result cards

Padding:

* use existing spacing tokens only
* no one-off local values

This is consistent with your broader rule that new surfaces should not invent local padding, radius, shadow, or spacing values outside the token system. 

## 8. Color system

The sponsor component should use semantic tokens, not raw ad hoc colors.

### Add sponsor semantic tokens

Foundation:

* `sponsor.bg`
* `sponsor.border`
* `sponsor.text`
* `sponsor.textMuted`

Accent:

* `sponsor.badge.bg`
* `sponsor.badge.text`
* `sponsor.logo.bg`
* `sponsor.logo.border`

Actions:

* `sponsor.action.primary.bg`
* `sponsor.action.primary.text`
* `sponsor.action.primary.bgHover`
* `sponsor.action.secondary.bg`
* `sponsor.action.secondary.text`
* `sponsor.action.secondary.bgHover`

Optional subtle highlight:

* `sponsor.highlight.bg`
* `sponsor.highlight.text`

### Color behavior rules

* neutrals still drive structure
* blue family may drive trust and action
* violet may be used sparingly, if at all
* avoid turning the whole sponsor block into a vivid brand slab
* keep state colors reserved for scoring/result semantics, not sponsor marketing

This matches the existing theme direction: grays for structure, blue/cyan/violet for selective emphasis, and semantic tokens rather than raw palette names in app code.  

## 9. Copy hierarchy

The sponsor component should use a restrained copy model.

### Required content

* small eyebrow
* short headline
* short support line
* one primary CTA
* sponsor identity mark

### Optional content

* one short proof chip or trust marker
* one secondary CTA only if clearly necessary

### Remove or reduce

* long descriptive paragraph
* too many benefit pills
* multiple equal-weight CTAs
* repeated sponsor naming

### Copy length limits

Eyebrow:

* 2–4 words

Headline:

* 1–2 lines max
* ideally under 12 words

Support line:

* 1–2 short sentences
* ideally under 140 characters

Chips:

* max 2
* each under 24 characters

CTA labels:

* explicit and short

This aligns with your existing copy rule that primary surfaces should be plainspoken, practical, and avoid repetition.  

## 10. CTA rules

The sponsor component must not compete with the analyzer CTA.

### Allowed

* one sponsor primary CTA
* one subdued secondary CTA

### Preferred

* single sponsor CTA only

### Styling rules

Sponsor primary CTA:

* medium emphasis
* smaller or equal height to product controls
* should not visually outrank “Analyze prompt”

Sponsor secondary CTA:

* ghost or low-emphasis outline style
* may be removed on smaller screens

### CTA naming

Use concrete verbs, for example:

* `Visit StackTrack`
* `Learn more`
* `Talk to an engineer`

Avoid:

* vague language
* hype phrasing
* long CTA labels

## 11. Identity block rules

The right-side sponsor identity card should feel like an anchor, not a second panel competing for attention.

### Identity block should contain

* sponsor logo
* sponsor name
* one short descriptor

### Identity block should not contain

* a full second paragraph
* additional CTA set
* another visual hierarchy stronger than the left content

### Visual treatment

* lighter panel inside sponsor banner
* lower contrast than white-on-dark hero if possible
* subtle separation, not full standalone-card dominance

## 12. Badge and chip rules

The current chips are useful, but there are too many and they add noise.

### New rule

Maximum visible chips:

* 2 on desktop
* 0–1 on mobile

### Chip purpose

Only show chips that increase credibility quickly, such as:

* `Clear ownership`
* `Secure by design`

Avoid overly operational or detailed chip copy if it makes the sponsor block feel busy.

## 13. Motion and hover

If motion is used, it must be restrained.

Allowed:

* slight CTA hover elevation
* slight background shift
* subtle logo tile hover

Avoid:

* animated gradients
* moving spotlight effects
* pulsing badges
* attention-grabbing motion that competes with product interaction

## 14. Accessibility and readability

Sponsor content must remain readable but not over-contrasted.

Rules:

* all text passes accessible contrast
* CTA labels are clear
* sponsor labeling is explicit
* the block should clearly read as sponsorship, not product UI confusion

Use a visible sponsor label such as:

* `Project sponsor`
* `Sponsored spotlight`

But keep it small and restrained.

## 15. Theme behavior

The sponsor component must work in both light and dark themes and should follow the same theme model as the rest of the UI. The repo direction already calls for all colors to resolve from semantic tokens and for light/dark themes to feel intentional rather than mechanically inverted.  

### Light theme

Should feel:

* clean
* calm
* slightly elevated
* mostly neutral with a controlled brand accent

### Dark theme

Should feel:

* rich but not glowing
* lower glare
* clearly distinct from score-state hero gradients
* crisp in text and CTA contrast

## 16. Anti-patterns

Do not allow the sponsor component to become:

* taller than the analyzer card
* more saturated than the result hero
* more interactive than the main product section
* a second hero with equal-weight actions
* a collage of chips, CTAs, and nested cards
* a one-off visual style outside the UI system

## 17. Acceptance criteria

This sponsor tuning is successful when:

* the page still reads as PeakPrompt first
* the sponsor feels integrated, not bolted on
* the sponsor is clearly visible but not dominant
* the analyzer CTA remains the main action
* the sponsor uses semantic tokens, not hard-coded one-off colors
* spacing, radius, and shadows match the rest of the system
* the component feels premium and commercial without distracting from the product

## 18. Recommended implementation direction

I’d recommend one of these two directions:

### Option A — compact sponsor banner

Best if you want sponsorship visible but restrained.

* shorter height
* one CTA
* minimal chips
* small right-side identity tile

### Option B — inline sponsor strip

Best if you want even less dominance.

* single-row sponsor strip above the analyzer
* logo, short line, one CTA
* no large right-side card at all

For PeakPrompt, **Option A** is probably the sweet spot.

## 19. Practical design summary

The simplest tuning moves are:

* reduce sponsor block height
* reduce saturation and contrast
* remove one CTA
* reduce chips to two max
* shorten body copy
* make the right-side identity panel quieter
* keep all styling inside the same token system as the rest of the product

If you want, I can turn this into a **Codex-ready implementation brief with exact Tailwind/token suggestions for the sponsor component**.