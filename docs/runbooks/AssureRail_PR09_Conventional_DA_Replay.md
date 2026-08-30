# AssureRail PR-09 conventional DA replay runbook

**Scope:** non-mutating domestic conventional DA replay/shadow only
**Forbidden:** production/live mode, real payment or register instruction, token mint/burn, marketing
claim that a replay proves legal transfer

## 1. Named operational roles

Every rehearsal names different people where the control requires separation:

- case owner/transferor operator;
- transferor checker;
- transferee decision owner and transferee checker;
- authoritative-record operator and authoritative-record checker;
- break owner;
- repair maker and repair checker; and
- Rail service operator, who may observe health but may not impersonate a participant.

No person may review their own replay authorisation, reconcile their own observation, approve their
own repair, or reconcile a repair that they approved.

## 2. Pre-flight

1. Confirm `ASSURERAIL_OPERATING_MODE` is exactly `REPLAY` or `SHADOW`.
2. Confirm every legacy mutating adapter remains `demo` and demo endpoints remain disabled outside
   the isolated demo environment.
3. Enable the PR-03/05/06 foundation, then set
   `ARAIL_EXTERNAL_ACTION_SAGA_V1=required` and `ARAIL_DA_REPLAY_V1=allow_list`.
4. Validate startup configuration before starting the process. Do not relax an invariant to make an
   environment boot.
5. Apply the PR-09 migration. Record migration version, database backup reference, operator,
   checker and deployment time.
6. Verify the case is exactly domestic, bilateral, conventional DA, initial transfer, route-pack
   `1.0.0`, and `REPLAY`/`SHADOW`.
7. Verify distinct active transferor/transferee parties and current assignments for execution, cash
   settlement and authoritative-register update.
8. Verify the recordkeeper institution and every operator's session, membership, mandate and
   step-up capability.
9. Confirm that the retained evidence is authorised for replay and contains no unnecessary borrower
   PII. Do not load raw production records into an unapproved environment.

Stop if any prerequisite is unknown, expired, manually edited, unverified or outside the approved
data-use purpose.

## 3. Evidence preparation

Retain and verify these exact case-scoped objects before evidence lock:

- transferee-owned `TRANSFEREE_CREDIT_DECISION`;
- transferor-owned `EXECUTED_TRANSFER_DOCUMENT`;
- transferor-owned `HISTORIC_DA_OUTCOME`;
- recordkeeper-owned `AUTHORITATIVE_RECORD_DECLARATION`;
- recordkeeper-owned `AUTHORITATIVE_RECORD_SNAPSHOT` for the before state; and
- one evidence object for each later leg observation.

Record source/as-of time, provider, schema version, payload digest, signature verification, result,
qualifications and expiry. `REVIEW_REQUIRED`, `PRESENT_UNVERIFIED`, unavailable, quarantined,
expired or cross-case evidence is not eligible. If the current evidence pipeline cannot produce
verified evidence, record that as a blocking control gap; never update the row by hand.

## 4. Authorise the case

1. The case owner proposes the DA replay authorisation with an idempotency key, authority evidence,
   reason and purpose-bound step-up.
2. A different authorised person rechecks the route, parties and function assignments.
3. The checker approves or rejects. A rejected record is retained; do not delete and recreate it to
   hide the rejection.
4. Record the authorisation ID and governed audit-chain position in the rehearsal log.

Flags expose capability; this approved record allow-lists the individual case.

## 5. Plan the saga

After the case reaches `APPROVED_FOR_EXECUTION`, the owner submits:

- expected case aggregate version and command idempotency key;
- exact consideration currency, integer minor units and scale;
- legal mechanism and transferred-asset digest;
- historic outcome reference, evidence object and matching digest;
- decision/document evidence object IDs;
- authoritative recordkeeper, record type, optional exact case source reference, declaration
  evidence and before snapshot; and
- the route-required notice/recipient/acknowledgement list.

Confirm the response says `executionMode=OBSERVE_ONLY`, contains the derived ordered legs and does
not create any `ExternalInstruction`. Export and record the plan digest. Transition the case to
`EXECUTION_PENDING` only after the case engine reports saga readiness.

## 6. Replay observations

Record each required leg in derived sequence. Each participant owner supplies:

