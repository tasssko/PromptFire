Here is a cleaner **v0.5.2 weighting spec** that matches the product behavior you want and fixes the balance problem.

## PromptFire scoring spec v0.5.2

### Objective

The overall score should reflect the likelihood that a prompt will produce:

* bounded output
* differentiated output
* useful output without needing significant rewrite

The score should **not** be overly lifted by:

* direct wording alone
* shortness alone
* low token waste alone

This change is needed because the current formula gives too much credit to clarity and low token waste, while underweighting constraint usefulness and generic-output control. The current formula is still `2.5*scope + 2.0*contrast + 2.0*clarity + 1.5*constraintQuality + 1.0*(10-genericOutputRisk) + 1.0*(10-tokenWasteRisk)`, which is what allows minimal but clear prompts like the IAM example to sit around 50, and also leaves some already-strong prompts below the public 80 threshold unless separate gating logic suppresses rewrite anyway.  

---

## 1. Revised score formula

### Current problem

The current weighting over-rewards:

* **clarity**
* **low token-waste**

and under-rewards:

* **constraint quality**
* **generic-output control**
* **structural differentiation**

### New formula

```text
rawOverallScore =
  2.75 * scope +
  2.25 * contrast +
  1.25 * clarity +
  2.00 * constraintQuality +
  1.50 * (10 - genericOutputRisk) +
  0.50 * (10 - tokenWasteRisk)

overallScore = round(clamp(rawOverallScore, 0, 100))
```

### Interpretation

* **scope** remains the single strongest term because boundedness is central
* **contrast** becomes slightly more important because differentiation is core to PromptFire
* **clarity** becomes supportive rather than dominant
* **constraintQuality** becomes more important than clarity
* **genericOutputRisk** becomes more consequential
* **tokenWasteRisk** becomes a minor hygiene factor rather than a major positive offset

---

## 2. Weighting principles

### 2.1 Clarity is supportive, not primary

A prompt can be perfectly clear and still be weak.
Example: “Write landing page copy for our IAM service.” is direct, but structurally underdirected. Your repo still treats it as a canonical weak marketer example with rewrite recommended. 

**Spec rule:**
Clarity must not by itself pull a prompt into a healthier band when audience, boundaries, and differentiation are missing.

### 2.2 Low token-waste is not a strength signal

Low waste should help slightly, but it should not rescue weak prompts.

**Spec rule:**
Token efficiency is a secondary quality factor. It should never outweigh missing audience, missing contrast, or weak constraint value.

### 2.3 Constraint quality is a core quality signal

PromptFire is meant to reward the work words do. That means useful requirements must matter more than stylistic cleanliness.

**Spec rule:**
Constraint quality must have more influence on overall score than clarity.

### 2.4 Generic-output control is central

If the prompt is likely to produce interchangeable default output, the score should reflect that strongly.

**Spec rule:**
Generic-output risk is a primary quality dimension, not a mild penalty.

---

## 3. Interpretation rules for sub-scores

### Scope

Scope measures **boundedness after accounting for both narrowing and breadth**.

It should reward:

* clear deliverable
* audience specificity
* framing boundaries
* output boundaries
* manageable task shape

It should be reduced by:

* breadth pressure
* overloaded coverage
* multiple latent jobs inside one deliverable

This is consistent with your existing v2 direction, which already decomposes scope into deliverable clarity, audience/context specificity, task boundaries, and task load. 

### Contrast

Contrast measures whether the prompt contains meaningful differentiators:

* audience
* tension
* proof needs
* exclusions
* trade-off framing
* differentiated angle

This should continue to reward composition over rarity of words.

### Clarity

Clarity measures directness and readability only.
It does **not** measure strength of framing or usefulness of constraints.

### Constraint quality

Constraint quality measures whether the requirements actually shape output:

* audience constraints
* example requirements
* exclusions
* framing boundaries
* comparison boundaries
* structural requirements
* tone boundaries when meaningful

Broad topic inclusions can raise this somewhat, but they should not score like strong narrowing constraints.

### Generic output risk

Generic risk should remain high when a prompt lacks differentiating control signals, even if it includes many topical requirements.

### Token waste risk

Token waste should capture:

* overbreadth
* diffuse coverage
* likely reruns due to broad asks
* bloated or padded wording

It should not strongly reward simple short prompts.

---

## 4. Constraint interpretation model

The system must distinguish:

* **missing constraints**: no meaningful requirements beyond the basic ask
* **broad constraints**: requirements exist but mainly expand coverage
* **functional constraints**: requirements narrow output meaningfully
* **strong constraints**: requirements tightly bound audience, framing, proof, and exclusions

`CONSTRAINTS_MISSING` should fire only for the first case.
Broad-but-present requirements must not be treated as missing constraints. This matches the direction already present in your marketer heuristics notes. 

---

## 5. Recommended score bands

These are display bands, not absolute rewrite-policy gates.

* **0–39**: weak
* **40–59**: weak but usable
* **60–74**: usable
* **75–84**: strong
* **85–100**: very strong

