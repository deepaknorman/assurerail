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
