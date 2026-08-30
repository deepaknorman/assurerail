# AssureRail PR-00 — Characterisation and Evidence Record

**Status:** implemented; full local release gate passed on 2026-08-30

**Code baseline verified:** `origin/main` / `336fa6d62dc02df6a1eca269677a957ed74ea32b`

**Scope:** tests, source contracts, startup claim guards and internal documentation only

**No scope:** no new route model, transaction UI, customer-facing copy, tenant model or lifecycle fix

## 1. Why PR-00 exists

AssureRail already contained useful tokenised-DA demonstration code, while AssureTransfer contained a
strong transfer-room implementation and AssurePool contained pool/tape preparation. The next stages
will introduce a provider-neutral conventional DA and conventional PTC kernel without losing useful
current behaviour or silently treating a demonstration as production evidence.

PR-00 therefore freezes the current observable surface and makes known risks executable. It does not
pretend to correct the risks. In particular, several tests are expected to pass because they reproduce
an unsafe current sequence. A green `[CURRENT_SEQUENCE][AR-…]` test means “the finding is still present
and accurately characterised,” not “the sequence is safe.” The later remediation PR must deliberately
change the expectation and replace it with a recovery/idempotency/reconciliation test.

The governing implementation register is
`docs/design/AssureRail_Code_Capability_Baseline_And_Implementation_Register.md`.

## 2. Changes made

### 2.1 Explicit operating/evidence modes

`apps/assurerail-api/src/runtime/runtime-profile.ts` defines six modes:

| Mode | Current PR-00 startup contract | What a passing configuration proves |
|---|---|---|
| `DEMO` | Persistent DB and Firebase are optional; demo endpoints may be enabled; every external adapter must be `demo` | Only that an isolated demonstration configuration is internally consistent |
| `REPLAY` | DB and Firebase required; demo endpoints forbidden; live HTS/HCS/settlement mutations forbidden | Authenticated persistent replay configuration, not an executed replay or route correctness |
| `SHADOW` | DB and Firebase required; demo endpoints forbidden; live HTS/HCS/settlement mutations forbidden | Authenticated persistent shadow configuration, not a completed customer shadow run |
| `SANDBOX` | DB and Firebase required; demo endpoints forbidden; provider test-environment adapters may be selected | Configuration eligibility to test external adapters, not production readiness |
| `CONTROLLED_LIVE` | DB, Firebase, all live adapters, connector credentials, enforced reCAPTCHA and HTTPS provider URL required | Only that the declared configuration contains the minimum current prerequisites |
| `PRODUCTION` | Same minimum prerequisites as controlled-live; demo endpoints/adapters forbidden | Only that the process may start; it does not establish legal, operational, integration or assurance readiness |

`NODE_ENV` is deliberately not the evidence boundary. It controls Node/framework optimisation. The
current Hetzner and compose demonstration can therefore use `NODE_ENV=production` while explicitly
declaring `ASSURERAIL_OPERATING_MODE=DEMO`. If the explicit mode is omitted from a process whose
`NODE_ENV=production`, the resolver assumes `PRODUCTION` and fails closed unless all current production
preconditions are supplied.

The guard executes before Nest application creation. `DemoModule` is mounted only when the validated
mode is `DEMO` and `ARAIL_DEMO_ENDPOINTS_ENABLED=true`. Invalid mode names, invalid boolean/adapter
values, permissive CORS outside demo, demo adapters in controlled-live/production, live adapters in
demo and live mutating adapters in replay/shadow are rejected.

This is the only intentional runtime behaviour change in PR-00: configurations that previously booted
with a misleading or unsafe mode/capability combination now fail before serving traffic.

### 2.2 Exact current endpoint contract

`apps/assurerail-api/src/characterisation/current-endpoint-contract.ts` records all **56** current
controller routes. Every row specifies:

- HTTP method and exact route template;
- current access decorator contract;
- current data class;
- current scope (`PUBLIC`, `CALLER`, `PLATFORM`, `GLOBAL_VENUE` or `RESOURCE_ID_ONLY`);
- module availability (`ALWAYS`, `DB_MODE` or `DEMO_MODULE`); and
- linked finding identifiers.

The metadata test discovers the controllers directly from Nest decorators and compares the complete
route/access list to the reviewed contract. Adding, deleting or changing a route/access decorator now
requires an explicit inventory change. The test also requires every current global or ID-only resource
surface to remain linked to `AR-C01`; it does not mislabel those routes as tenant-isolated.

The exact public surface is frozen as health, liveness, readiness, metrics and session exchange. The
two one-call demo routes are frozen as the only routes contributed by `DemoModule`.

### 2.3 Authentication/role harness

The direct guard-chain harness records current DB-mode authentication/authorisation behaviour:

- a verified token is resolved to the venue user before function-role evaluation;
- a protected route rejects a missing bearer token;
- a public route ignores an invalid optional token under current behaviour;
- an active allowed user with a matching function role passes;
- a suspended user fails the function-role check; and
- platform administrator and superadministrator gates remain distinct.

