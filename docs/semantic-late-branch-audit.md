# Semantic Late-Branch Audit

Status: PR 1 inventory for `semantic-late-branch-cleanup-and-gap-determinism-v0.1.0`

Scope:

- `apps/api/src/server.ts`
- `apps/api/src/rewrite/rewritePresentation.ts`

Goal:

- identify every late branch that still affects rewrite posture, missing-context framing, or guided completion after semantic ownership exists
- tag each branch as `keep`, `narrow`, or `delete`
- preserve downgrade, suppress, and operational recovery behavior
- remove or fence off reinterpretive rescue behavior for semantically owned prompts

## Classification Rule

`keep`

- operational safety or transport recovery
- malformed provider/eval handling
- downgrade or suppress behavior that stays inside semantic policy

`narrow`

- branch is still useful for non-owned prompts
- branch is acceptable for owned prompts only if it cannot escalate or replace semantic framing

`delete`

- branch exists only to reinterpret prompt quality or missing context after semantic findings/policy already exist

## Server Audit

### `apps/api/src/server.ts`

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1098)

- `semanticDecision?.rewriteRecommendation ?? recommendationFromState(...)`
- Reason: this is the main ownership gate already. Semantic recommendation wins when present; score-based recommendation is fallback-only for non-owned prompts.

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1104)

- `shouldFloorDeveloperRecommendation(...)` guarded by `if (!semanticDecision)`
- Reason: explicitly non-semantic fallback. Does not touch owned prompts.

`narrow` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1092)

- `shouldSuppressByStrength`
- Reason: safe for owned prompts only because current recommendation selection takes semantic recommendation first. This is suppress-only, not escalation, but it still depends on raw score/issue state.
- PR 1 action: make the ownership rule explicit in code comments or structure so this cannot accidentally re-enter owned-path recommendation logic later.

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1127)

- `deriveFindings(...)` and `buildRewritePolicy(...)`
- Reason: canonical semantic downstream state.

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1135)

- `generatedBestNextMove = semanticFindings ? null : generateBestNextMove(...)`
- Reason: semantic findings already suppress generic best-next-move for owned prompts.

`narrow` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1154)

- rewrite generation still runs whenever `!shouldSuppress`, including owned prompts that will later be downgraded to guided completion
- Reason: not interpretive by itself, but it means late eval still participates in owned-path presentation choice.
- PR 1 action: keep for now, but document that eval may only select within `allowedPresentationModes` for owned prompts.

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1223)

- `selectRewritePresentationMode(...)` with `semanticPolicy`
- Reason: this is the bounded presentation seam. Safe as long as owned prompts cannot escape `allowedPresentationModes`.

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1234)

- `buildGuidedCompletion(...)` after presentation mode selection
- Reason: safe after recent gap-first change. Guided completion now follows semantic family and `primaryGap` first for owned prompts.

`narrow` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1251)

- `finalIssues = semanticFindings?.issues ?? resolvedAnalysis.issues`
- `finalSignalsBase = semanticFindings?.signals ?? resolvedAnalysis.signals`
- Reason: owned prompts already prefer semantic findings, but fallback signals still include some pre-semantic language.
- PR 1 action: ensure no late non-semantic signal append can override semantic framing.

`narrow` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1257)

- `bestImprovementPath(patternFit.primary)` added only when `!semanticFindings`
- Reason: already excluded for owned prompts. Keep, but this is a classic stale rescue path and should stay clearly non-owned only.

`keep` [server.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/server.ts#L1265)

- `semanticFindings?.summary ?? summaryForV2(...)`
- Reason: semantic summary already owns covered prompts. Generic summary is fallback-only.

## Rewrite Presentation Audit

### `apps/api/src/rewrite/rewritePresentation.ts`

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L64)

- `allowedModes` fallback derived from `rewriteRecommendation` when `semanticPolicy` is absent
- Reason: correct for non-owned prompts, but this fallback is the main seam to protect.
- PR 1 action: keep fallback, but make owned-path handling explicit and early.

