# PromptFire Phase 2 Spec — Shared Semantic Decision Rollout

## Status

Draft

## Purpose

Define the next implementation phase after Slice A.

Phase 2 expands the semantic decision core beyond bounded developer handler prompts and makes the semantic decision state the source of truth for additional prompt families.

This phase is not a full-system rewrite. It is a controlled rollout that extends the generic semantic pipeline to more stable prompt families while reducing overlapping legacy logic where semantic coverage now exists.

---

## Why This Phase Exists

Slice A proved that PromptFire can improve trust by evaluating prompts through a semantic decision path instead of relying only on score-first heuristics.

That first slice demonstrated three important things:

* semantically equivalent developer prompts can be normalized through tags, inventory, and decision state
* recommendation and findings can come from semantic boundedness instead of raw score alone
* rollout/task-family gating can live in orchestration while the semantic modules remain generic

The next step is to expand that approach to prompt families already supported conceptually by the product, especially where method-fit and best-next-move logic already exist.

---

## Phase Objective

Expand the shared semantic pipeline so that, for selected additional prompt families:

* semantic decision state drives recommendation
* findings and best-next-move derive from semantic gaps
* score remains a projection of semantic interpretation
* duplicate legacy logic is reduced where semantic coverage exists

This phase should widen the semantic path without destabilizing the current UI or public API.

---

## In Scope

Phase 2 covers these prompt families:

1. **Comparison / trade-off prompts**

   * prompts asking the model to compare options, approaches, or frameworks
   * prompts framed around pros/cons, trade-offs, when X helps vs hurts, or evaluation criteria

2. **Decision-support prompts**

   * prompts asking for judgment under constraints
   * prompts framed around when to choose one option vs another
   * prompts that need criteria, boundaries, examples, or scenarios to avoid generic output

3. **Context-first prompts**

   * prompts where the user provides a substantial situation, background, or constraints block before asking for an output
   * prompts whose quality depends on whether relevant context is actually present and used

4. **Few-shot / example-led prompts**

   * prompts that anchor expected output via examples, reference structures, or style examples
   * prompts where example quality and relevance matter more than generic wording polish

---

## Out Of Scope

This phase does not yet attempt to solve:

* a global score formula redesign
* all marketer-mode calibration issues
* all remaining prompt families at once
* rewrite engine redesign
* full prompt-personality/style modeling
* every legacy heuristic in one pass

It is acceptable for uncovered families to continue using the older path until a later phase.

---

## Architectural Rule For Phase 2

For in-scope prompt families:

```text
prompt -> extractTags -> buildInventory -> buildDecision -> deriveFindings -> projectScores
```

The semantic decision state is the source of truth for:

* rewrite recommendation
* major blocking state
* best-next-move
* top findings

Score remains a projection and must not overturn a stronger semantic interpretation.

---

## Families And Coverage

## 1. Comparison / Trade-off Prompts

### Goal

Normalize prompts that ask for comparisons or trade-offs even when phrased differently.

### Example variants

* Compare Kubernetes and ECS for a mid-sized SaaS team.
* Explain when Kubernetes is worth the overhead and when ECS is the better choice.
* Evaluate Kubernetes versus ECS for team autonomy, operational load, and scaling complexity.

These should not land in different recommendation states merely because one uses “compare” and another uses “when X is worth it.”

### Key semantic signals

* comparison object present
* comparison axes present
* trade-off framing present
* scenario or org context present
* decision criteria or evaluation frame present
* examples or concrete cases present
* exclusions or anti-hype bounds present

### Boundedness rule

A comparison / trade-off prompt is bounded enough when it has:

* a comparison or decision object
* and at least 2 of the following:

  * explicit evaluation axes
    n  - scenario / audience / org context
  * examples or case framing
  * exclusions / anti-default framing

### Common brittle variants to normalize

* “compare X and Y” vs “when X is better than Y”
* “real trade-offs” vs “pros and cons” vs “advantages and disadvantages”
* “for CTOs at SaaS companies” vs “for a mid-sized SaaS engineering org”