It also preserves `AR-C02` as an executable current finding: a suspended/non-allowlisted user whose
`entityRole` string matches is admitted by the entity-role branch. PR-03 must replace that expected pass
with denial under the participant/mandate model.

This is a guard harness with stubbed token verification/user resolution. It is not Firebase integration,
not Postgres integration and not an HTTP end-to-end test.

### 2.4 Lifecycle and relay failure ordering

The fault-sequence tests inject deterministic adapter/store failures and record:

- `AR-C04`: DvP cash settlement may succeed before HCS failure prevents the asset commit;
- `AR-C04`: cash settlement and HCS anchoring may both succeed before the asset DB transaction fails;
- `AR-C05`: HTS mint may succeed before the local mint transaction fails;
- `AR-C05`: HTS burn and HCS anchor may succeed before close persistence fails;
- `AR-C05`: partial HTS burn and HCS anchor may succeed before amortisation persistence fails;
- `AR-C06`: breached/problem surveillance currently transitions an issued Note to `ACTIVE`;
- `AR-H10`: domain/outbox/billing may commit before a later governed-audit append fails;
- `AR-H09`: the event sink starts webhook dispatch without awaiting a partner acknowledgement; and
- `AR-H09`: a partner delivery failure plus delivery-log failure can both be swallowed.

These use in-process deterministic fakes. No real cash, token, HCS, webhook, Firebase or database call
is made. Their purpose is to make the current order impossible to deny or accidentally obscure before
the saga/reconciliation work.

### 2.5 AssureTransfer transfer-room golden gate

The existing `apps/api/test/transfer-room.test.ts` suite is now a hard step in the AssureRail build
check. Its current 26 tests preserve the useful source behaviour while it is mapped, then migrated,
into the neutral Rail case/room model:

- only frozen pools with a manifest may open;
- transferor/transferee membership and invitation constraints;
- declaration/reliance gates before transferee reads;
- TLE permitted-transferee classification;
- hash-chained, concurrency-safe room access/Q&A log;
- pool-scoped findings and dossier construction;
- close/withdrawal revocation;
- recursive commercial-term redaction without false positives on benign fields;
- dossier watermarking;
- manifest and sealed-tape drift refusal; and
- membership-only room listing.

This keeps AssureTransfer’s current product-specific semantics as source evidence. It does not declare
the present room to be the future provider-neutral DA/PTC room and does not move code in PR-00.

## 3. Evidence labels and their limits

| Label | Meaning | Does not mean |
|---|---|---|
| `[CONFIG]` | Pure validation of an environment map | A spawned process, deployed environment or production-readiness test |
| `[STARTUP_PROCESS]` | A local compiled child process assembled the real Nest graph in no-listen probe mode, or failed before Nest creation, under a clean fixture environment | A deployed environment, real provider integration or production readiness |
| `[CONFIG][DEMO/REPLAY/SHADOW/CONTROLLED_LIVE/PRODUCTION]` | The named profile was evaluated | That a run in that mode occurred; `PRODUCTION` in a test name is not production evidence |
| `[SOURCE_CONTRACT]` | Source/decorator metadata matches the reviewed endpoint contract | HTTP behaviour, database isolation or business entitlement |
| `[DB_MODE_GUARD_HARNESS]` | The current guard chain was called with deterministic verifier/repository stubs | Real Postgres/Firebase integration |
| `[CURRENT_SEQUENCE]` | The current service ordering was reproduced with injected failures | The ordering is safe; finding-tagged cases normally prove the opposite |
| `AssureTransfer room golden characterisation` | Existing focused Jest room suite passed | Rail migration parity, a route pilot or a production room |
| Existing unlabelled unit tests | Pure tape, manifest, k-anon, allocation and demo-signature behaviour | Provider integration or institutional/legal authority |

There are no skipped external tests in the PR-00 focused suites because no external tests are attempted.
That is different from claiming external tests passed.

## 4. Finding-to-evidence/gap register

Every section 6 finding is linked either to an executable characterisation or to an explicit test gap.
“Gap” is intentional PR-00 evidence: the later PR named below may not claim completion without replacing
it with the stated layer.

