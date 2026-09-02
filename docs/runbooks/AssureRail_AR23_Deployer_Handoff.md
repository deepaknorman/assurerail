# AssureRail AR-23 deployer handoff

**Authority:** EX-28 permits implementation, commit and push. It does not permit deployment or
activation.

## 1. Default posture

Leave the product dark:

```text
ARAIL_DA_PRODUCT_V1=off
NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1=off
```

AR-23 adds no migration. Continue to run the standard AssureRail venue migration step before API
restart. The API route returns forbidden while its flag is off; the case cockpit omits its link.

## 2. Later replay/shadow preparation

Only after separate deployment/activation instruction, satisfy the existing PR-03–09/AR-21–22
requirements and set:

```text
ASSURERAIL_OPERATING_MODE=REPLAY  # or SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_ROOM_READ_SOURCE=compare   # or rail under its own approved cutover
ARAIL_EXTERNAL_ACTION_SAGA_V1=required
ARAIL_DA_REPLAY_V1=allow_list
ARAIL_INTERNAL_RBAC_V1=shadow
ARAIL_DEVELOPER_PORTAL_V1=shadow
ARAIL_HOSTED_ALPHA_V1=shadow
ARAIL_INSTITUTIONAL_PRODUCT_V1=shadow
ARAIL_DA_PRODUCT_V1=shadow
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow
NEXT_PUBLIC_ASSURERAIL_HOSTED_ALPHA_V1=shadow
NEXT_PUBLIC_ASSURERAIL_INSTITUTIONAL_PRODUCT_V1=shadow
NEXT_PUBLIC_ASSURERAIL_DA_PRODUCT_V1=shadow
```

All external adapters remain demo/non-mutating. Do not set a controlled-live/production mode to make
the product appear available; startup must reject it.

## 3. Smoke checks after an authorised deployment

1. Confirm migrations, `/healthz`, `/readyz` and the declared replay/shadow runtime.
2. With flags off, confirm the DA journey link is absent and product overview is forbidden.
3. With an approved case, confirm a non-party gets `404` and a member lacking `VIEW_CASE` gets `403`.
4. Confirm source/evidence and rooms show `UNAVAILABLE`, not zero, without their exact actions.
5. Confirm a transferee can see only granted evidence and a non-owner sees only granted rooms.
6. Confirm replay authorisation and repair enforce maker/checker and purpose-bound step-up.
7. Retry an intentionally ambiguous request and verify one durable command/result.
8. Confirm only the assigned leg-owner institution can record/reconcile that leg.
9. Record a mismatch and verify a break opens; apply a reviewed corrected observation and verify the
   original remains retained.
10. Download the CSV and evidence pack; verify their digest/counts against the same saga.
11. Confirm no external instruction, outbox dispatch, funds, token, title, notice or register write
    was created by the product workflow.

## 4. Rollback

Set both AR-23 flags to off, rebuild the web bundle and restart through the normal process. Existing
case/evidence/room/PR-09 records remain intact and exportable. Pause new product actions; never delete
or rewrite observations, breaks or repair history.

## 5. Open gates

Historic transaction-owner authorisation, customer acceptance, VAPT, counsel route ratification,
live shadow evidence, provider/recordkeeper integration and signed PR-12 controlled-live approval
remain open.
