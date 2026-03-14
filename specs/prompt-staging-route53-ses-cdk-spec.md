# PeakPrompt Staging Route53 and SES CDK Spec v0.1

## Status

Draft

## Objective

Define the infrastructure required to support a **staging environment** for PeakPrompt ([docs.aws.amazon.com](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/CreatingNewSubdomain.html?utm_source=chatgpt.com))ES for email sending

* AWS CDK for infrastructure as code

This spec is focused on the minimum infrastructure needed to support:

* a staging DNS boundary
* SES-based email sending for staging
* future magic-link authentication emails from staging

It does **not** cover application runtime resources in detail beyond the DNS and email assumptions needed to support staging.

---

## Summary of decisions

* Primary root domain: `peakprompt.ai`
* Production/public product path strategy: `https://peakprompt.ai/app/`
* Staging should use a separate subdomain boundary
* DNS should be managed in Route 53
* Email sending for staging should use Amazon SES
* Infrastructure should be defined in AWS CDK

---

## Recommended staging naming

### Preferred staging host pattern

Use:

* `staging.peakprompt.ai`

Optional application paths:

* `https://staging.peakprompt.ai/`
* `https://staging.peakprompt.ai/app/`

### Preferred sender identities

Use a domain-level SES identity for:

* `staging.peakprompt.ai`

Recommended sender addresses:

* `login@staging.peakprompt.ai`
* `no-reply@staging.peakprompt.ai`

This keeps staging mail clearly separated from production mail.

---

## Goals

* Create a Route 53 public hosted zone for staging.
* Delegate the staging subdomain from the root domain.
* Configure SES for staging email sending.
* Enable DKIM for staging email.
* Support branded staging auth emails for future magic-link flows.
* Keep the design simple and easy to promote later.

## Non-goals

* Full production infrastructure.
* App runtime/CDN/load balancer design.
* Inbound mail handling.
* Multi-region email routing.
* Enterprise email deliverability tuning.
* Custom MAIL FROM domain in the first pass unless needed.

---

## High-level architecture

### DNS model

The root domain remains:

* `peakprompt.ai`

Staging lives under a delegated subdomain:

* `staging.peakprompt.ai`

Recommended Route 53 model:

1. Root hosted zone for `peakprompt.ai`
2. Child public hosted zone for `staging.peakprompt.ai`
3. NS delegation record in the root zone pointing to the staging zone name servers

This gives staging a clean DNS boundary and reduces the chance of mixing staging records into the root zone.

### SES model

Use SES with a **domain identity** for:

* `staging.peakprompt.ai`

Enable:

* domain verification
* Easy DKIM

This allows emails to be sent from addresses such as:

* `login@staging.peakprompt.ai`
* `no-reply@staging.peakprompt.ai`

---

## Why use a delegated staging subdomain

Using a delegated subdomain for staging gives several benefits:

* clear separation from production DNS
* simpler isolation of email/DKIM records
* lower risk of accidental production record changes
* easier future account/environment separation
* cleaner sender reputation boundaries between staging and production

---

## CDK scope

Create a dedicated CDK stack for staging DNS and SES.

Suggested stack names:

* `PeakPromptDnsRootStack` (if not already present)
* `PeakPromptStagingDnsStack`
* `PeakPromptStagingEmailStack`

If preferred, staging DNS and SES can be combined into a single stack:

* `PeakPromptStagingInfraStack`

Recommended separation:

* DNS stack manages Route 53 zones and records
* Email stack manages SES identity resources and any SES-related DNS records

---

## Route 53 specification

### 1. Root hosted zone

The root hosted zone should exist for:

* `peakprompt.ai`

If it does not already exist in Route 53, create it first.

This zone remains the authority for the root domain.

### 2. Staging hosted zone

Create a **public hosted zone** for:

* `staging.peakprompt.ai`

This hosted zone becomes authoritative for all staging DNS records.

### 3. NS delegation from root to staging

Create an NS record in the root zone:

* record name: `staging.peakprompt.ai`
* record type: `NS`
* values: the name servers assigned to the staging hosted zone

This delegates control of the subdomain to the staging hosted zone.

### 4. Staging DNS records

The staging hosted zone should own records such as:

* app/API aliases or CNAMEs
* SES verification records
* DKIM CNAME records
* any TXT records specific to staging

Do not place staging-specific records in the root zone once delegation is in place.

---

## SES specification

### 1. SES region

Choose a single SES region for staging.

Recommendation:

* keep SES in the same region as the staging app infrastructure when practical
* use one region consistently for identity management and sending

This region choice must be reflected in:

* SES identity creation
* IAM permissions
* runtime environment configuration

### 2. SES identity type

Create a **domain identity** for:

* `staging.peakprompt.ai`

Do not begin with individual email-address verification only.

Reasons:

* supports multiple sender addresses
* aligns better with magic-link auth emails
* avoids manual re-verification for each mailbox

### 3. DKIM

Enable **Easy DKIM** for the staging identity.

This should publish the required DKIM CNAME records into the staging hosted zone.

### 4. MAIL FROM

Custom MAIL FROM is optional for the first pass.

Recommendation:

* do not require custom MAIL FROM in v0.1 unless there is a specific deliverability or branding reason
* revisit once production sending is introduced

### 5. Sandbox status

