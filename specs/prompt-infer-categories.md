Implement PeakPrompt inference fallback and loading UX, but skip database persistence in v1.

Context
PeakPrompt is a score-first prompt analysis tool.
It must keep scoring, rewrite gating, and final verdicts local.
OpenAI must only be used as a structured metadata inference service for unfamiliar prompt shapes.

Core product rule
- OpenAI is inference-only
- OpenAI must not score prompts
- OpenAI must not decide rewrite recommendation
- PeakPrompt owns final scoring, findings, next-step suggestions, rewrite gating, and response payload

Objective
Add a fallback path for unfamiliar prompt shapes:

local -> openai inference -> local resolve -> return

Also update the UI so users can clearly see that analysis is in progress, especially when fallback inference is used.

Scope
1. Add backend fallback resolution flow without persistence
2. Add structured OpenAI inference call for unknown/low-confidence cases
3. Use inferred metadata in-memory for the current request only
4. Add UI loading card with staged progress
5. Add logging so we can review inference behavior before adding DB storage

Non-goals
- do not add database storage or category persistence in v1
- do not expose raw OpenAI inference directly to users
- do not replace local heuristics
- do not add a user-facing AI confidence panel
- do not require streaming in v1
- do not let OpenAI return scores, verdicts, or rewrite recommendations

Backend flow
1. Run local analysis
2. If local classification is confident, resolve locally and return
3. If no confident match exists, call OpenAI once for structured metadata inference
4. Validate result
5. Use validated metadata only in-memory for this request
6. Re-run local resolution using local rules plus inferred metadata
7. Return normal PeakPrompt result
8. Log the inference case for later review

Inference trigger
Call OpenAI only when:
- no local pattern match
- low local confidence
- contradictory local signals

Do not call OpenAI when:
- local classification is strong

OpenAI inference contract
Use Structured Outputs with strict json_schema.

Return schema:

type InferenceMetadata = {
  promptPattern: string | null;
  taskType: string | null;
  deliverableType: string | null;
  missingContextType:
    | "audience"
    | "operating"
    | "execution"
    | "io"
    | "comparison"
    | "source"
    | "boundary"
    | null;
  roleHint: "general" | "developer" | "marketer" | null;
  noveltyCandidate: boolean;
  lookupKeys: string[];
  confidence: number;
  notes: string | null;
};

Rules:
- do not request score
- do not request verdict
- do not request rewrite recommendation
- validate output before use
- if inference fails, fall back to best local result

Logging
Log enough data to review whether persistence should be added later.

Minimum logging fields:
- prompt_hash
- role
- mode
- local_match_status
- inference_used
- validated_inference_metadata
- inference_error if any
- final_resolution_source
- timestamp

API changes
Keep the main response shape compatible.

Optionally add meta fields:
- inferenceFallbackUsed: boolean
- resolutionSource: "local" | "inference"

These meta fields must be safe to ignore by existing UI code.

Frontend UX
Current behavior only changes the button label to “Analyzing…”.
Replace this with a richer loading card rendered where the results card normally appears.

Required UI states
- idle
- loading-local
- loading-inference
- success
- degraded-success
- error

Loading card requirements
- same surface family as results card
- headline
- short supporting sentence
- 3 visible progress steps
- skeleton placeholders for result content

Visible progress labels
1. Initial analysis
2. Pattern lookup
3. Finalizing result

If inference fallback is used, step 2 can display:
- Looking up similar prompt patterns

Copy guidance
Use product-facing copy only.

Good:
- Analyzing your prompt
- Checking prompt structure
- Looking up similar prompt patterns
- Finalizing result

Avoid:
- Calling OpenAI
- Running classifier
- Executing metadata inference

Control behavior while loading
- disable Analyze button
- disable textarea
- disable role/mode/rewrite preference controls
- disable example loader

Fallback behavior
If OpenAI inference fails but local resolution still works:
- return degraded-success
- show normal result
- do not hard-fail the user flow

Acceptance criteria
1. User always sees a clear loading state after clicking Analyze
2. Slower unfamiliar-prompt cases do not look frozen
3. Final score remains locally computed
4. OpenAI is only used for metadata inference
5. Inferred metadata is used only in-memory in v1
6. Inference cases are logged for later review
7. Main UI remains score-first and non-technical

Required tests
1. Known local prompt path does not call OpenAI
2. Unknown prompt path calls OpenAI once
3. Invalid OpenAI schema result is ignored
4. Inference failure still returns best local result
5. Loading card appears during request
6. Controls are disabled while loading
7. Result card replaces loading card on completion

Implementation note
Use strict json_schema Structured Outputs for the inference step rather than older JSON mode.

Future phase
Database-backed persistence and reuse can be added after reviewing logged inference behavior and stabilizing the metadata contract.