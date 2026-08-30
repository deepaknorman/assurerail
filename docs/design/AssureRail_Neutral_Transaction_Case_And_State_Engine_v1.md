# AssureRail neutral transaction case and state engine v1

**Status:** PR-06 implemented behind replay/shadow gates, 30 August 2026

**Depends on:** PR-01 contracts, PR-02 persistence, PR-03 participant authority, PR-05 evidence intake

**Not a claim of:** a completed DA/PTC route pack, live external action, legal completion, matching,
settlement, authoritative ownership, production readiness or a customer-facing case workspace

## 1. Selected product and code boundary

Rail now owns a provider-neutral `TransactionCase` spine. A case explicitly records DA or PTC,
conventional or tokenised representation, jurisdiction, market context, placement/listing context,
initial or secondary lifecycle leg, asset class, operating mode and a versioned route-pack reference.
Those dimensions remain separate. No `Note`, `poolId`, `claId`, token, AssurePool or trustee-vendor
field defines the case.

This is an additive shadow kernel. Existing Note and transfer-room paths still own their current
writes. PR-06 neither renames Note into PTC nor changes AssurePool from a DA tape-preparation product.
AssureTransfer remains a parallel product. Evidence can now be bound to a real case and its parties,
but legacy opaque case references remain valid while the feature is off so PR-05 history is not
destroyed by a new foreign key.

`REPLAY` and `SHADOW` are the only transaction operating modes accepted. The runtime also rejects
mounting the case module in DEMO, SANDBOX, CONTROLLED_LIVE or PRODUCTION. Setting a flag cannot make
the kernel live.

## 2. Records and responsibilities

| Record | Selected responsibility | Explicitly not its responsibility |
|---|---|---|
| `TransactionCase` | Stable route/representation identity, owner, status, route-pack and optimistic aggregate version | Legal title, external settlement finality or a product-specific tape |
| `CaseVersion` | Immutable canonical case specification and digest before evidence lock | Rewriting route/representation or post-lock correction |
| `CaseParty` | Case-scoped admitted institution, role, authority evidence, acceptance and status | A global venue role or identity-provider assertion |
| `CaseFunctionAssignment` | Material function, performer class/institution, appointment and authority/permission evidence | A declaration that Rail itself is licensed or authorised |
| `CaseCondition` | Precedent/subsequent obligation, owner, due date, evidence, waiver authority and resolution | Silent waiver or a UI checkbox that establishes satisfaction |
| `CaseDecision` / `CaseApproval` | Rule-pack/evidence-bound proposal and independent review | Self-approval or unversioned legal policy |
| `CaseTransition` | Append-only command, before/after state, request/idempotency digest, guard result, actor/mandate/step-up and evidence bundle | Execution of cash, token, register or other external actions |
| `CaseReplayReceipt` | Deterministic export and transition-chain reproduction result | Proof that an external authority agreed with Rail |

All nine tables are Rail-owned and additive. Restrictive foreign keys prevent deletion of a case
whose governed history exists. The evidence-to-case column deliberately remains a validated opaque
reference rather than a database foreign key during compatibility: PR-05 records may already carry
provider case identifiers that predate the Rail case table.

## 3. Admission, authority and case visibility

A user needs all of the following:

1. an authenticated Rail session with an active institution context;
2. an active admitted institution and active membership;
3. an active `VIEW_CASE` or `OPERATE_CASE` mandate; and
4. case ownership or an active party record for that same institution.

Resource lookup returns not found when the institution is outside the case. Platform employment,
legacy function role and DigiKYC identity binding grant no case access. An institution-wide mandate
may cover child cases only after the case service has proved ownership/active-party scope. A
`TRANSACTION_CASE` mandate remains exact to its case reference and cannot be reused for another case.

Creation additionally requires an exact active route entitlement for
`ASSET_OR_INSTRUMENT_ADMISSION`, including route, representation, asset class, lifecycle leg and
operating mode. An `OTHER_APPROVED` market, placement or asset value requires a named
`extensionProfileRef`; it is never an unknown-value fallback.

The owner proposes another admitted institution as a party. It remains `PROPOSED` and gets no read
access until a mandated user of that institution accepts it with purpose-bound step-up evidence.
The owner cannot accept on the other institution's behalf.

## 4. Function assignments and appointments

Every non-prohibited function identifies an active case-party institution whose exact route/function
entitlement passes. `LICENSED_PARTNER` and `EXTERNAL_AUTHORITY` require an active, effective
appointment; the appointment must be general or scoped to the same case and must identify the same
performer. Every non-prohibited function needs authority evidence. `OWNED_AUTHORISED` and
`LICENSED_PARTNER` additionally need permission/licence evidence.

`PROHIBITED` is a fail-closed performer classification, not a completed assignment. A case with an
active prohibited function cannot enter review. This preserves the distinction between recording
that a function exists and proving who may perform it.

Trustee authority is therefore represented as a party/appointment/function/decision combination;
it is not inferred from a hard-coded vendor, email, global role or token signature. PR-10 will add
the PTC-specific route meanings only after review.

## 5. Common state spine

```text
DRAFT -> INTAKE_OPEN -> EVIDENCE_LOCKED -> REVIEW_PENDING
      -> APPROVED_FOR_EXECUTION -> EXECUTION_PENDING
      -> COMPLETION_PENDING -> COMPLETED
```

`BLOCKED`, `CANCELLED` and `FAILED` are explicit side/terminal paths. The current guards are:

| Target state | Minimum common guard |
|---|---|
| `INTAKE_OPEN` | At least two active institutional parties |
| `EVIDENCE_LOCKED` | At least one case-scoped evidence object; every latest version is available, syntactically valid and unexpired |
| `REVIEW_PENDING` | At least one material-function assignment and none classified prohibited |
| `APPROVED_FOR_EXECUTION` | No open precedent condition and an independently approved `CASE_APPROVAL` decision |
| `EXECUTION_PENDING` | Durable external saga reports ready |
| `COMPLETION_PENDING` | Durable external saga reports completion observed |
| `COMPLETED` | Route-specific completion reconciliation reports matched |
| `BLOCKED` / `FAILED` | A retained reason |
| `CANCELLED` | Independently approved `CASE_CANCELLATION` decision |
| recovery from `BLOCKED` | Independently approved decision naming the exact recovery target |

The final three positive execution facts are deliberately hard-coded false in PR-06. Therefore the
new kernel cannot reach execution or completion until PR-09 supplies the durable saga and route
reconciliation facts. This is a control, not missing test data.

Evidence lock makes case versions, parties, function assignments and evidence versions immutable.
Later corrections must be explicit decisions/recovery or a new case/version lineage as designed;
they cannot rewrite the locked record.

## 6. Decisions, concurrency, idempotency and replay

Every decision proposal stores canonical proposal digest, route-pack reference/version and the
digest of the latest case evidence bundle plus the case aggregate version. A checker cannot be the
proposal maker. Review stops if the evidence bundle changed or any intervening case mutation changed
the aggregate after proposal. `CASE_APPROVAL` may be proposed only in `REVIEW_PENDING`, and approval
also rechecks current evidence validity/expiry. Approval stores its own digest, mandate, step-up,
reason and effective time.

Case creation has an owner-scoped idempotency key and complete request digest. Reuse with changed
content conflicts. A race either returns the already-created identical case or fails without a
second case. Transition commands likewise bind command, target, expected aggregate version, reason
and step-up evidence to a request digest. The database compares the aggregate version and current
status in the same transaction that appends the transition. Identical concurrent/repeated commands
return the retained transition; changed commands conflict.

Other immutable commands use bounded natural identities: case specification digest, party role,
material function, condition code, decision proposal digest and decision/checker. A changed retry
cannot overwrite the original record. A later API-hardening pass may expose a uniform header-level
idempotency convention, but it may not weaken these stored uniqueness rules.

Replay exports a canonical, date-normalised case graph and hashes it. It checks transition order,
from/to continuity and each transition's `resultingVersion = expectedVersion + 1`. Aggregate gaps
between transitions are valid because party, function, condition and decision mutations also
increment the aggregate version. The replay's final state must equal the retained case state.

## 7. Evidence integration and compatibility

When `ARAIL_TRANSACTION_CASE_V1=shadow`, JSON and document intake must find the case and prove the
submitting institution is owner or active party. New evidence and versions are allowed only in
`DRAFT` or `INTAKE_OPEN`. Evidence list/read/download and grants also require active case-party scope;
an evidence grant alone cannot admit an outsider to a case. Case-scoped evidence becomes immutable
at evidence lock.

When the feature is off, PR-05 retains its prior institution/grant behaviour and opaque
`transactionCaseId` values. This prevents an additive migration from hiding or corrupting earlier
evidence. No cross-database foreign key or AssureLocker dependency was introduced.

## 8. Versioned API surface

The module adds 13 routes under `/v1/rail/cases`: list/create/get, create version, propose/accept
party, assign function, add/resolve condition, propose/review decision, transition and replay.
Every route derives actor, session and acting institution from authenticated context. No actor or
institution authority is accepted from the body.

Dedicated case screens are deliberately deferred. The PR-04 institution workspace exposes the new
mandate actions, while the API and replay export provide the technical case timeline. PR-07 adds the
room/workspace surface after the room access model and migration comparator exist.

## 9. Rejected and deferred alternatives

- Rejected: rename Note to PTC, use `PTC_DATA_ROOM` as route proof, or let AssurePool own the case.
- Rejected: create a case from identity binding, a global role, platform admin status or an
  unaccepted party proposal.
- Rejected: allow DEMO, CONTROLLED_LIVE or PRODUCTION labels to enable this shadow module.
- Rejected: allow an unknown taxonomy value or `OTHER_APPROVED` without an extension profile.
- Rejected: let submitted evidence, a UI status or an approved decision alone imply completion.
- Rejected: allow case evidence grants to bypass active party scope.
- Rejected: rewrite legacy evidence identifiers or introduce a new foreign key that breaks PR-05
  compatibility.
- Deferred to PR-07/08: purpose-specific rooms, sealed legacy access-chain import, dual-read parity,
  one-write-authority cutover and AssurePool completion acknowledgement.
- Deferred to PR-09: external-action saga, conventional DA route facts, completion reconciliation
  and historic DA replay.
- Deferred to PR-10 and later review: PTC route semantics, matching, solicitation, primary placement,
  secondary trading and any regulated-function launch conclusion.

## 10. Feature and claim rule

The module mounts only when participant admission, neutral ingress and transaction case are all
explicitly `shadow`, with runtime `REPLAY` or `SHADOW`. The current box remains an explicitly declared
DEMO environment and was not changed or deployed. Code presence is not capability acceptance.