Staging SES may initially be in the SES sandbox.

If so:

* only verified addresses can receive mail
* staging magic-link testing will be constrained

Recommendation:

* plan for sandbox-aware testing initially
* request production access for SES when the staging auth flow needs realistic external delivery

---

## CDK implementation requirements

### Route 53 resources

CDK should provision:

* root zone lookup or import for `peakprompt.ai`
* public hosted zone for `staging.peakprompt.ai`
* NS delegation record in the root zone

### SES resources

CDK should provision:

* SES domain identity for `staging.peakprompt.ai`
* DKIM configuration
* required Route 53 records for SES verification and DKIM where supported by the chosen constructs

### Outputs

CDK should output at least:

* root zone ID or confirmation of imported root zone
* staging hosted zone ID
* staging hosted zone name servers
* staging SES identity domain
* sender domain used for staging

---

## Suggested CDK package structure

### Recommended location

Use:

* `infra/`

Suggested folders/files:

* `infra/lib/root-dns-stack.ts`
* `infra/lib/staging-dns-stack.ts`
* `infra/lib/staging-email-stack.ts`
* `infra/bin/infra.ts`

If the repo stays minimal, a simpler structure is acceptable.

### Suggested construct boundaries

#### Root DNS construct

Responsibilities:

* import or look up root zone
* expose root zone attributes for child stacks

#### Staging DNS construct

Responsibilities:

* create staging hosted zone
* create delegation record in root zone

#### Staging Email construct

Responsibilities:

* create SES identity for staging domain
* configure DKIM
* publish or manage SES-related DNS records

---

## Environment assumptions

### Staging environment variables

Expected runtime configuration later should include:

* `APP_BASE_URL=https://staging.peakprompt.ai/app`
* `EMAIL_FROM=login@staging.peakprompt.ai`
* SES region configuration

Optional:

* `EMAIL_REPLY_TO`
* `EMAIL_CONFIGURATION_SET`

### Path strategy

Staging should mirror the production path model where practical.

Recommended staging app URLs:

* `https://staging.peakprompt.ai/`
* `https://staging.peakprompt.ai/app/`
* `https://staging.peakprompt.ai/app/auth/callback`

This keeps staging behavior close to production.

---

## Security and operational requirements

### DNS isolation

* Keep staging records inside the staging hosted zone.
* Avoid mixing staging records into the root zone except for NS delegation.

### Email isolation

* Use staging-only sender addresses.
* Do not send production-branded auth mail from production sender addresses during staging.

### IAM

Grant only the permissions needed for:

* Route 53 hosted zone changes in the relevant zones
* SES identity management in the chosen SES region
* future SES send permissions for the staging application runtime

### Secrets

SES sending should rely on IAM-backed runtime access where possible instead of long-lived SMTP credentials.

---

## Deployment sequence

### Phase 1 — root DNS readiness

1. Confirm `peakprompt.ai` is hosted in Route 53.
2. If not, create/import the root hosted zone.
3. Confirm CDK can look up or import the root zone safely.

### Phase 2 — staging DNS

1. Create public hosted zone for `staging.peakprompt.ai`.
2. Add NS delegation in the root hosted zone.
3. Verify DNS resolution for the staging subdomain.

### Phase 3 — SES identity

1. Create SES domain identity for `staging.peakprompt.ai` in the selected region.
2. Publish SES verification and DKIM records into the staging hosted zone.
3. Wait for SES verification to complete.
4. Confirm DKIM status is successful.

### Phase 4 — sender validation

1. Set `EMAIL_FROM` to a sender on the staging domain.
2. Send a staging smoke-test email.
3. Confirm headers show expected SES/DKIM behavior.

---

## Acceptance criteria

The staging DNS and SES setup is complete when all of the following are true:

* `staging.peakprompt.ai` has its own public hosted zone
* the subdomain is delegated from `peakprompt.ai`
* SES has a verified domain identity for `staging.peakprompt.ai`
* DKIM is enabled and verified
* a sender such as `login@staging.peakprompt.ai` can be used for test mail
* the chosen app base URL for staging can be configured consistently

---

## Risks and caveats

* SES sandbox restrictions may limit realistic auth testing until production access is granted.
* DNS propagation for delegation and SES verification may not be immediate.
* If the root domain is not already managed in Route 53, the root setup step may be larger than expected.
* CDK support for fully automatic SES DNS publishing may vary depending on the construct/version used; be prepared to create Route 53 records explicitly if needed.

---

## Out-of-scope follow-ups

These are logical next steps but are not part of this spec:

* staging app certificate and HTTPS setup
* CloudFront or ALB routing for staging
* staging API custom domain
* production SES identity for `peakprompt.ai`
* bounce/complaint handling via SNS
* SES configuration sets and event destinations
* DMARC/SPF policy tuning for production deliverability

---

## Recommendation

Proceed with a delegated staging subdomain design:

* root domain: `peakprompt.ai`
* staging subdomain: `staging.peakprompt.ai`
* Route 53 public hosted zone for staging
* NS delegation from the root zone
* SES domain identity for `staging.peakprompt.ai`
* Easy DKIM enabled
* CDK-managed infrastructure for all of the above

This is the smallest clean staging setup that keeps DNS and email isolated while staying aligned with the future PeakPrompt auth system.
