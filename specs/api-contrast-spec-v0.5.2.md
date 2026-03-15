Yes — contrast is the right place to tighten next, and the current implementation is still too broad.

The current code and tests show that PromptFire already intends contrast to mean **meaningful differentiation**, not lexical novelty or punishment of common category terms. The spec says contrast should measure how distinct and directed the prompt is from category-default framing, and it explicitly says not to blindly punish necessary domain vocabulary like security, compliance, integration, monitoring, testing, or deployment. The current tests also protect functional category terms and require that “security, compliance, and integration” used functionally should not reduce contrast.  

But the live marketer implementation is still an additive bundle with a relatively generous base of 4, then a series of bonuses for audience, proof, org-fit specificity, differentiation instructions, and a functional-composition score, plus extra bonuses in `high_contrast` mode, minus several penalties for weak positioning, low context contrast, generic value-prop density, and generic phrases. It even applies a manual floor so that a marketer `high_contrast` prompt with audience, lead angle, and proof cannot fall below contrast 5 unless it is clearly generic overall. That tells me the system is still compensating for contrast instability with guardrails instead of a cleaner contrast model. 

The overlap problem is also visible in the current code. Contrast currently gets direct positive credit for `proofRequested`, `proofSpecificityHigh`, `differentiationInstructionsPresent`, `orgFitSpecificityHigh`, and `functionalCompositionScore`, while `constraintQuality` separately scores whether constraints are present and whether they are weak or strong. In other words, the same “good prompt structure” can raise both contrast and constraint quality, which makes contrast drift toward “feature-counting” instead of staying focused on distinctiveness. 

I would update the spec like this.

---

# PromptFire Contrast Scoring Spec v0.5.2

## 1. Purpose

This update narrows the definition of `contrast` so it measures one thing clearly:

**How strongly does the prompt steer output away from category-default framing and toward a distinctive, directed angle?**

This update is needed because the current implementation rewards a broad set of positive signals, many of which also belong to `constraintQuality`, and therefore risks making contrast a “general prompt goodness” bucket rather than a clean distinctiveness score. The current code starts marketer contrast at 4, layers multiple bonuses and penalties, and then uses an extra floor in `high_contrast` mode for certain combinations of audience, lead angle, and proof. That is useful operationally, but it is also a sign that contrast is not yet defined narrowly enough in the scoring model itself. 

## 2. Updated definition

`contrast` is the degree to which the prompt gives the model a **non-default angle**.

A high-contrast prompt does not merely ask for output in a category. It introduces a meaningful way to frame the work so that a default category-shaped answer becomes less likely. This is already consistent with the main PromptFire spec language, which defines contrast as meaningful differentiation rather than novelty or absence of common words.  

## 3. What contrast should reward

Contrast should reward signals that make the framing materially more distinctive.

Primary contrast signals:

* explicit audience specificity
* business tension
* trade-off framing
* comparison framing
* distinctive lead angle
* exclusions that block category-default copy paths
* concrete operating context or scenario context

These are the strongest contrast drivers because they change the shape of the response rather than merely asking for more content. This direction is already partially reflected in the marketer docs, which say contrast should increase when a clear business tension or angle is present and should decrease when positioning is weak, context contrast is low, or generic value-prop density is high. 

Secondary contrast signals:

* proof requirements
* examples
* measurable outcomes
* light structural guidance

These can support contrast, but only modestly. They are useful mainly when they reinforce a distinctive angle that already exists.

## 4. What contrast should not reward heavily

The current implementation gives meaningful contrast credit to proof and composition signals. That is where I would tighten it.

Contrast should not receive major positive weight merely because the prompt:

* asks for proof
* asks for examples
* includes measurable outcomes
* contains several “good prompt” ingredients
* has multiple functional requirements

Those are often signs of stronger constraints, not necessarily signs of stronger differentiation. Today, `proofRequested`, `proofSpecificityHigh`, and `functionalCompositionScore` all feed directly into contrast. That should be reduced. Those signals belong primarily to `constraintQuality`, with only minor spillover into contrast when they reinforce a clear angle. 

## 5. What contrast should penalize

Contrast should decrease when a prompt remains close to generic category framing.

Penalties should apply for:

* no audience
* broad or weak audience phrasing
* category-only framing
* no tension or lead angle
* repeated value-prop language without narrowing
* decorative buzzwords
* generic value-prop density
* prompts that could apply to many near-identical tasks with minimal change

This aligns with the current docs, which already say contrast should penalize filler, vague uplift language, empty superiority claims, repeated category claims without narrowing function, decorative buzzwords, and default category framing without tension or direction. 

## 6. Overlap with constraint quality

This is the key clarification.

### Constraint quality answers:

**Do the requirements genuinely narrow the work?**

Constraint quality should own:

