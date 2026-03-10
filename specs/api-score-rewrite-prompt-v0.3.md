# PromptScope Scoring and Rewrite Evaluation Specification v0.3

## Purpose

This specification defines how PromptFire should score an original prompt, score a rewritten prompt, compare the two, and decide whether a rewrite is materially better or merely a paraphrase.

The goal is to prevent rewrite churn, detect diminishing returns, and make the product trustworthy.

---

## Problem statement

A prompt rewrite system should not assume that every prompt needs further rewriting.

In many cases:

* the original prompt is weak and needs substantial improvement
* the first rewrite is materially better
* subsequent rewrites produce only light paraphrases

Without an evaluation layer, the system can keep rewording prompts without increasing quality. This wastes tokens, hides convergence, and weakens user trust.

PromptScope therefore needs two distinct evaluation steps:

1. score the original prompt
2. score the rewritten prompt

Then it must compare both and determine whether the rewrite created meaningful improvement.

---

## Core principles

* Every prompt submitted for rewrite should be scored before rewriting.
* Every rewritten prompt should be scored after rewriting.
* The system should compute a structured improvement assessment.
* The system should detect when a rewrite is only a paraphrase.
* The system should be allowed to say: the prompt is already strong.
* The system should not force a rewrite when expected improvement is low.

---

## Scoring model

### Score range

All prompt quality scores are integers from `0` to `10`.

### Required dimensions

Each prompt, original or rewritten, must be scored on:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

### Score meaning

