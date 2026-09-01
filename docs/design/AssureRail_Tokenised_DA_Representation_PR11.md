# AssureRail tokenised-DA representation adapter — PR-11 as built

**Status:** implemented for review; not deployed

**Date:** 2 September 2026

**Freeze authority:** EX-26

**Operating boundary:** `REPLAY` and `SHADOW`, `OBSERVE_ONLY`; no external dispatch

## 1. Outcome

PR-11 connects the legacy tokenised `Note` demonstration to the neutral AssureRail transaction
kernel without renaming the Note into a generic legal instrument and without treating its ledger as
the legal ownership record.

The implementation establishes four separate facts:

1. the Rail `TransactionCase` describes a domestic tokenised DA route;
2. the legacy `Note` is a compatibility projection linked one-to-one to that case;
3. a route-approved `AuthoritativeRecordDeclaration` identifies the legally controlling external
   record; and
4. `TokenRepresentation.authorityMode` is `MIRROR`.

The token therefore remains a technical representation. Its existence, supply or holder list does
not displace the approved lender/register/source record.

## 2. Selected and rejected choices

### Selected

- additive `TokenRepresentation`, `TokenAction`, `TokenReconciliationSnapshot` and
  `TokenReconciliationBreak` records;
- exactly one token representation per transaction case and exactly one case linkage per legacy
  Note in PR-11;
- an active, case-scoped authoritative-record declaration before linkage;
- authenticated user, active session, active institution, scoped `OPERATE_ROUTE` mandate, current
  tokenised-DA route entitlement and active `TOKEN_REPRESENTATION_MANAGEMENT` function assignment
  for every governed write;
- recent single-use step-up evidence for linkage, action preparation, action observation and
  reconciliation;
- durable `ExternalInstruction` and `ExternalAcknowledgement` records for external effects;
- explicit `OBSERVE_ONLY` and `dispatchProhibited: true` on every PR-11 action;
- acknowledgement evidence that binds both the instruction request digest and expected-action
  digest;
- exact integer-string values for token units and payment minor units;
- supply, token-holder, economic-interest and authoritative-record comparison on every
  reconciliation snapshot;
- critical blocking breaks for every mismatch; and
- governed audit records written atomically with the corresponding domain fact.

### Rejected

- making the token or Note ledger the legal authority by default;
- calling HTS, HCS or a payment adapter from the PR-11 service;
- enabling the adapter in `CONTROLLED_LIVE` or `PRODUCTION`;
- permitting secondary token transfers under PR-11;
- accepting a body-supplied actor, institution or mandate;
- accepting unsigned, stale, unavailable, cross-case or non-participant evidence;
- treating an acknowledgement ID, status string or provider capability declaration as evidence;
- allowing linked Notes to continue through direct legacy DvP, amortisation, closure, surveillance
  anchoring or break-glass anchoring; and
- exposing linked Notes through the global legacy Note portfolio/report/holding reads.

## 3. Runtime gate

The new feature flag is:

```text
ARAIL_TOKENISED_DA_V1 = off | allow_list
```

It defaults to `off`. `allow_list` is accepted only when all of the following are true:

```text
ASSURERAIL_OPERATING_MODE = REPLAY | SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1 = shadow
ARAIL_NEUTRAL_INGRESS_V1 = shadow
ARAIL_TRANSACTION_CASE_V1 = shadow
ARAIL_EXTERNAL_ACTION_SAGA_V1 = required
```

The application rejects PR-11 enablement in sandbox, controlled-live and production modes. Replay
and shadow runtime rules also reject live HTS, HCS and settlement adapters.

## 4. Persistence

### `TokenRepresentation`

Owns the one-to-one case/Note linkage, token network and ID, unit scale, authoritative-record
declaration, mirror-only authority mode, status and immutable linkage command evidence.

Statuses currently used are `LINKED`, `RECONCILED` and `BREAK_OPEN`. `SUSPENDED` is reserved for a
later governed suspension command; it is not set through an arbitrary patch endpoint.

### `TokenAction`

Links an ordered, idempotent case action to a durable `ExternalInstruction`. Supported action types
are:

```text
MINT | TRANSFER | PAYMENT | ANCHOR | AMORTISE_BURN | CLOSE_BURN
```

Every action is `OBSERVE_ONLY`. Preparing one records intended/expected facts with instruction state
`SHADOW_RECORDED`; it does not call an external system and is not a pending dispatch job. Its
external instruction is also not selected by the existing AssurePool completion worker, which
accepts only `SOURCE_LOCK_PERMANENT` instructions.