* proof requirements
* output structure
* measurable outcomes
* example requirements
* tone boundaries
* must-include and must-avoid instructions
* directional narrowing such as “focus on,” “lead with,” and “rather than,” when used as requirements

That is already how the current spec describes constraint quality. It says high constraint quality includes proof requirements, exclusions, output structure, measurable outcomes, tone boundaries, and must-include or must-avoid instructions. It also explicitly says functional constraints count even without rigid modal verbs. 

### Contrast answers:

**Do those requirements create a non-default angle?**

So the same words can touch both dimensions, but for different reasons:

* “include one proof point” is mostly a constraint-quality signal
* “lead with audit pressure and identity sprawl” is primarily a contrast signal
* “avoid generic cybersecurity buzzwords” affects both, but more strongly affects contrast because it blocks default framing
* “use one startup example and one enterprise example” is mostly a constraint-quality signal unless it creates a meaningful comparison frame, in which case it also supports contrast

### Overlap rule

When one phrase contributes to both `constraintQuality` and `contrast`, PromptFire must assign it a **primary home**.

Primary-home rules:

* proof, examples, measurable outcomes, structure → primarily `constraintQuality`
* audience specificity, tension, trade-offs, comparison frame, exclusions against default framing, scenario context → primarily `contrast`

This is the simplest way to stop contrast from behaving like a second constraint-quality score.

## 7. Updated contrast scoring model

I would replace the current additive marketer formula with a more explicitly tiered model.

### Proposed internal components

`contrast` should be derived from five components:

* `audienceDifferentiation` (`0–2`)
* `framingDistinctiveness` (`0–3`)
* `exclusionDistinctiveness` (`0–2`)
* `contextSpecificity` (`0–2`)
* `supportingDifferentiators` (`0–1`)

Then subtract:

* `genericFramingPenalty` (`0–2`)

### Component definitions

`audienceDifferentiation`

* 0: no audience or extremely broad audience
* 1: audience exists but remains broad
* 2: specific role and/or relevant operating context

`framingDistinctiveness`

* 0: no tension, no trade-off, no comparative angle
* 1: weak angle or light directional framing
* 2: clear business tension, trade-off, or lead angle
* 3: strong non-default framing that clearly changes likely output shape

`exclusionDistinctiveness`

* 0: no exclusions
* 1: light anti-generic instruction
* 2: explicit exclusions that materially block default framing

`contextSpecificity`

* 0: no meaningful operating context
* 1: some useful business or technical context
* 2: specific scenario or operating circumstance that narrows the angle

`supportingDifferentiators`

* 0: none
* 1: proof/examples/measurable outcomes reinforce an already distinctive angle

`genericFramingPenalty`

* 0: framing is already differentiated
* 1: some generic phrasing remains
* 2: prompt still resembles broad category-default copy

### Proposed formula

```text
contrast =
  audienceDifferentiation +
  framingDistinctiveness +
  exclusionDistinctiveness +
  contextSpecificity +
  supportingDifferentiators -
  genericFramingPenalty

contrast = clamp(contrast, 0, 10)
```

This keeps contrast explicitly tied to differentiation rather than feature accumulation.

## 8. Contrast band definitions

### 0–2: very low contrast

The prompt mostly names a category task and leaves the model on default rails.

Example shape:

* “Write landing page copy for our IAM service.”

This has a deliverable and subject, but no audience, no angle, no tension, no exclusions, and no scenario context. It is category-default framing. Under the updated spec, this should be closer to 1–2 than to 3–4. That is more faithful to the product definition of contrast. The current tests still use this as the minimal IAM case for contrast improvement in high-contrast rewrites. 

### 3–4: low contrast

Some direction exists, but the framing still resembles many standard prompts in the category.

Example shape:

* “Write landing page copy for IT decision-makers about our IAM platform. Highlight security, compliance, and ease of use.”

Audience exists, but the angle is still mostly category-standard. This should score better than the bare IAM prompt, but still remain low because it lacks tension, exclusions, and differentiated framing. The existing tests already use a similar example as a “low-contrast marketer prompt” that should improve when the rewrite adds audit pressure, identity sprawl, proof, and exclusions. 

### 5–6: moderate contrast

The prompt has at least one real non-default signal, but the framing still has some generic drag.

Example shape:

* audience present
* one business tension
* one proof requirement
* weak or absent exclusions

This is where today’s manual high-contrast floor is trying to push certain rewrites. Under the new spec, fewer manual floors should be needed because the underlying score would already reflect the right logic. 

### 7–8: high contrast

The prompt has specific audience, meaningful business tension, useful scenario context, and at least one framing or exclusion signal that clearly blocks generic output paths.

### 9–10: very high contrast

The prompt strongly directs the model toward a specific, non-default angle and makes default category framing unlikely.

## 9. Awareness around the word “concrete”

I agree with your concern here.

