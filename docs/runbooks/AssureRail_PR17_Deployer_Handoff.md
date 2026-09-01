# AssureRail PR-17 deployer handoff

**Scope:** deploy code/migration only; do not activate customer or live transaction functions
**Owner:** deployment operator other than this implementation agent

## Pre-deployment

1. Confirm the intended commit and retain the current environment export/digest without printing
   secret values.
2. Run `npm test --workspace=@code/assurerail-api`.
3. Run `npm run db:rehearse:pr17 --workspace=@code/assurerail-api` on a disposable local database.
4. Back up the target Rail database and record restore evidence.
5. Confirm no public copy or customer claim is coupled to this deployment.

## Migration

Apply `20260902170000_assurerail_pr17_venue_conduct`. It creates nine additive tables and no deletes,
drops or source-record rewrites. Verify migration status and the presence of all nine tables before
starting the new build.

## Environment

Deploy dark first:

```text
ARAIL_VENUE_CONDUCT_V1=off
```

Do not change the existing `ASSURERAIL_OPERATING_MODE=DEMO` box merely to mount PR-17. The conduct
module is intentionally unavailable in DEMO. When a separately approved replay/shadow environment
has the PR-13 and OP-01 foundations, the permitted configuration is:

```text
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_PRIMARY_COMMERCIAL_V1=shadow
ARAIL_INTERNAL_RBAC_V1=enforce
ARAIL_VENUE_CONDUCT_V1=shadow
```

Use `ARAIL_INTERNAL_RBAC_V1=shadow` only for a time-bounded SUPERADMIN bootstrap rehearsal. It is not
the target operating posture.

## Shadow activation checklist

- create and independently approve a versioned conduct policy;
- assign named alert/complaint/investigation owners and SLAs;
- confirm internal staff sessions carry no participant institution context;
- verify each role has only its documented permissions;
- exercise missing-fact, conflict, off-channel, allocation and prohibited-action observations;
- verify alerts remain `REVIEW_REQUIRED` until a human review;
- rehearse legal hold, complaint resolution and append-only correction;
- rehearse maker/checker safe pause without connecting it to external mutation;
- establish fixture capacity budgets, then replace them with evidence-backed pilot thresholds; and
- export the evidence and keep all external gates visibly open.

## Rollback and safe pause

Set `ARAIL_VENUE_CONDUCT_V1=off` and restart through the normal deployment process. Do not drop the
tables or delete policy, signal, complaint, correction, control or capacity history. This disables the
module surface but preserves evidence for audit and later restart.

PR-17 has no live capability ID and cannot activate external action. Any deployment manifest or
public claim suggesting otherwise is invalid.
