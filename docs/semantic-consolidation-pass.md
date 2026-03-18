# Semantic Consolidation Pass

Purpose: settle the current semantic path for covered families without expanding coverage.

## Mismatch Audit Punch List

### Routing and ownership

- Covered semantic families could still enter the inference-fallback lane before semantic classification took ownership.
- This showed up most clearly on `context_first`, `few_shot`, and some `decision_support` prompts that logged `no_local_pattern` or `contradictory_local_signals` even though the semantic engine already handled them deterministically.
- Classification: routing/ownership issue.

### Projection stability

- Strong covered-family prompts still depended enough on the lexical heuristic scores that equivalent wording variants could drift more than the score-first UI should tolerate.
- The biggest risk was not recommendation drift; it was band-adjacent tone wobble across otherwise equivalent `comparison`, `decision_support`, `context_first`, and `few_shot` prompts.
- Classification: projection issue.

### Copy ownership

- Covered semantic responses still appended the legacy `Best improvement path:` signal copy even when semantic findings already owned the narrative.
- That did not change the primary summary, top finding, or best-next-move fields, but it mixed an older pattern-fit voice back into covered semantic output.
- Classification: copy/ownership issue.

## What Changed

- Covered semantic families now bypass the inference-fallback lane and stay on the local semantic route.
- Covered semantic responses no longer append the legacy `Best improvement path:` signal copy.
- Strong bounded covered-family prompts now get small semantic stability floors in score projection so equivalent variants stay in the same visible score band more reliably.
- A curated 25-case semantic eval suite now covers `implementation`, `comparison`, `decision_support`, `context_first`, and `few_shot` prompts.

## Legacy Branch Removed

- Removed for covered families: the inference-fallback routing branch.
- Why: semantic classification already owned the judgment for these families, so letting them enter inference fallback created overlapping routing authority and noisy legacy behavior without adding value.
- Uncovered families still retain the inference fallback path unchanged.

## Running The Eval Suite

- CI: included in the normal `apps/api` Vitest run.
- Local targeted run: `pnpm --filter @promptfire/api test:semantic-evals`
- Existing equivalence and integration coverage still runs through:
  - `pnpm --filter @promptfire/heuristics test -- semanticCore.test.ts`
  - `pnpm --filter @promptfire/api test -- server.test.ts`

## Routing Decision

Recommendation: treat semantic routing as the default engine path for covered families.

Why this now clears the bar:

- Covered-family outputs stay on a single local routing path.
- Stale legacy leakage is materially reduced.
- Equivalence tests now require matching score bands and tighter score tolerances.
- The curated semantic eval suite provides a compact regression lane for future semantic refactors.

## Remaining Before Wider Expansion

- Keep monitoring rewrite-presentation behavior separately from semantic routing; rewrite evaluation can still produce template-or-question presentation modes for thin prompts even when semantic classification is stable.
- Add real-provider sampling only after these covered-family evals remain stable over a few follow-up changes.
