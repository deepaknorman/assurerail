# AssureRail PR-02 persistence foundation — executed evidence

**Execution date:** 30 August 2026  
**Branch:** `codex/assurerail-pr01-neutral-taxonomy`  
**Parent baseline:** `220afb53b01d50a955b77e00b1ac8f4fccd3da78` (`origin/main` when the
PR-02 work started)  
**Scope:** local build, test, disposable-database and static-security evidence. This is not a
deployment record, production approval, live-provider certification, route approval or evidence
that DA/PTC execution is available.

## Result

PR-02 passed its final local gate. The migration and code are additive except for the deliberate,
documented disabling of legacy webhook subscriptions and clearing of their plaintext HMAC secrets.
No environment was deployed and no live webhook, Vault, payment, ledger, trustee, RTA, depository or
AssureLocker provider call was made.

## Executed checks

| Check | Executed result |
|---|---|
| `bash ./scripts/assurerail-build-check.sh` | **PASS** after the correction described below |
| AssureRail static invariants | **PASS**: 58 reviewed endpoints; ten PR-02 models; migration secret clearing; durable claim/dead-letter/pre-verification boundary; SSRF/rebinding; Vault and live-startup guards |
| AssureRail API no-egress build | **PASS** under the macOS deny-network sandbox profile |
| AssureRail API tests | **106 passed, 0 failed, 0 skipped** |
| Transfer-room golden characterisation | **26 passed, 0 failed** |
| AssureRail web production build | **PASS**; ten static app routes generated |
| `npm run typecheck` in `apps/assurerail-api` | **PASS** |
| Prisma schema validation | **PASS** |
| `bash -n` for `scripts/assurerail-*.sh` | **PASS** |
| `shellcheck` | Not executed: the optional binary was not installed on the workstation |
| Gitleaks outgoing-history scan | **PASS**: 5,664 commits / approximately 927.94 MB scanned; no leaks found |
| Semgrep | **PASS**: 128 rules over 27 files; zero findings; three repository-ignored files reported by Semgrep |
| Diff whitespace check for the PR-02 file set | **PASS** |

The API result includes positive and negative coverage for:

- command request-digest idempotency and changed-payload conflict;
- denial of idempotent response replay across institution/case ownership boundaries;
- compare-and-set completion and retained response digests;
- provider instruction deduplication;
- durable retry/dead-letter classification and stable delivery IDs;
- stale delivery recovery;
- immutable payload digest enforcement before egress;
- HTTPS-only endpoint syntax, private/reserved address blocking and DNS preflight;
- Vault-reference-only subscription persistence;
- operator-visible fail-closed handling when Vault provisioning does not complete;
- endpoint-control challenge plus HMAC proof of secret possession;
- startup rejection of unsafe persistence/relay combinations;
- rejection of static Vault-token authentication in controlled-live/production modes; and
- the existing PR-00/PR-01 and current-risk characterisation corpus.

## Disposable Postgres rehearsal

Executed:

```bash
npm run db:rehearse:pr02 --workspace=@code/assurerail-api
```

The rehearsal used an isolated local Postgres instance in a uniquely named temporary directory and
ignored the developer's `DATABASE_URL`. Final result:

```text
[PR02-DB] PASS fresh=10-models idempotency=bounded stale-claim=recovered
legacy-secret=disabled+cleared queue-index=used restore=50000
```

The script proved:

1. all nine committed Rail migrations apply to an empty database;
2. all ten PR-02 neutral models exist;
3. command, external-instruction and billing uniqueness bounds duplicate effects;
4. a stale claim is recovered without creating a replacement durable row;
5. an upgraded legacy webhook is inactive, marked with an operator-visible reason and has no
   plaintext secret;
6. the due-outbox query uses the intended queue index with 50,000 rows; and
7. custom-format backup/restore preserves 50,000 outbox rows and an up-to-date Prisma migration
   ledger.

The local sandbox initially blocked Postgres shared memory; the same repository script was therefore
rerun with permission outside that filesystem/process sandbox. It still used only the validated
temporary directory and local loopback database created by the script.

## Corrected gate issue

The first full-gate run found one test-harness timing issue, not a runtime assertion failure: the
DEMO startup child process reached normal Nest module initialisation but exceeded the old 15-second
probe deadline while the full Node test corpus was running concurrently. Earlier isolated execution
had completed in under five seconds.

The probe was corrected to remove every new PR-02 flag and Vault credential from its inherited test
environment and to allow a 30-second process-start window. The final full run reached the expected
DEMO startup marker in approximately 13.9 seconds, and both startup-process tests passed. No runtime
guard was weakened.

## Evidence boundaries and open work

PR-02 proves local durability primitives and a migration/restore path. It does **not** prove:

- production Vault policy, availability, rotation or recovery;
- a certified customer webhook receiver or ambiguous-success reconciliation across a real network;
- institutional tenancy, admission, mandate or route entitlement (PR-03);
- transaction-case or case-object authorisation (PR-06);
- live payment, token, authoritative-register or trustee integrations;
- a completed DA/PTC route; or
- repair of the current external-action sequencing and audit atomicity findings `AR-C04`, `AR-C05`
  and `AR-H10`.

Those boundaries remain fail-closed in the implementation register. No deployment or product claim
was made from this test result.
