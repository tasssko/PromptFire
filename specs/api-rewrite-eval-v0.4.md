# PromptFire Spec v0.4 — Rewrite Evaluation and Improvement Scoring

## Summary

v0.4 adds an evaluation layer to PromptFire so the system can judge whether a rewrite actually improved the prompt.

The current vertical slice already supports:

* deterministic analysis
* rewrite generation behind an engine abstraction
* `POST /v1/analyze-and-rewrite`
* structured API responses and metadata
* mock vs real provider modes

That foundation is visible in the current server flow, where the API validates the request, runs `analyzePrompt`, calls the rewrite engine, and returns `analysis`, `rewrite`, and `meta`. The current response contract and endpoint set are defined in the existing API spec, which centers the MVP around `POST /v1/analyze-and-rewrite`.

v0.4 extends that contract by scoring the rewritten prompt, comparing it to the original, and returning a structured evaluation result.

Primary goal:

* distinguish meaningful improvement from paraphrase-only rewrites
* detect diminishing returns
* prevent rewrite churn
* make the product more trustworthy

---

## Why this phase matters

The current system can generate a rewrite, but it cannot yet determine whether that rewrite is actually better. The analysis layer already scores the original prompt across dimensions such as scope, contrast, clarity, constraint quality, generic-output risk, and token-waste risk.

That means PromptFire currently answers:

* what is wrong with the original prompt
* what rewrite the system suggests

But it does not yet answer:

* did the rewrite materially improve the prompt
* is the rewrite mostly paraphrasing
* is the original prompt already strong
* did the rewrite accidentally make the prompt worse

v0.4 addresses those gaps.

---

## Objectives

1. Score the original prompt and expose that score clearly.
2. Score the rewritten prompt using the same scoring model.
3. Compare both score sets and compute structured deltas.
4. Assign an improvement status.
5. Detect low expected improvement and convergence.
6. Extend the main API contract without breaking the existing product loop.
7. Surface evaluation clearly in the frontend.

---

## Non-goals

Not part of this phase:

* billing
* persistence
* saved prompt history
* share links
* team workspaces
* prompt template libraries
* async jobs
* provider failover
* prompt embedding similarity search
* multi-turn session state

---

## Existing foundation

The current implementation already has the right shape for this phase:

### API entrypoint

The API currently routes:

* `GET /v1/health`
* `POST /v1/analyze-and-rewrite`

### Server flow

The API handler currently:

1. validates input with shared schemas
2. normalizes preferences
3. runs `analyzePrompt`
4. calls the rewrite engine
5. returns `analysis`, `rewrite`, and `meta`

### Frontend

The current UI already renders:

* analysis summary
* issue list
* rewritten prompt
* trace metadata such as request ID, provider mode, and latency 

That means v0.4 can be added as an extension rather than a redesign.

---

## High-level design

v0.4 introduces a new evaluation step after rewrite generation.

### Proposed request flow

```text
validate request
  -> normalize preferences
  -> analyze original prompt
  -> generate rewrite
  -> analyze rewritten prompt
  -> compare original vs rewritten scores
  -> assign improvement status
  -> return evaluation block
```

### New concept

Add a first-class `evaluation` object to rewrite-capable responses.

This object should answer:

* how the original prompt scored
* how the rewritten prompt scored
* whether the rewrite improved the prompt
* by how much
* whether the user should use the rewrite or keep the original

---

## Scoring model

### Score dimensions

Keep the current score dimensions unchanged:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

### Score rules

* all scores are integers from `0` to `10`
* higher is better for:

  * `scope`
  * `contrast`
  * `clarity`
  * `constraintQuality`
* higher is worse for:

  * `genericOutputRisk`
  * `tokenWasteRisk`

### Original score

The original prompt score should be derived from the existing deterministic analysis.

### Rewrite score

The rewritten prompt must be rescored using the same deterministic analysis engine.

Implementation note:

* reuse `analyzePrompt`
* run it against `rewrite.rewrittenPrompt`
* use the same `role`
* use the same `mode`
* use normalized preferences

---

## New evaluation object

### Shape

```json
{
  "originalScore": {
    "scope": 6,
    "contrast": 6,
    "clarity": 8,
    "constraintQuality": 7,
    "genericOutputRisk": 4,
    "tokenWasteRisk": 3
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
  ]
}
```

### Field definitions

#### `originalScore`

The score set for the submitted prompt.

#### `rewriteScore`

The score set for the rewritten prompt.

#### `improvement`

Comparison object describing whether the rewrite materially improved the prompt.

#### `signals`

Evaluation-specific machine-friendly or UI-friendly flags.

---

## Improvement calculation

### Score deltas

Compute deltas as follows:

For positive-quality dimensions:

* `delta = rewriteScore - originalScore`

For risk dimensions:

* `delta = rewriteRisk - originalRisk`
* a more negative value means improvement

Dimensions:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

Example:

* original `scope = 3`, rewrite `scope = 7` => `+4`
* original `genericOutputRisk = 8`, rewrite `genericOutputRisk = 4` => `-4`

### Overall delta

Use a simple weighted sum for v0.4.

