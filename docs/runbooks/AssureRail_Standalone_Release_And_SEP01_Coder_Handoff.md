# AssureRail standalone release controls and SEP-01 coder handoff

**Audience:** AssureRail engineers, deployers, security reviewers and future Plaza integrators

**Status:** implementation handoff; committed software evidence, not deployment or production approval

**Prepared:** 7 September 2026

**Repository:** `deepaknorman/assurerail`

**Branch:** `codex/assurerail-predeploy-gates`

**Build-control commit:** `ce8f451d7388a32f3d7d33475d8e7a37080311a1`

**Provider-separation commit:** `ef05e457f3443080bf54e4f6c8d58879e48df5cd`

## 1. Read this first

Two related changes have been completed in the new standalone AssureRail repository:

1. AssureRail now has its own local release-control, security-scanning, browser-checking and
   deployer-gate workflow. GitHub Actions are deliberately not part of the release trust path.
2. `SEP-01` removes product-specific AssureLocker/DigiKYC and online legacy-room dependencies from
   the AssureRail runtime, while retaining provider-neutral identity assurance and deliberately
   optional provider adapters.

No deployment, database migration, feature activation, external provider call or production claim
was made by either commit. The pushed branch contains code and handoff evidence only.

The most important architectural clarification made during this work is the Plaza boundary:

- Plaza's interim organisational and IP home is AssureLocker Private Limited.
- Plaza is to be a physically separate application, datastore, identity, key, network and release
  boundary; this is the selected target, not yet as-built evidence.
- AssureLocker and AssureRail are different Plaza tenants and API clients.
- AssureLocker may consume Plaza for KYC/KYB and related trust services.
- AssureRail may later consume Plaza for approved tokenised/HTS services.
- AssureRail conventional DA/PTC does not depend on Plaza.
- AssureRail's use of Plaza requires a specific schedule under the AssureLocker--AssureRail MSA.

Do not reinterpret “provider-neutral” to mean that Plaza cannot be the selected provider. It means
that Plaza is reached through the same narrow, versioned contract and isolation controls as another
approved provider; Plaza is not compiled into Rail, does not share Rail's database or credentials,
and cannot confer Rail authority.

## 2. Selected target system boundary

```text
                                 AssureLocker Private Limited
                              organisational and contractual home
                                             │
                              ┌──────────────┴──────────────┐
                              │                             │
                    AssureLocker runtime             Plaza service platform
                    own app/data/identity         own app/data/keys/network
                              │                    tenant: AssureLocker
                              └──── KYC/KYB API ───────────►│
                                                           │
                                                           │ versioned provider API
                                                           │ tenant: AssureRail
                                                           ▼
Founder now; AssureRail company after assignment     AssureRail runtime
standalone source/IP and release controls       own app/data/identity/keys
                                                   conventional DA/PTC
                                                   optional token adapters
```

There must be no AssureLocker-to-AssureRail lateral application route through Plaza. Both consumers
authenticate independently to Plaza, see only their tenant and purpose-limited records, and use
separate credentials and key scopes. Plaza responses are evidence or execution acknowledgements;
they do not create participant admission, membership, mandates, route entitlement, legal title or
an assurance conclusion in Rail.

Any later five-to-seven-node HashSphere/HTS topology belongs behind the Plaza service boundary.
AssureRail must not host or directly couple to those nodes. The node cloud/location design remains
open and need not match the AssureRail Azure estate.

## 3. Standalone repository and release controls

Commit `ce8f451` added the following controls.

### 3.1 Local trust path

- `.githooks/pre-push` invokes the AssureRail pre-push gate.
- `scripts/assurerail-prepush-gate.sh` performs diff hygiene, formatting, architecture invariants,
  public-boundary checks, Gitleaks and Semgrep against the outgoing commit range.
- `scripts/assurerail-predeployment-gate.sh` is the mandatory deployer-run release gate. It validates
  the exact signed tag/commit and effective private environment before any migration, image
  promotion or restart.
- `scripts/assurerail-postdeploy-verify.sh` is read-only post-deployment verification.
- `scripts/assurerail-daily-qa.sh` and `scripts/assurerail-strix-daily.sh` provide the local daily QA
  and independent Strix workflow.
- `scripts/install-assurerail-daily-qa-launchd.sh` and the launchd template install the daily job on
  the controlled macOS runner.