---

## 2. Decision-Support Prompts

### Goal

Handle prompts that ask for judgment, guidance, or choice under constraints.

### Example variants

* Write a practical piece on when TypeScript improves maintainability and when it adds unnecessary complexity.
* Help engineering managers decide when TypeScript is worth introducing.
* Explain when TypeScript is useful, when it is costly, and what criteria should guide the choice.

### Key semantic signals

* decision object present
* trade-off or evaluation frame present
* audience or scenario present
* examples present
* constraints or boundaries present
* anti-hype / grounded framing present

### Boundedness rule

A decision-support prompt is bounded enough when it has:

* a decision object or decision frame
* and at least 2 of the following:

  * audience or scenario
  * examples or cases
  * explicit trade-off axis
  * exclusions / grounded framing

### Common brittle variants to normalize

* “when X helps and when it hurts” vs “when X is worth it”
* “focus on real trade-offs” vs “avoid hype” vs “keep it practical”
* “use one startup and one enterprise example” vs equivalent case framing

---

## 3. Context-First Prompts

### Goal

Recognize when the prompt already supplies enough context to avoid generic advice.

### Example variants

* We are a 20-person B2B SaaS team with two product squads, limited SRE support, and a compliance requirement. Recommend whether we should adopt service mesh now or later.
* Given this setup [context block], advise on whether service mesh is worth the operational cost.

### Key semantic signals

* explicit situation or context block present
* environment / org / constraints present
* decision or deliverable present
* relevant context tied to the task
* requested output shaped by that context

### Boundedness rule

A context-first prompt is bounded enough when it has:

* a clear requested output
* a substantive context block or situation description
* and at least one relevant narrowing signal such as constraints, scenario, or evaluation frame

### Common brittle variants to normalize

* explicit paragraph of context vs inline context clauses
* “given this situation” vs “for a team with…”
* “consider these constraints” vs embedding them in the narrative

---

## 4. Few-Shot / Example-Led Prompts

### Goal

Recognize example-driven prompts as semantically structured prompts rather than treating them as generic requests with extra text.

### Example variants

* Use the following examples as the model for tone and structure.
* Write output in the style and structure shown below.
* Follow these examples closely for format, but adapt to the new topic.

### Key semantic signals

* examples present
* examples tied to output shape or style
* request for adaptation or transfer present
* scope or topic for the new output present
* constraints on what to preserve or change present

### Boundedness rule

A few-shot prompt is bounded enough when it has:

* at least one usable example or reference structure
* a clear target output request
* and at least one instruction about what to preserve, adapt, or exclude

### Common brittle variants to normalize

* “use these examples” vs “follow this pattern” vs “model the response after…”
* style-only few-shot vs structure-only few-shot
* one strong example vs multiple shorter examples

---

## Semantic Model Additions

Phase 2 extends the generic semantic core with additional tags.

### New or expanded tag families

```ts
type Phase2SemanticTag =
  | 'has_comparison_object'
  | 'has_tradeoff_frame'
  | 'has_decision_frame'
  | 'has_decision_criteria'
  | 'has_scenario_context'
  | 'has_context_block'
  | 'has_examples'
  | 'has_example_transfer_instruction'
  | 'has_style_reference'
  | 'has_format_reference'
  | 'has_grounding_exclusion'
  | 'has_audience'
  | 'has_org_context'
  | 'has_output_request'
  | 'has_internal_contradiction';
```

### Tag extraction guidance

Support semantic equivalents, not just exact wording.

Examples:

* trade-off cluster:

  * trade-offs
  * pros and cons
  * when it helps and when it hurts
  * when it is worth it
  * benefits versus overhead

* grounding cluster:

  * avoid hype
  * keep it practical
  * keep the tone grounded
  * focus on real trade-offs
  * avoid architectural fashion

* example cluster:

  * use one example
  * include one startup example
  * follow these examples
  * model the response after

* context cluster:

  * given this situation
  * for a team with
  * with these constraints
  * in our environment

---

## Inventory Additions

