# AssureRail standalone repository separation and incorporation cutover

**Status:** RS-00 and RS-02 locally complete; RS-01 remote controls, RS-03/04 operations and RS-05
incorporation delivery remain open

**Prepared:** 6 September 2026

**Source repository:** `deepaknorman/assurelocker`

**Proposed target repository:** private `deepaknorman/assurerail`

**No-deploy rule:** repository work does not authorise a deployment, operating-mode change or
capability activation.

**Implementation checkpoint (6 September 2026):** the approved source baseline was extracted with
history into a standalone, independently buildable repository. The local clean-clone API/web build,
366-test corpus, boundary checks and fail-closed configuration checks passed. The AssureLocker
monorepo was not edited or cut over. Remote publication remains open because the proposed private
GitHub repository does not yet exist and the available GitHub CLI credential is invalid. Full
details and residual gates are recorded in
`docs/qa/AssureRail_Standalone_Repository_Separation_Evidence.md`.

## 1. Outcome and ownership decision

AssureRail will be separated from the AssureLocker monorepo into a standalone repository with its
relevant Git history preserved. The repository is to be controlled by Deepak Norman before
AssureRail is incorporated and transferred directly by Deepak Norman to AssureRail at the IP
assignment closing.

AssureLocker is not:

- a party to AssureRail's incorporation or Founder-to-AssureRail IP assignment;
- the owner, licensor, co-transferor or beneficiary of the extracted AssureRail baseline;
- the repository organisation/account owner or an indispensable administrator;
- the principal commissioning new pre-incorporation AssureRail work; or
- a source-code dependency embedded in the standalone baseline.

If AssureRail later appoints AssureLocker to provide development or operational services, that is a
separate post-incorporation procurement decision under an arm's-length MSA. It does not retrospectively
alter the founding chain of title.

## 2. Non-negotiable extraction rules

1. **Preserve history.** Extract relevant commits with path history; do not create an unexplained
   source-code snapshot.
2. **Use a signed baseline.** Record source commit, extraction rules, target commit, file manifest,
   dependency inventory and cryptographic digests.
3. **Do not copy the monorepo wholesale.** AssureLocker, AssureCLA, AssurePool and AssurePlane code,
   customer records and internal documents remain outside the Rail repository.
4. **Do not import the full `@code/shared` package.** Replace the small set of Rail imports with
   Rail-owned neutral contracts or an independently licensed, versioned provider contract.
5. **Keep provider relationships at the boundary.** AssurePool, identity/KYB, AssurePlane and other
   services integrate through provider-neutral adapters and APIs. AssureLocker is one possible
   provider, not an implicit runtime or ownership dependency.
6. **Keep secrets and live data out.** No `.env`, key, customer transaction evidence, production
   database, build cache or generated artefact is extracted.
7. **No big-bang deletion.** The old repository remains deployable until the new repository builds,
   migrates, tests and produces the same dark-by-default runtime. Removal from the old repository is
   a later, separately approved cutover commit.
8. **One source of truth after cutover.** Dual independent development in both repositories is
   prohibited. Temporary compatibility changes must identify their authority and expiry.

## 3. Initial asset disposition

### 3.1 Extract to the standalone repository

| Asset | Current location | Target treatment |
|---|---|---|
| AssureRail web | `apps/assurerail/**` | Extract with history; initially retain path to minimise build risk |
| AssureRail API | `apps/assurerail-api/**` | Extract with history; retain its separate database and migrations |
| Rail deployment definition | `docker-compose.assurerail.yml` | Extract and rename only after parity |
| Rail browser test config | `playwright.assurerail.config.ts` | Extract with Rail E2E/DAST suite |
| Rail scripts | `scripts/assurerail-*`, `scripts/check-assurerail-*` and individually reviewed Rail-only scripts | Extract by an explicit manifest, never a broad `scripts/**` copy |
| Rail design and architecture | AssureRail-specific files in `docs/design/**` | Extract after confidentiality classification |
| Rail QA/evidence specifications | AssureRail-specific files in `docs/qa/**` | Extract internal evidence; exclude customer-owned evidence and secrets |
| Rail runbooks and security | AssureRail-specific files in `docs/runbooks/**`, `docs/security/**` and `docs/ops/**` | Extract private operational versions; public versions remain separately curated |
| Rail GTM/content/decks | AssureRail-specific files in `docs/gtm/**`, `docs/decks/**`, public assets and templates | Extract only after public/private classification and provenance checks |
| Rail incorporation IP records | Rail-only files in `docs/legal/incorporation/**` | Canonical copies move to the private Rail repository; AssureLocker formation documents do not |

