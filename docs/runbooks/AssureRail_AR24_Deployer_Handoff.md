# AssureRail AR-24 deployer handoff

**Authority:** EX-28 permits implementation, commit and push. It does not permit deployment or
activation.

## 1. Default posture

Leave both flags off:

```text
ARAIL_PTC_PRODUCT_V1=off
NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1=off
```

AR-24 adds no migration. Continue the standard venue migration step before any API restart. With
the flags off, the API product overview is forbidden and the case cockpit omits the PTC link.

## 2. Later replay/shadow preparation

Only under a separate deployment/activation instruction, satisfy PR-03–10 and AR-21/22, then set:

```text
ASSURERAIL_OPERATING_MODE=REPLAY  # or SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_ROOM_READ_SOURCE=compare   # or rail under its own approved cutover
ARAIL_EXTERNAL_ACTION_SAGA_V1=required
ARAIL_PTC_REPLAY_V1=allow_list
ARAIL_INTERNAL_RBAC_V1=shadow
ARAIL_DEVELOPER_PORTAL_V1=shadow
ARAIL_HOSTED_ALPHA_V1=shadow
ARAIL_INSTITUTIONAL_PRODUCT_V1=shadow
ARAIL_PTC_PRODUCT_V1=shadow
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow
NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=shadow
NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1=shadow
NEXT_PUBLIC_ASSURERAIL_PTC_PRODUCT_V1=shadow
```

Keep all mutating external adapters in demo/non-mutating mode. Do not enable DA product unless its
independent route cohort is also approved.

## 3. Smoke checks after an authorised deployment

1. Confirm migrations, health/readiness and declared replay/shadow runtime.
2. With flags off, confirm the PTC link is absent and overview forbidden.
3. Confirm a non-party gets `404`; a member without `VIEW_CASE` gets `403`.
4. Confirm hidden source/evidence/room data is unavailable rather than inferred absent.
5. Confirm originator, trustee and recordkeeper remain distinct active parties and functions.
6. Confirm replay authorisation and repair require maker/checker and purpose-bound step-up.
7. Retry an ambiguous request and verify one retained result.
8. Confirm all evidence digests bind to current signed, valid, verified case-scoped versions.
9. Confirm only the assigned institution records/reconciles each ordered leg.
10. Confirm multiple required-review legs do not complete from a single reconciliation.
11. Record a mismatch and prove a blocking break plus append-only repair history.
12. Confirm trustee decision and legal-record acknowledgement are separate.
13. Download comparison/evidence pack and verify their digest/counts.
14. Confirm no external instruction, cash, issue, allotment, notice, register or token mutation.

## 4. Rollback

Set both AR-24 flags off, rebuild the web bundle and restart through the normal process. Retain all
case, evidence, room, saga, observation, break and repair records. Never rewrite confirmed external
facts to fit Rail state.

## 5. Open gates

Named historic-PTC data owner, originator/trustee authorization, counsel route ratification,
customer/provider acceptance, VAPT, live shadow comparison, provider/recordkeeper integrations and
signed PR-12 controlled-live acceptance remain open.
