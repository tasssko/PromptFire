# Promptable
# Promptable Starter Specification

## Goal

Create a clean MVP foundation for Promptable as a monorepo with:

* a web frontend
* a serverless API on AWS
* shared schemas and types
* a heuristics package for deterministic prompt analysis
* infrastructure as code

This spec is designed so the repo can be bootstrapped directly from a blank state.

---

## Product scope for MVP

Promptable is a service that:

1. accepts a prompt
2. analyzes it for scope, contrast, clarity, and likely generic-output risk
3. rewrites it using a role and mode
4. returns structured feedback and a rewritten prompt

Initial target roles:

* `general`
* `developer`
* `marketer`

Initial rewrite modes:

* `balanced`
* `tight_scope`
* `high_contrast`
* `low_token_cost`

Initial primary endpoint:

* `POST /v1/analyze-and-rewrite`

---

## Technical approach

### Monorepo

Use a monorepo so frontend and backend stay separate but share schemas and types.

### AWS serverless backend

Use Lambda behind API Gateway HTTP API.

### TypeScript everywhere

Use TypeScript across apps and packages.

### Shared validation

Use Zod for request and response schemas.

### Infrastructure as code

Use AWS CDK in TypeScript.

---

## Recommended stack

### Package manager

* `pnpm`

### Monorepo tooling

* `turbo`

### Frontend

* `Next.js`
* `TypeScript`
* `Tailwind CSS`

### Backend

* `AWS Lambda`
* `Node.js 22.x runtime`
* `API Gateway HTTP API`
* lightweight handler structure

### Shared packages

* `zod`
* shared TypeScript config and lint config if needed later

### Infrastructure

* `aws-cdk-lib`
* `constructs`

### Quality

* `eslint`
* `prettier`
* `vitest`

---

## Repository layout

```text
repo/
  apps/
    web/
    api/
  packages/
    shared/
    heuristics/
  infra/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  .gitignore
  .editorconfig
  README.md
```

---

## Package responsibilities

### `apps/web`

User-facing app.

Responsibilities:

* prompt input UI
* role and mode selection
* show analysis results
* show rewritten prompt
* copy actions
* basic auth later if needed

Suggested pages for MVP:

* `/`
* optional `/api-docs` later

### `apps/api`

Serverless API handlers.

Responsibilities:

* request parsing
* schema validation
* call heuristics package
* call rewrite engine
* return structured response

Suggested structure:

```text
apps/api/
  src/
    handlers/
      analyze-and-rewrite.ts
    services/
      analysis.ts
      rewrite.ts
    lib/
      response.ts
      env.ts
  package.json
  tsconfig.json
```

### `packages/shared`

Shared schemas and types.

Responsibilities:

* request schemas
* response schemas
* enums for role and mode
* inferred TypeScript types

Suggested structure:

```text
packages/shared/
  src/
    prompt.ts
    analysis.ts
    rewrite.ts
    index.ts
  package.json
  tsconfig.json
```

### `packages/heuristics`

Deterministic analysis logic.

Responsibilities:

* score prompt scope
* score contrast
* detect missing constraints
* detect likely generic-output risk
* produce issue codes and signals

Suggested structure:

```text
packages/heuristics/
  src/
    analyzePrompt.ts
    rules/
      scope.ts
      contrast.ts
      clarity.ts
      genericRisk.ts
      tokenWaste.ts
    issues.ts
    index.ts
  package.json
  tsconfig.json
```

### `infra`

AWS infrastructure.

Responsibilities:

* Lambda function
* API Gateway HTTP API
* environment variable wiring
* IAM permissions
* optional CloudWatch log groups

Suggested structure:

```text
infra/
  bin/
    infra.ts
  lib/
    promptfire-stack.ts
  cdk.json
  package.json
  tsconfig.json
```

---

## Initial domain model

### Roles

* `general`
* `developer`
* `marketer`

### Modes

* `balanced`
* `tight_scope`
* `high_contrast`
* `low_token_cost`

### Example request

```json
{
  "prompt": "Write a webhook handler.",
  "role": "developer",
  "mode": "tight_scope",
  "context": {
    "runtime": "Node.js",
    "deployment": "AWS Lambda"
  },
  "preferences": {
    "includeScores": true,
    "includeExplanation": true,
    "includeAlternatives": false
  }
}
```

### Example response

```json
{
  "analysis": {
    "scores": {
      "scope": 2,
      "contrast": 2,
      "clarity": 4,
      "constraintQuality": 1,
      "genericOutputRisk": 9,
      "tokenWasteRisk": 8
    },
    "issues": [
      {
        "code": "TASK_TOO_BROAD",
        "severity": "high",
        "message": "The task does not define runtime, failure conditions, or implementation boundaries."
      }
    ],
    "summary": "This prompt is likely to produce a generic implementation."
  },
  "rewrite": {
    "role": "developer",
    "mode": "tight_scope",
    "rewrittenPrompt": "Write only the request validation and retry-safety portion of a Node.js Lambda webhook handler. Do not implement downstream business logic.",
    "explanation": "The rewrite narrows scope and adds implementation boundaries.",
    "changes": [
      "Reduced task breadth",
      "Added implementation boundary"
    ]
  },
  "meta": {
    "version": "0.1"
  }
}
```