This change matters because your current fixtures already show prompts being treated as `no_rewrite_needed` below the public 80 threshold, which means the product logic has already partially decoupled score band and rewrite policy. 

---

## 6. Rewrite policy alignment

The score should inform rewrite behavior, but not be the only determinant.

### Recommended policy

Suppress rewrite by default when all are true:

* `overallScore >= 75`
* `majorBlockingIssues = false`
* `expectedImprovement = low`
* `rewritePreference != "force"`

If `rewritePreference = "suppress"`, do not rewrite.
If `rewritePreference = "force"`, always rewrite.

### Why 75 instead of 80

Your fixtures already show that some prompts in the low 70s are structurally strong enough to avoid rewrite. Lowering the public suppression threshold makes the score align better with existing behavior. 

---

## 7. Fixture target ranges

These are not exact hardcoded outputs. They are calibration targets.

### A. IAM minimal marketer prompt

Prompt:
“Write landing page copy for our IAM service.”

Expected interpretation:

* clear deliverable
* no audience
* no proof
* no exclusions
* no framing
* high risk of generic SaaS/security output

Target sub-scores:

* scope: **4–5**
* contrast: **2–3**
* clarity: **8**
* constraintQuality: **1–2**
* genericOutputRisk: **6–8**
* tokenWasteRisk: **1–2**

Target overall range:

* **42–48**

Target recommendation:

* `rewrite_recommended`

This remains weak, but its score should be less flattered by clarity and brevity than under the current formula.

---

### B. Kubernetes broad guide prompt

Prompt:
“Create a complete guide to Kubernetes, including architecture, security, deployment, monitoring, troubleshooting, cost optimization, migration strategy, best practices, examples, and a conclusion for different kinds of businesses.”

Expected interpretation:

* requirements are present
* requirements mostly increase breadth
* audience/framing still weak
* high breadth pressure
* moderate generic risk
* moderate-to-high rerun risk

Target sub-scores:

* scope: **3–4**
* contrast: **2–3**
* clarity: **5–6**
* constraintQuality: **4–5**
* genericOutputRisk: **5–6**
* tokenWasteRisk: **5–6**

Target overall range:

* **41–49**

Target recommendation:

* `rewrite_recommended`

This is important: Kubernetes should score **better than IAM on constraint quality**, but not necessarily better overall.

---

### C. TypeScript strong prompt

Prompt:
“Write a blog post for engineering managers at SaaS companies about when TypeScript improves maintainability and when it adds unnecessary complexity. Use one startup example and one enterprise example. Avoid hype and keep the tone practical.”

Expected interpretation:

* strong audience
* clear angle
* useful examples
* exclusion/tone boundaries
* low generic risk
* low expected improvement

Target sub-scores:

* scope: **8**
* contrast: **8**
* clarity: **8**
* constraintQuality: **8**
* genericOutputRisk: **2–3**
* tokenWasteRisk: **2–3**

Target overall range:

* **76–83**

Target recommendation:

* `no_rewrite_needed`

This better aligns the score with the actual product judgment already visible in fixtures. 

---

### D. Microservices strong prompt

Prompt:
“Write a practical blog post for CTOs at mid-sized SaaS companies about when microservices improve team autonomy and when they create unnecessary operational overhead. Use one example from a fast-growing startup and one from a more mature engineering organization. Avoid hype, keep the tone grounded, and focus on real trade-offs rather than architectural fashion.”

Expected interpretation:

* strong audience
* strong framing
* strong contrast
* explicit examples
* clear exclusions
* low generic risk
* low expected improvement

Target sub-scores:

* scope: **8–9**
* contrast: **8–9**
* clarity: **8**
* constraintQuality: **8–9**
* genericOutputRisk: **1–2**
* tokenWasteRisk: **2–3**

Target overall range:

* **80–87**

Target recommendation:

* `no_rewrite_needed`

This is consistent with the intended fix for strong prompts in general mode and avoids relying on rewrite suppression to override a middling public score. 

---

## 8. Acceptance criteria

### A. IAM should stay weak without being padded by hygiene factors

A minimal but clear prompt should not land near the middle of the usable range purely because it is direct and short.

### B. Kubernetes should not be treated as constraint-free

It should score higher than IAM on `constraintQuality`, but still remain weak because breadth pressure keeps scope low.

### C. Strong prompts should score as strong

Prompts that are already structurally well-composed should land in the strong band directly, rather than depending on special-case rewrite suppression.

### D. Score and rewrite policy should feel aligned

Users should not routinely see:

* a score that looks only mediocre
* paired with a recommendation that says the prompt is already strong

---

## 9. Implementation note

You do not need to rewrite the detector system first.
You can implement this in two steps:

### Step 1

Update weights and band thresholds only.

### Step 2

Refine sub-score generation for:

* broad vs functional constraints
* breadth pressure
* generic-risk control signals

That sequencing will let you see whether the scoring experience improves before doing deeper detector work.

## Bottom line

The balancing problem is real. The current formula gives too much lift to prompts that are merely clean and too little lift to prompts that are genuinely well-composed. The revised weighting and target ranges above should make the public score better reflect the actual product judgment already implied by your gating logic and fixtures.