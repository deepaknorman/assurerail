# AssureRail conventional PTC replay design v1

**Status:** PR-10 implementation design — 1 September 2026

**Scope:** domestic India, conventional PTC, initial issuance, `REPLAY` or `SHADOW` only
**Explicitly excluded:** tokenised PTC, live issuance/allotment/cash/register action, matching,
distribution, secondary trading and any claim of regulatory/route approval.

## 1. Binding decisions carried into the route

1. A PTC is not a renamed Rail `Note`, a `PTC_DATA_ROOM` purpose, or an existing token mint/DvP
   flow. It has its own route pack and controls.
2. The trustee is the final transaction-control authority in the Rail workflow. The legally
   operative record is the route-defined RTA, depository or register. Rail retains both trustee
   decision and recordkeeper acknowledgement; a difference is a blocking reconciliation break.
3. The trustee or accountable appointing party arranges assurance/review. The provider is optional,
   provider-neutral and may be neither AssureLocker nor AssurePlane. Rail validates the scoped,
   signed appointment/result only; it does not mark its own transaction.
4. Every material function is explicitly `OWNED_AUTHORISED`, `LICENSED_PARTNER`,
   `PARTICIPANT_OWNED`, `EXTERNAL_AUTHORITY` or `PROHIBITED`. An unassigned/prohibited function
   fails closed.
5. First code runs in `OBSERVE_ONLY`. It records historic facts and independently reconciles them;
   it dispatches no cash, PTC allotment, filing, depository/RTA/register instruction or notice.

## 2. Exact first route perimeter

| Dimension | Required value |
|---|---|
| Route | `PTC` |
| Representation | `CONVENTIONAL` |
| Jurisdiction / market | `IN` / `DOMESTIC` |
| Placement | `PRIVATE_PLACEMENT` unless a later counsel-approved route pack selects another value |
| Lifecycle leg | `INITIAL_TRANSFER_OR_ISSUE` |
| Mode | `REPLAY` or `SHADOW` |
| Execution | `OBSERVE_ONLY` |
| Proposed pack | `assurerail://route-packs/domestic-conventional-ptc-replay@1.0.0` |

The first pack will not infer a listing, a depository, an RTA, a rating, a trustee, a servicer,
assurance provider or a token. Each is supplied and verified in the replay record when applicable.

## 3. Material parties and functions

| Function | Expected accountable party | Default performer | Required route evidence |
|---|---|---|---|
| Originator / pool transferor | originator | `PARTICIPANT_OWNED` | executed pool-transfer evidence and pool digest |
| Trustee / transaction control | appointed trustee | `EXTERNAL_AUTHORITY` | accepted appointment, control decision and scope |
| Legal/counsel | appointed counsel | route-specific | route opinion/closing evidence when required |
| Rating | appointed rating provider | route-specific | rating/review evidence when required |
| Servicer / collection account | appointed servicer / account provider | route-specific | appointment and account/lifecycle evidence |
| Assurance/review | trustee-appointed provider | external/participant as appointment states | signed scoped result; provider-neutral |
| Subscription / cash | investors and route bank/payment performer | participant/external as route states | subscription/allotment consideration observations |
| Allotment / authoritative record | declared RTA, depository or register | `EXTERNAL_AUTHORITY` | authority declaration, before/after snapshots and final acknowledgement |

`TRUSTEE_TRANSACTION_CONTROL` and `AUTHORITATIVE_RECORD_UPDATE` are distinct mandatory functions.
The trustee cannot acknowledge away a recordkeeper discrepancy; the recordkeeper cannot replace the
trustee's transaction-control decision.

## 4. Minimum evidence and ordered replay legs

Before planning, the case requires current, case-scoped, verified evidence for the programme/trust,
pool-transfer basis, trustee appointment/control, executed transaction documents, declared
authoritative record, and the historic outcome. Rating, counsel, servicer, account and assurance
evidence are conditions only where the approved pack marks them required.

The immutable plan uses the following ordered legs:

1. programme/trust and appointment validation;
2. pool-transfer / asset eligibility evidence;
3. required counsel, rating and trustee-appointed assurance results;
4. executed documents and class/tranche definition;
5. subscription commitment and consideration observation;
6. trustee transaction-control decision;
7. allotment/issue observation;
8. RTA/depository/register authoritative after snapshot and acknowledgement;
9. route-required notices and lifecycle-account setup.

Every observation includes an idempotency key, finality class, provider/external reference,
evidence object, as-of time and independent comparison. A later leg cannot be reconciled before its
required predecessors. Every mismatch creates `ReconciliationBreak` with blocked capability
`CASE_COMPLETION`; no automatic repair or outcome rewriting is permitted.

## 5. PR-10 code work packages

1. Add a PTC route-pack module and strict schema tests independent from the DA adapter.
2. Reuse the generic `TransactionCase`, `CaseParty`, appointment/function-assignment, evidence,
   `SettlementSaga`, authoritative record and reconciliation primitives; do not add a parallel PTC
   status JSON or a token field.
3. Add PTC-specific plan/leg validation, including trustee-control versus authoritative-record
   comparison and provider-neutral assurance appointment/result validation.
4. Add an anonymised fixture only as a structural test. It must be labelled synthetic and cannot be
   presented as the required completed historic replay.
5. Obtain an approved historic PTC evidence pack and replay it in `OBSERVE_ONLY`; retain a
   trustee-authoritative comparison and an RTA/depository/register comparison as separate artefacts.
