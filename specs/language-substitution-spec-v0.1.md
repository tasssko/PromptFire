Yes. And the repo already points in this direction: the current contrast spec says PromptFire should avoid using **“concrete”** as a standalone quality label and instead name the missing specificity directly, like audience, operating context, lead angle, or exclusion. It also says these explanations should feel sharper and more trustworthy. 

I’d make it a small standalone spec so it can govern:

* findings
* best next move
* rewrite explanations
* issue messages
* suggestion templates
* future marketing/UI copy

Here is a clean draft.

---

# PeakPrompt Language Substitution Spec v0.1

## 1. Purpose

Define a plain-language replacement system for PeakPrompt and PromptFire UI copy.

This spec exists to stop abstract scorer language from leaking into product wording. Users should see language that is easy to understand and easy to act on.

The system should prefer words that describe:

* what is missing
* what to add
* what to improve
* why the change matters

It should avoid words that sound polished but do not clearly tell the user what to do.

---

## 2. Background

PromptFire already defines a score-first interface where the numeric score is primary, rewrite output is optional, and strong prompts should be validated rather than rewritten by default. That means the wording around findings and next moves has to be especially clear and low-friction.  

The current contrast spec already warns against vague uses of **“concrete”** and recommends replacing it with direct wording such as:

* specific audience
* specific operating context
* specific business tension
* specific proof requirement
* specific lead angle
* specific exclusion
* specific comparison frame 

This spec generalizes that rule into a reusable substitution system.

---

## 3. Core writing rule

Prefer **plain action language** over **abstract quality language**.

Say:

* what to add
* what to change
* what kind of signal is missing

Do not say:

* that something should become “better,” “stronger,” “more concrete,” unless the UI also tells the user exactly how

---

## 4. Discouraged terms

These terms should be avoided in default UI copy unless they are required by a very specific context.

### 4.1 Discouraged terms

* concrete
* concretely

### 4.2 Why they are discouraged

These terms are discouraged because they:

* sound like internal evaluation language
* are harder to understand quickly
* do not always point to a clear next action
* weaken the score-first, plain-English feel

---

## 5. Approved replacement vocabulary

Replacement should be based on meaning, not blind one-to-one substitution.

### 5.1 When the intended meaning is specificity

Use:

* specific
* clear
* explicit

Examples:

* “add a concrete example” → “add a specific example”
* “make the audience more concrete” → “name a specific audience”

### 5.2 When the intended meaning is realism or practicality

Use:

* real
* practical
* based on a real scenario

Examples:

* “make this more concrete” → “make this more practical”
* “use a concrete comparison” → “use a real comparison”

### 5.3 When the intended meaning is support or proof

Use:

* evidence-based
* supported by an example
* backed up by a comparison
* support the claim
* show why
* show how

Examples:

* “add a concrete claim” → “add a claim supported by an example”
* “make the point more concrete” → “show why with one example”

### 5.4 When the intended meaning is measurement

Use:

* measurable
* measurable outcome
* clear benchmark
* specific result

Examples:

* “make the benefit more concrete” → “show a measurable outcome”

---

## 6. Preferred term list

When a short replacement is needed in UI copy, prefer this list:

* specific
* real
* clear
* example-based
* evidence-based
* measurable outcome

Note:

* **real** or **specific** is allowed and preferred over **concrete** when the intended meaning is support or proof
* **specific** should remain the default replacement in most general UI cases

---

## 7. Substitution rule

Do not replace terms mechanically.

Choose the replacement that matches the user-facing meaning.

### Mapping guidance

* missing audience → specific audience
* weak framing → clearer angle
* weak support → evidence-based / supported by an example
* weak examples → specific example / real example
* weak outcomes → measurable outcome
* weak exclusions → clear boundary / clear exclusion

---

## 8. UI copy rules

### 8.1 Good UI copy should

* be easy to understand in one pass
* suggest a visible next move
* avoid internal scoring jargon
* fit the score-first interface

### 8.2 Avoid patterns like

* make it more concrete
* use more concrete language
* add more concrete details

### 8.3 Prefer patterns like

* add one specific example
* show one real comparison
* support the claim with one example
* add one measurable outcome
* name a clearer audience
* set one clearer boundary
* make the claim more evidence based

---

## 9. PeakPrompt examples

### Before

Optional: require one concrete example

### After

Optional: require one specific example

---

### Before

Add a concrete comparison

### After

Add one clear comparison

---

### Before

This prompt would benefit from more concrete support

### After

This prompt would benefit from one example or comparison

---

## 10. Implementation scope

Apply this spec to:

* recommendation cards
* key findings
* best next move text
* issue descriptions
* rewrite explanations
* inline suggestion templates
* future copy review

---

## 11. Enforcement model

Add a lightweight replacement registry in code or config.

Suggested shape:

```json
[
  {
    "term": "concrete",
    "status": "discouraged",
    "reason": "Too abstract for default UI copy",
    "replacements": {
      "specificity": ["specific", "clear", "explicit", "exact"],
      "realism": ["real", "practical"],
      "support": ["evidence-based", "supported by an example"],
      "measurement": ["measurable outcome", "specific result"]
    }
  },
]
```

---

## 12. Acceptance criteria

This spec is working if:

* “concrete” no longer appears in generic recommendation copy
* “evidence-based” is only used when the UI truly means proof/support
* users can understand suggested next moves without translation
* wording feels aligned with the score-first UI
* recommendations feel more actionable and less academic

---

## 13. Recommendation

I would ship this as a separate doc, not bury it inside the contrast spec.

Suggested file name:

`specs/language-substitution-spec-v0.1.md`

That keeps it reusable across product copy, rewrite guidance, and later UI review.

The other reason to do it now is that the current PromptFire direction already depends on clear alignment between score, recommendation, and rewrite visibility. The repo explicitly says users should not see a mediocre-looking score paired with a message that feels misaligned. Cleaner language helps reduce that same trust problem at the copy level. 

If you want, I can turn this into a tighter engineering-ready markdown version next.