PromptFire should not use “concrete” lazily as a vague compliment or as a substitute for actual specificity. In prompt analysis and rewrite guidance, words like “concrete,” “specific,” and “clear” can become empty if they are not tied to what exactly is being made more specific.

So in the spec:

### Terminology rule

PromptFire should avoid using “concrete” as a standalone quality label unless it points to an explicit specificity type.

Preferred language:

* specific audience
* specific operating context
* specific business tension
* specific proof requirement
* specific lead angle
* specific exclusion
* specific comparison frame

Avoid:

* “make it more concrete”
* “add concrete wording”
* “use concrete language”

unless followed by what kind of specificity is missing.

This matters in rewrite guidance too. One of the current mock rewrite directives says “Define the exact audience, for CTOs or IT directors with a concrete business context.” That is better than generic advice, but even there “concrete business context” would be clearer if it named what counts, such as audit pressure, identity sprawl, acquisitions, admin overhead, or governance cleanup. 

### Preferred phrasing in UI and analysis

Instead of:

* “the prompt needs more concrete details”

say:

* “the prompt needs a specific audience”
* “the prompt needs a clearer lead angle”
* “the prompt needs a more specific operating context”
* “the prompt needs exclusions that block default category framing”

This will make PromptFire’s explanations feel sharper and more trustworthy.

## 10. Contrast implementation guidance

### Remove the high default floor

The marketer contrast score should not start at 4. A base that high makes low-end contrast too generous and forces penalties to do too much work. A lower effective base, with stronger positive scoring only for true differentiators, would be more stable.

### Reduce proof and composition weight inside contrast

`proofRequested`, `proofSpecificityHigh`, and `functionalCompositionScore` should either:

* move out of contrast entirely, or
* contribute only minor support value

They should primarily live in `constraintQuality`.

### Keep category-term protection

The existing rule that functional category terms should not reduce contrast is good and should stay. The tests for “security, compliance, and integration” used functionally are a solid regression guard.  

### Keep anti-generic penalties

`genericValuePropDensityHigh`, weak positioning, and low context contrast are correctly in contrast territory. Those are good negative signals and should remain important.

### Remove or reduce the manual floor

The current `high_contrast` floor of 5 for audience + lead angle + proof is understandable, but it is a workaround. Once the new contrast model is in place, that floor should either disappear or become a very narrow regression-only safeguard. 

## 11. Calibration examples

### Example A: minimal IAM prompt

“Write landing page copy for our IAM service.”

Expected contrast:

* 1–2

Reason:

* clear deliverable
* no audience
* no angle
* no exclusions
* no scenario context
* category-default framing

### Example B: broad category prompt with audience

“Write landing page copy for IT decision-makers in mid-sized enterprises about our IAM platform. Highlight security, compliance, and ease of use.”

Expected contrast:

* 3–4

Reason:

* audience present
* still generic value-prop framing
* no tension
* no real exclusions
* category terms are functional but not differentiating

### Example C: differentiated IAM prompt

“Write landing page copy for CTOs and IT directors at mid-sized enterprises dealing with identity sprawl and audit pressure after acquisitions. Lead with operational control and compliance readiness, require one customer proof point and one measurable outcome, and avoid generic value-prop buzzwords.”

Expected contrast:

* 7–8

Reason:

* specific audience
* specific business tension
* strong lead angle
* scenario context
* explicit anti-generic exclusion
* proof requirement supports the distinctive framing

This exact style of rewrite is already used in current regression tests to ensure contrast does not go down when audience, tension, and proof are added. 

## 12. Acceptance criteria

The updated contrast model should satisfy all of these:

* Common category terms used functionally must not reduce contrast. 
* A bare marketer prompt with only deliverable + category should score very low on contrast.
* Adding proof alone should not create a large contrast jump.
* Adding audience + tension + lead angle + exclusion should create a large contrast jump.
* Contrast should no longer behave like a proxy for “prompt has many useful requirements.”
* Explanations should avoid vague praise words like “concrete” unless they point to a specific missing specificity type.

## 13. Short diagnosis of the current system

So the detailed analysis, boiled down, is this:

The current PromptFire docs are already pointing in the right direction. They define contrast correctly and explicitly protect functional category terms. The current implementation, however, still uses a high-base additive formula with several bonuses that belong more naturally to `constraintQuality`, plus a manual high-contrast floor. That makes contrast too much of a “good marketer prompt features” score and not enough of a “non-default angle” score. Tightening contrast around audience, tension, lead angle, exclusions, and scenario context — while demoting proof/example/structure signals to secondary status — will make the score more faithful to the product meaning and easier to trust.  

If you want, I can turn this into a patch-style spec section that replaces `## 9. Contrast Rules` in `prompt-scoring-and-rewrite-gating-v0.5.1.md` almost verbatim.