Run `npm run harness:check` in a fresh clone. `npm run harness:setup` installs the local hook path and
other developer prerequisites when explicitly desired.

### 3.2 Checks supplied

| Command | Purpose |
|---|---|
| `npm run check` | Cumulative compile, API test, web-boundary and production-build gate |
| `npm run check:full` | The cumulative gate plus all 24 disposable PostgreSQL rehearsals |
| `npm run check:prepush` | Local outgoing-commit/public/security gate |
| `npm run check:predeploy:code` | Pre-deployment software-only gate |
| `npm run check:predeploy` | Exact signed-release and effective-environment gate |
| `npm run check:postdeploy` | Read-only health/dark-route verification |
| `npm run format:check` | Repository formatting and configuration hygiene |
| `npm run security:local` | Gitleaks, Semgrep, dependency ratchet, Trivy and SBOM |
| `npm run security:release` | Strict release form of the local security gate |
| `npm run security:azure` | Target Azure baseline contract validation |
| `npm run security:e2e` | Authenticated SEC-01 E2E preflight and Playwright suite |
| `npm run security:dast` | Authenticated DAST entry point |
| `npm run check:public` | Public claims, exposure and publication checks |
| `npm run qa:daily` | Daily cumulative/security/Strix workflow |

### 3.3 Release rules

- GitHub Actions are not a release dependency.
- A successful local check is not permission to deploy or activate a capability.
- The deployer must check the exact signed release, not a mutable branch name.
- Deployment environment values come from a private mode-600 file; checks must never print secrets.
- Migrations precede the new API process. The deploy/restart command itself must not hide migrations.
- All live/customer/product flags remain fail-closed unless their specific evidence and approval
  procedure has been completed.
- The GitHub `main` ruleset and registered signing key are external repository controls and should
  be verified by the GitHub administrator; they are not recreated by application code.

The detailed procedure is in
`docs/runbooks/AssureRail_PreDeployment_And_Release_Gate.md`.

## 4. SEP-01 identity-assurance change

### 4.1 Removed behaviour

The deleted `DigiKycGateService` was hard-coded to AssureLocker terminology, an internal endpoint,
a special shared-secret header and an AssureLocker DID result. Its presence risked making
AssureLocker a compulsory Rail identity dependency.

It has been replaced by `IdentityAssuranceProviderService`. The new service:

- supports `off`, `demo` and `live` explicitly;
- uses an operator-selected `IDENTITY_PROVIDER_KEY`;
- calls a configurable HTTPS provider URL and path with a Rail-scoped bearer credential;
- forbids redirects;
- applies a bounded timeout;
- requires `active: true` and a non-empty subject;
- rejects expired evidence and a claimed/returned subject mismatch;
- retains only bounded provider references and no underlying KYC dossier; and
- fails closed for an absent credential, invalid mode, network error or malformed/non-current result.

The provider contract is:

```text
POST {IDENTITY_PROVIDER_API_URL}{IDENTITY_PROVIDER_STATUS_PATH}
Authorization: Bearer <Rail-scoped provider credential>
Content-Type: application/json

{
  "email": "normalised@example.com",
  "claimedSubject": "optional provider subject"
}

{
  "active": true,
  "subject": "provider-owned stable subject",
  "evidenceRef": "optional evidence reference",
  "assuranceLevel": "optional bounded level",
  "expiresAt": "optional ISO timestamp"
}
```

This is a currentness/binding response, not participant admission.

### 4.2 API compatibility

`POST /venue/auth/onboard` now accepts:

```json
{ "subject": "optional provider subject" }
```

The old `did` field is temporarily accepted as an alias so an already-deployed client does not fail
immediately. The caller can no longer select the provider. Any former `provider` field must not be
relied upon; provider selection is deployment-controlled.

The response explicitly includes `grantsAdmission: false`. Identity binding activates the identity
record but leaves the legacy venue allow-list false. Institutional admission, active membership,
mandate, appointment, route entitlement and action step-up remain separate checks.

The internal admin status payload changed from a single `digikycGate` field to:

```json
{
  "identityAssurance": {
    "mode": "off|demo|live",
    "providerKey": "DEPLOYMENT_SELECTED_PROVIDER"
  }
}
```

The AssureRail web admin, onboarding and settings screens were updated in the same commit.

### 4.3 Environment contract

The current keys are:

```text
IDENTITY_ASSURANCE_ADAPTER=off|demo|live
IDENTITY_PROVIDER_KEY=<stable provider identifier>
IDENTITY_PROVIDER_API_URL=<provider base URL>
IDENTITY_PROVIDER_API_KEY=<Rail-scoped secret>
IDENTITY_PROVIDER_STATUS_PATH=/v1/identity-assurance/status
IDENTITY_PROVIDER_TIMEOUT_MS=5000
```

The retired keys are:

```text
DIGIKYC_GATE
DIGIKYC_STATUS_SERVICE_SECRET
```

Do not silently translate the old shared-secret header or old internal DigiKYC path into the new
contract. If DigiKYC or another service is procured, it must implement the new provider contract and
use a scoped credential like any other provider.

The previously applied PR-03 database migration contains the literal
`ASSURELOCKER_DIGIKYC` for historical records. It was deliberately not edited: an applied migration
is immutable evidence. The label grants no current authority and can be superseded through a
governed recertification.

## 5. Optional provider adapters and runtime gating

All adapter modes now share the explicit type:

```text
off | demo | live
```

| Adapter | Function | Conventional DA/PTC prerequisite? |
|---|---|---|
| `IDENTITY_ASSURANCE_ADAPTER` | Human identity evidence used where Rail authority policy requires it | Live in controlled-live/production |
| `TAPE_SOURCE` | Optional AssurePool-profile tape/surveillance source | No |
| `HTS_ADAPTER` | Optional token representation service | No; token route only |
| `HCS_ANCHOR` | Optional evidence anchoring | No; declared capability only |
| `SETTLEMENT_ADAPTER` | Optional external settlement instruction | No; declared capability only |

Controlled-live/production rules are now:

1. no adapter may remain in `demo`;
2. unused adapters must be `off`;
3. identity assurance must be `live`;
4. a future live capability must be registered with its exact adapter dependencies;
5. each required live HTTP provider needs its own HTTPS URL and credential; and
6. the normal activation manifest, RBAC, database, Vault, reCAPTCHA and other route controls still
   apply.

`IMPLEMENTED_LIVE_CAPABILITIES` is currently empty. This is deliberate: SEP-01 adds architecture,
not a live capability.

The old localhost/AssureLocker/Plaza defaults were replaced by non-routable `.invalid` placeholders.
Anchor and settlement paths are deployment-selected:

```text
ANCHOR_PROVIDER_SUBMIT_PATH=/v1/anchors
SETTLEMENT_PROVIDER_TRANSFER_PATH=/v1/settlements
```

The tape, surveillance, identity, anchor and settlement HTTP clients reject redirects. Selecting an
`off` adapter fails locally rather than falling back to a demo result.

The live HTS adapter remains deliberately unimplemented and fail-closed. Plaza has not been made
live merely because the organisational boundary has now been decided.

## 6. Online legacy-room bridge retirement

The following executable files were removed:

```text
apps/assurerail-api/src/rooms/legacy-room-proxy.controller.ts
apps/assurerail-api/src/rooms/legacy-room-proxy.service.ts
apps/assurerail-api/src/integrations/connector-subject-mapping.controller.ts
apps/assurerail-api/src/integrations/connector-subject-mapping.service.ts
```

The Nest modules no longer mount or export them. The
`assurerail.legacy-room-proxy.v1` integration profile is unsupported. The environment flag remains
as an off-only tombstone:

```text
ARAIL_LEGACY_ROOM_PROXY_V1=off
```

A stale `shadow` value now fails configuration validation. Do not try to restore the proxy to make
an old deployment file pass.

Rail-native rooms remain. Deterministic sealed legacy-room import also remains as an offline data
migration facility, preserving original IDs, payloads, hashes and provenance without a runtime
AssureLocker API dependency. Historical PR-08 proxy instructions are marked superseded in the design
and runbook.

## 7. Plaza requirements for the MSA and implementation

Before AssureRail calls Plaza, the AssureLocker--AssureRail MSA needs a Plaza schedule covering:

- exact functions, APIs, permitted purposes and prohibited uses;
- tenant/data/workload-identity/credential/key/log/operator segregation;
- data minimisation, location, retention, legal hold, return and deletion;
- request authentication/signing, idempotency, acknowledgements, finality and reconciliation;
- SLA, support, capacity, RTO/RPO, backup/restore and incident notification;
- security assurance, audit rights, regulatory cooperation and subprocessors;
- arm's-length pricing, conflicts, service credits, liability and related-party governance;
- schema/version change control and deprecation notice;
- exit, portable evidence export, transition assistance and provider replacement; and
- assignment/novation if Plaza is later transferred or spun out.

