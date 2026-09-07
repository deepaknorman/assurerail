# AssureRail SIM-100 execution evidence

**Execution date:** 7 September 2026

**Candidate branch:** `codex/ar-sim-100-gate`

**Starting commit:** `5f1ee241b92c16ad8d40abc57d8dedd5cc4ac472`

**Classification:** internal software evidence from synthetic fixtures; not customer, legal,
regulatory, VAPT, connector, settlement or production evidence

## Result

The complete AssureRail cumulative gate passed with `SIM-100` registered as its final database
rehearsal:

```text
[SIM-100-DB] PASS scenarios=200 parties=800 persisted-intakes=19
recovered-intake=verified mid-saga-restart=verified restore=verified external-evidence=not-tested
[ARAIL-INTEGRATED] PASS mode=--full external-evidence=not-tested
external-gates=remain-open deployment=not-performed
```

The deterministic scenario contract was:

```text
corpus version: assurerail.multi-party-simulation.v1
corpus digest:  sha256:e92c0bbdb9298d23c4714d9f880e1afc0e0ca491747946fa0865f3c89f9d200e
assertions:      200 passed, 0 failed
```

## What was executed

The cumulative run completed:

- shell syntax checks for every `scripts/assurerail-*.sh` file;
- scoped diff hygiene and the static architecture/safety invariant suite;
- the complete API compilation and test corpus: 373 tests passed, 0 failed;
- all 13 web boundary checks, including private-demo and full-system-demo access boundaries;
- the AssureRail web production build; and
- 25 fresh-database rehearsals: PR-02 through PR-17 as applicable, PR-19, PR-20, AR-22,
  AR-25, AR-26, AR-27, AR-29, AR-30 and SIM-100. Each rehearsal provisions a disposable local
  PostgreSQL database and includes its declared migration/service/restore checks.

SIM-100 itself persisted and reverified:

| Record or proof | Verified count |
|---|---:|
| scenario cases | 200 |
| case-party rows | 800 |
| monitoring intake submissions | 19 |
| monitoring evidence versions | 19 |
| consumed, one-use step-up records | 140 |
| reproducible case replay receipts | 1 |
| pending external instructions | 1 |
| executing observe-only sagas | 1 |
| observed saga legs | 1 |

The stopping-point distribution also matched the frozen corpus contract:

| Gate | Scenarios |
|---|---:|
| case participation/non-disclosure | 20 |
| connector certification | 18 |
| institution authority | 20 |
| participant topology | 14 |
| provider evidence | 90 |
| Rail review required | 18 |
| session/step-up context | 20 |

The nineteenth intake was deliberately left durable but unmaterialised, then submitted through two
concurrent identical retries. Both returned replay semantics and the same evidence coordinates; the
database retained exactly one version for that intake.

The database was then stopped and restarted while the observe-only saga remained `EXECUTING` and
the external instruction remained `PENDING`. All counts and intermediate states survived. A
`pg_dump` was restored into a second fresh database and the same persisted controls were verified
again.

## Defect found and corrected by the gate

The first rehearsal exposed a genuine JSON-evidence idempotency defect. When
`PersistenceFoundationService` correctly classified an identical intake as a replay,
`EvidenceIntakeService` still attempted to create another evidence version for the same intake
submission, violating the one-submission/one-materialisation invariant.

The corrected path returns the original evidence object, version and source-reference coordinates.
If an identical retry observes a durable intake without materialised evidence, it safely resumes
materialisation. Under concurrency, database uniqueness selects one winner and the losing caller
returns the same coordinates instead of leaking a storage conflict or creating an orphan object.
The completed rehearsal proved this recovery path, ordinary identical replay and rejection of
changed-content reuse of the same idempotency key.

## Explicit limits and open gates

This result proves repeatable software behaviour over synthetic data and local infrastructure only.
It does **not** establish:

- participant admission, consent or institutional authority supplied by a real institution;
- a counsel-ratified DA or PTC route pack;
- trustee, RTA, depository, register, payment, custody, ledger or token-network finality;
- external connector acceptance, customer security review, independent VAPT or Azure readiness;
- historic transaction parity, a shadow transaction result, controlled-live acceptance or
  production readiness; or
- that the 200 scenarios are completed financial transactions.

Accordingly, `syntheticOnly` remained `true`, `externalEvidenceGatesClosed` remained `false`, no
runtime feature flag or operating mode was changed, and no deployment was performed.
