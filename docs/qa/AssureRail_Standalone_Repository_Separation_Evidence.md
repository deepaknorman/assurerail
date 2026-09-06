# AssureRail standalone repository separation evidence

**Status:** technical extraction and independent-build evidence; remote publication and operational
cutover remain open

**Evidence date:** 6 September 2026

**Source repository:** `deepaknorman/assurelocker`

**Source branch:** `codex/assurerail-pr01-neutral-taxonomy`

**Selected source commit:** `4d349a4feb93c50e75a4f12f4081eafb2992640f`

**Filtered source-tip equivalent:** `6cfca890b6896d4e89fc4735aade75d48cc6d6c2` before standalone corrections

This record evidences RS-00 and the locally complete portions of RS-01/RS-02 in
`docs/design/AssureRail_Standalone_Repository_Separation_Plan.md`. It does not authorise deployment,
change the live deployment remote, transfer IP to an unincorporated company or close an external
evidence gate.

## 1. Baseline selection

The source commit was selected from the existing AssureRail implementation branch after the
Founder-to-AssureRail direct-assignment and repository-separation decisions were committed. The
working tree in the source monorepo contained unrelated changes belonging to other coders; none was
staged, committed or included. The extraction was performed in a fresh temporary clone.

At the filtered baseline:

- 124 relevant historical commits remained;
- 657 tracked files remained before the standalone root/evidence additions;
- 481 tracked files were below `apps/assurerail` and `apps/assurerail-api`; and
- the filtered history exposed one Git author identity, `Deepak Norman
  <deepaknorman@DN-MacBook-Air.local>`. This is repository attribution, not proof that no contractor,
  AI tool or other contributor participated. The Founder IP Register therefore keeps contributor
  diligence open.

## 2. Included path classes

The history-preserving filter included:

- `apps/assurerail/**` and `apps/assurerail-api/**`;
- `docker-compose.assurerail.yml` and `playwright.assurerail.config.ts`;
- explicit AssureRail build, migration, QA, security, operations and deployment scripts;
- `tests/e2e/assurerail-sec01/**`;
- AssureRail-specific design, QA, runbook, security, operations, GTM, deck, template and
  incorporation records; and
- Rail-only public and private content assets required by the extracted web application.

The full `.git/filter-repo/commit-map` in the extraction working repository is retained as local
forensic evidence and should be stored in the Founder-controlled closing archive. It is not shipped
inside application source because it contains a monorepo-wide commit inventory.

## 3. Explicit exclusions

The filter excluded:

- AssureLocker API/web/product code and formation documents;
- AssureCLA, AssurePool and AssurePlane product code;
- AssureTransfer product code;
- the parked AssurePlane/bond-trustee second-spine specifications;
- monorepo-wide shared packages, infrastructure and unrelated scripts;
- `.env`, installed dependencies, build output, caches, databases and runtime/customer evidence;
  and
- all source-working-tree changes not present in the selected source commit.

AssurePool and AssureTransfer wire examples needed to preserve adapter conformance were re-expressed
as narrow, Rail-owned provider-boundary fixtures. They confer no ownership or runtime dependency on
the source products.

## 4. Standalone corrections

The extracted repository was made independently buildable by:

1. creating a minimal npm workspace root for `@assurerail/api` and `@assurerail/web`;
2. replacing the `@code/shared` source dependency with local provider-boundary contracts and
   lossless fixture mappings;
3. moving Prisma client generation inside the API workspace;
4. replacing monorepo Docker build assumptions and external Google-font build fetches;
5. separating tape, identity, anchor and settlement provider endpoints and credentials;
6. removing hard-coded AssureLocker demo identities, email and source-tree checks;
7. preserving the `DEMO` default and every fail-closed capability/production invariant;
8. upgrading SimpleWebAuthn v8 to v14 and adapting its registration credential model;
9. moving Prisma to the audited 6.12 maintenance release because the later 6.x configuration
   dependency carried a high-severity recursive-merge advisory; and
10. adding repository-local security, contribution and deterministic-manifest controls.

## 5. Verification executed

### Code and application

- API TypeScript/Prisma build: passed.
- Complete API test corpus: **366 passed, 0 failed, 0 skipped**.
- Static architecture/security invariants: passed.
- PR-18 and AR-21 through AR-30 web boundary checks: passed.
- Next.js production build: passed; **40 application routes/pages** generated or registered.
- Additional CX/PUB/SIM/INBOUND/public-exposure/content/private-access checks: passed before the
  final full rehearsal and remained covered by the unchanged web source.
- Shell syntax: all extracted shell scripts passed `bash -n`; `shellcheck` was unavailable.
- Prisma schema validation: passed.

### Database and recovery

`npm run check -- --full` passed all **24** disposable PostgreSQL rehearsals from PR-02 through
AR-30. The suite repeatedly deployed all **32** migrations from zero and exercised, as applicable:

- additive legacy upgrades and restrictive history;
- tenant/case authority and maker-checker constraints;
- command/event idempotency and external-instruction boundaries;
- evidence, case-room, replay, lifecycle, primary/secondary and token-representation records;
- schema parity;
- backup and restore; and
- production-scale open-gate behaviour with no activation or external action.

Final suite result:

```text
[ARAIL-INTEGRATED] PASS mode=--full external-evidence=not-tested
external-gates=remain-open deployment=not-performed
```

### Dependency and secret posture

- npm production audit: **0 critical, 0 high, 6 moderate, 0 low**.
- The six monitored moderate findings are the Firebase Admin → unused Google Cloud Storage
  transport subtree (`@google-cloud/storage`, `gaxios`, `retry-request`, `teeny-request`, `uuid` and
  the parent `firebase-admin`). AssureRail imports Firebase application/authentication only. The
  explicit reachability decision expires on 3 October 2026 and is not a VAPT substitute.
- SimpleWebAuthn's prior low-severity finding and Prisma's high-severity dependency chain were
  remediated, not added to the baseline.
- Full filtered-history gitleaks scanning is required to pass after redaction of one historical
  public reCAPTCHA site identifier. Exact taxonomy phrases and synthetic idempotency fixture IDs are
  narrowly allow-listed as non-secrets in `.gitleaks.toml`.
- A CycloneDX SBOM and the deterministic tracked-file manifest must be generated from the final
  signed commit and retained in the Founder closing archive.

## 6. Gates still open

1. Create the private Founder-controlled `deepaknorman/assurerail` remote or confirm another
   organisation; the proposed GitHub repository did not exist when tested.
2. Repair GitHub CLI authentication, configure MFA/least privilege/branch protection/secret
   scanning and push the signed extraction tag.
3. Run a clean clone from that remote and repeat install/build/test/manifest verification.
4. Establish AssureRail-controlled Azure, CI/CD, artefact, domain, identity, secret and backup
   administration under RS-03.
5. Complete contributor agreements, third-party/open-source review and the Founder IP Register.
6. Complete authenticated two-tenant E2E/DAST and independent VAPT in the approved pre-production
   environment.
7. Obtain real DA/PTC replay evidence and every function-specific external authority gate before
   activation.
8. At incorporation, execute the direct Founder-to-AssureRail assignment, Board acceptance and
   delivery certificate against the same signed baseline.

## 7. Reproduction commands

```bash
npm ci
npm run security:deps
npm run check -- --full
gitleaks git --no-banner --redact --exit-code 1 .
npm sbom --workspace=@assurerail/api --workspace=@assurerail/web --sbom-format=cyclonedx
scripts/assurerail-repository-manifest.sh HEAD
```

The last two outputs contain machine evidence and should be retained outside the source tree with
their SHA-256 digests, reviewer, creation time and target commit.
