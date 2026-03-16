Yes — here is an implementation-ready spec for replacing `computeClarityScore`.

It is designed to fit PromptFire’s existing public definition of clarity as **“how understandable and direct the prompt is”** while keeping clarity separate from scope, contrast, and constraint quality. The current spec already defines clarity that way, and keeps the public score model deterministic and heuristic-driven.  

---

# PromptFire Clarity Scoring Spec v0.5.2

## 1. Purpose

Replace the current `computeClarityScore` implementation with a deterministic heuristic that actually measures:

**How easy the prompt is to understand and follow on first read.**

This change is needed because the current function mostly measures:

* overload
* length
* a very small set of hype/intensifier words

That makes it a weak proxy for clarity and causes many prompts to cluster around high clarity even when they are vague or poorly formed.

## 2. Non-goals

This function must **not** try to score:

* boundedness
* meaningful differentiation
* usefulness of constraints
* rewrite worthiness

Those belong to:

* `scope`
* `contrast`
* `constraintQuality`
* `genericOutputRisk`

This matches the current spec separation, where:

* clarity = understandable and direct
* scope = boundedness
* contrast = meaningful differentiation
* constraint quality = usefulness of requirements 

## 3. Core rule

`clarity` should be earned from **present readability signals**, not assumed by default.

A prompt should score well on clarity when it:

* uses a clear action
* names a recognizable deliverable or output
* is readable in sentence structure
* avoids obvious ambiguity and filler
* avoids contradiction

A prompt can be:

* high clarity and weak overall
* high clarity and broad
* high clarity and low contrast

That is acceptable.

Example:
“Write landing page copy for our IAM service.” can still be high clarity even if it is weak overall.

## 4. Scoring model

`clarity` remains a `0–10` integer.

Use additive scoring from present signals rather than starting at 8 and subtracting tiny penalties.

### Component weights

* clear action verb present: `0–2`
* recognizable deliverable present: `0–2`
* readable structure: `0–2`
* low ambiguity / low vagueness: `0–2`
* low filler / low hype: `0–1`
* no overload that hurts readability: `0–1`

Total max: `10`

## 5. Component rules

### 5.1 Clear action verb (`0–2`)

Award when the prompt clearly tells the model what to do.

Examples of acceptable verbs:

* write
* create
* draft
* generate
* develop
* produce
* explain
* summarize
* compare
* outline
* design

Scoring:

* `2`: clear action verb present
* `0`: no clear action verb

### 5.2 Recognizable deliverable (`0–2`)

Award when the prompt clearly names an output type.

Examples:

* landing page copy
* blog post
* guide
* article
* email
* summary
* outline
* report
* case study
* ad copy
* script

Scoring:

* `2`: deliverable clearly named
* `0`: no recognizable deliverable

### 5.3 Readable structure (`0–2`)

Award when the prompt is readable and not structurally tangled.

Signals:

* not excessively long
* not one giant dense sentence
* sentence length still readable

Suggested heuristic:

* `2`: prompt length <= 1200 chars and average sentence length <= 40 words
* `1`: slightly dense but still readable
* `0`: very dense, tangled, or hard to parse

### 5.4 Low ambiguity / low vagueness (`0–2`)

Award when the prompt avoids vague placeholders and weak generic wording.

Examples of vague wording:

* something
* stuff
* things
* good
* better
* nice
* engaging
* interesting
* compelling

Scoring:

* `2`: no obvious vague placeholders
* `1`: mild vagueness
* `0`: substantial vagueness

Important:
This is about phrasing ambiguity, not whether the prompt is well bounded.

### 5.5 Low filler / low hype (`0–1`)

Penalize decorative hype and empty intensifiers lightly.

Examples:

* amazing
* incredible
* very
* really
* seamless
* world-class
* best-in-class
* innovative

Scoring:

* `1`: low filler / hype
* `0`: hype or intensifier language present

This should remain a small factor, not a main driver.

### 5.6 No overload that hurts readability (`0–1`)