Phase 2 expands `buildInventory` so the shared inventory can represent more than implementation boundedness.

### New inventory areas

```ts
type Inventory = {
  taskShape: {
    taskClass: 'implementation' | 'comparison' | 'decision_support' | 'context_first' | 'few_shot' | 'other';
    outputRequestPresent: boolean;
  };
  audienceContext: {
    present: boolean;
    audience: string[];
    orgContext: string[];
  };
  comparisonContext: {
    present: boolean;
    objects: string[];
    axes: string[];
    tradeoffFrame: boolean;
  };
  decisionContext: {
    present: boolean;
    decisionObject: string[];
    criteria: string[];
    groundedFraming: string[];
  };
  contextBlock: {
    present: boolean;
    relevant: boolean;
    signals: string[];
  };
  exampleContext: {
    present: boolean;
    examples: string[];
    styleReference: boolean;
    formatReference: boolean;
    transferInstruction: boolean;
  };
  contradictions: {
    present: boolean;
    reasons: string[];
  };
};
```

### Inventory rule

Inventory must describe semantic presence and usefulness, not just literal wording matches.

---

## Decision Rules

Phase 2 extends `buildDecision` for the new families.

## Comparison / Trade-off

### Weak

* comparison object missing
* or no evaluation frame and no scenario
* or no meaningful narrowing signals beyond naming two options

### Usable

* comparison object present
* some combination of axes, scenario, examples, or exclusions present
* output is likely serviceable without a rewrite

### Strong

* comparison object present
* trade-off framing present
* scenario or audience context present
* examples or criteria present
* grounded framing reduces generic output risk

### Rewrite behavior

* recommend rewrite only when the prompt lacks comparison frame or useful context
* suppress default rewrite when the prompt is already well bounded and expected improvement is low

## Decision-Support

### Weak

* decision object present but no criteria, no context, and no trade-off frame

### Usable

* decision object plus some useful combination of audience, examples, criteria, or grounded framing

### Strong

* clear decision frame
* examples or scenarios
* grounded framing or exclusions
* low expected improvement

### Rewrite behavior

* prefer `rewrite_optional` or `no_rewrite_needed` when the decision frame is already strong

## Context-First

### Weak

* context present but no clear output request
* or output request present but context is vague or irrelevant

### Usable

* clear output request plus relevant context block
* some remaining gaps in criteria or structure

### Strong

* output request clear
* context relevant and substantial
* guidance is already shaped by the supplied situation

### Rewrite behavior

* avoid recommending rewrite when the prompt is already doing the most important thing: supplying useful context

## Few-Shot / Example-Led

### Weak

* examples present but unclear target task
* or target task present but examples are not linked to desired behavior

### Usable

* examples and target task are both present
* some ambiguity remains around what to preserve or adapt

### Strong

* examples are relevant
* transfer instructions are clear
* target output is clear
* constraints on adaptation are clear

### Rewrite behavior

* default rewrite should be cautious because rewriting often destroys useful example structure

---

## Findings And Best-Next-Move Rules

For all in-scope Phase 2 families:

### Findings must:

* describe the actual semantic gap
* reflect what is already present
* avoid fallback templates that imply total absence when partial boundedness exists

### Forbidden stale findings

Examples of findings to suppress when semantics are already present:

* “constraints are missing” when useful boundaries or examples are already present
* “the prompt needs more detail” when the real problem is method fit or criteria quality
* “the prompt is too open-ended” when the prompt already includes a strong comparison or context block

### Best-next-move rules

#### Comparison / Decision-support

Focus next move on:

* sharpening criteria
* adding one or two concrete cases
* clarifying audience or scenario
* making trade-offs explicit

#### Context-first

Focus next move on:

* clarifying the requested deliverable
* surfacing the most decision-relevant context
* adding evaluation criteria if needed

#### Few-shot

Focus next move on:

* clarifying what to preserve from the examples
* clarifying what should change
* clarifying output shape

Best-next-move must not contradict the semantic recommendation state.

---

## Score Projection Rules For Phase 2

Phase 2 does not replace the whole global score formula.