---

## API design for MVP

### Endpoint

`POST /v1/analyze-and-rewrite`

### Request fields

* `prompt`: string, required
* `role`: enum, required
* `mode`: enum, required
* `context`: object, optional
* `preferences`: object, optional

### Validation rules

* `prompt` must be non-empty
* `prompt` length limit should be set conservatively for MVP
* `role` must be valid
* `mode` must be valid

### Error response shape

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Prompt is required."
  }
}
```

---

## Heuristics engine responsibilities

The heuristics package should not depend on the LLM.

It should:

* inspect the prompt text
* inspect optional context fields
* generate deterministic findings
* assign scores from 0 to 10
* emit stable issue codes

### First issue codes

* `PROMPT_TOO_SHORT`
* `TASK_TOO_BROAD`
* `AUDIENCE_MISSING`
* `NO_CONSTRAINTS`
* `NO_EXCLUSIONS`
* `LOW_CONTRAST`
* `MULTIPLE_JOBS_IN_ONE_PROMPT`
* `HIGH_GENERIC_OUTPUT_RISK`
* `HIGH_TOKEN_WASTE_RISK`

### First score dimensions

* `scope`
* `contrast`
* `clarity`
* `constraintQuality`
* `genericOutputRisk`
* `tokenWasteRisk`

---

## Rewrite engine responsibilities

For MVP, the rewrite service can be abstracted behind an interface.

Example:

```ts
export interface RewriteEngine {
  rewrite(input: RewriteInput): Promise<RewriteResult>
}
```

This keeps the API independent from the initial LLM provider choice.

The rewrite engine should:

* preserve original intent
* reduce breadth when mode requires it
* increase useful contrast when mode requires it
* avoid inventing product facts not supplied by the user
* return an explanation and list of changes

---

## Frontend MVP behaviour

### Main page

Single-page interface with:

* prompt textarea
* role selector
* mode selector
* optional context fields later
* submit button
* analysis panel
* rewrite panel

### MVP user flow

1. user enters prompt
2. user selects role
3. user selects mode
4. user submits
5. app calls API
6. results render
7. user copies rewritten prompt

### Nice additions after MVP

* before/after diff
* saved prompt history
* copy explanation
* alternative modes
* prompt score badge

---

## Infrastructure scope for MVP

### AWS resources

* one Lambda function for API
* one API Gateway HTTP API
* IAM role for Lambda
* CloudWatch logs
* environment variables for rewrite provider config

### Optional later

* custom domain
* WAF
* Cognito or other auth
* SQS for async rewrite jobs
* DynamoDB for saved prompt history

---

## Environment variables

### API app

* `REWRITE_PROVIDER`
* `REWRITE_MODEL`
* `REWRITE_API_KEY`
* `NODE_ENV`

### Web app

* `NEXT_PUBLIC_API_BASE_URL`

---

## Delivery plan

### Phase 1: repository bootstrap

* initialize monorepo
* set up pnpm workspace
* set up turbo
* create apps and packages
* add TypeScript base config

### Phase 2: shared contracts

* define role and mode enums
* define request and response Zod schemas
* export inferred types

### Phase 3: heuristics engine

* implement first scoring rules
* implement issue detection
* add tests

### Phase 4: API

* build analyze-and-rewrite handler
* wire shared validation
* stub rewrite engine
* return mock rewrite initially

### Phase 5: frontend

* build single-page UI
* integrate endpoint
* render scores, issues, and rewrite

### Phase 6: infrastructure

* provision API Gateway and Lambda with CDK
* deploy API
* connect frontend env

### Phase 7: real rewrite provider

* implement provider adapter
* add retries and error handling
* track latency and failures

---

## Recommended first milestones

### Milestone 1

Bootstrapped repo with:

* monorepo structure
* working web app
* working API app
* shared package
* heuristics package

### Milestone 2

`POST /v1/analyze-and-rewrite` works with deterministic analysis and mocked rewrite output.

### Milestone 3

Real rewrite provider connected.

### Milestone 4

Deployed MVP on AWS with working frontend and backend.

---

## Open questions to leave until later

Do not block MVP on these:

* authentication
* billing
* usage quotas
* saved prompt history
* team workspaces
* analytics dashboards
* viral sharing features
* lead capture flow

Those can come after the core loop is proven.

---

## Practical instruction for code generation tools

If using Codex or another coding agent, start by generating only:

1. monorepo bootstrap
2. shared schemas and enums
3. heuristics package with stubbed rules
4. API handler with mocked rewrite output
5. basic frontend form and result rendering
6. CDK stack for Lambda and API Gateway HTTP API

Do not generate authentication, billing, or persistence in the first pass.

---

## Summary

Build PromptFire as a TypeScript monorepo with a Next.js frontend, AWS Lambda API, shared schemas, deterministic heuristics, and CDK infrastructure.

Keep the MVP narrow:

* one main endpoint
* one page
* deterministic analysis first
* rewrite engine abstracted behind an interface
* deploy early

---

## Not in v0.1

The following are explicit non-goals for v0.1 and must not be added during bootstrap:

* user accounts
* saved prompt history
* team workspaces
* billing/quota accounting
* persistence
* prompt templates
* share links
* analytics dashboards