Use the existing `overloaded` input only as a readability modifier.

Scoring:

* `1`: not overloaded in a way that harms readability
* `0`: overloaded

Important:
This does not mean broad prompts are unclear by default. It only affects clarity when overload makes the instruction harder to follow.

## 6. Proposed implementation

```ts
function computeClarityScore(prompt: string, overloaded: boolean): number {
  let score = 0;
  const text = prompt.trim();

  const hasActionVerb =
    /\b(write|create|draft|generate|develop|produce|outline|summarize|explain|compare|design)\b/i.test(text);
  if (hasActionVerb) score += 2;

  const hasDeliverable =
    /\b(landing page copy|blog post|guide|article|email|summary|outline|report|ad copy|case study|headline|script)\b/i.test(text);
  if (hasDeliverable) score += 2;

  const sentenceCount = (text.match(/[.!?]/g) || []).length || 1;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const avgSentenceLength = wordCount / sentenceCount;

  if (text.length <= 1200 && avgSentenceLength <= 40) {
    score += 2;
  } else if (text.length <= 1800 && avgSentenceLength <= 55) {
    score += 1;
  }

  const hasStrongVagueness =
    /\b(something|stuff|things)\b/i.test(text);
  const hasMildVagueness =
    /\b(good|better|nice|interesting|engaging|compelling)\b/i.test(text);

  if (!hasStrongVagueness && !hasMildVagueness) {
    score += 2;
  } else if (!hasStrongVagueness) {
    score += 1;
  }

  const hasHypeOrIntensifiers =
    /\b(amazing|incredible|very|really|seamless|world-class|best-in-class|innovative)\b/i.test(text);
  if (!hasHypeOrIntensifiers) {
    score += 1;
  }

  if (!overloaded) {
    score += 1;
  }

  return clamp(score, 0, 10);
}
```

## 7. Expected behavior on calibration examples

### Example A

Prompt:
`Write landing page copy for our IAM service.`

Expected:

* action verb present
* deliverable present
* readable
* low ambiguity
* low filler
* not overloaded

Target clarity:

* `9–10`

Reason:
This prompt is weak overall, but it is still easy to understand.

### Example B

Prompt:
`Develop a comprehensive guide to Kubernetes tailored for small to medium-sized businesses...`

Expected:

* action verb present
* deliverable present
* readable enough
* not very vague
* possibly overloaded

Target clarity:

* `7–8`

Reason:
Broad is not the same as unclear.

### Example C

Prompt:
`Create something engaging and really good for our product.`

Expected:

* action verb present
* no clear deliverable
* vague wording present
* intensifier present

Target clarity:

* `3–5`

Reason:
Readable, but weak and vague.

## 8. Acceptance criteria

The replacement clarity model should satisfy all of these:

1. A prompt with a clear action and deliverable can score high on clarity even if it is weak overall. This preserves the intended separation between clarity and the other sub-scores. 
2. Broad prompts do not automatically lose clarity unless breadth harms readability.
3. Short vague prompts do not automatically score high.
4. Hype words are a minor penalty, not the main basis of the score.
5. Clarity does not depend primarily on word count.
6. The score distribution should be wider than the current function’s default-8 behavior.
7. The function remains deterministic and inexpensive.

## 9. Migration note

This should be introduced as a behavior correction, not as a public score-definition change.

Public definition stays the same:

* clarity = how understandable and direct the prompt is 

Implementation changes:

* remove default `score = 8`
* switch to additive scoring from present signals
* keep `overloaded` only as a small modifier
* keep hype/filler detection as a small modifier

## 10. Recommended follow-up tests

Add regression tests for:

* bare IAM prompt → clarity high
* broad Kubernetes guide → clarity moderate-high
* vague “do something good” prompt → clarity low
* long but readable structured prompt → clarity still decent
* short but ambiguous prompt → clarity not inflated

If you want, I can turn this into a patch-style markdown block for `specs/prompt-scoring-and-rewrite-gating-v0.5.1.md` or into a Jest test table.