6. Add the `ARAIL_PTC_REPLAY_V1=allow_list` gate only after those tests and operating runbook exist.

### 5.1 Persistence-foundation checkpoint — 1 September 2026

The first persistence phase is implemented additively and remains runtime-inert:

- `SettlementSaga` now carries an explicit `transactionRoute` and a route-evidence bundle digest;
- the three DA-specific evidence relationships remain available for existing and new DA replays but
  are no longer falsely mandatory for a PTC saga;
- `SagaEvidenceLink` provides immutable, ordered, role-specific evidence references without adding
  PTC facts to an opaque JSON field;
- `PtcReplayAuthorisation` is separate from DA authorisation and retains maker/checker, step-up,
  digest, effective-time and revocation facts; and
- the migration defaults and backfills every existing saga as `DA`, retains all three existing DA
  evidence references, and does not delete or rewrite historic data.

This checkpoint adds no PTC controller, UI, live adapter, feature enablement or external action. A
synthetic database rehearsal proves that a PTC saga can retain trustee-control evidence without
fabricating DA credit-decision or transfer-document references. The next phase is the governed,
case-scoped replay service and operating runbook. The real historic evidence gate in section 6
remains open.

### 5.2 Governed planning-service checkpoint — 1 September 2026

The second phase adds a disabled-by-default, case-scoped planning surface behind
`ARAIL_PTC_REPLAY_V1=allow_list`. It mounts only when participant admission, neutral intake,
transaction cases and the observe-only saga foundation are also enabled in a `REPLAY` or `SHADOW`
runtime. The five endpoints cover only authorisation read/propose/review and saga list/create.

Planning requires the exact domestic conventional PTC route, active originator/trustee/recordkeeper
case parties, independently approved case state, case-owner maker/checker replay authorisation,
current route-function assignments, optimistic case version, and signed/current/verified evidence
objects for every declared evidence role. The service validates each supplied digest against the
latest retained evidence version, stores an ordered evidence-link bundle, preserves trustee control
and authoritative-record acknowledgement as separate plan legs, and writes the saga, legs,
before-snapshot, case version and governed audit atomically.

This phase still exposes no observation, reconciliation, break repair, comparison export, issue,
allotment, cash, notice, RTA/depository/register or external-dispatch command. Its operating
procedure is `docs/runbooks/AssureRail_PR10_Conventional_PTC_Replay.md`. The next phase is the
append-only observation/reconciliation service and evidence export, followed by the external
historic replay gate.

### 5.3 Service/database rehearsal checkpoint — 1 September 2026

The governed planning command now has executable disposable-PostgreSQL evidence. The rehearsal
builds the actual service, migrates a fresh database, seeds only synthetic admitted institutions,
case parties, function assignments and verified evidence, then calls `PtcReplayService.createSaga`.
It proves one atomic PTC saga, 11 ordered legs, 19 role-bound evidence links, null DA-only evidence
fields, one authoritative declaration and one governed audit receipt. Repeating the identical
command returns the same saga; changed content under the same idempotency key is rejected and does
not create a second saga. The resulting history also survives dump/restore. This closes the planning
service database-test gap, not the observation/reconciliation or real historic evidence gates.

### 5.4 Observation and independent-reconciliation checkpoint — 1 September 2026

The third phase adds append-only historic observations to the same case-scoped, disabled-by-default
surface. The declared participant owner records the initial observation with an idempotency key,
external reference, finality, verified signature status, observation time, reason, step-up evidence
and a current retained evidence object whose payload digest exactly matches the canonical observed
facts. No observation can dispatch an external action, and a later leg cannot be observed while an
earlier required leg remains unobserved or broken.

The service compares canonical expected and observed facts and retains both digests and field-level
differences. An exact result moves the leg to `OBSERVED`; a mismatch moves it to `BREAK_OPEN` and
atomically creates a critical `ReconciliationBreak` that blocks `CASE_COMPLETION`. Only a different
authorised human at the same declared owner institution can reconcile an exact observation. An
exact authoritative-record acknowledgement also creates the distinct `AFTER` snapshot; a trustee
decision never substitutes for that recordkeeper evidence.

Read-only break, comparison and evidence-pack endpoints expose the retained result and a stable
digest. The disposable service/database rehearsal proves identical-observation replay, independent
reconciliation, mismatch-to-break behaviour, comparison counts and evidence-pack generation. This
checkpoint adds no break-repair command, external issue/allotment/cash/notice/register action, live
adapter or UI. A participant-authorised historic PTC replay and governed repair workflow remain
open.

## 6. External evidence gate

The following cannot be supplied by code or guessed from a market convention: the named historic
transaction data owner; permission to use the closing evidence; trustee control decision; actual
recordkeeper authority; before/after RTA/depository/register acknowledgement; and any route-specific
counsel/rating/assurance evidence. Until they are received and accepted, the implementation may
complete only schema, fixture and replay-engine work. It must not state that a PTC replay, issue or
venue is live.

## 7. Rejected shortcuts

- calling existing token mint, Note DvP or demo trustee-signing code;
- assuming trustee equals legal recordkeeper;
- hard-coding IDBI, AssureLocker, AssurePlane, a depository or an RTA into the canonical model;
- making assurance compulsory or treating provider capability as a verified transaction result;
- using a screen/status label as evidence of issue/allotment; or
- exposing a primary/secondary PTC venue, matching or tokenised PTC before its separate permissions,
  performer assignments and operating acceptance are evidenced.
