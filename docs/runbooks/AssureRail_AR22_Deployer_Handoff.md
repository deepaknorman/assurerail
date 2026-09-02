# AssureRail AR-22 deployer handoff

**Authority:** EX-28 authorises implementation, commit and push. It does not authorise deployment or
activation.

## 1. Default posture

Leave the feature dark:

```text
ARAIL_INSTITUTIONAL_PRODUCT_V1=off
NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1=off
```

The web value is a build argument. The API module is not mounted while off. Run the standard
database migration script before starting the new image; it now includes the AssureRail venue
schema.

## 2. Later shadow preparation

Only after separate deployment/activation instruction, use a `SHADOW` environment with:

```text
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_INTERNAL_RBAC_V1=shadow
ARAIL_DEVELOPER_PORTAL_V1=shadow
ARAIL_HOSTED_ALPHA_V1=shadow
ARAIL_INSTITUTIONAL_PRODUCT_V1=shadow
NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=shadow
NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1=shadow
```

Retain all existing authentication, database and customer-workspace prerequisites. Do not make a
service principal `ACTIVE`, install identity-provider secrets, or route logins to a proposed
connection in this stage.

## 3. Smoke checks after an authorised deployment

1. Confirm venue migrations are current, then confirm `/healthz` and `/readyz`.
2. With flags off, verify the product API is not mounted and the institution page reports disabled.
3. In an approved shadow build, verify institution A cannot address institution B's product path.
4. Verify a member missing each exact new action cannot see or invoke that record family.
5. Verify maker/checker rejection and consumed/expired/wrong-purpose step-up rejection.
6. Verify a duplicate connection key, client ID, review reference and exit reference returns `409`.
7. Verify approval produces `SHADOW_APPROVED`/`APPROVED` records but does not authenticate a user or
   service identity, change authority, revoke access or execute exit.
8. Verify responses and logs contain no credential material, vault location or step-up identifier.
9. Verify pending records appear in the hosted-alpha action centre only for authorised reviewers.

Retain request IDs, actor/institution IDs, timestamps and database counts without secrets or
customer-confidential payloads. Do not label smoke results as customer/provider acceptance.

## 4. Rollback

Set both AR-22 flags to `off`, rebuild the web bundle and restart through the standard deployment
process. Stop new proposals; retain all additive rows and audit evidence. Do not reverse the
migration, delete shadow records or promote them through a legacy path. Existing PR-03/04/19
capabilities remain available under their own flags.

## 5. Open gates

Identity-provider verification, domain control, live federation, secret issuance and rotation,
customer acceptance, accessibility, VAPT, executed recertification and safe participant exit remain
open. AR-29 owns production-grade external identity and integration activation.
