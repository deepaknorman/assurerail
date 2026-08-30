# AssureRail conventional DA replay and external-action saga v1

**Status:** PR-09 engineering design and as-built record, 31 August 2026
**Operating perimeter:** domestic India, conventional DA, initial transfer, bilateral, `REPLAY` or
`SHADOW` only
**Execution mode:** `OBSERVE_ONLY`; no cash, title, register, source-system or notice action is
dispatched by this implementation
**Route pack:** `assurerail://route-packs/domestic-conventional-da-replay`, version `1.0.0`

## 1. Outcome

PR-09 opens the first neutral conventional-DA completion path without weakening the safety blocks
on the legacy tokenised Note demonstration. It adds a durable, ordered saga whose expectations,
historic observations, evidence, discrepancies, repairs and independent reconciliations survive a
restart. The common case engine can now move:

`APPROVED_FOR_EXECUTION → EXECUTION_PENDING → COMPLETION_PENDING → COMPLETED`

only when the corresponding persisted saga facts exist. A route label, API response or operator
assertion cannot manufacture readiness or completion.

The implementation deliberately does **not** call the current settlement, HCS, HTS or webhook
egress adapters. The current Note DvP sequencing remains characterised as unsafe for controlled
live use and remains a PR-11 refactor. PR-09 establishes the conventional-DA kernel that PR-11 and
later controlled-live connectors must use; it does not disguise the legacy flow as migrated.

## 2. Selected decisions and rejected alternatives

### Selected

1. Conventional DA replay is a versioned route pack, not a free-form case convention.
2. Every case is allow-listed through a per-case maker-checker authorisation before a saga can be
   planned.
3. The route requires distinct active `TRANSFEROR` and `TRANSFEREE` parties.
4. The transferee owns the credit/diligence decision. Rail requires a retained, verified
   `TRANSFEREE_CREDIT_DECISION` evidence object owned by the transferee; it does not calculate or
   approve that decision.
5. `EXECUTION`, `CASH_SETTLEMENT` and `AUTHORITATIVE_REGISTER_UPDATE` must each have a current,
   permitted function assignment.
6. The legally operative record is declared independently of Rail. A before snapshot and exact
   expected after digest are required; the after observation cannot complete the case until it is
   independently reconciled.
7. Consideration uses exact currency, integer minor units and explicit scale. Floating point,
   exponent notation, leading-zero ambiguity, zero and negative consideration fail before a saga is
   created.
8. Historic observations are append-only. A mismatch opens a critical reconciliation break. The
   original observation is never overwritten.
9. Repair is maker-checker: a participant owner proposes a corrected observation and a different
   person reviews it. The repair reviewer also cannot perform the subsequent independent leg
   reconciliation.
10. Expected and observed facts remain visible side by side in JSON and downloadable CSV. Rail does
    not auto-correct the historic outcome or silently coerce a mismatch into a match.
11. A trustee and assurance provider are not required or auto-created for this conventional-DA
    route. If a later approved DA variant genuinely needs another function, it must be added through
    a new route-pack release and explicit assignment.
12. Source completion is route-dependent. If a case has a source-completion lifecycle, every such
    completion must be exactly reconciled before case completion. A route with no applicable source
    completion does not invent an AssurePool dependency.

### Rejected

- calling the existing cash-first Note DvP service from the DA case;
- treating `sellerDid`, `buyerDid` or a global venue role as institutional authority;
- letting a replay or shadow flag turn on a live adapter;
- recording one opaque `completed=true` field instead of separate legs and evidence;
- letting Rail make the transferee's credit decision;
- requiring AssurePool, AssureLocker, AssurePlane, a named trustee or a token for generic DA;
- considering a payment reference sufficient without source/register observations;
- accepting unsigned, unverified, expired, unavailable or case-misaligned evidence;
- replacing a mismatched observation in place;
- letting the observation recorder close the same leg, or the repair maker approve the repair;
- allowing an unresolved reconciliation break to coexist with completion; and
- claiming that the anonymised reference fixture is a completed real-customer replay.

## 3. Exact route perimeter

The v1 route accepts only this combination:

| Dimension | Required value |
|---|---|
| Transaction route | `DA` |
| Representation | `CONVENTIONAL` |
| Jurisdiction | `IN` |
| Market context | `DOMESTIC` |
| Placement | `BILATERAL` |
| Lifecycle leg | `INITIAL_TRANSFER_OR_ISSUE` |
| Case/runtime mode | `REPLAY` or `SHADOW` |
| Saga execution mode | `OBSERVE_ONLY` |
| Route-pack version | `1.0.0` exact |

A case created under another route-pack reference or version cannot borrow this adapter. Secondary
DA, discovery, matching, live consideration instructions and tokenised representation remain
outside PR-09.