Suggested initial weights:

* `scope`: `1.5`
* `contrast`: `1.5`
* `clarity`: `1.0`
* `constraintQuality`: `1.25`
* `genericOutputRisk`: `1.25`
* `tokenWasteRisk`: `1.0`

Suggested formula:

```text
overallDelta =
  (scopeDelta * 1.5) +
  (contrastDelta * 1.5) +
  (clarityDelta * 1.0) +
  (constraintQualityDelta * 1.25) +
  ((-genericOutputRiskDelta) * 1.25) +
  ((-tokenWasteRiskDelta) * 1.0)
```

Rationale:

* improvements in scope and contrast matter strongly for PromptFire
* risk reduction should count positively when risk decreases
* this should be simple enough to reason about and refine later

---

## Improvement statuses

The system must assign one of the following statuses.

### `material_improvement`

Use when the rewrite materially improves prompt quality.

Suggested threshold:

* `overallDelta >= 4`

### `minor_improvement`

Use when the rewrite improves the prompt a bit, but not dramatically.

Suggested threshold:

* `overallDelta >= 1.5`
* and `< 4`

### `no_significant_change`

Use when the rewrite is mostly paraphrase or produces negligible gains.

Suggested threshold:

* `overallDelta > -1.5`
* and `< 1.5`

### `possible_regression`

Use when the rewrite may have weakened the prompt.

Suggested threshold:

* `overallDelta <= -1.5`

### `already_strong`

Use when:

* the original prompt was already strong
* the rewrite adds little or no value
* expected gains from further rewriting are low

Suggested conditions:

* original `scope >= 7`
* original `clarity >= 7`
* original `genericOutputRisk <= 4`
* original `tokenWasteRisk <= 4`
* and status would otherwise be `minor_improvement` or `no_significant_change`

---

## New evaluation signals

Add support for these evaluation-oriented signals.

### `LOW_EXPECTED_IMPROVEMENT`

Use when the original prompt is already strong and further rewriting is unlikely to help much.

### `PROMPT_ALREADY_OPTIMIZED`

Use when the rewrite produces tiny deltas and the original prompt is already strong.

### `PROMPT_CONVERGENCE_DETECTED`

Use when the rewrite remains in the same meaning space and mostly changes phrasing.

### `REWRITE_POSSIBLE_REGRESSION`

Use when a rewrite appears to remove useful specificity or increase vagueness.

---

## Paraphrase detection

v0.4 should include a lightweight paraphrase detection rule.

### Initial rule

Treat a rewrite as likely paraphrase-heavy when all of the following hold:

* score deltas are small across most dimensions
* the same task type is preserved
* the same audience intent is preserved
* the same core constraints are preserved
* the same output goal is preserved

This does not require semantic embeddings in v0.4.

It should be implemented as a rule-based judgment using:

* score similarity
* unchanged structural features
* unchanged role/mode

If matched:

* set status to `no_significant_change` or `already_strong`
* add `PROMPT_CONVERGENCE_DETECTED`

---

## API contract changes

### Endpoint scope

No new endpoint is required in v0.4.

The main endpoint remains:

* `POST /v1/analyze-and-rewrite`

Optional later:

* extend `POST /v1/rewrite` similarly
* extend `POST /v1/analyze` only if evaluation is requested explicitly

### Response change

Add `evaluation` to `POST /v1/analyze-and-rewrite`.

### Updated response shape

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
  "evaluation": {
    "originalScore": {
      "scope": 6,
      "contrast": 6,
      "clarity": 8,
      "constraintQuality": 7,
      "genericOutputRisk": 4,
      "tokenWasteRisk": 3
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
    "signals": [
      "LOW_EXPECTED_IMPROVEMENT",
      "PROMPT_ALREADY_OPTIMIZED",
      "PROMPT_CONVERGENCE_DETECTED"
    ]
  },
  "meta": {
    "version": "0.4",
    "requestId": "...",
    "latencyMs": 123,
    "providerMode": "real"
  }
}
```

### Backward compatibility

To avoid breaking existing clients:

* keep `analysis` unchanged
* keep `rewrite` unchanged
* add `evaluation` as a new block

Clients that do not know about `evaluation` can ignore it.

---

## Shared contract changes

The shared package should add schemas for:

* `ScoreSet`
* `ImprovementStatus`
* `Improvement`
* `Evaluation`
* updated `AnalyzeAndRewriteResponse`

### Suggested new types

```ts
export type ImprovementStatus =
  | 'material_improvement'
  | 'minor_improvement'
  | 'no_significant_change'
  | 'possible_regression'
  | 'already_strong';

export interface Improvement {
  status: ImprovementStatus;
  scoreDeltas: ScoreSet;
  overallDelta: number;
  expectedUsefulness: 'higher' | 'slightly_higher' | 'unchanged' | 'lower';
  notes?: string[];
}