Action-specific validation requires:

- positive canonical `unitsMinor` for mint/burn;
- distinct seller/buyer and positive canonical units for transfer;
- distinct payer/payee, positive canonical amount, three-letter currency and explicit scale for
  payment; and
- a valid SHA-256 payload digest for anchoring.

### `TokenReconciliationSnapshot`

Append-only snapshot containing:

- declared token supply;
- canonical sorted token positions;
- canonical economic-interest positions;
- canonical authoritative-record positions;
- an available, signed, valid, verified and case-scoped evidence object from an active participant;
- source as-of time;
- each exact comparison and digest; and
- `MATCHED` or `BREAK_OPEN` result.

The evidence version's payload digest must equal the digest of the submitted supply, all three
position sets and source timestamp. A generally valid but differently scoped evidence file cannot
satisfy this command.

### `TokenReconciliationBreak`

Every failed comparison creates a critical break with expected/observed values and digests, owner,
24-hour due time and blocked capabilities:

```text
TOKEN_TRANSFER | TOKEN_BURN | CASE_COMPLETION
```

No automatic correction or overwrite occurs. Break resolution is deliberately deferred to a later
maker-checker repair command rather than being improvised inside PR-11.

## 5. API

All endpoints derive the user, session and active institution from authenticated request context:

```text
GET  /v1/rail/cases/:caseId/token-representation
POST /v1/rail/cases/:caseId/token-representation/link
POST /v1/rail/cases/:caseId/token-representation/actions
POST /v1/rail/cases/:caseId/token-representation/actions/:actionId/observations
POST /v1/rail/cases/:caseId/token-representation/reconciliations
```

There is no mint, burn, transfer, payment, settlement or dispatch endpoint in this module.

## 6. Legacy compatibility and cutover behaviour

Unlinked Notes retain the existing demonstration behaviour so the current explicit demo remains
reproducible. Once a Note is linked:

- direct legacy DvP, amortisation and closure fail before selecting an external adapter;
- direct legacy surveillance and break-glass anchoring fail before external anchoring;
- legacy Note portfolio/list queries omit it; and
- legacy holdings, DvP, surveillance, report and CSV paths return not-found rather than revealing a
  governed case through global role-based access.

The case-scoped PR-11 read becomes the sole supported view of the linked projection. This is a
strangler cutover at the individual Note boundary, not a big-bang rewrite.

## 7. Reconciliation rules

All holder lists use `{ holderRef, unitsMinor }`, reject duplicates and sort by holder reference.
Amounts reject signs, fractions, exponent notation and leading zeros. Three comparisons are made:

1. token supply equals the sum of token positions;
2. token positions equal economic-interest positions; and
3. economic-interest positions equal the authoritative external record.

The representation is `RECONCILED` only if all three comparisons match. Any mismatch moves the
projection to `BREAK_OPEN`. Observed token actions become `RECONCILED` only after a fully matched
snapshot.

## 8. Safety, recovery and rollback

- Every mutating command is idempotent and rejects reuse with different content.
- Advisory transaction locks serialize per-representation action sequence and reconciliation
  version allocation.
- Governed audit append occurs in the same database transaction as the domain write.
- Foreign keys use `RESTRICT`; linked Notes, declarations, instructions, evidence and snapshots
  cannot be silently deleted.
- The migration is additive. Rollback means setting `ARAIL_TOKENISED_DA_V1=off`; records remain
  retained and exportable.
- A linked Note must not be squeezed back through a lossy legacy write path. If the PR-11 module is
  disabled, it pauses rather than reverting external facts.
- No confirmed external state is reversed by database rollback.

## 9. Deliberate limitations

PR-11 does not:

- issue a new live token;
- move cash or token units;
- anchor data externally;
- prove key custody, network finality or payment finality;
- support secondary transfer/trading;
- resolve reconciliation breaks;
- provide a controlled-live operating acceptance; or
- make a production/public capability claim.

Those remain subject to PR-12 operating acceptance and later route-specific live connector work.

## 10. Acceptance evidence

See `docs/qa/AssureRail_PR11_Tokenised_DA_Evidence.md`. The executed checks cover schema validity,
build/type safety, 221 API/unit/contract tests and a disposable PostgreSQL fresh-migration,
service/idempotency, divergence, schema-parity, backup and restore rehearsal.