Technical conformance must prove:

- distinct AssureLocker and AssureRail Plaza tenants;
- separate workload identities, credentials and cryptographic key scopes;
- no cross-tenant listing, object reference, search, log or support access;
- no shared application session or database access;
- Rail egress only to the approved Plaza endpoint and port;
- Plaza cannot initiate a lateral connection to the Rail data plane;
- bounded, signed/idempotent instructions and authenticated acknowledgements;
- ambiguous-result recovery and independent reconciliation; and
- provider exit/replay without loss of Rail's retained evidence.

## 8. Deployment handoff

### 8.1 What changed operationally

SEP-01 contains no Prisma migration. It changes application code, environment validation and mounted
routes. A normal dark deployment therefore rebuilds/restarts API and web after the exact signed
release gate, but must not enable a capability or call a provider.

For the existing isolated demo posture, the deployer should carry values equivalent to:

```text
ASSURERAIL_OPERATING_MODE=DEMO
ARAIL_DEMO_ENDPOINTS_ENABLED=true
IDENTITY_ASSURANCE_ADAPTER=demo
IDENTITY_PROVIDER_KEY=ASSURERAIL_DEMO_IDENTITY
TAPE_SOURCE=demo
HTS_ADAPTER=demo
HCS_ANCHOR=demo
SETTLEMENT_ADAPTER=demo
ARAIL_LEGACY_ROOM_PROXY_V1=off
```

All product/live flags remain off. Do not add a Plaza/AssureLocker host merely to preserve an old
default. The `.invalid` endpoints are intentional in demo/off configurations.

Before a controlled-live or production environment can start, unused provider adapters must be
`off`, identity assurance must be an approved `live` provider, and every activated capability must
declare and satisfy its precise live-adapter dependencies. The activation manifest and external
evidence gates are still mandatory.

### 8.2 Expected smoke behaviour

- API and web health/readiness follow the existing runbook.
- Identity onboarding uses the generic subject wording.
- Admin status reports `identityAssurance`, not `digikycGate`.
- The online legacy-room proxy and subject-mapping endpoints return 404 because they are not mounted.
- `ARAIL_LEGACY_ROOM_PROXY_V1=shadow` is rejected rather than ignored.
- No Plaza, AssureLocker or other provider request should occur in demo/off operation.

Use the exact signed-release procedure; do not deploy directly from this branch merely because the
branch checks passed.

## 9. Verification completed

The candidate passed:

- the cumulative full gate;
- 377/377 API tests;
- all web boundary checks from PR-18 and AR-21 through AR-30;
- the 40-route Next.js production build;
- all 24 disposable PostgreSQL migration/service/upgrade/restore rehearsals;
- all 32 migrations from a clean database in each applicable rehearsal;
- 12/12 release-control/configuration tests;
- formatting/configuration checks over 491 tracked/unignored files;
- static architectural and safety invariants;
- Gitleaks over 129 commits and the outgoing SEP-01 commit, with no leak;
- seven AssureRail Semgrep rules over 403 targets, with zero finding;
- the dependency ratchet: 0 critical, 0 high, 6 bounded moderate and 0 low;
- Trivy dependency and Dockerfile configuration gates with zero high/critical finding; and
- CycloneDX SBOM generation.

The push hook repeated the format, architecture, public exposure/freshness, outgoing-commit
Gitleaks and Semgrep gates successfully.

The optional OSV scanner still reports `GHSA-w5hq-g745-h8pq` against transitive optional
`uuid@9.0.1` with CVSS 7.5. The dated dependency ratchet keeps the chain open for review by 3 October
2026. It was not represented as fixed. Grype could not complete; Checkov and njsscan were not
installed. A direct post-staging Semgrep run also timed out two rules on four unchanged large service
files, while the subsequent pre-push run completed without those warnings. These facts remain in
the evidence record for follow-up rather than being hidden.

## 10. What is proven and what remains open

### Proven at source/configuration level

- standalone Rail repository, packages and release controls;
- Rail-owned Prisma client/schema/migrations;
- no AssureLocker application or Prisma-client import;
- no AssureLocker/DigiKYC/Plaza host, path, header or default provider in executable adapters;
- provider-selected identity evidence without provider-selected authority;
- online legacy-room/API bridge retired;
- explicit optional adapter modes and capability dependency declarations; and
- failure-closed deployment rules.