### 3.2 Keep in the AssureLocker repository

| Asset | Reason |
|---|---|
| AssurePool and AssureCLA product code | Separate AssureLocker/AssureCLA product ownership |
| AssurePlane product and bond-trustee work | Separate product; bond work is parked |
| AssureTransfer product logic | Ownership/suite placement remains separately governed |
| `apps/api/src/co-lending/assurerail-room-proxy.client.ts` | AssureLocker-side client into Rail during/after cutover |
| `apps/web/src/lib/assurerail-api-url.ts` and AssureLocker public cross-links | AssureLocker-side integration and marketing responsibility |
| AssureLocker MOA/AOA, cap table and corporate records | Not part of the AssureRail company or repository |
| AssureLocker customer data, secrets and operational records | No Rail ownership or extraction right merely from technical proximity |

### 3.3 Split or replace before cutover

| Current coupling | Required correction |
|---|---|
| API dependency on `@code/shared` | Create narrow Rail-owned canonical/digest, AssurePool-tape and AssureTransfer-manifest boundary types; validate them against provider fixtures |
| API Dockerfile builds/copies `@code/shared` | Build only standalone Rail workspaces and generated client |
| Prisma client outputs into root `node_modules` | Generate within the standalone workspace/package boundary |
| API scripts reference `../../scripts` | Move reviewed scripts into the new repository and update paths |
| Public-claims check reads AssureLocker `apps/web` pages | Split into a Rail-owned public-site check and an AssureLocker-side cross-link check |
| `ASSURELOCKER_API_URL` multiplexes identity/tape/provider concerns | Replace with explicit provider registrations/endpoints and independently scoped credentials |
| DigiKYC gate assumes AssureLocker provider and DID grammar | Retain it only as a named adapter; make the admission contract/provider selection neutral |
| Demo fixtures use `assurelocker.com` DIDs or contact address | Replace with non-production Rail fixture identities and Rail-owned contact configuration |

## 4. Target repository shape

The first standalone release should favour a low-risk extraction over aesthetic renaming:

```text
assurerail/
├── apps/
│   ├── assurerail/             # web
│   └── assurerail-api/         # API and Rail-owned Prisma schema
├── packages/
│   └── contracts/              # Rail-owned neutral and provider-boundary contracts
├── docs/
│   ├── design/
│   ├── qa/
│   ├── runbooks/
│   ├── security/
│   ├── gtm/
│   └── legal/incorporation/    # Rail-only private chain-of-title records
├── scripts/                    # reviewed Rail-only build, DB, security and evidence scripts
├── package.json
├── package-lock.json
├── turbo.json
├── docker-compose.yml
└── playwright.config.ts
```

Repository naming, package-scope renaming and directory beautification follow the first green
standalone build. They must not obscure the extracted history or combine with substantive security
changes.

## 5. Dependency-ordered cutover

### RS-00 — Freeze, classify and sign the source baseline

- choose a source commit that includes every approved Rail change and none of another coder's
  uncommitted work;
- export tracked Rail paths and classify each `MOVE`, `KEEP`, `SPLIT`, `EXCLUDE` or `REPLACE`;
- run secret, licence, generated-file, customer-data and large-file scans;
- record contributor/AI/tool provenance by commit range; and
- sign the baseline manifest and preserve it in the Founder IP Register.

**Gate:** no unknown file class, embedded secret or unresolved claim of AssureLocker ownership in
the extraction set.

### RS-01 — Create the private history-preserving repository

- create private `deepaknorman/assurerail` under an account/organisation controlled directly by the
  Founder;