## 4. Required parties, authority and evidence

### 4.1 Parties and functions

- The case owner is the transferor for this initial adapter.
- `TRANSFEROR` and `TRANSFEREE` must be active, admitted, distinct case parties.
- The person proposing/reviewing the allow-list or creating the saga needs active membership, an
  applicable case mandate, active session institution context and a purpose-bound step-up receipt.
- Observation owners need both case-operation and route-operation authority.
- The authoritative recordkeeper must be an admitted active institution and the exact current
  performer named by `AUTHORITATIVE_REGISTER_UPDATE`.
- Effective and expiry dates on function assignments are evaluated; a stale `ACTIVE` string is not
  sufficient.

### 4.2 Evidence objects

Saga creation requires current, case-scoped, available evidence with `validationStatus=VALID`,
`signatureStatus=VERIFIED` and `result=VERIFIED`:

| Evidence type | Required owner | Use |
|---|---|---|
| `TRANSFEREE_CREDIT_DECISION` | Transferee | Shows that the participant made and retained its own decision |
| `EXECUTED_TRANSFER_DOCUMENT` | Transferor | Binds legal mechanism and transferred-asset digest |
| `HISTORIC_DA_OUTCOME` | Transferor | Binds the retained historical outcome used for replay |
| `AUTHORITATIVE_RECORD_DECLARATION` | Recordkeeper | Declares the route-authorised external record and evidence basis |
| `AUTHORITATIVE_RECORD_SNAPSHOT` | Recordkeeper | Binds the before snapshot; later observations supply the after snapshot |

The saga and authoritative-record declaration retain the exact evidence-object IDs as restrictive
foreign keys in addition to their digests and external references. The evidence pack therefore
preserves direct lineage to the reviewed credit decision, executed document, historic outcome,
declaration and before/after snapshots.

Every leg observation also references a current verified evidence object owned by that leg's
participant owner. This is intentionally stricter than the present PR-05 raw intake path, which
stores provider submissions as `REVIEW_REQUIRED`/unverified until a trustworthy verification
workflow promotes them. Therefore a genuine replay remains fail-closed until that verified-evidence
workflow or an approved signed-provider adapter exists; no database label should be manually edited
to bypass it.

## 5. Ordered saga

The planner derives immutable legs rather than accepting arbitrary ordering:

| Sequence | Leg | Owner | Performer class | Expected fact |
|---:|---|---|---|---|
| 10 | Transferee credit decision | Transferee | `PARTICIPANT_OWNED` | Exact retained decision evidence digest and owner |
| 20 | Executed transfer document | Transferor | `PARTICIPANT_OWNED` | Document, legal-mechanism and asset digests |
| 30 | Cash consideration | Transferee | `PARTICIPANT_OWNED` | Currency, exact units/scale, historic reference, payer/payee |
| 40 | Transferor source update | Transferor | `PARTICIPANT_OWNED` | Exact post-transfer source digest |
| 50 | Transferee source update | Transferee | `PARTICIPANT_OWNED` | Exact post-transfer source digest |
| 60 | Authoritative register update | Declared recordkeeper | `EXTERNAL_AUTHORITY` | Before/after/asset digest and record identity |
| 70+ | Route-declared required notices | Transferor | `PARTICIPANT_OWNED` | Recipient, notice type and acknowledgement digest |

A later required leg cannot be observed until every earlier required leg is at least observed. This
prevents the prior direct “cash first, then hope the anchor/database succeeds” pattern from entering
the neutral conventional-DA path. It is still an observation order for historic replay, not a live
payment instruction sequence.

Saga states are derived from leg state and unresolved breaks:

`READY → EXECUTING → OBSERVED → RECONCILED`

Any discrepancy derives `BREAK_OPEN`; an approved append-only repair returns the saga to the state
derived from all retained legs. `PAUSED` and `FAILED` are reserved durable states for later operating
commands; PR-09 exposes no live resumption or compensation instruction.

## 6. Observation, reconciliation and completion gates

An observation must contain an idempotency key, exact observed fact object, external reference,
`FINAL` finality, `VERIFIED` signature status, evidence object, as-of time, reason and step-up
receipt. The command is one database transaction covering:

- append-only observation version;
- exact canonical comparison and digest;
- leg state;
- critical break creation when required;
- authoritative after snapshot when applicable;
- saga-derived state;
- case aggregate version and route state; and
- governed hash-chained audit entry.

Failure before commit leaves none of those writes. Retrying the same idempotency key and request
digest returns the retained result; changing content under the same key conflicts. Once a direct
observation exists, another direct observation is forbidden. Correction must pass through the
repair workflow.

