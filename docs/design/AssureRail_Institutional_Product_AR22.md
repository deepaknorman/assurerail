# AssureRail institutional productisation — AR-22

**Status:** implemented for internal review under EX-28; not deployed or activated
**Date:** 2 September 2026
**Operating boundary:** `REPLAY` / `SHADOW` only

## 1. Product outcome

AR-22 turns the earlier institution, admission, membership, mandate, appointment and connector
registers into one institution journey. It adds governed records for identity-federation proposals,
service identities, periodic access reviews and exit plans. The customer workspace shows all ten
stages without presenting a partial record as admission or operating authority.

The stage deliberately separates recording from activation:

- a SAML/OIDC proposal stores configuration metadata and its digest, not an identity-provider
  secret, and `SHADOW_APPROVED` does not authenticate anyone;
- a service-identity proposal stores a credential fingerprint and a pending vault reference, never
  credential material, and remains denied by the existing authenticator unless separately made
  `ACTIVE` in a later authorised integration stage;
- an approved access review records an independent conclusion but changes no membership, mandate,
  entitlement or credential; and
- an approved exit plan schedules and evidences intent but does not suspend access, revoke authority,
  delete evidence or terminate an in-flight case.

## 2. Journey and authority model

The overview exposes these independently evaluated stages: application, evidence, admission,
membership, authority, appointments, connectors, identity/access, recertification and exit.
`COMPLETE`, `CONDITIONAL`, `SHADOW_READY`, `MONITORED`, `PLANNED` and similar display states are read
projections only. They cannot grant a route function or satisfy an external gate.

Every write requires:

1. an authenticated Rail session whose active institution matches the path;
2. the exact institution mandate action;
3. a purpose-bound, unconsumed step-up record;
4. maker/checker separation for review;
5. a conditional update for concurrent-review safety; and
6. a governed audit append in the same database transaction.

The four new actions are `MANAGE_IDENTITY_CONNECTIONS`, `MANAGE_SERVICE_IDENTITIES`,
`MANAGE_ACCESS_REVIEWS` and `MANAGE_PARTICIPANT_EXIT`. Shadow service identities are limited to
bounded integration/read actions; human governance ceremonies cannot be delegated to them.

## 3. Data and API boundary

New durable records are `InstitutionIdentityConnection`, `InstitutionAccessReview` and
`InstitutionExitPlan`. `InstitutionServicePrincipal` gains display, fingerprint and maker/checker
provenance. Natural references are unique and duplicate submissions return a conflict. Foreign keys
use restrictive deletion so institutional history cannot disappear with a parent delete.

The institution-scoped API is rooted at:

```text
/v1/rail/institutions/:institutionId/product
```

It provides the overview plus propose/review commands for the four governed record families.
Suspension and revocation continue through the existing general governance proposal/review API so
there remains one status-change authority path. That path permits shadow access targets to be
suspended or revoked but does not permit generic `REINSTATE` to turn one into an active login.

## 4. Deliberately rejected shortcuts

- Treating an identity-provider metadata digest as verified SSO connectivity.
- Accepting client secrets, certificates, private keys or bearer tokens in the product API.
- Making `SHADOW_APPROVED` authenticate or authorise a service identity.
- Using a readiness stage as participant admission or route entitlement.
- Allowing a maker to approve their own access, review or exit proposal.
- Letting access-review approval mutate the authority being reviewed.
- Treating an exit plan as executed suspension, evidence deletion or case termination.
- Calling connector schema conformance counterparty acceptance or certification.

## 5. Dependencies and remaining work

`ARAIL_INSTITUTIONAL_PRODUCT_V1=shadow` requires hosted alpha, participant admission and developer
integration in shadow, internal RBAC enabled, and a `REPLAY` or `SHADOW` runtime. It has no
controlled-live or production capability ID.

Real SAML/OIDC metadata retrieval, signature validation, domain control, login mapping and provider
acceptance belong to AR-29. Secret issuance/rotation and an active service-credential ceremony also
belong there. Customer workflow acceptance, accessibility, VAPT, multi-institution negative tests,
recertification operations and an executed exit rehearsal remain external or later-stage gates.
