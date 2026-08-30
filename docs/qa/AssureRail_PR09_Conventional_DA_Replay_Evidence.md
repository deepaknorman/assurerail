# AssureRail PR-09 conventional DA replay evidence

**Executed:** 31 August 2026
**Scope:** local code, unit/contract/startup tests and disposable PostgreSQL only
**Excluded:** deployment, live provider calls, real money/title/register changes, customer acceptance,
real historic transaction replay and PR-10 PTC work

## 1. Automated checks

### Rail API test suite and build

Commands:

```bash
npm test --workspace=@code/assurerail-api
npm run build --workspace=@code/assurerail-api
```

Result:

- Prisma client generation succeeded;
- TypeScript compilation succeeded;
- **185 tests passed, 0 failed, 0 skipped**; and
- the independent build completed successfully.

The eleven new PR-09 tests cover:

- case-scoped endpoint inventory;
- the eight additive persistence models and restrictive migration;
- absence of settlement/token/anchor/webhook egress imports from the replay service;
- participant-owned transferee credit decision;
- no automatic trustee/assurance requirement;
- deterministic completed-deal-shaped reference replay;
- explicit expected/observed difference reporting;
- fail-closed saga state when a break exists;
- exact/non-ambiguous consideration values; and
- spreadsheet-formula neutralisation plus correct quoting in the downloadable CSV.

Existing case-state tests now separately prove saga readiness, all-leg observation and final
reconciliation. Runtime tests prove the DA adapter cannot mount without its full foundation and is
rejected in demo, sandbox, controlled-live and production modes.

### Schema validation and shell syntax

Commands:

```bash
npx prisma validate --schema=prisma/schema.prisma
bash -n scripts/assurerail-pr09-db-rehearsal.sh
```

Result: both passed.

### Disposable PostgreSQL rehearsal

Command:

```bash
bash scripts/assurerail-pr09-db-rehearsal.sh
```

Result:

- fresh database deployed all **15** Rail migrations;
- all **8** PR-09 tables existed;
- one case/saga version was enforced;
- an existing observation version could not be rewritten;
- a reconciliation command could not be duplicated within a saga;
- every referenced evidence object, including the four saga/declaration inputs, could not be
  deleted;
- applying PR-09 on a PR-08 database retained the pre-existing case;
- the schema comparison found no PR-09 table/index/constraint drift;
- custom-format backup and restore retained the observation; and
- restored migration status was current.

Terminal receipt:

```text
[PR09-DB] PASS models=8 one-plan=enforced observations=append-only
history=restrictive upgrade=retained restore=1-observation
```

The rehearsal creates and destroys an isolated local PostgreSQL cluster and never reads the shell's
configured `DATABASE_URL`.

## 2. Acceptance mapping

| PR-09 acceptance point | Evidence achieved | Status |
|---|---|---|
| Durable multi-leg state | Additive saga/leg/observation/break/repair tables; atomic service transactions; DB restart/restore rehearsal | Passed for replay persistence |
| No duplicate action on retry | Authorisation, saga, observation, reconciliation and repair command receipts; request-digest checks; DB uniqueness; repair compare-and-set | Passed for non-mutating commands |
| No completion before cash/register/source facts reconcile | Case engine separates ready, observed and reconciled facts; open breaks and unmatched applicable source completion block | Passed in code/tests; real route replay pending |
| Transferee decision remains participant-owned | Fixed route leg/evidence ownership and test | Passed |
| No injected trustee/assurance | Required roles limited to transferor/transferee; static/perimeter test | Passed |
| Differences explicit, no auto-correction | Canonical field comparison, critical break and append-only maker-checker repair | Passed |
| Comparison/evidence outputs | JSON, formula-neutralised CSV and stable-digest evidence pack with exact retained-evidence IDs | Built; participant acceptance pending |
| No money/ownership mutation | Runtime gate, `OBSERVE_ONLY`, no mutating adapter import or `ExternalInstruction` creation | Passed for PR-09 perimeter |
| One completed historic DA replay | Anonymised reference outcome only; no authorised real historic corpus was supplied | **Open—must not be claimed as passed** |
| Kill/network at every external step | Atomic non-network commands and DB recovery tested; PR-09 deliberately has no external call to fault-inject | Partially applicable; live connector fault injection deferred to its introducing PR |

## 3. Accuracy limitation discovered

The route requires evidence versions with `validationStatus=VALID`, `signatureStatus=VERIFIED` and
`result=VERIFIED`. The existing PR-05 intake correctly stores raw provider documents/assertions as
`REVIEW_REQUIRED` and signatures as unverified until cryptographic/provider verification is
actually achieved. No manual promotion is permitted.

Therefore a genuine historic replay is intentionally blocked until a verified-evidence workflow or
approved signed-provider adapter supplies those facts. This is a safe dependency, not a test
failure. It must be resolved and exercised with real authorised input before the real-historic-
replay acceptance point can close.

## 4. Claim boundary

This evidence supports these statements only:

- the observe-only conventional-DA route, persistence, governance and comparison code builds;
- automated regression and disposable database checks pass; and
- PR-09 cannot dispatch a live external action.

It does not support a statement that AssureRail has completed a real DA transfer, moved
consideration/title, connected an authoritative register, passed customer acceptance, or is ready
for controlled-live/production operation.