export interface Evaluation {
  originalScore: ScoreSet;
  rewriteScore: ScoreSet;
  improvement: Improvement;
  signals?: string[];
}
```

---

## Heuristics package changes

### New responsibilities

The heuristics package currently analyzes prompts and returns deterministic findings. v0.4 extends it with evaluation helpers.

Add:

* `scorePrompt(...)`
* `evaluateRewriteImprovement(...)`
* optional helper rules for paraphrase-like convergence detection

### Design guidance

Keep evaluation logic deterministic and independent from the rewrite provider.

Possible module layout:

```text
packages/heuristics/
  src/
    analyzePrompt.ts
    scorePrompt.ts
    evaluateRewriteImprovement.ts
    rules/
      scope.ts
      contrast.ts
      clarity.ts
      genericRisk.ts
      tokenWaste.ts
      convergence.ts
```

### Acceptance criteria

* same input scores the same way every time
* same pair of score sets produces the same improvement result every time
* evaluation does not call the LLM provider

---

## API implementation changes

### Current state

The current server computes analysis and rewrite, then returns them. 

### v0.4 change

After the rewrite is generated, the API must:

1. rescore `rewrite.rewrittenPrompt`
2. compute evaluation
3. attach `evaluation` to the response

### Pseudocode

```ts
const preferences = normalizePreferences(input.preferences);
const analysis = analyzePrompt({ ...input, preferences });

const rewrite = await rewriteEngine.rewrite({
  prompt: input.prompt,
  role: input.role,
  mode: input.mode,
  context: input.context,
  preferences,
  analysis,
});

const rewriteAnalysis = analyzePrompt({
  prompt: rewrite.rewrittenPrompt,
  role: input.role,
  mode: input.mode,
  context: input.context,
  preferences,
});

const evaluation = evaluateRewriteImprovement({
  originalScore: analysis.scores,
  rewriteScore: rewriteAnalysis.scores,
  originalAnalysis: analysis,
  rewriteText: rewrite.rewrittenPrompt,
  role: input.role,
  mode: input.mode,
});

return {
  id,
  analysis,
  rewrite,
  evaluation,
  meta,
};
```

### Error handling

No new external error codes are required.

If evaluation fails unexpectedly:

* return `INTERNAL_ERROR`
* log request ID and phase `evaluation`

---

## Frontend changes

The current UI already renders the result block and trace metadata. v0.4 should extend it to render evaluation clearly.

### New UI elements

Add:

* original score summary
* rewrite score summary
* improvement status badge
* overall delta
* short recommendation message

### Recommended messages

* `Material improvement: use the rewritten prompt`
* `Minor improvement: rewrite is slightly tighter`
* `Already strong: your original prompt is already well scoped`
* `No significant change: rewrite mostly rephrases the original`
* `Possible regression: rewrite may have removed useful specificity`

### Suggested rendering order

1. analysis summary
2. rewrite block
3. evaluation summary
4. detailed score comparison
5. trace metadata

---

## Testing plan

### Unit tests

Add tests for:

* score delta calculation
* overall delta weighting
* status assignment thresholds
* already strong detection
* convergence detection on paraphrase-like rewrites
* regression detection when useful constraints are removed

### API integration tests

Add tests ensuring:

* `evaluation` is returned on successful `POST /v1/analyze-and-rewrite`
* `evaluation.originalScore` equals `analysis.scores`
* `evaluation.rewriteScore` is present and valid
* `evaluation.improvement.status` is one of the allowed values
* strong prompts can return `already_strong`
* paraphrase-heavy rewrites can return `no_significant_change`

### Frontend tests

If frontend tests exist later, verify:

* improvement status is rendered
* recommendation text matches status
* missing evaluation is handled gracefully during migration

---

## Observability

Add evaluation-aware logging fields:

* `evaluationStatus`
* `overallDelta`
* `alreadyStrong` boolean

Do not log full prompt bodies by default.

This builds naturally on the existing log shape, which already logs endpoint, role, mode, status, latency, and provider mode.

---

## Versioning

This phase should bump the response version to `0.4` for the updated contract.

Recommended handling:

* keep path `/v1`
* set `meta.version = "0.4"`
* update tests accordingly

---

## Acceptance criteria

v0.4 is complete when:

1. `POST /v1/analyze-and-rewrite` returns an `evaluation` block.
2. The rewritten prompt is rescored deterministically.
3. The API computes score deltas and `overallDelta`.
4. The API returns a valid improvement status.
5. The system can identify prompts that are already strong.
6. The system can identify rewrites that are mostly paraphrases.
7. The frontend renders evaluation in a useful, clear way.
8. Existing clients that only use `analysis` and `rewrite` continue to work.

---

## Suggested follow-up specs after v0.4

After this phase, the most natural next specs are:

1. **v0.5 — OpenAPI 3.1 and typed client generation**
2. **v0.6 — Provider evaluation fixtures and benchmark corpus**
3. **v0.7 — Policy packs and house style rules**
4. **v0.8 — Prompt history and iterative convergence tracking**

---

## Summary

v0.4 turns PromptFire from a prompt rewriting service into a prompt evaluation service.

It does that by:

* rescoring rewritten prompts
* computing deltas
* labeling the result honestly
* detecting diminishing returns
* exposing whether a rewrite is actually worth using

This is the phase that makes the product meaningfully more trustworthy and more differentiated.
