# AssureRail PR-03 institution authority — executed evidence

**Execution date:** 30 August 2026

**Branch:** `codex/assurerail-pr01-neutral-taxonomy`

**Implementation commit:** `06c39deef` (`feat(assurerail): add institutional authority foundation`)

**Scope:** local build, unit/contract/static-security checks and disposable Postgres migration,
startup and restore rehearsal. This is not a deployment record, production approval, live-provider
certification, licence conclusion, participant admission or route approval.

## Result

PR-03 passed its focused implementation checks and every applicable repository-gate constituent. It
is additive and runtime-inert by default. No environment was deployed, no external identity/KYB,
payment, ledger, trustee, RTA, depository or AssureLocker call was made, and no route was enabled
beyond local `SHADOW`/compare testing.

## Executed checks

| Check | Result |
|---|---|
| Prisma schema validation | **PASS** |
| TypeScript compile/typecheck | **PASS** |
| AssureRail static invariants | **PASS** |
| AssureRail API tests | **129 passed, 0 failed, 0 skipped** |
| PR-03 disposable Postgres rehearsal | **PASS** |
| PR-03 SHADOW startup probe against disposable Postgres | **PASS** |
| Fresh migration and custom-format restore/migration status | **PASS** |
| `bash -n scripts/assurerail-pr03-db-rehearsal.sh` | **PASS** |
| No-egress AssureRail API production build | **PASS** |
| AssureTransfer room golden gate | **26 passed, 0 failed, 0 skipped** |
| AssureRail web production build | **PASS**, 9 static routes |
| Working-tree Gitleaks scan (`apps/assurerail-api`) | **PASS**, no leaks in 560.66 KB |
| Outgoing-history Gitleaks scan | **PASS**, no leaks across 5,669 commits / 928.12 MB |
| Semgrep on new PR-03 source, with git-ignore disabled | **PASS**, 128 rules / 13 files / 0 findings |
| Semgrep on tracked AssureRail source | **PASS**, 129 rules / 153 files / 0 findings |

The 129 API tests include the existing PR-00/PR-01/PR-02 corpus plus PR-03 coverage for:

- identity binding without legacy allow-list admission;
- denial of identity rebinding that would reactivate a suspended account;
- provider-adapter fail-closed behavior;
- active session and institution-context binding;
- legacy entity-role denial for suspended/non-allowlisted users;
- exact user/session/institution/purpose/expiry/one-use step-up evidence;
- cross-session/institution step-up denial;
- distinct admission, mandate and entitlement makers/checkers;
- denial of participant self-grant for route permission;
- active institution/admission/member/mandate evaluation;
- immediate denial after suspension or legacy projection;
- exact mandate scope and expiry;
- retained evidence during provider outage and expiry failure;
- separation of expected and achieved provider cross-checks;
- exact route/function/mode evaluation and `PROHIBITED` denial;
- service-principal suspension denial;
- all 16 versioned endpoint/access classifications; and
- route API denial when compare mode is off.

The aggregate build-check wrapper was also executed. Its first restricted-process run reported two
environmental failures: macOS `sandbox-exec` was not permitted to initialise inside the existing
process sandbox, and Next.js could not download the three declared Google Fonts without network
access. The identical API build passed inside the repository's deny-network `sandbox-exec` profile
when run with local process permission, and the web production build passed when allowed to fetch
those fonts. The wrapper's report-first Semgrep invocation also encountered a local CA-initialisation
error; both the tracked-source and explicit not-yet-committed-source scans were then run directly
from the repository-cached rule packs and passed with zero findings. No failed substantive build,
test, migration, secret or SAST finding was waived.

## Disposable Postgres evidence

Executed:

```bash
npm run db:rehearse:pr03 --workspace=@code/assurerail-api
```

The first sandboxed attempt could not allocate a PostgreSQL shared-memory segment. The same checked
repository script was rerun with permission outside the process sandbox. It still ignored the
developer's `DATABASE_URL`, bound only to local loopback and used a validated, uniquely named
temporary directory.

Final marker:

```text
[PR03-DB] PASS fresh=11-models startup=shadow legacy=reference-only
admission=none mandates=0 entitlements=0 constraints=bounded restore=11-models
```

The rehearsal proved:

1. all ten Rail migrations apply to an empty database;
2. all eleven PR-03 tables, relations and indexes exist;
3. the real compiled module graph starts and closes cleanly in `SHADOW` with the PR-03 flags;
4. two legacy users sharing one entity reference create one `LEGACY_REFERENCE_ONLY` institution,
   one `NOT_ADMITTED` admission and two `LEGACY_PROJECTED` memberships;
5. that projection creates zero mandates and zero route entitlements;
6. historical DID presence backfills only identity-provider binding;
7. membership uniqueness and mandate foreign keys reject ambiguous/orphan rows; and
8. a nullable mandate scope cannot bypass version uniqueness and only one proposal may remain
   pending for an exact member/action/scope; and
9. backup/restore preserves all eleven models and an up-to-date Prisma migration ledger.

## Evidence boundary and open findings

PR-03 does not prove or claim:

- an institutional UI, accessibility or operator approval inbox (PR-04);
- automated signed provider intake, object storage or malware controls (PR-05);
- transaction-case, condition, decision or case-object ACL enforcement (PR-06);
- enforcement on legacy Note, document, report or room routes;
- service-principal credential issuance/authentication;
- WebAuthn assertion step-up or production TOTP secret/recovery controls (`AR-M18`);
- atomic legacy `AuditLog` append for every governance transaction (`AR-H10` remains open);
- a live trustee/assurance, RTA/depository, payment or ledger connector;
- a live DA/PTC route; or
- deployment.

The implementation is therefore correctly labelled `SHADOW`/compare-only and remains disabled by
default.
