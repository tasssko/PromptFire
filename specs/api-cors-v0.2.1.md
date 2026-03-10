# PromptFire Spec v0.2.1 — CORS and Preflight Support

## Summary

Track the CORS fix required for frontend-to-API communication in both local development and deployed infrastructure.

This change ensures browser requests to PromptFire API endpoints succeed by:

- returning CORS headers on all API responses (success and error)
- handling `OPTIONS` preflight requests
- configuring API Gateway HTTP API CORS at the infra layer

---

## Problem

The frontend was blocked by browser CORS policy when calling:

- `POST /v1/analyze-and-rewrite`
- `GET /v1/health`

Observed behavior:

- preflight (`OPTIONS`) requests failed or returned without required CORS headers
- non-2xx API responses lacked CORS headers, causing browser-side opaque CORS failures

---

## Scope

### In scope

- API-layer CORS headers for all responses
- `OPTIONS` preflight response handling
- Infra-level CORS settings for deployed HTTP API
- environment configuration for allowed origins
- tests for preflight + CORS response behavior

### Out of scope

- auth redesign
- endpoint contract redesign
- provider logic changes beyond existing v0.2 work
- persistence, billing, quotas, analytics

---

## Functional requirements

1. API server must return CORS headers on:
- successful responses
- error responses
- preflight responses

2. API server must handle `OPTIONS` requests with status `204`.

3. Required CORS headers:
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`
- `Access-Control-Max-Age`

4. Allowed methods must include:
- `GET`
- `POST`
- `OPTIONS`

5. Allowed headers must include:
- `content-type`
- `authorization`
- `x-request-id`

6. Configurable origin behavior:
- `API_CORS_ALLOW_ORIGIN` env var supports `*` or comma-separated origins.

7. Infra must configure API Gateway HTTP API CORS for deployed routes.

---

## Implementation notes

### API layer

- Introduce reusable CORS header builder in HTTP response utility.
- Ensure `jsonResponse()` and `errorResponse()` include CORS headers.
- Add empty preflight response helper for `OPTIONS`.
- In router, short-circuit `OPTIONS` to `204`.

### Infra layer

- Configure `Api` construct CORS with:
  - `allowOrigins: ['*']`
  - `allowMethods: ['GET', 'POST', 'OPTIONS']`
  - `allowHeaders: ['content-type', 'authorization', 'x-request-id']`

### Configuration

Add env var to examples:

- `API_CORS_ALLOW_ORIGIN=*`

---

## Testing requirements

### API tests

1. `OPTIONS /v1/analyze-and-rewrite` returns `204` and CORS headers.
2. `GET /v1/health` includes CORS headers.
3. Error responses (e.g. validation failure) include CORS headers.

### Regression checks

- Existing v0.2 tests still pass for:
  - mock mode
  - real mode happy path (with mocked provider boundary)
  - provider configuration failures

---

## Acceptance criteria

Change is complete when:

1. Frontend can call API from browser without CORS errors in local dev.
2. Preflight succeeds for API POST calls.
3. Deployed API returns proper CORS behavior after infra deploy.
4. API tests validate preflight and CORS headers.

---

## Changelog reference

- Version: `v0.2.1`
- Type: patch-level operational fix
- Primary impact: reliability of browser integration, no breaking API contract changes
