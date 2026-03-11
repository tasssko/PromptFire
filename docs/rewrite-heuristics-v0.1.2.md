Here’s a Codex-ready revision note you can drop into the doc or paste as an implementation brief.

---

# Marketer Mode Revision Note for v0.4 Compatibility

## Purpose

Refine marketer-mode analysis and rewrite behavior without breaking the current `v0.4` public API contract.

This change is intended to improve marketer-specific detection and rewrite quality, especially for prompts that already contain an audience but still lack differentiation.

## Compatibility rules

The following must remain unchanged in this revision:

* public response shape
* public `v0.4` score keys
* existing public issue-code enum
* existing API validation contract

This means:

* do **not** add marketer-specific public score dimensions
* do **not** rename existing public issue codes
* do **not** introduce new public issue codes in this change

## Public contract policy

### Public scores remain:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

### Public issue codes remain:

* `AUDIENCE_MISSING`
* `CONSTRAINTS_MISSING`
* `EXCLUSIONS_MISSING`
* `TASK_OVERLOADED`
* `GENERIC_PHRASES_DETECTED`
* `GENERIC_OUTPUT_RISK_HIGH`

## Internal marketer signals

The following marketer-specific concepts should be implemented as **internal-only signals**, not public API fields or enums:

* `audienceSpecificity`
* `positioningStrength`
* `proofSpecificity`
* `leadAnglePresence`
* `contextContrast`
* `genericValuePropDensity`
* `constraintsWeak`

These may influence:

* public score calculation
* whether existing public issue codes are emitted
* rewrite strategy and explanation text

They must **not** appear as new public score keys or issue codes in `v0.4`.

## Implementation intent

Marketer mode should improve **differentiation**, not just **polish**.

A good marketer rewrite should:

* preserve valid audience when already present
* strengthen business tension
* add a clearer lead angle
* improve proof specificity
* add exclusions where missing
* reduce generic category language

The rewrite should not simply rephrase the prompt with softer synonyms.

---

# Deterministic trigger rules

## 1. `AUDIENCE_MISSING`

### Trigger only when:

* no identifiable audience phrase appears in the prompt
* and no `audienceHint` exists in context

### Do not trigger when prompt contains phrases such as:

* `for CTOs`
* `for IT decision-makers`
* `aimed at ...`
* `targeting ...`
* `for mid-sized enterprises`
* `for enterprise buyers`
* similar explicit audience noun phrases

### Notes

If an audience is present but broad, treat that as a lower internal `audienceSpecificity` score, not as `AUDIENCE_MISSING`.

---

## 2. `CONSTRAINTS_MISSING`

### Trigger only when:

* the prompt has no meaningful requirements beyond the basic request

Example:

* `Write landing page copy for our IAM service.`

### Do not trigger when the prompt includes requirements such as:

* benefits to emphasize
* proof to include
* audience constraints
* measurable outcomes
* specific sections or content requirements

### Notes

If constraints exist but are broad or category-default, record internal `constraintsWeak = true` instead of emitting `CONSTRAINTS_MISSING`.

---

## 3. `EXCLUSIONS_MISSING`

### Trigger when:

* the prompt does not specify what language, framing, tone, or approaches to avoid
* and no exclusions are provided in context

Examples of valid exclusions:

* avoid generic cybersecurity buzzwords
* do not use “seamless”, “robust”, or “powerful”
* avoid fear-based messaging

---

## 4. `TASK_OVERLOADED`

### In marketer mode, trigger only when:

* the prompt requests multiple distinct deliverables

Examples that should trigger:

* write landing page copy, ad variants, and follow-up email copy
* create homepage copy, a case study summary, and a webinar outline

### Do not trigger when:

* the prompt asks for one deliverable plus normal constraints

Examples that should **not** trigger:

* write landing page copy and include testimonials
* write landing page copy and emphasize compliance support
* write landing page copy with measurable proof points

### Notes

In marketer mode, a single landing-page brief with supporting constraints is **not** overloaded.

---

## 5. `GENERIC_PHRASES_DETECTED`

### Trigger when:

* the prompt explicitly contains known generic phrases

Initial examples:

* seamless
* robust
* powerful
* innovative
* cutting-edge

### Notes

This remains a public issue code and should stay deterministic through explicit phrase matching.

---

## 6. `GENERIC_OUTPUT_RISK_HIGH`

### Trigger when:

the combined marketer signals indicate the prompt is still likely to produce category-generic output.

Recommended deterministic conditions:
Trigger when at least **three** of the following are true:

* audience is missing or weakly specific
* exclusions are missing
* lead angle is absent
* positioning is weak
* proof is weak
* generic value prop density is high
* generic phrases are detected

This can be implemented as a simple integer threshold.

---

# Internal-only marketer signal rules

These are not public issue codes. They are internal heuristic inputs.

## `audienceSpecificity`

Low when the prompt names a broad audience only, without role tension or buying context.