### Not yet proven as deployed fact

- Azure Hyderabad-primary/Pune-recovery physical resource separation;
- production network security groups/private endpoints/egress allow-lists;
- separate Rail keys, workload identities, backups and logging workspaces as-built;
- executed Plaza tenant segregation and MSA schedule;
- authenticated two-tenant E2E/DAST;
- independent VAPT remediation/retest;
- real identity/provider conformance;
- live HTS/HashSphere connector, key custody and finality;
- historic authorised DA/PTC replay evidence; or
- operational incident, restore, BCP/DR and provider-exit rehearsal.

Therefore coders may state that **the source and configuration are logically separated and designed
for physical/network separation**. Do not state that complete production separation has been proven
until the Azure, Plaza and independent test evidence exists.

## 11. High-value code map

| Area | Primary files |
|---|---|
| Identity provider | `apps/assurerail-api/src/auth/identity-assurance-provider.service.ts` |
| Identity binding/API | `apps/assurerail-api/src/auth/identity-binding.service.ts`, `auth.controller.ts` |
| Runtime enforcement | `apps/assurerail-api/src/runtime/runtime-profile.ts` |
| Live dependency registry | `apps/assurerail-api/src/runtime/live-capability-registry.ts` |
| Provider endpoints | `apps/assurerail-api/src/config.ts` |
| Anchor adapter | `apps/assurerail-api/src/surveillance/hcs.adapter.ts` |
| Settlement adapter | `apps/assurerail-api/src/settlement/settlement.adapter.ts` |
| Token adapter | `apps/assurerail-api/src/hts/hts.adapter.ts` |
| Optional tape/source | `apps/assurerail-api/src/tape/tape-provider.client.ts`, `surveillance.client.ts` |
| Retired bridge modules | `apps/assurerail-api/src/rooms/rooms.module.ts`, `integrations/integrations.module.ts` |
| Environment examples | `apps/assurerail-api/.env.example`, `deploy/examples/assurerail-demo.env.example` |
| Compose contract | `docker-compose.assurerail.yml` |
| Static invariants | `scripts/check-assurerail-invariants.mjs` |
| Release env validation | `scripts/check-assurerail-release-env.mjs` |
| Architecture tests | `apps/assurerail-api/src/runtime/architectural-separation.test.ts` |
| Design decision | `docs/design/AssureRail_Identity_Assurance_And_Provider_Separation.md` |
| Executed evidence | `docs/qa/AssureRail_SEP01_Provider_Separation_Evidence.md` |

## 12. Instructions to the next coder

1. Pull and review the two signed commits by hash; do not rely only on this summary.
2. Run `npm run harness:check`, `npm run check` and the narrow checks for any file you subsequently
   change.
3. Do not restore the DigiKYC service, online room proxy or caller-selected identity provider.
4. Do not hard-code Plaza endpoints. A Plaza integration must implement the generic contract and
   retain separate Rail tenant credentials.
5. Do not register a live capability until its external evidence and activation authority exist.
6. Keep conventional DA/PTC independent from Plaza and token services.
7. Preserve the old PR-03 migration literal and sealed legacy evidence; do not rewrite history to
   make it look provider-neutral.
8. Coordinate deployment environment changes with the deployer and keep every product/live flag
   off unless separately authorised.
9. Record as-built Azure and Plaza evidence in the restricted evidence store, not public pages.
10. Treat the Plaza MSA schedule, provider conformance, E2E/DAST and VAPT as open gates—not synthetic
    tests that can be marked passed internally.

## 13. Canonical supporting documents

- `docs/design/AssureRail_Identity_Assurance_And_Provider_Separation.md`
- `docs/qa/AssureRail_SEP01_Provider_Separation_Evidence.md`
- `docs/qa/AssureRail_PreDeployment_Gate_Implementation_Evidence.md`
- `docs/runbooks/AssureRail_PreDeployment_And_Release_Gate.md`
- `docs/runbooks/AssureRail_Containerisation.md`
- `docs/security/AssureRail_SEC01_Dependency_Posture.md`
- `deploy/azure/assurerail/security-baseline.json`

If a later document conflicts with this handoff, the signed code, the current provider-separation
design record and an expressly approved later decision take precedence. Historical PR-08 material
that describes the retired online proxy is not current implementation authority.
