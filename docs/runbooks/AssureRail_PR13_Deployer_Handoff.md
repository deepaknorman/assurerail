# AssureRail PR-13 deployer handoff

**Audience:** the separately authorised coder/deployer, SRE and release reviewers.
**Instruction:** deployer may deploy committed code; this implementation session must not deploy.

## 1. Safe initial environment

The current box remains:

```dotenv
ASSURERAIL_OPERATING_MODE=DEMO
ARAIL_PRIMARY_COMMERCIAL_V1=off
```

Do not change its mode or enable PR-13 merely because the migration is present. PR-13 cannot be
enabled in controlled-live or production in this build.

For a separately approved non-live shadow environment only:

```dotenv
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_PRIMARY_COMMERCIAL_V1=shadow
```

Persistent Postgres and Firebase authentication are mandatory in shadow. Existing shadow-mode
prohibitions on mutating adapters remain in force.

## 2. Deployment sequence

1. Verify the exact reviewed commit and ensure unrelated working-tree files are absent from the
   release artefact.
2. Take and verify a database backup.
3. Run `prisma migrate deploy`; never run `migrate dev` on a shared environment.
4. Leave `ARAIL_PRIMARY_COMMERCIAL_V1=off` for the first restart.
5. Verify health, readiness, authentication and existing route regressions.
6. Confirm the nine PR-13 tables exist and no live capability ID was registered.
7. If a shadow cohort has separate approval, configure the complete shadow foundation and restart.
8. Create only synthetic/training or properly authorised shadow cases; do not import customer
   commercial data without the corresponding data owner and operating approval.
9. Verify named-audience isolation with two institutions and a negative third-institution test.
10. Monitor authorisation denials, database conflicts and invalid step-up events.

## 3. Required smoke checks

- With the flag `off`, PR-13 routes are unmounted or refused.
- `shadow` is rejected without the transaction-case foundation.
- `shadow` is rejected under `SANDBOX`, `CONTROLLED_LIVE` and `PRODUCTION`.
- A non-invited institution cannot discover or read an opportunity.
- An invited institution sees only its own interest, RFQ, thread and allocation records.
- The owner cannot act as its own counterparty.
- A publisher cannot review their own publication proposal.
- An allocation proposer cannot review their own allocation.
- Stale versions, expired terms/grants and reused idempotency keys with different content fail.
- No request causes settlement, token, registry, webhook or other external dispatch.

## 4. Safe pause and rollback

Set `ARAIL_PRIMARY_COMMERCIAL_V1=off` and restart normally. Preserve all PR-13 rows. The migration is
additive and existing application versions that ignore these tables remain compatible; do not drop
tables or delete history as a rollback mechanism.

If deployment itself fails before any shadow use, revert only the application artefact to the last
approved schema-compatible build. If shadow records exist, retain/export them and investigate; do
not squeeze them into legacy Note or room fields.

## 5. Activation prohibition and handoff to later stages

PR-13 has no controlled-live command path and no implemented-live capability ID. Do not create a
manifest that claims otherwise. Legal/perimeter, performer, conduct, participant, security and
operating gates remain open. PR-17 conduct controls and PR-18 customer workspaces are still future
dependencies for broad customer use.
