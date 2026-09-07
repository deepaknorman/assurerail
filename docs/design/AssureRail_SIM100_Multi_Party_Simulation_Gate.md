# AssureRail SIM-100 multi-party simulation gate

**Status:** implemented software gate; synthetic evidence only

**Scope:** AssureRail standalone repository

**Purpose:** establish broad, repeatable failure-path confidence before any real institution is admitted to a Rail test cohort.

## Decision

No real institution should enter an AssureRail replay, shadow or pilot cohort until the complete
`SIM-100` gate passes at the candidate build commit. This is a software-quality gate. It does not
replace a participant-authorised historic replay, counsel approval, VAPT, connector acceptance,
trustee/RTA/depository evidence, controlled-live acceptance or production approval.

The gate deliberately contains **200 distinct scenarios**, not 200 repetitions of one flow:

```text
2 transaction routes (DA, PTC)
× 2 representations (conventional, tokenised)
× 5 party counts (2, 3, 4, 5, 6)
× 10 evidence/authority conditions
= 200 scenarios
```

The canonical corpus digest is
`sha256:e92c0bbdb9298d23c4714d9f880e1afc0e0ca491747946fa0865f3c89f9d200e`.
Any matrix change must be reviewed as a changed test contract, not silently absorbed.

## What each persisted scenario exercises

Every scenario is created in a fresh disposable PostgreSQL cluster after all migrations are applied.
It retains a synthetic case, its exact number of active parties, participant admission, membership,
scoped mandates, route entitlement and session context. The runner invokes production classes rather
than an authorization bypass:

- `InstitutionAccessService` evaluates membership, mandate and route entitlement;
- `CasesService` enforces institution/case non-disclosure;
- `StepUpService` issues and consumes one-use, purpose- and institution-bound evidence;
- `AssureLensMonitoringService` verifies Ed25519 signatures and provider-package invariants;
- `EvidenceIntakeService` enforces participant scope and connector certification and persists the
  result as `REVIEW_REQUIRED`; and
- `PersistenceFoundationService` exercises intake and external-instruction idempotency.

Supporting party rows are test fixtures. They are not treated as customer admission evidence, legal
appointments or consent. No endpoint, provider, money rail, token network or authoritative register
is contacted.

## The ten conditions and expected stopping point

| Condition | Expected result |
|---|---|
| no injected fault | valid provider evidence is retained, but the Rail result remains `REVIEW_REQUIRED` |
| payload changed after signing | provider-evidence gate blocks on digest mismatch |
| signature made by an untrusted key | provider-evidence gate blocks before intake |
| expired signed package | provider-evidence gate blocks |
| inconsistent coverage arithmetic | provider-evidence gate blocks; no optimistic rounding |
| raw PAN-like identifier in output | privacy boundary blocks before persistence |
| inactive institution member | authority gate blocks; issued step-up remains unconsumed |
| active session bound to another institution | step-up issuance blocks |
| valid institution actor who is not a case party | case is returned as not found; its existence is not disclosed |
| connector lacking an approved shadow certification | intake blocks after signature verification |

Identity, authority and case non-disclosure precede topology diagnostics. This is intentional: an
unauthorised caller must not learn that a case exists or has a missing participant. For an authorised
caller, a PTC with only issuer and trustee blocks because the route-defined recordkeeper is absent.
Tokenisation never cures a missing legal/operating participant.

## Operational fault evidence

After the 200 scenario outcomes pass, the runner also proves:

1. two concurrent identical external-instruction requests create exactly one instruction and return
   one original plus one replay result;
2. reuse of the idempotency key with different content is rejected;
3. an intake accepted before evidence materialisation is safely completed by two concurrent
   identical retries, producing exactly one evidence version;
4. a case replay produces one reproducible receipt across repeated requests;
5. an observe-only saga and one observed leg survive a hard database stop/start while still
   mid-flight;
6. a pending external instruction also survives that restart; and
7. a database backup restored into a new disposable database reproduces all control counts and
   intermediate states.

The first execution found and caused correction of a real JSON-intake replay defect: an accepted
intake replay previously tried to create a second evidence version. The corrected path returns the
original evidence coordinates. If an accepted intake has no materialised evidence because a process
stopped or another request is still working, an identical retry resumes materialisation. Database
uniqueness selects one winner and every caller receives the same coordinates without an orphan
evidence object.

## Safety boundaries

The TypeScript runner refuses to start unless all three conditions hold:

- `ARAIL_DISPOSABLE_SIMULATION_DATABASE=SIM100_ONLY`;
- the database host is loopback (`127.0.0.1`, `localhost` or `::1`); and
- the database name begins `assurerail_sim100_`.

The shell wrapper creates its own temporary Postgres cluster, never reads a configured
`DATABASE_URL`, checks its scratch-path prefix before deletion, and removes the cluster on exit.
Fixture addresses use `example.invalid`; provider keys are ephemeral; the report contains no private
keys, secrets or borrower data.

## Evidence classification

The machine-readable report records scenario counts, stopping-point counts, persisted-control counts,
the canonical corpus digest and explicit fields `syntheticOnly: true` and
`externalEvidenceGatesClosed: false`. Runtime UUIDs and timestamps are not used as a determinism
claim. Determinism applies to the scenario contract, its expected outcome and the replayed state
machine—not to incidental record identifiers.

This gate may support entry into a real-data rehearsal after the other prerequisites are met. It may
not be described as 200 completed transactions, 200 end-to-end external settlements, a passed VAPT,
or evidence that DA/PTC/tokenised routes are legally or operationally live.

## How to run

Narrow gate:

```bash
npm run db:rehearse:sim100 --workspace=@assurerail/api
```

Complete cumulative gate:

```bash
bash scripts/assurerail-integrated-release-check.sh --full
```

`SIM-100` is registered only in `--full` because it provisions a database, runs 200 persisted
scenarios, restarts the cluster and performs backup/restore. Normal compilation still runs the pure
corpus tests and checks the fixed digest.