Higher is better for:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`

Higher is worse for:

* `genericOutputRisk`
* `tokenWasteRisk`

---

## Prompt score object

```json
{
  "scope": 3,
  "contrast": 2,
  "clarity": 6,
  "constraintQuality": 1,
  "genericOutputRisk": 8,
  "tokenWasteRisk": 7
}
```

### Field guidance

#### `scope`

Measures how well the prompt bounds the task.

High score indicators:

* clear task definition
* explicit boundaries
* limited breadth
* reduced ambiguity

Low score indicators:

* broad task framing
* multiple implicit jobs
* missing boundaries

#### `contrast`

Measures how differentiated the prompt is.

High score indicators:

* clear audience
* specific context
* distinctive angle
* meaningful constraints
* exclusions or forbidden patterns

Low score indicators:

* generic framing
* reusable category language
* no distinction from similar prompts

#### `clarity`

Measures how understandable and direct the prompt is.

High score indicators:

* plain instruction language
* clear output goal
* little ambiguity

Low score indicators:

* vague verbs
* ambiguous intent
* unclear success condition

#### `constraintQuality`

Measures whether the prompt contains useful constraints.

High score indicators:

* specific must-include items
* explicit must-avoid items
* structured focus areas
* desired output form or limits

Low score indicators:

* no constraints
* weak or generic constraints

#### `genericOutputRisk`

Measures the likelihood the prompt will generate default-pattern output.

High risk indicators:

* broad category requests
* no audience or context
* no differentiation
* marketing or coding clichés likely

Low risk indicators:

* differentiated context
* sharp task framing
* meaningful constraints

#### `tokenWasteRisk`

Measures the likelihood the current prompt will create unnecessary token usage through retries, overbreadth, or bloated wording.

High risk indicators:

* repeated filler language
* broad scope requiring follow-up narrowing
* excessive verbosity without added precision

Low risk indicators:

* concise, bounded prompt
* minimal ambiguity
* high instruction density

---

## Analysis stages

### Stage 1: original prompt scoring

The submitted prompt must be scored before any rewrite is attempted.

Output name:

* `originalScore`

### Stage 2: rewritten prompt scoring

The rewritten prompt must be scored using the same scoring logic.

Output name:

* `rewriteScore`

### Stage 3: score comparison

The system must compare `originalScore` and `rewriteScore`.

Output name:

* `improvement`

---

## Improvement model

### Improvement object

```json
{
  "status": "material_improvement",
  "scoreDeltas": {
    "scope": 4,
    "contrast": 5,
    "clarity": 2,
    "constraintQuality": 4,
    "genericOutputRisk": -4,
    "tokenWasteRisk": -3
  },
  "overallDelta": 8,
  "expectedUsefulness": "higher",
  "notes": [
    "Rewrite adds audience definition",
    "Rewrite introduces exclusions",
    "Rewrite reduces generic output risk"
  ]
}
```

### `scoreDeltas`

Computed as:

* positive delta for improved good-quality scores
* negative delta for reduced risk scores

Example:

* original `scope = 3`, rewrite `scope = 7` => `+4`
* original `genericOutputRisk = 8`, rewrite `genericOutputRisk = 4` => `-4`

### `overallDelta`

A summary measure representing total improvement across dimensions.

Suggested v0.1 approach:

* simple weighted sum
* weights can be refined later

Suggested initial weighting:

* `scope`: 1.5
* `contrast`: 1.5
* `clarity`: 1.0
* `constraintQuality`: 1.25
* `genericOutputRisk`: 1.25
* `tokenWasteRisk`: 1.0

Interpretation:

* higher positive value means stronger improvement
* near-zero value means little improvement
* negative value means rewrite made the prompt worse

---

## Rewrite outcome statuses

The system must assign one of the following statuses after comparing the original and rewritten prompts.

### `material_improvement`

Use when the rewrite meaningfully improves prompt quality.

Typical conditions:

* scope or contrast improved substantially
* risks reduced materially
* prompt becomes more useful for downstream generation

### `minor_improvement`

Use when the rewrite improves the prompt, but only modestly.

Typical conditions:

* one or two dimensions improve slightly
* prompt is a bit cleaner, tighter, or more focused
* expected downstream difference is real but small

### `no_significant_change`

Use when the rewrite mostly paraphrases the original prompt.

Typical conditions:

* scores are almost unchanged
* same audience, same task, same constraints, same angle
* wording changed more than meaning

### `possible_regression`

Use when the rewrite may have made the prompt worse.

Typical conditions:

* useful constraints removed
* prompt became broader or vaguer
* token waste increased without added precision
* distinctive context was lost

### `already_strong`

Use when the original prompt is already well structured and expected improvement is low.

Typical conditions:

* original prompt scores highly already
* rewrite produces only marginal change
* system should warn against unnecessary reruns

---

## Diminishing returns detection

The system should detect when repeated rewrites are unlikely to produce meaningful gains.

### Signal: `LOW_EXPECTED_IMPROVEMENT`

Use when the original prompt already has high quality.

Suggested initial conditions:

* `scope >= 7`
* `clarity >= 7`
* `genericOutputRisk <= 4`
* `tokenWasteRisk <= 4`

And one or more of:

* audience is defined
* outcome is defined
* constraints are present
* exclusions are present

### Signal: `PROMPT_ALREADY_OPTIMIZED`

Use when a rewrite attempt produces only tiny deltas and the original prompt was already strong.

Suggested initial conditions:

* `overallDelta <= 1.5`
* original prompt quality already high
* semantic structure unchanged

### Signal: `PROMPT_CONVERGENCE_DETECTED`

Use when repeated rewrites remain in the same meaning space and only wording shifts.

This is especially useful for multi-step or iterative sessions.

---

## Paraphrase detection

PromptScope needs a lightweight way to decide whether a rewrite is mostly a paraphrase.

### v0.1 rule

Treat a rewrite as likely paraphrase-heavy when all of the following are true:

* score deltas are minimal across most dimensions
* audience intent is unchanged
* task type is unchanged
* major constraints are unchanged
* major exclusions are unchanged
* output goal is unchanged

### Result

If these conditions hold, set:

* `status = no_significant_change`

And include notes such as:

* `Rewrite mostly rephrases the same instruction`
* `No meaningful change in audience, scope, or constraints`

---

## Suggested threshold model for v0.1

These thresholds are intentionally simple and should be tuned with real examples later.

### Material improvement

Use when:

* `overallDelta >= 4`

### Minor improvement

Use when:

* `overallDelta >= 1.5`
* and `< 4`

### No significant change

Use when:

* `overallDelta > -1.5`
* and `< 1.5`

### Possible regression

Use when:

* `overallDelta <= -1.5`

### Already strong

Use when:

* original prompt is high quality
* and rewrite is `minor_improvement` or `no_significant_change`
* and `LOW_EXPECTED_IMPROVEMENT` applies

---

## API response additions

To support this behaviour, the API should add scoring and evaluation fields to rewrite-capable endpoints.

### Updated `POST /v1/rewrite` response

```json
{
  "id": "rwt_01JXYZ...",
  "originalScore": {
    "scope": 6,
    "contrast": 6,
    "clarity": 8,
    "constraintQuality": 7,
    "genericOutputRisk": 4,
    "tokenWasteRisk": 3
  },
  "rewrite": {
    "role": "marketer",
    "mode": "balanced",
    "rewrittenPrompt": "Write landing page copy for a CTO at a mid-sized SaaS company dealing with identity sprawl after acquisitions. Lead with operational control and audit readiness, not fear. Emphasize integration clarity and reduced admin overhead. Avoid generic cybersecurity buzzwords and do not use the words seamless, robust, or powerful.",
    "explanation": "The rewrite narrows audience, sharpens business tension, and adds phrasing exclusions.",
    "changes": [
      "Defined target audience",
      "Added business tension",
      "Added exclusions"
    ]
  },
  "rewriteScore": {
    "scope": 8,
    "contrast": 8,
    "clarity": 8,
    "constraintQuality": 8,
    "genericOutputRisk": 3,
    "tokenWasteRisk": 3
  },
  "improvement": {
    "status": "material_improvement",
    "scoreDeltas": {
      "scope": 2,
      "contrast": 2,
      "clarity": 0,
      "constraintQuality": 1,
      "genericOutputRisk": -1,
      "tokenWasteRisk": 0
    },
    "overallDelta": 4.5,
    "expectedUsefulness": "higher",
    "notes": [
      "Rewrite adds stronger audience specificity",
      "Rewrite reduces generic-output risk"
    ]
  },
  "signals": [
    "LOW_EXPECTED_IMPROVEMENT"
  ],
  "meta": {
    "version": "0.1"
  }
}
```

### Updated `POST /v1/analyze-and-rewrite` response

```json
{
  "id": "par_01JXYZ...",
  "analysis": {
    "scores": {
      "scope": 6,
      "contrast": 6,
      "clarity": 8,
      "constraintQuality": 7,
      "genericOutputRisk": 4,
      "tokenWasteRisk": 3
    },
    "issues": [],
    "signals": [
      "LOW_EXPECTED_IMPROVEMENT"
    ],
    "summary": "Prompt is already well structured. Further rewriting may produce only minor paraphrasing."
  },
  "rewrite": {
    "role": "marketer",
    "mode": "balanced",
    "rewrittenPrompt": "Draft targeted landing page copy for our Identity and Access Management (IAM) service aimed at IT decision-makers in mid-sized enterprises. Focus on specific benefits such as improved security measures, efficient user access management, and adherence to industry compliance standards. Address critical pain points like the risk of data breaches and the challenges of managing access controls. Conclude with a strong call to action inviting readers to schedule a demo or consultation.",
    "explanation": "Rewrite makes wording adjustments but introduces little new specificity.",
    "changes": [
      "Minor rephrasing"
    ]
  },
  "rewriteScore": {
    "scope": 6,
    "contrast": 6,
    "clarity": 8,
    "constraintQuality": 7,
    "genericOutputRisk": 4,
    "tokenWasteRisk": 3
  },
  "improvement": {
    "status": "already_strong",
    "scoreDeltas": {
      "scope": 0,
      "contrast": 0,
      "clarity": 0,
      "constraintQuality": 0,
      "genericOutputRisk": 0,
      "tokenWasteRisk": 0
    },
    "overallDelta": 0,
    "expectedUsefulness": "unchanged",
    "notes": [
      "Rewrite mostly paraphrases the original prompt",
      "Original prompt was already strong"
    ]
  },
  "meta": {
    "version": "0.1"
  }
}
```

---

## New issue and signal codes

### Recommended new issues

* `LOW_EXPECTED_IMPROVEMENT`
* `PROMPT_ALREADY_OPTIMIZED`
* `PROMPT_CONVERGENCE_DETECTED`
* `REWRITE_POSSIBLE_REGRESSION`

### Recommended new signal messages

* `Prompt already contains strong structure`
* `Further rewriting is unlikely to create material improvement`
* `Rewrite appears to be mostly paraphrasing`
* `Prompt convergence detected`

---

## Server behaviour guidance

### On strong prompts

If the prompt is already strong, the system should still be able to return a rewrite if explicitly requested, but it must say clearly when expected gains are low.

### On low-improvement rewrites

If the rewrite is mostly a paraphrase, the system should:

* score it honestly
* label it as `no_significant_change` or `already_strong`
* avoid overstating the value of the rewrite

### On regressions

If the rewrite weakens the prompt, the system should surface that clearly.

---

## Frontend behaviour guidance

The UI should show:

* original prompt score
* rewritten prompt score
* improvement status
* score deltas
* a short note explaining whether the rewrite is worth using

### Good UX outcomes

Examples:

* `Material improvement: use the rewritten prompt`
* `Minor improvement: rewrite is slightly tighter`
* `Already strong: your original prompt is already well scoped`
* `No significant change: rewrite mostly rephrases the original`
* `Possible regression: rewrite may have removed useful specificity`

---

## Implementation order

1. Score original prompt.
2. Rewrite prompt.
3. Score rewritten prompt.
4. Compare score sets.
5. Assign improvement status.
6. Return evaluation fields in rewrite-capable endpoints.

---

## Summary

PromptScope should not stop at generating rewrites. It should evaluate whether a rewrite actually improved the prompt.

That requires:

* scoring the original prompt
* scoring the rewritten prompt
* computing score deltas
* assigning an improvement status
* detecting diminishing returns and paraphrase-only rewrites

This evaluation layer is essential to make PromptScope accurate, efficient, and trustworthy.