`keep` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L75)

- `fallbackMode()`
- Reason: bounded downgrade helper. Safe if only operating inside `allowedModes`.

`keep` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L82)

- suppress when `rewritePreference === 'suppress'`, `rewriteRecommendation === 'no_rewrite_needed'`, or no rewrite exists
- Reason: suppress-only behavior.

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L88)

- `if (!params.evaluation) return allow('full_rewrite') ? 'full_rewrite' : fallbackMode()`
- Reason: for owned prompts this is safe only because `allow('full_rewrite')` is policy-bounded. For non-owned prompts it is still a broad fallback.
- PR 1 action: make the owned-path interpretation explicit in code comments or branch structure.

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L95)

- `material_improvement` prefers `full_rewrite`
- Reason: safe for owned prompts only because policy blocks escalation. This is exactly the seam named in the spec.
- PR 1 action: keep, but annotate and test as downgrade-only / policy-bounded behavior.

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L98)

- `minor_improvement` plus `hasConcreteRewriteGains(...)`
- Reason: eval-driven posture choice. Safe only within policy.
- PR 1 action: keep under ownership guard; candidate for later simplification.

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L104)

- `possible_regression` branch using `isExtremelyUnderspecified(...)` and `hasBoundaryPattern(...)`
- Reason: this is a late rescue heuristic. It downgrades rather than escalates, so it is still product-protective, but it is interpretive.
- PR 1 action: keep only as downgrade helper; never let it replace semantic gap framing for owned prompts.

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L114)

- `no_significant_change` branch using score band and boundary pattern
- Reason: score-band-driven late behavior. Safe for owned prompts only because allowed modes cap posture.
- PR 1 action: keep for non-owned prompts; mark as deletion candidate for owned-path reinterpretation in PR 2 if equivalent safety can be preserved.

`keep` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L137)

- `pushSemanticGapQuestions(...)`
- Reason: canonical owned-path guided completion behavior.

`keep` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L258)

- owned prompt early return in `buildGuidedCompletionQuestions(...)`
- Reason: this is the ownership boundary for guided completion.

`delete` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L265)

- generic developer question fallback for owned prompts is no longer needed
- Reason: current code does not hit this for owned prompts because of the semantic early return. This branch should remain only as non-owned fallback and should not continue to carry owned-path assumptions.
- PR 2 action: shrink comments/logic so this clearly serves non-owned prompts only.

`delete` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L280)

- generic non-developer missing-context fallback for owned prompts is no longer needed
- Reason: same as above. Safe as non-owned fallback, but it should no longer be considered a semantic rescue path.

`narrow` [rewritePresentation.ts](/home/tasssko/Clients/Servana/PromptFire/apps/api/src/rewrite/rewritePresentation.ts#L301)

- templates/examples remain mostly family or role shaped, not fully gap shaped
- Reason: questions are already gap-first, but templates/examples can still feel generic.
- PR 1 action: acceptable to keep. PR 2 can decide whether to add gap-sensitive templates/examples or leave them intentionally generic.

## PR Mapping

## PR 1

- make ownership guards explicit around presentation/eval-driven late branches
- keep all downgrade and suppress behavior
- keep non-owned fallback behavior
- keep provider/eval failure recovery
- do not delete helpers yet

## PR 2

- remove owned-path score-band posture branches that no longer add safety
- remove any owned-path generic rescue wording still reachable after semantic findings/policy exist
- reduce eval-driven reinterpretation branches to non-owned fallback only

## PR 3

- return temporary source-path imports to package-root exports
- delete helpers left unused by semantic ownership
- compress orchestration comments to the final authority model

## Regression Checks Required

- owned prompts can downgrade but not escalate
- owned prompts never regain stale generic missing-context messaging
- equivalent prompts keep the same `primaryGap` and materially similar guided completion
