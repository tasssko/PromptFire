# PromptFire Prompt Scoring and Rewrite Gating Spec v0.5.1

## 1. Purpose

Define a stable scoring and rewrite-gating model for PromptFire that:

* gives users a clear numeric prompt score
* improves weak prompts
* validates strong prompts without rewriting them by default
* rewards composition over decoration
* keeps behavior deterministic enough to test and trust

This spec covers product behavior, scoring logic, rewrite gating, and API/UI expectations.

---

## 2. Problem Statement

PromptFire has reached a point where ad hoc heuristic changes are no longer enough.

Current problems:

* strong prompts may still be rewritten even when no rewrite is needed
* score behavior has sometimes been unstable or counterintuitive
* contrast has sometimes been over-tied to “generic term” detection
* rewrites can improve wording without improving distinction
* UI feedback needs a clearer primary signal than multiple status labels

This change introduces:

* a primary 0–100 score
* explicit rewrite gating
* a Pagespeed-style interface model
* a stricter definition of scope and contrast
* a rule that strong prompts should be confirmed, not automatically rewritten

---

## 3. Product Principles

### 3.1 Reward composition over decoration

PromptFire should reward words for the work they do, not for how uncommon they sound.

Prompt language is better when it:

* defines audience
* names tension
* adds proof requirements
* sets boundaries
* excludes bad directions
* narrows the task

Prompt language is worse when it:

* adds filler
* inflates tone without adding meaning
* uses buzzwords as placeholders for direction
* duplicates meaning without improving constraints

### 3.2 Strong prompts should be validated, not auto-rewritten

If a prompt is already strong, PromptFire should say so and avoid automatic rewriting.

### 3.3 Scope means boundedness

Scope is not prompt length. Scope is how well bounded the task is.

### 3.4 Contrast means meaningful differentiation

Contrast should measure how distinct and directed the prompt is, not merely the absence of common words.

### 3.5 Numeric score is the primary UI

The main interface should use a single 0–100 score, supported by a small number of subscores and findings.

---

## 4. Definitions

### 4.1 Overall Prompt Score

A 0–100 score representing the overall quality of the prompt for first-pass LLM usefulness.

### 4.2 Scope

How well bounded the task is.

### 4.3 Contrast

How meaningfully differentiated the prompt is from category-default or generic task framing.

### 4.4 Clarity

How understandable and direct the prompt is.

### 4.5 Constraint Quality

How useful and specific the prompt’s requirements are.

### 4.6 Generic Output Risk

How likely the prompt is to produce bland, default-pattern output.

### 4.7 Token Waste Risk

How likely the prompt is to create waste through unnecessary breadth, reruns, or vague expansion.

---

## 5. Public Scoring Model

## 5.1 Public scores

PromptFire continues to expose these public sub-scores:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

Each remains internally calculable on a 0–10 scale.

## 5.2 Overall score

PromptFire introduces a primary overall score on a 0–100 scale.

### Proposed formula

```text
rawOverallScore =
  2.5 * scope +
  2.0 * contrast +
  2.0 * clarity +
  1.5 * constraintQuality +
  1.0 * (10 - genericOutputRisk) +
  1.0 * (10 - tokenWasteRisk)

overallScore = round(clamp(rawOverallScore, 0, 100))
```

`overallScore` must be clamped to `0–100` and rounded to the nearest integer before display, score-band assignment, and rewrite gating.

## 5.3 Intent of weighting

* Scope is weighted highest because boundedness strongly affects usefulness.
* Contrast and clarity are also major contributors.
* Constraint quality matters but slightly less than the top three.
* Risk metrics act as penalties.

---

## 6. Score Bands

* **90–100** Excellent
* **75–89** Strong
* **55–74** Usable
* **35–54** Weak
* **0–34** Poor

These bands are display-oriented. The numeric score is primary.

---

## 7. Rewrite Gating Policy

## 7.1 Default rewrite policy by score

* **0–54**: rewrite recommended
* **55–79**: rewrite optional
* **80–100**: eligible for no rewrite by default, subject to gating conditions

## 7.2 Strong prompt rule

If a prompt scores 80 or above, PromptFire should not generate a rewrite by default.

Rewrite suppression applies only when all of the following are true:

* `overallScore >= 80`
* no major blocking issues
* expected improvement is low
* `rewritePreference != "force"`

Instead it should return:

* overall score
* sub-scores
* brief explanation of strengths
* recommendation: `no_rewrite_needed`

## 7.3 Low expected improvement rule

Low expected improvement should influence recommendation quality, but it must not suppress rewrite on its own below the strong-prompt threshold.

Use signal:

* `LOW_EXPECTED_IMPROVEMENT`

When this is present for a prompt below `80`, PromptFire may return:

* score
* findings
* recommendation: `rewrite_optional`
* optional rewrite payload depending on product behavior and user preference

## 7.4 Manual override

Users may still explicitly request a rewrite even when the default is `no_rewrite_needed`.

Use request field:

* `rewritePreference: "auto" | "force" | "suppress"`

Behavior:

* `auto`: apply normal gating rules
* `force`: generate rewrite even if the prompt would otherwise suppress rewrite
* `suppress`: do not generate rewrite regardless of score

---

## 8. Scope Rubric (0–10)

Scope is computed from four components with a maximum of 10 points:

1. deliverable clarity (`0–3`)
2. audience/context specificity (`0–3`)
3. task boundaries (`0–2`)
4. task load (`0–2`)

## 8.1 Deliverable clarity

* 0: no clear deliverable
* 1: output type is implied but vague
* 2: deliverable is mostly clear
* 3: explicit deliverable is named

## 8.2 Audience/context specificity

* 0: no audience or context
* 1: broad audience or light context
* 2: some useful audience or operating context
* 3: specific audience and/or operating context

## 8.3 Task boundaries

* 0: no limits or exclusions
* 1: weak or implied boundaries
* 2: explicit boundaries or exclusions

## 8.4 Task load

* 0: multiple distinct deliverables
* 1: mildly overloaded
* 2: one deliverable with normal supporting requirements

---

## 9. Contrast Rules

## 9.1 Definition

Contrast measures meaningful differentiation, not just lexical novelty.

## 9.2 Contrast should reward

* explicit audience
* audience specificity
* business tension
* lead angle
* proof requirements
* exclusions
* differentiated framing
* org-fit specificity
* measurable outcomes

## 9.3 Contrast should not blindly punish

* necessary category vocabulary
* normal domain terms like security, compliance, integration, monitoring, testing, deployment
* common terms used in functional ways

## 9.4 Contrast should penalize

* filler
* vague uplift language
* empty superiority claims
* repeated category claims without narrowing function
* decorative buzzwords
* default category framing without tension or direction

## 9.5 Composition principle

Common words are acceptable if they do functional work.

Example:

* “compliance reporting” may be functional
* “compelling, robust, innovative solution” is likely decorative

---

## 10. Clarity Rules

Clarity measures directness and readability of instruction.

Clarity should decrease when:

* the prompt is padded
* wording becomes more formal without becoming more precise
* the sentence structure obscures the ask
* multiple ideas are nested unnecessarily

Clarity should not automatically increase with length.

---

## 11. Constraint Quality Rules

Constraint quality measures whether the requirements genuinely narrow the work.

High constraint quality includes:

* proof requirements
* exclusions
* output structure
* measurable outcomes
* tone boundaries
* must-include or must-avoid instructions

Weak constraints include:

* vague content asks
* generic requests for examples or benefits
* “SEO optimized” without more direction

### 11.1 Functional constraints count even without explicit modal verbs

PromptFire must recognize functional constraints even when the prompt does not use words like `must`, `should`, `exactly`, or `only`.

Examples of functional constraints that should count:

* specific example requirements such as “use one startup example and one enterprise example”
* exclusion instructions such as “avoid hype”
* tone boundaries such as “keep the tone grounded”
* framing boundaries such as “focus on real trade-offs rather than architectural fashion”
* directional narrowing such as “focus on”, “lead with”, or “rather than”

### 11.2 `CONSTRAINTS_MISSING` should be conservative

`CONSTRAINTS_MISSING` should not trigger when the prompt already contains multiple meaningful requirements that narrow output, even if those requirements are expressed in natural language rather than rigid command syntax.

In these cases, PromptFire may still lower `constraintQuality` modestly if the constraints are broad, but it should not classify them as missing.

---

## 12. Generic Output Risk Rules

Generic output risk should rise when:

* no audience is specified
* no exclusions are present
* positioning is weak
* proof is vague or absent
* category-default framing dominates
* generic phrases are used affirmatively
* contrast signals are weak