| Finding | PR-00 evidence | Explicit remaining test/architecture gap |
|---|---|---|
| `AR-C01` | 56-route scope contract requires global/ID-only routes to retain the finding link | PR-03 real-DB + HTTP negative institution/case/object access matrix |
| `AR-C02` | Guard harness reproduces entity-role admission for suspended/non-allowlisted user | PR-03 central subject/participant/mandate evaluator and bypass matrix |
| `AR-C03` | Onboard route is linked in endpoint contract | PR-03 identity-binding vs admission/entitlement state and negative API tests |
| `AR-C04` | Two DvP failure-order tests | PR-07/11 durable saga, idempotency, ambiguous-success, compensation/repair and reconciliation tests |
| `AR-C05` | Mint, close and amortise external-success/local-failure tests | PR-07/11 instruction/acknowledgement ledger, resumable command and reconciliation worker tests |
| `AR-C06` | Breached surveillance activation test | PR-06/route-pack state guards and stale/problem/exception negative matrix |
| `AR-H07` | Actor-sensitive DvP/break-glass routes linked in contract | PR-03 authenticated human/institution/mandate attribution tests; body identity cannot grant authority |
| `AR-H08` | DvP route linked in contract | PR-01 exact-money schemas plus PR-07 idempotency/finality/invalid-input API tests |
| `AR-H09` | Two webhook failure/relay-order tests and four webhook routes linked | PR-07 SSRF/challenge/vault/retry/backoff/dead-letter/replay integration and security tests |
| `AR-H10` | Post-domain audit failure test | PR-07 atomic governed receipt or incomplete-command reconciliation tests |
| `AR-H11` | Document routes/data class linked | PR-05/08 streaming, content sniffing, malware quarantine, immutable version, ACL/retention tests |
| `AR-H12` | Ingress routes/data class linked | PR-02 immutable signed version/receipt schema, duplicate/idempotency and provenance tests |
| `AR-H13` | Runtime mode tests, local child-process boot/refusal tests, conditional DemoModule assembly and static invariant | Deployed negative startup smoke in each release environment, added by PR-12 |
| `AR-H14` | Holdings/report routes linked | PR-09/10/11 authority declaration and external-register divergence/reconciliation tests |
| `AR-H15` | Finding retained in implementation register | PR-02/09 AssurePool completion acknowledgement, source-lock idempotency and orphan repair tests |
| `AR-H16` | Production requires explicit live adapters/HTTPS | PR-02 provider-specific endpoint/credential registrations, conformance, health and exit tests |
| `AR-M17` | Activity route linked | PR-07 whole-chain sweep vs returned-window verification tests and UI/API wording contract |
| `AR-M18` | MFA/passkey removal routes linked | PR-03/12 recovery, last-factor, secret protection, step-up and penetration tests |
| `AR-M19` | Ops routes linked | PR-07 scoped finding ownership/SLA/waiver/escalation/independent-closure tests |
| `AR-M20` | PR-00 adds source, guard and failure-order layers | Real DB/API/concurrency/migration/security/capacity/restore/provider tests remain mandatory |

## 5. Enforced local gate

GitHub Actions remain off by design. The local AssureRail gate is:

```bash
bash scripts/assurerail-build-check.sh
```

It now performs, in order:

1. shell syntax checks;
2. venue Prisma schema validation;
3. static security/segregation/value-path/runtime/56-route invariants;
4. AssureRail API build;
5. all AssureRail tests, including PR-00 characterisations;
6. focused AssureTransfer room golden tests;
7. AssureRail web build unless explicitly skipped; and
8. the existing local quick secret scan when available.

Useful focused commands are:

```bash
npm run test --workspace=@code/assurerail-api
(cd apps/api && npx jest --runInBand --runTestsByPath test/transfer-room.test.ts)
node scripts/check-assurerail-invariants.mjs
```

## 6. PR-00 acceptance interpretation

PR-00 is acceptable when all of the following are true:

- the exact current Rail endpoint/access surface is reproducible and drift-detected;
- the current transfer-room golden suite remains green;
- every known production finding has executable characterisation or a named explicit gap;
- fixtures contain only synthetic `.invalid` identities, placeholder references and deterministic
  demo data—no borrower PII, customer secret or live credential;
- the output clearly separates source/unit/harness/current-sequence evidence from unavailable DB,
  external and production evidence; and
- no configuration may use a live/production claim merely to obtain an optimised Node process or
  expose demo endpoints/adapters.

PR-00 does **not** authorise a multi-institution pilot, a conventional DA/PTC route, token movement,
cash settlement, production onboarding, marketplace activity or a production assurance claim. Those
remain gated by the dependency-ordered programme and the controlled-pilot operating pack.

## 7. Verification result — 2026-08-30

The complete `bash scripts/assurerail-build-check.sh` gate passed outside the managed coding sandbox:

- shell syntax: passed;
- Prisma schema validation: passed;
- static AssureRail invariants: passed;
- no-egress AssureRail API build: passed;
- AssureRail tests: **61 passed, 0 failed, 0 skipped**;
- focused AssureTransfer room tests: **26 passed, 0 failed, 0 skipped**;
- AssureRail Next.js production build: passed, 10 static pages generated;
- gitleaks quick scan: no new leaks; and
- Semgrep report-first scan: 0 findings across the reported scan, with one timeout/partial-analysis
  warning in the concurrently modified AssureLocker
  `apps/api/src/modules/controllers/individual.controller.ts` SSRF rule. That warning is outside the
  PR-00 Rail files and is not represented as a complete scan of that file.

The first run inside the managed coding sandbox could not invoke macOS `sandbox-exec` from inside the
existing sandbox and could not fetch the three `next/font` Google resources. The same unchanged gate
was rerun with the approved host permissions; its no-egress API build and network-dependent web build
both passed. This was an execution-environment limitation, not a waived gate.