- use a fresh clone and `git filter-repo` with the approved path manifest;
- push an immutable extraction tag and protected default branch;
- require MFA, least privilege, branch protection, secret scanning and signed/reviewed releases;
- appoint technical custodians as agents without transferring ownership; and
- retain a source-to-target commit map and extraction command log.

**Gate:** target history and manifest reconcile to the approved source baseline.

### RS-02 — Make the extracted repository independently buildable

- establish the minimal root workspace, lockfile, TypeScript/Turbo configuration and CI;
- extract/replace `@code/shared` dependencies;
- make Prisma generation local to Rail;
- correct Docker/build/test paths and remove AssureLocker monorepo assumptions;
- preserve all fail-closed feature flags and `DEMO` operating mode in non-production examples; and
- run API build/tests, web build/checks, database migration rehearsal and security checks.

**Gate:** a clean clone builds and tests without access to the AssureLocker repository or any
AssureLocker-owned source package.

### RS-03 — Establish independent operational control

- create Founder-controlled CI/CD, artefact registry, Azure subscription/resource hierarchy,
  Key Vault, identities, domains, monitoring and backup ownership;
- configure Hyderabad/Pune roles only when the region decision is confirmed and documented;
- preserve the later 5–7 HashSphere/HTS-node question as a separately approved architecture gate;
- transfer no live key by copying it into Git; rotate/reissue credentials at cutover; and
- document AssureLocker only as an optional external service/provider endpoint.

**Gate:** Rail can be built, secured, restored and administered without AssureLocker credentials,
accounts or personnel being indispensable.

### RS-04 — Parity, deployment handoff and source-of-truth cutover

- compare schema/migration set, build output, flags-off endpoint surface and health/readiness;
- run authenticated two-tenant E2E and the available SEC-01 checks;
- produce a no-deploy handoff for the other coder;
- change deployment remote only under a separately approved deployment action;
- declare the target repository the sole write authority; and
- replace the old tree with compatibility clients/notices only after rollback evidence exists.

**Gate:** the deployed service, when separately authorised, identifies the standalone build commit;
all capability flags remain dark until their existing evidence gates are satisfied.

### RS-05 — Incorporation and direct IP delivery

- freeze and sign the incorporation baseline/tag and software bill of materials;
- complete contributor/title, third-party and exclusions schedules;
- execute the direct Deepak Norman-to-AssureRail assignment deed;
- have the AssureRail Board accept the deed and delivery certificate;
- transfer repository, domains, cloud, artefact, signing and administrative control to AssureRail;
- complete tax, FEMA, valuation and stamp advice; and
- separately decide whether AssureRail procures services from AssureLocker or another supplier.

**Gate:** the Founder IP Register, deed schedules and technical delivery manifest identify the same
baseline and exclusions.

## 6. Verification evidence

The separation is complete only when the following can be produced:

1. source and target commit IDs plus the filter/extraction log;
2. complete tracked-file manifest and digests;
3. contributor and third-party/open-source schedules;
4. secret/data/generated-file scan reports;
5. clean-clone dependency install, API/web build and test reports;
6. complete Prisma migration status and fresh-database rehearsal;
7. flags-off and explicit operating-mode startup evidence;
8. authenticated tenant-isolation/RBAC and security evidence available at the time;
9. deployment remote and rollback instructions; and
10. at incorporation, the signed deed, Board acceptance and delivery certificate.

Synthetic transaction evidence cannot close DA/PTC replay, controlled-live, production, VAPT or
external-authority gates. Repository separation proves custody and build independence, not
regulatory permission or production readiness.

## 7. Immediate blockers and decisions

RS-00 and the local RS-02 build-independence gate are complete. The following remain required before
RS-01 is completed:

- GitHub authentication must be repaired: the installed `gh` CLI currently reports an invalid
  credential;
- confirm the proposed private remote `deepaknorman/assurerail` or provide the intended GitHub
  organisation;
- review and approve the selected source baseline and extracted manifest before remote protection is
  treated as final; and
- identify any contributor engagement that named AssureLocker as contracting party, so its code can
  be excluded, independently replaced or covered by a specific counsel-approved cure.

These items do not justify putting AssureLocker into the Founder-to-AssureRail deed. They determine
what the Founder can accurately warrant and include in the direct assignment schedule.