Generic output risk should not rise simply because a necessary category term appears.

---

## 13. Token Waste Risk Rules

Token waste risk should rise when:

* the prompt is overly broad
* multiple jobs are bundled
* large amounts of wording add little meaning
* follow-up clarification is likely

Token waste risk should not rise just because the prompt is detailed and well bounded.

---

## 14. Strong Prompt Behavior

When a prompt is strong:

### Conditions

* overall score >= 80
* no major blocking issues
* expected improvement is low
* `rewritePreference != "force"`

### PromptFire behavior

Return:

* overall score
* sub-scores
* top strengths
* small number of findings, if any
* `rewriteRecommendation: "no_rewrite_needed"`

Do not generate a rewrite unless the user explicitly asks for one through `rewritePreference: "force"`.

### Display message

Example:

* “Strong prompt. No rewrite needed.”
* “This prompt is already well scoped and well directed.”

---

## 15. Weak Prompt Behavior

When a prompt is weak:

### Conditions

* overall score <= 54
* significant missing audience, boundaries, or constraints
* high generic-output risk

### PromptFire behavior

Return:

* overall score
* sub-scores
* top issues
* rewritten prompt
* explanation of why rewrite is stronger
* `rewriteRecommendation: "rewrite_recommended"`

---

## 16. Usable Prompt Behavior

For mid-range prompts:

### Conditions

* overall score 55–79

### PromptFire behavior

Return:

* overall score
* sub-scores
* top issues
* rewrite optional
* rewrite may be included if expected improvement is material

Use:

* `rewriteRecommendation: "rewrite_optional"`

---

## 17. API Behavior

## 17.1 Public compatibility

This v0.5.1 spec behavior must ship behind a new versioned API contract rather than changing the current v1 API contract in place.

The current v1 API remains stable for existing clients during migration.

## 17.2 New public fields

Suggested additions:

* `overallScore: number`
* `scoreBand: "poor" | "weak" | "usable" | "strong" | "excellent"`
* `rewriteRecommendation: "rewrite_recommended" | "rewrite_optional" | "no_rewrite_needed"`
* `rewritePreference: "auto" | "force" | "suppress"` in the request

Suggested versioning approach:

* add a new endpoint such as `POST /v2/analyze-and-rewrite`
* or add a formally versioned successor path and shared schema package version

The key requirement is that v1 clients continue to receive the existing mandatory `rewrite` and `evaluation` fields unchanged until they migrate to v2.

## 17.3 Rewrite payload behavior

The rewrite payload should become optional.

Example:

* strong prompt → no rewrite payload by default
* weak prompt → rewrite payload present

## 17.4 Evaluation behavior

If rewrite is skipped because the prompt is strong:

* no before/after evaluation is required by default

### Example request additions

```json
{
  "prompt": "Write landing page copy for our IAM platform.",
  "role": "marketer",
  "mode": "high_contrast",
  "rewritePreference": "auto"
}
```

---

## 18. UI Behavior

## 18.1 Primary interface

Use a Pagespeed-style display:

* one large 0–100 score
* short band label
* a few key findings
* optional sub-scores
* rewrite area only when relevant

## 18.2 High score UI

Show:

* score
* “Strong prompt” or equivalent
* strengths
* no rewrite by default

## 18.3 Mid score UI

Show:

* score
* top weaknesses
* rewrite option

## 18.4 Low score UI

Show:

* score
* problems
* rewrite output
* why rewrite should help

---

## 19. Internal vs Public Behavior

## 19.1 Internal signals allowed

PromptFire may use internal role-specific signals such as:

* audienceSpecificity
* positioningStrength
* proofSpecificity
* leadAnglePresence
* contextContrast
* genericValuePropDensity

These may influence public scores.

## 19.2 Public contract rule

These internal signals must not be exposed as public score keys unless separately versioned.

---

## 20. Rewrite Quality Rules

A rewrite is only successful if it materially improves the prompt’s boundedness or differentiation.

A rewrite should not be considered successful just because it:

* is longer
* sounds more polished
* uses more formal wording

A rewrite should be rewarded when it:

* adds usable context
* adds functional constraints
* adds proof expectations
* adds exclusions
* adds audience/tension
* reduces ambiguity

---

## 21. Decision Rules

## 21.1 Strong prompt

If all of the following are true:

