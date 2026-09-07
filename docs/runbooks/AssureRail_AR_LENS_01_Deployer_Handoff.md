# AssureRail AR-LENS-01 deployer handoff

**Status:** build handoff only; do not deploy or enable without a separate instruction
**Date:** 7 September 2026

## Purpose and boundary

AR-LENS-01 is a small optional provider adapter. It verifies a signed AssureLens monitoring package
and maps it into AssureRail's ordinary certified, provider-neutral evidence intake. AssureRail does
not import AssureLocker code, query its database, share a secret/private signing key, rely on its
identity system or give AssureLens privileged assurance status.

Every accepted package is persisted as `REVIEW_REQUIRED`, regardless of the provider result. It
cannot make a credit decision, claim total borrower indebtedness, automatically restrict a case or
change a transaction state. Raw PAN, GSTIN, CIN, LLPIN, Udyam, LEI and DID values are rejected.

## Deployment posture

The new module is absent unless all four conditions are true:

```text
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_LENS_MONITORING_CONNECTOR_V1=shadow
```

Ship with the last flag explicitly `off`. There is deliberately no `on`, `live` or `production`
value in AR-LENS-01.

`ARAIL_ASSURELENS_TRUSTED_KEYS_JSON` must be a secret-manager value containing 1–20 independently
verified public keys:

```json
[
  {
    "providerId": "assurelens.assurelocker",
    "keyId": "<32-character SPKI SHA-256 prefix>",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
]
```

Only the public key crosses the organisational boundary. Establish its fingerprint through a
separate security channel; do not copy it from the same API payload being verified.

## Shadow enablement prerequisites

1. AssureRail DB-mode authentication and institution/session context are working.
2. The provider reference and connector registration exist for the institution.
3. The connector has passed conformance and a different authorised reviewer has approved the
   `assurelens.monitoring-evidence.v1` profile for schema `assurerail.neutral-intake/1.0.0`.
4. The target Rail case exists and the active institution is an accepted participant.
5. The trusted-key fingerprint has been checked out of band.
6. The AssureLens package is active, unexpired and produced in an approved replay/shadow context.

## Required smoke tests at shadow enablement

- valid signed package → neutral intake/evidence version, provider result retained, Rail result
  `REVIEW_REQUIRED`;
- repeated identical package → idempotent replay with no duplicate evidence/version;
- changed payload under the same signature/digest → rejected;
- unknown/rotated/revoked key, invalid signature and expired/revoked package → rejected;
- inconsistent coverage arithmetic or a `VERIFIED` result over incomplete/adverse evidence →
  rejected;
- raw identifier in any output field → rejected;
- inactive member, wrong active institution, non-participant case or uncertified connector →
  rejected; and
- accepted provider finding does not transition, suspend or restrict the Rail case.

## Rollback

Set `ARAIL_LENS_MONITORING_CONNECTOR_V1=off` and restart the API. The module and route then do not
mount. Retain already ingested evidence and audit history; do not delete or rewrite it. Key
compromise requires flag-off, trust-list removal, package impact review and provider notification.

## Open gates

Build/type/unit checks do not close authenticated two-tenant E2E/DAST, independent VAPT, real
provider-key ceremony, connector conformance, customer data-rights, case-specific monitoring scope
or operating acceptance. These remain activation gates rather than synthetic passes.
