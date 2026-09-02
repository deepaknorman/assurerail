# AssureRail AR-30 production-scale evidence

**Evidence class:** software and synthetic disposable-database evidence only

**Date:** 3 September 2026

**Deployment:** not performed

## Acceptance matrix

| Control                                        | Executed evidence                                          | Result                       |
| ---------------------------------------------- | ---------------------------------------------------------- | ---------------------------- |
| Gate taxonomy/state precedence                 | AR-30 policy tests                                         | Passed                       |
| Exact activation currentness                   | source/boundary tests plus retained PR-12 activation tests | Passed                       |
| Missing/stale integrity and capacity facts     | policy/source tests and DB open-state rehearsal            | Passed fail-closed           |
| Internal assessment/review separation          | internal RBAC tests and DB maker/checker rehearsal         | Passed                       |
| Immutable additive persistence                 | Prisma validation, migration inspection and schema parity  | Passed                       |
| Idempotency and control-change guard           | service rehearsal and source tests                         | Passed                       |
| Deterministic evidence pack                    | two-export digest comparison in DB rehearsal               | Passed                       |
| No gate closure, activation or external action | boundary tests and zero-row DB assertions                  | Passed                       |
| Internal UI and fail-closed flags              | AR-30 web check and 25-page production build               | Passed                       |
| Backup/restore                                 | disposable PostgreSQL dump/restore verification            | Passed                       |

## Test accounting

The full API corpus after AR-30 control hardening passed **366/366**, with zero failed and zero
skipped. Static architecture/security invariants, all eleven current web boundary checks and the
25-page production build passed. The disposable PostgreSQL rehearsal applied all 32 migrations from
zero, exercised the service, verified schema parity, restored a dump and confirmed the retained
row counts. The first sandboxed build attempt could not reach Google Fonts; the build was rerun with
network access and passed. That environmental failure is not counted as a product failure.

The final `assurerail-integrated-release-check.sh --full` run also repeated every available
disposable PR-02 through AR-30 migration/service/restore rehearsal and completed with `PASS`. It
reported external evidence not tested, external gates remaining open and no deployment performed.

No external test is counted as executed. VAPT, counsel, participant, trustee, provider,
authoritative-record, DR, customer, pilot and production-acceptance evidence remain open.

## Explicit non-evidence

- A synthetic database row is not a VAPT or provider certificate.
- A successful build is not customer acceptance.
- An acknowledged assessment is not an activation.
- An activation is not current unless every exact retained binding remains current.
- AR-30 adds no implemented live capability.
