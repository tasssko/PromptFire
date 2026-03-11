Here’s a concrete rubric for **scope: 0–10** that fits PromptFire.

## Definition

**Scope measures how well bounded the task is.**

A high scope score means the prompt gives the model fewer, better choices.
A low scope score means the prompt is broad, ambiguous, or trying to do too many things at once.

---

## Scope scoring dimensions

Score scope from five components, each worth **0–2 points**:

1. **Deliverable clarity**
2. **Audience/context specificity**
3. **Task boundaries**
4. **Constraint quality**
5. **Task load**

Total = **0 to 10**

---

## 1. Deliverable clarity

Does the prompt clearly say what should be produced?

### 0 points

No clear output type.

Example:
“Help with our IAM messaging.”

### 1 point

General output type is implied, but not fully clear.

Example:
“Improve our IAM landing page.”

### 2 points

Clear deliverable is stated.

Example:
“Write landing page copy for our IAM service.”

---

## 2. Audience/context specificity

Does the prompt define who it is for or what situation it applies to?

### 0 points

No audience or context.

Example:
“Write landing page copy for our IAM service.”

### 1 point

Broad audience or light context.

Example:
“Write landing page copy for IT decision-makers.”

### 2 points

Specific audience and/or concrete operating context.

Example:
“Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure.”

---

## 3. Task boundaries

Does the prompt define what is in scope or out of scope?

### 0 points

No boundaries, exclusions, or limits.

Example:
“Write landing page copy for our IAM service.”

### 1 point

Some implied boundaries, but weak.

Example:
“Focus on security and compliance.”

### 2 points

Explicit boundaries or exclusions.

Example:
“Lead with audit readiness and reduced admin overhead. Avoid generic cybersecurity buzzwords.”

---

## 4. Constraint quality

Does the prompt include useful requirements that narrow the work?

### 0 points

No meaningful constraints.

Example:
“Write landing page copy for our IAM service.”

### 1 point

Some constraints, but broad or generic.

Example:
“Include customer testimonials and key benefits.”

### 2 points

Specific, functional constraints.

Example:
“Include one measurable proof point, one customer example, and avoid fear-based messaging.”

---

## 5. Task load

Is the prompt asking for one bounded thing, or is it overloaded?

### 0 points

Multiple deliverables or strategic spread.

Example:
“Write landing page copy, ad copy, case study messaging, and a broader go-to-market plan.”

### 1 point

Mostly one task, but with mild overload.

Example:
“Write landing page copy and also suggest the homepage positioning and CTA strategy.”

### 2 points

One clear deliverable with normal supporting requirements.

Example:
“Write landing page copy for our IAM service and include one proof point.”

---

# Interpretation bands

## 0–2: Very poorly scoped

The task is broad, ambiguous, or spread across too many jobs.

Typical outcome:

* generic output
* lots of reruns
* weak relevance

## 3–4: Weak scope

There is a task, but not enough context or boundaries.

Typical outcome:

* plausible but bland output
* hidden assumptions
* drift toward defaults

## 5–6: Fair scope

The task is understandable, but still leaves too much open.

Typical outcome:

* workable first pass
* still likely to need refinement

## 7–8: Strong scope

The task is well bounded with good context and useful constraints.

Typical outcome:

* much better first-pass usefulness
* fewer reruns

## 9–10: Very strong scope

The task is tightly framed without being over-constrained.

Typical outcome:

* high relevance
* lower ambiguity
* efficient generation

---

# Example scoring

## Example A

**Prompt:**
“Write landing page copy for our IAM service.”

### Score

* Deliverable clarity: 2
* Audience/context specificity: 0
* Task boundaries: 0
* Constraint quality: 0
* Task load: 2

**Total: 4/10**

That feels right: clear task, but weakly bounded.

---

## Example B

**Prompt:**
“Write landing page copy for our IAM service targeting IT decision-makers in mid-sized enterprises. Highlight security, compliance, and integration.”

### Score

* Deliverable clarity: 2
* Audience/context specificity: 1
* Task boundaries: 1
* Constraint quality: 1
* Task load: 2

**Total: 7/10**

This is much better scoped, even if still not very distinctive.

---

## Example C

**Prompt:**
“Write landing page copy for a CTO at a mid-sized enterprise dealing with identity sprawl and audit pressure. Lead with compliance readiness and reduced admin overhead. Include one measurable proof point. Avoid generic cybersecurity buzzwords.”

### Score

* Deliverable clarity: 2
* Audience/context specificity: 2
* Task boundaries: 2
* Constraint quality: 2
* Task load: 2

**Total: 10/10**

Very well scoped.

---

## Example D

**Prompt:**
“Help me improve our IAM website, blog content, SEO, ad campaigns, and positioning.”

### Score

* Deliverable clarity: 0
* Audience/context specificity: 0
* Task boundaries: 0
* Constraint quality: 0
* Task load: 0

**Total: 0/10**

Very badly scoped.

---

# Implementation guidance

A good system rule is:

**Scope should reward boundedness, not length.**

So:

* longer prompts should not automatically score higher
* prompts with one deliverable and strong boundaries should beat longer but sprawling prompts

## Good internal checks

You can compute scope from signals like:

* `hasClearDeliverable`
* `hasAudienceOrContext`
* `hasBoundariesOrExclusions`
* `hasFunctionalConstraints`
* `isTaskOverloaded`

Then map each to 0–2.

---

# Best short rule

**A well-scoped prompt asks for one thing, for someone specific, within clear boundaries.**

If you want, I can also turn this into a TypeScript-friendly scoring table for Codex.