The same exact-retry rule applies to authorisation proposal/review, saga creation, independent leg
reconciliation and repair proposal/review. Review and reconciliation receipts persist both the
accepted idempotency key and request digest. A repair proposal claims its open break with a
compare-and-set update, so two makers cannot create competing active repairs.

The case transition facts are now distinct:

- `externalSagaReady`: an enabled, observe-only saga exists in a non-terminal usable state;
- `externalSagaObserved`: every required leg is observed/reconciled and no break is open; and
- `completionReconciled`: the saga is fully reconciled, no break is open, and every applicable
  source completion is `MATCHED`.

Consequently readiness permits `APPROVED_FOR_EXECUTION → EXECUTION_PENDING`; complete observation
permits `EXECUTION_PENDING → COMPLETION_PENDING`; independent reconciliation permits
`COMPLETION_PENDING → COMPLETED`.

## 7. Break and repair separation

A mismatch opens a `CRITICAL` break with expected/observed objects and digests, accountable
institution, four-hour initial due time and blocked capabilities `CASE_COMPLETION` and
`SAGA_RECONCILIATION`.

Repair does not edit the old observation:

1. the leg owner proposes `APPEND_CORRECTED_OBSERVATION`, a reason and authority evidence;
2. a different user reviews it with a separate step-up receipt;
3. approval is impossible unless the replacement now matches exactly;
4. a new observation version is appended and the original remains available;
5. the break records maker, independent closer and resolution evidence; and
6. a third independent reconciliation step is still required for the leg.

This is correction of Rail's retained observation, not correction of an external legal record. Any
external correction must already have occurred under the responsible participant/authority's own
process and be supplied as new signed evidence.

## 8. API surface

All routes are beneath `/v1/rail/cases/:caseId/da-replay`:

- `GET|POST /authorisation` and `POST /authorisation/:id/review`;
- `GET|POST /sagas`;
- `POST /sagas/:sagaId/legs/:legId/observations`;
- `POST /sagas/:sagaId/legs/:legId/reconcile`;
- `GET /breaks`;
- `POST /breaks/:breakId/repairs` and `POST /breaks/:breakId/repairs/:repairId/review`;
- `GET /sagas/:sagaId/comparison`;
- `GET /sagas/:sagaId/comparison.csv`; and
- `GET /sagas/:sagaId/evidence-pack`.

The evidence pack declares `OBSERVE_ONLY` and
`NO_MONEY_TITLE_REGISTER_OR_NOTICE_ACTION_DISPATCHED`. Its digest covers stable content; generation
time is returned outside that digest.

## 9. Persistence

The additive migration creates:

- `DaReplayAuthorisation`;
- `SettlementSaga` and ordered `SettlementLeg`;
- append-only `SagaLegObservation`;
- `AuthoritativeRecordDeclaration` and before/after snapshots;
- `ReconciliationBreak`; and
- `SagaRepairAction`.

Foreign keys use `ON DELETE RESTRICT`. Unique case/version, case/idempotency, leg/key, leg/sequence,
saga/reconciliation-idempotency, leg/observation-version and repair/idempotency constraints prevent
duplicate plans, reordered legs, history rewrites and duplicate reconciliation/repair commands at
the database boundary.

## 10. Runtime gates and rollback

The module mounts only when all of these are explicit:

```text
ASSURERAIL_OPERATING_MODE=REPLAY|SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_EXTERNAL_ACTION_SAGA_V1=required
ARAIL_DA_REPLAY_V1=allow_list
```

The runtime rejects these PR-09 flags in demo, sandbox, controlled-live and production. A case also
needs a database-backed approved allow-list record; flags alone grant no case authority.

Rollback disables `ARAIL_DA_REPLAY_V1` first, then the saga flag. This removes the API surface and
prevents new observations without deleting saga/evidence history. Because the path makes no
external mutation, a replay/shadow cohort can be stopped without reversing cash or title. Existing
records remain exportable through an authorised database/evidence procedure.

## 11. Evidence achieved and remaining acceptance

Automated evidence covers exact planning/comparison, explicit discrepancies, case state gates,
route flags, endpoint surface, no mutating-adapter imports and all existing Rail regression tests.
The disposable PostgreSQL rehearsal proves additive deployment, restrictive history, append-only
observation versions, one saga version, upgrade retention and backup/restore.

The included `ANONYMISED_REFERENCE_OUTCOME` fixture proves that a completed-deal-shaped corpus can
derive and reconcile every required leg. It is not a real transaction and does not satisfy the
business acceptance criterion “one completed historic DA replay.” That criterion remains open until
an authorised transferor/transferee supplies a redacted completed transaction, the evidence is
verified, participant owners perform the replay, discrepancies are dispositioned, and both parties
sign the comparison/evidence pack. PR-10 must not use the fixture as evidence that PR-09 has passed a
customer or production gate.