It extends `projectScores` so that, for in-scope families:

* `contrast` does not collapse to zero when meaningful trade-offs, examples, or grounded framing are present
* `constraintQuality` reflects useful scenario, example, and decision criteria signals
* `genericOutputRisk` decreases when comparison frame, context block, or example structure is present
* `scope` reflects boundedness appropriate to the family, not just implementation-style constraints

### Important rule

Score projection remains downstream of decision state.

Recommendation state must not be overwritten by a weaker projected score.

---

## Orchestration And Integration

### Orchestration responsibilities

Orchestration remains responsible for:

* deciding which prompts are in scope for the semantic path
* rollout gating
* calling the generic semantic pipeline
* falling back to the old path for uncovered families

### Semantic pipeline responsibilities

The semantic modules remain responsible for:

* tag extraction
* inventory construction
* decision construction
* findings derivation
* score projection

### Downstream consumers that must use the shared decision object

Where semantic coverage exists, these outputs must be derived from the same semantic decision object:

* rewrite recommendation
* major blocking issues
* best-next-move
* top findings
* score projection
* rewrite display suppression logic

---

## Legacy Logic To Delete Or Shrink

Phase 2 should not be purely additive.

For in-scope families, shrink or remove legacy logic that duplicates semantic interpretation.

### Candidates

* duplicate pattern mismatch heuristics where semantic tags already classify the family
* stale findings templates based on raw score bands
* family-specific recommendation overrides that semantic decision now makes unnecessary
* narrow rescue logic that only exists to repair pre-semantic misclassification

### Rule

Every new semantic coverage area should come with at least one old special-case path being reduced, disabled, or deleted for that family.

---

## Test Plan

## Unit tests

Add tests for:

* trade-off tag extraction
* decision-frame tag extraction
* context block detection and relevance
* example detection and transfer instruction detection
* family-specific boundedness rules
* family-specific decision rules

## Semantic-equivalence fixtures

Add families where meaning stays the same but wording changes.

### Comparison / Trade-off fixtures

* compare X and Y
* when X is better than Y
* real trade-offs between X and Y

### Decision-support fixtures

* when TypeScript helps and when it hurts
* when TypeScript is worth the complexity
* criteria for deciding whether to adopt TypeScript

### Context-first fixtures

* inline context version
* explicit context block version
* “given this situation” version

### Few-shot fixtures

* “use these examples”
* “follow this pattern”
* “model the response after these examples”

## Integration tests

For each family, assert:

* same recommendation state across equivalent fixtures
* findings reflect semantic gaps, not fallback templates
* best-next-move aligns with semantic state
* score variance stays small across equivalent prompts

---

## Exit Criteria

Phase 2 is complete when:

* semantically equivalent prompts in covered families land in the same recommendation state
* findings and best-next-move align with semantic gaps in covered families
* score projection no longer collapses useful comparison / decision / example-driven prompts into obviously wrong weak states
* at least one category of overlapping legacy logic is removed for each covered family
* rewrite behavior is more conservative for already-bounded comparison, context-first, and few-shot prompts

---

## Follow-On After Phase 2

Likely next phase:

* broaden semantic decision coverage to additional marketer/general families
* reduce remaining score-first legacy logic
* consider whether the public score projection needs a larger global recalibration after more families are semantic-first

Do not begin a full global scoring redesign until Phase 2 has shown stable semantic-equivalence behavior across multiple non-handler families.

---

## Implementation Checklist

* [ ] Add Phase 2 semantic tags to `extractTags`
* [ ] Expand `buildInventory` for comparison / decision / context / few-shot families
* [ ] Expand `buildDecision` for those families
* [ ] Expand `deriveFindings` for those families
* [ ] Expand `projectScores` to reflect family-appropriate boundedness
* [ ] Add orchestration gating for covered Phase 2 families
* [ ] Add semantic-equivalence fixture families
* [ ] Switch recommendation and findings for covered families
* [ ] Remove at least one overlapping legacy path per covered family
* [ ] Validate rewrite suppression behavior for already-bounded prompts