* `overallScore >= 80`
* no major blocking issues
* expected improvement is low
* `rewritePreference != "force"`

* default: skip rewrite

## 21.2 Rewrite failure safeguard

If a generated rewrite materially lowers quality:

* do not present it as an improvement
* either suppress it or label it as not recommended

## 21.3 High-contrast safeguard

For `high_contrast` mode:

* a rewrite should not reduce contrast unless it clearly becomes more generic overall

---

## 22. Required Test Cases

1. weak prompt receives rewrite recommendation
2. strong prompt is validated without rewrite by default
3. explicit audience does not trigger `AUDIENCE_MISSING`
4. one deliverable with normal constraints does not trigger overload
5. necessary category terms are not penalized merely for being common
6. filler/buzzword-heavy prompt is penalized appropriately
7. `high_contrast` rewrite does not reduce contrast for a clearly generic original
8. strong existing prompt returns `no_rewrite_needed`
9. rewrite payload is omitted by default for strong prompts
10. overall score maps correctly from sub-scores
11. `rewritePreference: "force"` overrides strong-prompt suppression
12. `rewritePreference: "suppress"` omits rewrite payload even when a rewrite would otherwise be recommended
13. overall score is rounded to nearest integer before score-band assignment and gating
14. scope score does not double-count constraint quality
15. prompts with explicit example requirements, exclusions, and framing boundaries do not trigger `CONSTRAINTS_MISSING`
16. strong prompts with low expected improvement and no major blocking issues return `no_rewrite_needed`
17. rewrites that mostly paraphrase an already-strong prompt are suppressed by default

---

## 23. Non-Goals

Not part of this spec:

* full prompt history
* billing or quota rules
* team policy management
* saved rewrite libraries
* versioned public issue-code expansion

---

## 24. Rollout Recommendation

Implement this as a spec-backed behavior change for the next product iteration.

Recommended artifact:

* `docs/specs/prompt-scoring-and-rewrite-gating-v0.5.1.md`

Recommended rollout:

1. implement score calculation
2. implement rewrite gating
3. make rewrite payload optional
4. update UI to Pagespeed-style score-first presentation
5. add regression tests for strong-prompt no-rewrite behavior

## Spec addition: Major Blocking Issues

### Major Blocking Issues

For rewrite gating, PromptFire must evaluate a boolean:

`majorBlockingIssues`

This value determines whether a prompt may skip rewrite by default.

### Rule

Set `majorBlockingIssues = true` when **either** of the following is true:

1. the prompt has **two or more** issues with severity `high`
2. the prompt has **one or more** `high` severity issues from this blocking set:

   * `AUDIENCE_MISSING`
   * `CONSTRAINTS_MISSING`
   * `GENERIC_OUTPUT_RISK_HIGH`

Otherwise:

`majorBlockingIssues = false`

### Notes

* This rule is deterministic and must be applied the same way in API, evaluation, and UI-facing behavior.
* `majorBlockingIssues` is an internal gating value. It does not need to be exposed publicly unless later versioned into the API.
* The purpose of this rule is to prevent high-scoring prompts from skipping rewrite when they still contain foundational defects.
* Because `CONSTRAINTS_MISSING` is a blocking issue, it must be emitted conservatively. Prompts with meaningful example requirements, exclusions, tone boundaries, or framing boundaries should not be escalated into blocking status merely because they omit rigid modal verbs.

### Gating precedence

Default rewrite suppression applies only when **all** of the following are true:

* `overallScore >= 80`
* `majorBlockingIssues = false`
* `expectedImprovement = "low"`
* `rewritePreference != "force"`

If `rewritePreference = "suppress"`, no rewrite is generated regardless of score.

If `rewritePreference = "force"`, a rewrite is generated regardless of score.

---

## Engineering-ready contract examples for v0.5.1

These examples assume a versioned API path such as:

`POST /v2/analyze-and-rewrite`

and a request field:

`rewritePreference: "auto" | "force" | "suppress"`

---

## 1. Weak prompt, rewrite recommended

### Request

```json
{
  "prompt": "Write landing page copy for our IAM service.",
  "role": "marketer",
  "mode": "high_contrast",
  "rewritePreference": "auto"
}
```

### Response

