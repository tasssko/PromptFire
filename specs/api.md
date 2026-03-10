# PromptFire API Specification v0.1

## Purpose

This document defines the full MVP API contract for PromptFire based on the current product understanding.

PromptFire analyzes prompts, identifies scope and contrast problems, and rewrites prompts using a selected **role** and **mode**.

This specification is intended to support spec-driven development for:

* backend implementation
* frontend integration
* schema validation
* infrastructure setup
* future OpenAPI generation

---

## API principles

* Keep the MVP synchronous.
* Keep the API small and task-oriented.
* Make responses structured and explainable.
* Separate deterministic analysis from rewrite generation.
* Keep room for future providers, persistence, quotas, and team policies without baking them into v0.1.

---

## Versioning

Base path:

`/v1`

Versioning strategy for MVP:

* path-based versioning
* response `meta.version` field included in all successful responses

Current API version:

* `0.1`

---

## Authentication

### MVP approach

The API should support API-key-based authentication, even if disabled in local development.

Expected header:

`Authorization: Bearer <api_key>`

### Local development

Local development may allow auth bypass through environment configuration.

### Out of scope for v0.1

* user identity
* sessions
* OAuth
* workspace auth

---

## Content type

Requests:

* `Content-Type: application/json`

Responses:

* `application/json`

---

## Domain model

### Role

Role describes the work context the rewrite is for.

Allowed values:

* `general`
* `developer`
* `marketer`

### Mode

Mode describes the rewrite strategy to apply.

Allowed values:

* `balanced`
* `tight_scope`
* `high_contrast`
* `low_token_cost`

### Severity

Allowed values:

* `low`
* `medium`
* `high`

---

## Shared object definitions

### PromptContext

Flexible object carrying optional task-specific context.

Initial shape:

```json
{
  "domain": "identity and access management",
  "product": "managed IAM service",
  "audienceHint": "CTOs at mid-sized SaaS companies",
  "runtime": "Node.js",
  "deployment": "AWS Lambda",
  "team": "marketing",
  "systemGoals": ["idempotency", "safe retries"],
  "mustInclude": ["audit readiness"],
  "mustAvoid": ["generic cybersecurity buzzwords"],
  "forbiddenPhrases": ["seamless", "robust", "powerful"]
}
```

Rules:

* object is optional
* all fields are optional in v0.1
* unknown keys may be allowed in v0.1 to avoid over-constraining early usage

### Preferences

Optional object controlling response detail.

Initial shape:

```json
{
  "includeScores": true,
  "includeExplanation": true,
  "includeAlternatives": false,
  "preserveTone": false,
  "maxLength": 800
}
```

Rules:

* object is optional
* all fields are optional
* defaults should be applied server-side

### Issue

Represents one problem detected in the original prompt.

Shape:

```json
{
  "code": "TASK_TOO_BROAD",
  "severity": "high",
  "message": "The task does not define runtime, failure conditions, or implementation boundaries."
}
```

Rules:

* `code`: stable string for client-side handling
* `severity`: `low | medium | high`
* `message`: human-readable explanation

### ScoreSet

All scores are integers from 0 to 10.

Shape:

```json
{
  "scope": 2,
  "contrast": 2,
  "clarity": 4,
  "constraintQuality": 1,
  "genericOutputRisk": 9,
  "tokenWasteRisk": 8
}
```

Scoring guidance:

* higher `scope`, `contrast`, `clarity`, and `constraintQuality` means better prompt quality
* higher `genericOutputRisk` and `tokenWasteRisk` means worse prompt quality

---

## Endpoints

### 1. Health check

#### `GET /v1/health`

Returns service health and version metadata.

##### Request

No body.

##### Response `200`

```json
{
  "status": "ok",
  "meta": {
    "version": "0.1"
  }
}
```

##### Purpose

* uptime checks
* smoke tests
* deployment verification

---

### 2. Analyze prompt

#### `POST /v1/analyze`

Analyzes a prompt and returns deterministic findings without performing a rewrite.

##### Request body