- a unique idempotency key;
- the exact observed fact object;
- the historical external reference;
- `FINAL` finality and `VERIFIED` signature status;
- a current verified evidence object;
- observed time, reason and step-up receipt.

After each command:

1. confirm one new observation version exists;
2. confirm the case aggregate version increased once;
3. confirm the audit entry is in the same committed operation;
4. repeat the identical command and confirm no duplicate is created;
5. repeat the idempotency key with changed content in a test case and confirm conflict; and
6. inspect the comparison result before proceeding.

Do not continue to a later required leg when a prior leg is not observed. Do not attempt to record a
second direct observation after any first observation.

## 7. Reconcile

For an exact observation, a different person within the responsible institution independently
checks the source evidence and calls leg reconciliation with a new idempotency key and separate
step-up. Reconciliation is not a rubber stamp: compare the retained expected/observed facts,
external reference, evidence digest, signer, finality and as-of time. An exact retry returns the
retained result; a different reconciliation command cannot replace it.

When every required leg is observed with no open break, transition the case to
`COMPLETION_PENDING`. When every leg is independently reconciled and every applicable source
completion is `MATCHED`, transition to `COMPLETED`. Save the transition guard results.

## 8. Break and repair

On `BREAK_OPEN`:

1. stop the case; the break blocks completion and saga reconciliation;
2. assign/confirm the accountable participant owner and four-hour initial SLA;
3. compare the explicit field-level differences and obtain corrected external evidence under the
   participant/recordkeeper's own process;
4. the owner proposes `APPEND_CORRECTED_OBSERVATION` with the replacement, reason and authority
   evidence;
5. a different checker verifies the external correction and approves only an exact replacement;
6. confirm the old observation still exists and a new version was appended;
7. confirm the break records both maker and independent closer; and
8. use a third person for subsequent leg reconciliation.

If an external record is wrong, this workflow does not authorise Rail to change it. Pause until the
external authority corrects it and issues evidence. Never use a waiver, manual SQL update or
“accepted difference” note to force a critical leg to `MATCHED`.

## 9. Comparison and evidence pack

Download both the JSON comparison and CSV. Confirm every row shows expected digest, observed digest,
external reference and an empty difference list. Export the evidence pack and independently
recompute its digest. `generatedAt` is outside the stable pack digest.

The pack must say:

```text
executionMode = OBSERVE_ONLY
mutationStatement = NO_MONEY_TITLE_REGISTER_OR_NOTICE_ACTION_DISPATCHED
```

The transferor and transferee should each sign an acceptance record referencing the same pack
digest. A trustee sign-off is not invented for this conventional-DA route.

## 10. Failure and recovery rehearsal

For a disposable test case, terminate the API process before and after each observation transaction
boundary, restart and repeat the command. Confirm either zero committed rows or exactly one complete
observation/audit/state update; partial evidence is a failure.

Because PR-09 has no network dispatch, network interruption must not create a cash/title/register
action. Connector ambiguity/finality fault injection becomes mandatory when a later PR adds live
instructions. Do not count “there was no network call” as proof of a live connector's recovery.

Run migration, additive-upgrade, database constraint, schema-drift, backup and restore rehearsal:

```bash
npm run db:rehearse:pr09 --workspace=@code/assurerail-api
```

## 11. Safe pause and rollback

1. Stop new authorisations and observations.
2. Set `ARAIL_DA_REPLAY_V1=off`; restart under the approved change process.
3. If needed, also set `ARAIL_EXTERNAL_ACTION_SAGA_V1=off`.
4. Preserve all rows, evidence objects, comparisons, breaks, repair history and audit entries.
5. Export affected case IDs and their state. Do not roll the database back or delete evidence.
6. Because no external mutation was dispatched, no payment/title reversal is required. Any external
   historical fact remains owned by its original participant/authority.

## 12. Exit criteria before PR-10 review

- all Rail tests and PR-09 database rehearsal pass;
- zero unresolved implementation-critical defects;
- the evidence-verification path needed by a genuine replay is identified and owned;
- one authorised real historic DA corpus is named, redacted and approved for use;
- participant operators/checkers and recordkeeper are named;
- a real replay is completed or explicitly recorded as an open acceptance item; and
- nobody represents the anonymised fixture as customer, legal or production evidence.