```json
{
  "id": "par_01HXWEAK123",
  "overallScore": 41,
  "scoreBand": "weak",
  "rewriteRecommendation": "rewrite_recommended",
  "analysis": {
    "scores": {
      "scope": 4,
      "contrast": 3,
      "clarity": 8,
      "constraintQuality": 2,
      "genericOutputRisk": 8,
      "tokenWasteRisk": 5
    },
    "issues": [
      {
        "code": "AUDIENCE_MISSING",
        "severity": "high",
        "message": "The prompt does not define a clear target audience."
      },
      {
        "code": "CONSTRAINTS_MISSING",
        "severity": "high",
        "message": "The prompt lacks clear constraints or implementation boundaries."
      },
      {
        "code": "EXCLUSIONS_MISSING",
        "severity": "medium",
        "message": "The prompt does not define what language or approaches to avoid."
      },
      {
        "code": "GENERIC_OUTPUT_RISK_HIGH",
        "severity": "high",
        "message": "The prompt is likely to produce generic output without stronger direction."
      }
    ],
    "detectedIssueCodes": [
      "AUDIENCE_MISSING",
      "CONSTRAINTS_MISSING",
      "EXCLUSIONS_MISSING",
      "GENERIC_OUTPUT_RISK_HIGH"
    ],
    "signals": [
      "No audience specified.",
      "Constraints are missing or too weak.",
      "No exclusions are defined.",
      "High likelihood of generic output."
    ],
    "summary": "Prompt is weakly bounded and likely to produce generic output."
  },
  "gating": {
    "rewritePreference": "auto",
    "expectedImprovement": "high",
    "majorBlockingIssues": true
  },
  "rewrite": {
    "role": "marketer",
    "mode": "high_contrast",
    "rewrittenPrompt": "Write landing page copy for an IT director at a mid-sized enterprise dealing with access sprawl and audit pressure. Lead with operational control and compliance readiness. Include one measurable proof point and avoid generic cybersecurity buzzwords.",
    "explanation": "The rewrite adds a clear audience, sharper tension, proof requirements, and exclusions to reduce generic output.",
    "changes": [
      "Added target audience",
      "Added business tension",
      "Added proof requirement",
      "Added exclusion guidance"
    ]
  },
  "evaluation": {
    "status": "material_improvement",
    "overallDelta": 19,
    "signals": [],
    "scoreComparison": {
      "original": {
        "scope": 4,
        "contrast": 3,
        "clarity": 8
      },
      "rewrite": {
        "scope": 8,
        "contrast": 7,
        "clarity": 8
      }
    }
  },
  "meta": {
    "version": "2",
    "requestId": "01HXWEAK123",
    "latencyMs": 183,
    "providerMode": "mock"
  }
}
```

---

## 2. Strong prompt, no rewrite by default

### Request

```json
{
  "prompt": "Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.",
  "role": "general",
  "mode": "balanced",
  "rewritePreference": "auto"
}
```

### Response

```json
{
  "id": "par_01HXSTRONG456",
  "overallScore": 86,
  "scoreBand": "strong",
  "rewriteRecommendation": "no_rewrite_needed",
  "analysis": {
    "scores": {
      "scope": 8,
      "contrast": 7,
      "clarity": 8,
      "constraintQuality": 8,
      "genericOutputRisk": 2,
      "tokenWasteRisk": 2
    },
    "issues": [],
    "detectedIssueCodes": [],
    "signals": [
      "Clear audience and topic framing.",
      "Balanced constraints and tone guidance.",
      "Low expected improvement."
    ],
    "summary": "Strong prompt. It is already well scoped and well directed."
  },
  "gating": {
    "rewritePreference": "auto",
    "expectedImprovement": "low",
    "majorBlockingIssues": false
  },
  "rewrite": null,
  "evaluation": null,
  "meta": {
    "version": "2",
    "requestId": "01HXSTRONG456",
    "latencyMs": 96,
    "providerMode": "mock"
  }
}
```

---

## 3. Strong prompt, forced rewrite

### Request

```json
{
  "prompt": "Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.",
  "role": "general",
  "mode": "balanced",
  "rewritePreference": "force"
}
```

### Response