```json
{
  "prompt": "Write a landing page for our IAM service.",
  "role": "marketer",
  "mode": "balanced",
  "context": {
    "product": "managed IAM service",
    "audienceHint": "CTOs at mid-sized SaaS companies"
  },
  "preferences": {
    "includeScores": true,
    "includeExplanation": true
  }
}
```

##### Request rules

* `prompt`: required, non-empty string
* `role`: required enum
* `mode`: required enum
* `context`: optional object
* `preferences`: optional object

##### Response `200`

```json
{
  "id": "anl_01JXYZ...",
  "analysis": {
    "scores": {
      "scope": 3,
      "contrast": 2,
      "clarity": 6,
      "constraintQuality": 1,
      "genericOutputRisk": 8,
      "tokenWasteRisk": 7
    },
    "issues": [
      {
        "code": "AUDIENCE_MISSING",
        "severity": "high",
        "message": "The prompt does not define a target audience."
      },
      {
        "code": "TASK_TOO_BROAD",
        "severity": "high",
        "message": "The request is likely to produce generic output because the task is underspecified."
      }
    ],
    "signals": [
      "No audience specified",
      "No explicit constraints",
      "High likelihood of default SaaS marketing language"
    ],
    "summary": "Broad, low-contrast prompt likely to produce generic output and require reruns."
  },
  "meta": {
    "version": "0.1"
  }
}
```

##### Notes

* `mode` is included because analysis may vary slightly by rewrite strategy later
* in v0.1, analysis should remain mostly deterministic

---

### 3. Rewrite prompt

#### `POST /v1/rewrite`

Rewrites a prompt without returning the full analysis payload.

##### Request body

```json
{
  "prompt": "Write a webhook handler.",
  "role": "developer",
  "mode": "high_contrast",
  "context": {
    "runtime": "Node.js",
    "deployment": "AWS Lambda",
    "systemGoals": ["idempotency", "safe retries", "structured logging"]
  },
  "preferences": {
    "includeExplanation": true,
    "includeAlternatives": true,
    "maxLength": 400
  }
}
```

##### Response `200`

```json
{
  "id": "rwt_01JXYZ...",
  "rewrite": {
    "role": "developer",
    "mode": "high_contrast",
    "rewrittenPrompt": "Write a webhook handler for a high-volume Node.js service running in AWS Lambda. It must be idempotent, safe for retries, reject malformed payloads early, emit structured logs, and avoid class-based design.",
    "explanation": "The rewrite adds runtime context, engineering constraints, and implementation boundaries.",
    "changes": [
      "Specified runtime and deployment model",
      "Added retry and validation requirements",
      "Added implementation exclusions"
    ],
    "alternatives": [
      {
        "mode": "tight_scope",
        "rewrittenPrompt": "Write only the request validation and retry-safety portion of a Node.js Lambda webhook handler. Do not implement downstream business logic."
      }
    ]
  },
  "meta": {
    "version": "0.1"
  }
}
```

##### Notes

* rewrite generation may be mocked in early development
* `alternatives` is optional and controlled by preferences

---

### 4. Analyze and rewrite

#### `POST /v1/analyze-and-rewrite`

Main MVP endpoint.

This endpoint returns both deterministic analysis and rewrite output in a single call.

##### Request body

```json
{
  "prompt": "Write landing page copy for our IAM service.",
  "role": "marketer",
  "mode": "balanced",
  "context": {
    "product": "managed IAM service",
    "audienceHint": "CTOs at mid-sized SaaS companies",
    "mustAvoid": ["generic cybersecurity buzzwords"],
    "forbiddenPhrases": ["seamless", "robust", "powerful"]
  },
  "preferences": {
    "includeScores": true,
    "includeExplanation": true,
    "includeAlternatives": false,
    "preserveTone": false,
    "maxLength": 800
  }
}
```

##### Request validation

###### Required fields

* `prompt`
* `role`
* `mode`

###### Prompt rules

* must be a string
* must be non-empty after trim
* should have a conservative max length in v0.1
* recommended max: 6000 characters for initial implementation

###### Role rules

Must be one of:

* `general`
* `developer`
* `marketer`

###### Mode rules

Must be one of:

* `balanced`
* `tight_scope`
* `high_contrast`
* `low_token_cost`

###### Preferences defaults

If omitted, use:

```json
{
  "includeScores": true,
  "includeExplanation": true,
  "includeAlternatives": false,
  "preserveTone": false
}
```

##### Response `200`

```json
{
  "id": "par_01JXYZ...",
  "analysis": {
    "scores": {
      "scope": 3,
      "contrast": 2,
      "clarity": 6,
      "constraintQuality": 1,
      "genericOutputRisk": 8,
      "tokenWasteRisk": 7
    },
    "issues": [
      {
        "code": "AUDIENCE_MISSING",
        "severity": "high",
        "message": "The prompt does not define a target audience."
      },
      {
        "code": "NO_EXCLUSIONS",
        "severity": "medium",
        "message": "The prompt does not define language, framing, or approaches to avoid."
      }
    ],
    "signals": [
      "No audience specified",
      "No exclusions defined",
      "High likelihood of generic category language"
    ],
    "summary": "Broad, low-contrast prompt likely to produce generic output and require reruns."
  },
  "rewrite": {
    "role": "marketer",
    "mode": "balanced",
    "rewrittenPrompt": "Write landing page copy for a CTO at a mid-sized SaaS company dealing with identity sprawl after acquisitions. Lead with operational control and audit readiness, not fear. Emphasize integration clarity and reduced admin overhead. Avoid generic cybersecurity buzzwords and do not use the words seamless, robust, or powerful.",
    "explanation": "The rewrite narrows the audience, sharpens the business tension, and blocks generic language.",
    "changes": [
      "Defined target audience",
      "Added business tension",
      "Added phrasing exclusions"
    ]
  },
  "meta": {
    "version": "0.1"
  }
}
```

##### Response semantics

* `analysis` should come from deterministic or near-deterministic rules
* `rewrite` may come from a mocked provider initially and a real provider later
* `meta.version` must always be present

---

## Error model

All non-2xx responses should follow a consistent error shape.

### Error body

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Prompt is required.",
    "details": {
      "field": "prompt"
    }
  },
  "meta": {
    "version": "0.1"
  }
}
```

### Error fields

* `code`: stable machine-readable code
* `message`: human-readable explanation
* `details`: optional structured object
* `meta.version`: required

### Initial error codes

* `INVALID_REQUEST`
* `PROMPT_REQUIRED`
* `PROMPT_TOO_LONG`
* `INVALID_ROLE`
* `INVALID_MODE`
* `UNSUPPORTED_CONTENT_TYPE`
* `UNAUTHORIZED`
* `RATE_LIMITED`
* `UPSTREAM_MODEL_ERROR`
* `INTERNAL_ERROR`

### Suggested status mapping

* `400` invalid request, missing fields, bad enums
* `401` unauthorized
* `415` unsupported content type
* `429` rate limited
* `502` rewrite provider failure
* `500` internal server error

---

## Deterministic analysis specification

The analysis service should produce the following fields.

### Scores

Required fields:

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

All values:

* integer
* min `0`
* max `10`

### Issues

Array of Issue objects.

Initial supported issue codes:

* `PROMPT_TOO_SHORT`
* `TASK_TOO_BROAD`
* `AUDIENCE_MISSING`
* `NO_CONSTRAINTS`
* `NO_EXCLUSIONS`
* `LOW_CONTRAST`
* `MULTIPLE_JOBS_IN_ONE_PROMPT`
* `HIGH_GENERIC_OUTPUT_RISK`
* `HIGH_TOKEN_WASTE_RISK`

### Signals

Array of short strings highlighting notable findings.

Rules:

* max 12 items recommended
* short, UI-friendly language

### Summary

Single sentence or short paragraph summarising the main quality concerns.

---

## Rewrite specification

The rewrite service should produce the following fields.

### Required rewrite fields

* `role`
* `mode`
* `rewrittenPrompt`

### Optional rewrite fields

* `explanation`
* `changes`
* `alternatives`

### Rewrite rules

The rewrite engine must:

* preserve original user intent
* narrow scope when required by mode
* increase contextual contrast when required by mode
* avoid inventing unsupported product or system facts
* use context inputs when provided
* keep output in plain text

### Mode expectations

#### `balanced`

* improve clarity and usefulness
* make moderate improvements to scope and contrast
* avoid making the prompt much longer than needed

#### `tight_scope`

* narrow the task aggressively
* reduce breadth and ambiguity
* introduce boundaries and exclusions

#### `high_contrast`

* strengthen differences in audience, constraints, context, and angle
* reduce default-pattern output

#### `low_token_cost`

* keep prompt concise
* preserve core constraints only
* optimise for shorter prompt length without becoming vague

### Alternatives

If `preferences.includeAlternatives` is true, the API may return up to 3 alternatives.

Alternative shape:

```json
{
  "mode": "tight_scope",
  "rewrittenPrompt": "Write only the request validation and retry-safety portion of a Node.js Lambda webhook handler. Do not implement downstream business logic."
}
```

---

## Response identifiers

Each successful non-health response should include an `id`.

Suggested prefixes:

* `anl_` for analyze
* `rwt_` for rewrite
* `par_` for analyze-and-rewrite

Rules:

* string
* unique per response
* tracing and debugging aid only

---

## Rate limiting

### MVP recommendation

Implement simple API-level rate limiting at gateway or edge level.

### Response on limit

Status `429`

Body:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Please try again later."
  },
  "meta": {
    "version": "0.1"
  }
}
```