Example low specificity:

* `IT decision-makers in mid-sized enterprises`

Example higher specificity:

* `CTOs at mid-sized enterprises dealing with audit pressure after acquisitions`

## `positioningStrength`

Low when the prompt uses category-default value props only.

Examples of weak/default props:

* security
* compliance
* integration

Higher when the prompt includes a distinct angle such as:

* identity sprawl after acquisitions
* audit readiness under regulatory pressure
* reduced admin overhead from access governance cleanup

## `proofSpecificity`

Low when proof is requested vaguely.

Weak:

* include customer testimonials and data-driven results

Stronger:

* include one customer proof point from a regulated business and one measurable audit-readiness outcome

## `leadAnglePresence`

Low or absent when the prompt does not indicate what should lead the page.

Examples of lead angles:

* operational risk
* audit pressure
* admin overhead
* access sprawl
* compliance readiness

## `contextContrast`

Low when the prompt is more detailed than a minimal brief but still resembles many category-standard prompts.

## `genericValuePropDensity`

High when the prompt relies mainly on expected category benefits rather than distinctive outcomes or tensions.

---

# Score mapping rules

Internal marketer signals may influence public scores, but public score keys must remain unchanged.

Suggested mapping:

* `scope`

  * decreases when lead angle is absent
  * decreases when the brief requests multiple deliverables
  * remains acceptable for one deliverable with normal constraints

* `contrast`

  * decreases when positioning is weak
  * decreases when context contrast is low
  * decreases when generic value prop density is high
  * increases when a clear business tension or angle is present

* `clarity`

  * decreases when proof requirements are vague
  * decreases when constraints are weak
  * should not be reduced simply because the prompt is rich

* `constraintQuality`

  * high when the prompt includes specific outcomes, exclusions, or structural requirements
  * medium when constraints exist but remain broad
  * low only when constraints are effectively absent

* `genericOutputRisk`

  * increases with weak positioning, low context contrast, missing exclusions, generic phrasing, and vague proof

* `tokenWasteRisk`

  * should reflect excess verbosity or broad multi-deliverable scope
  * should not rise just because a prompt contains reasonable marketing constraints

---

# Rewrite behavior rules for marketer mode

## General rule

A marketer rewrite should add **distinction**, not just **polish**.

## Required behaviors

When rewriting in marketer mode:

1. preserve the audience if a valid audience is already present
2. do not replace a valid audience with a vaguer one
3. add business tension where missing
4. add or sharpen a lead angle where missing
5. strengthen proof requirements
6. add exclusions when missing
7. reduce generic category phrases
8. prefer differentiation over synonym substitution

## Avoid

* simple synonym swaps
* “cleaner but same-shape” rewrites
* removing useful specificity
* collapsing prompt 3-style inputs back into prompt 2-style outputs

---

# Regression example

## Input prompt

Develop targeted landing page copy for our Identity and Access Management (IAM) service, specifically aimed at IT decision-makers in mid-sized enterprises. Emphasize the distinct advantages of our solution, including robust security features, compliance assistance, and seamless integration processes. Incorporate specific customer testimonials and quantifiable results to enhance credibility and demonstrate effectiveness.

## Expected analysis behavior

* do **not** emit `AUDIENCE_MISSING`
* do **not** emit `CONSTRAINTS_MISSING`
* do **not** emit `TASK_OVERLOADED`
* may emit `EXCLUSIONS_MISSING`
* may emit `GENERIC_PHRASES_DETECTED`
* may emit `GENERIC_OUTPUT_RISK_HIGH` if threshold is met
* internal marketer signals should likely indicate:

  * weak positioning
  * weak proof specificity
  * low context contrast
  * no clear lead angle

## Expected rewrite behavior

The rewrite should:

* preserve the stated audience
* add a more specific business tension or lead angle
* add exclusions for generic language
* strengthen proof specificity
* avoid drifting back to a more generic version of the same brief

---

# Implementation constraints

For this revision:

* keep public contracts unchanged
* use marketer-specific concepts internally only
* add deterministic rules and regression tests
* do not modify developer-mode behavior unless required for shared utility cleanup

---

# Required tests

Add tests covering:

1. explicit audience phrases do not trigger `AUDIENCE_MISSING`
2. single landing-page briefs with supporting constraints do not trigger `TASK_OVERLOADED`
3. prompts with broad but present requirements do not trigger `CONSTRAINTS_MISSING`
4. marketer rewrites preserve valid audience
5. marketer rewrites add stronger contrast signals than simple synonym replacements
6. IAM landing-page regression case remains fixed

---

You can hand Codex this with a short instruction like:

```text
Use the compatibility rules in docs/rewrite-heuristics-v0.1.2.md as mandatory constraints.
Implement marketer-mode improvements using internal signals only.
Do not change the public v0.4 API contract.
Add regression tests for the IAM landing-page example.
```