```json
{
  "id": "par_01HXFORCE789",
  "overallScore": 86,
  "scoreBand": "strong",
  "rewriteRecommendation": "rewrite_optional",
  "analysis": {
    "scores": {
      "scope": 8,
      "contrast": 7,
      "clarity": 8,
      "constraintQuality": 8,
      "genericOutputRisk": 2,
      "tokenWasteRisk": 2
    },
    "issues": [],
    "detectedIssueCodes": [],
    "signals": [
      "Clear audience and topic framing.",
      "Balanced constraints and tone guidance.",
      "Low expected improvement."
    ],
    "summary": "Strong prompt. Rewrite was generated because it was explicitly requested."
  },
  "gating": {
    "rewritePreference": "force",
    "expectedImprovement": "low",
    "majorBlockingIssues": false
  },
  "rewrite": {
    "role": "general",
    "mode": "balanced",
    "rewrittenPrompt": "Write a practical blog post for engineering managers at SaaS companies explaining when TypeScript improves maintainability and when it adds unnecessary complexity. Include one startup example and one enterprise example, and keep the tone grounded and non-hyped.",
    "explanation": "The rewrite is a mild tightening pass because the original prompt was already strong.",
    "changes": [
      "Minor tightening of wording",
      "Preserved audience and examples",
      "Preserved tone boundary"
    ]
  },
  "evaluation": {
    "status": "already_strong",
    "overallDelta": 0,
    "signals": [
      "LOW_EXPECTED_IMPROVEMENT"
    ],
    "scoreComparison": {
      "original": {
        "scope": 8,
        "contrast": 7,
        "clarity": 8
      },
      "rewrite": {
        "scope": 8,
        "contrast": 7,
        "clarity": 8
      }
    }
  },
  "meta": {
    "version": "2",
    "requestId": "01HXFORCE789",
    "latencyMs": 141,
    "providerMode": "mock"
  }
}
```

---

## 4. Strong prompt, rewrite explicitly suppressed

### Request

```json
{
  "prompt": "Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.",
  "role": "general",
  "mode": "balanced",
  "rewritePreference": "suppress"
}
```

### Response

```json
{
  "id": "par_01HXSUPPRESS321",
  "overallScore": 86,
  "scoreBand": "strong",
  "rewriteRecommendation": "no_rewrite_needed",
  "analysis": {
    "scores": {
      "scope": 8,
      "contrast": 7,
      "clarity": 8,
      "constraintQuality": 8,
      "genericOutputRisk": 2,
      "tokenWasteRisk": 2
    },
    "issues": [],
    "detectedIssueCodes": [],
    "signals": [
      "Clear audience and topic framing.",
      "Balanced constraints and tone guidance."
    ],
    "summary": "Strong prompt. Rewrite generation was suppressed by request."
  },
  "gating": {
    "rewritePreference": "suppress",
    "expectedImprovement": "low",
    "majorBlockingIssues": false
  },
  "rewrite": null,
  "evaluation": null,
  "meta": {
    "version": "2",
    "requestId": "01HXSUPPRESS321",
    "latencyMs": 81,
    "providerMode": "mock"
  }
}
```

---

## Small recommendation

I’d keep `rewrite` and `evaluation` as explicitly nullable in `v0.5.1`, rather than omitted. That makes frontend handling and schema evolution simpler.

---

## 25. Calibration Example: Strong Prompt With Natural-Language Constraints

This prompt should be treated as a calibration fixture for v0.5.1:

```text
Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.
```

### Expected interpretation

PromptFire should recognize that this prompt already contains:

* one clear deliverable
* a specific audience
* a concrete tension
* two specific example requirements
* explicit exclusion guidance
* a tone boundary
* a framing boundary

### Expected scoring behavior

This prompt should generally score as strong or high-usable, not weakly constrained.

Expected directional outcomes:

* `scope`: high
* `contrast`: high
* `clarity`: high
* `constraintQuality`: moderate-to-high or high
* `genericOutputRisk`: low
* `tokenWasteRisk`: low

### Expected issue behavior

PromptFire should not emit:

* `CONSTRAINTS_MISSING`

PromptFire should not set:

* `majorBlockingIssues = true`

unless another independent blocking issue is present.

### Expected rewrite behavior

If expected improvement is low, PromptFire should prefer:

* `rewriteRecommendation: "no_rewrite_needed"`
* no rewrite payload by default

If a rewrite is generated anyway, the system should be willing to classify it as:

* `already_strong`
* `no_significant_change`
* or suppressed due to low expected improvement / paraphrase-heavy behavior

For contract consistency in `v2`:

* weak / usable prompt with rewrite generated -> `rewrite` and `evaluation` populated
* strong prompt with no rewrite -> `rewrite: null`, `evaluation: null`