Out of scope for v0.1:

* usage accounting
* quota dashboards
* billing integration

---

## Observability requirements

The service should log enough information to debug failures without storing sensitive prompt content unnecessarily.

### Log recommendations

Log:

* request id
* endpoint
* role
* mode
* response status
* latency
* rewrite provider status

Avoid logging full raw prompts by default in production.

---

## Implementation guidance

### Shared package requirements

The following should be defined in shared schemas:

* role enum
* mode enum
* issue schema
* score schema
* analyze request/response schemas
* rewrite request/response schemas
* analyze-and-rewrite request/response schemas
* error schema

### Heuristics package requirements

The heuristics engine should:

* be independent from rewrite provider logic
* be deterministic for the same inputs
* return stable issue codes
* be unit tested

### Rewrite provider abstraction

The API should depend on a rewrite interface rather than a specific provider.

Example shape:

```ts
interface RewriteEngine {
  rewrite(input: RewriteInput): Promise<RewriteResult>
}
```

This allows v0.1 to start with a mock implementation and later switch to a real provider.

---

## Out of scope for v0.1

Do not include these in the initial implementation:

* auth beyond API key support
* user accounts
* persistence of prompt history
* workspaces
* billing
* batch APIs
* async rewrite jobs
* webhooks
* policy packs
* prompt templates API

---

## Recommended implementation order

1. Define shared schemas and types.
2. Implement `/v1/health`.
3. Implement `/v1/analyze` using deterministic heuristics only.
4. Implement `/v1/rewrite` using a mock rewrite engine.
5. Implement `/v1/analyze-and-rewrite` as the composition endpoint.
6. Add gateway auth and rate limiting.
7. Swap mock rewrite engine for a real provider.

---

## Example TypeScript contract sketch

```ts
export type Role = 'general' | 'developer' | 'marketer';
export type Mode = 'balanced' | 'tight_scope' | 'high_contrast' | 'low_token_cost';

export interface AnalyzeAndRewriteRequest {
  prompt: string;
  role: Role;
  mode: Mode;
  context?: Record<string, unknown>;
  preferences?: {
    includeScores?: boolean;
    includeExplanation?: boolean;
    includeAlternatives?: boolean;
    preserveTone?: boolean;
    maxLength?: number;
  };
}
```

---

## Summary

PromptFire v0.1 should expose a small, clear API with four endpoints:

* `GET /v1/health`
* `POST /v1/analyze`
* `POST /v1/rewrite`
* `POST /v1/analyze-and-rewrite`

The main product workflow should be built around `POST /v1/analyze-and-rewrite`, while the other endpoints provide clean internal and external boundaries for spec-driven implementation.
