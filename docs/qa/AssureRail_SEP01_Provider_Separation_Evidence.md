# AssureRail SEP-01 provider-separation evidence

**Checked:** 7 September 2026

**Scope:** standalone AssureRail source, configuration and local executable checks

**Deployment/activation:** not performed; all external evidence and production gates remain open

## Outcome

SEP-01 removes AssureLocker's product-specific identity and online room dependencies from the
AssureRail runtime. Human identity assurance remains a governed control, but the deployment selects
a provider through a narrow HTTPS contract. A provider result binds an external subject reference;
it cannot admit an institution, grant membership or mandate, enable a route or authorise an action.

The online legacy-room proxy, its connector subject-mapping administration endpoint and its schema
profile have been retired. The deterministic sealed-room importer remains an offline migration
facility so historical evidence can be preserved without an application-network dependency.

Source, identity, token, anchor and settlement adapters now support an explicit `off` state. A
controlled-live or production deployment requires live identity assurance, while another adapter
is required only when an accepted live capability declares that exact dependency. The live
capability registry remains empty. Therefore this tranche enables no external action or route.

Plaza is recorded as a physically separate provider platform with an interim organisational/IP
home in AssureLocker Private Limited. It is not an AssureRail component. AssureRail may consume a
future Plaza token/HTS service only through a tenant-isolated, versioned provider contract and a
specific AssureLocker--AssureRail MSA schedule. Conventional DA/PTC has no Plaza dependency.

## Executed verification

| Check | Result |
|---|---|
| Full cumulative software gate | PASS — `assurerail-integrated-release-check.sh --full` |
| API compile and tests | PASS — 377/377 |
| Web boundary checks | PASS — PR-18 and AR-21 through AR-30 |
| Web production build | PASS — 40 routes |
| Disposable PostgreSQL rehearsals | PASS — 24 scripts; all 32 migrations exercised from zero, with upgrade/restore coverage |
| Release-control/configuration tests | PASS — 12/12 |
| Repository format/configuration | PASS — 491 tracked/unignored files |
| Static architecture/safety invariants | PASS |
| SEP-01 identity/provider tests | PASS as part of the 377-test corpus |
| Gitleaks | PASS — 129 commits / approximately 5.43 MB plus staged SEP-01 content; no leak |
| AssureRail Semgrep rules | PASS — 7 rules over 403 targets; zero findings; timeout warnings disclosed below |
| Blocking dependency ratchet | PASS — 0 critical, 0 high, 6 bounded moderate, 0 low |
| Trivy dependency scan | PASS — zero high/critical findings in `package-lock.json` |
| Trivy configuration scan | PASS — zero high/critical findings in both Dockerfiles |
| CycloneDX SBOM | PASS — generated in ignored local security output |
| Deployment | NOT PERFORMED |

The first full-security attempt could not reach the npm advisory service inside the restricted
network environment. It was rerun with approved network access and completed successfully. This was
an execution-environment restriction, not an application test failure.

The supplemental OSV scanner continues to identify `GHSA-w5hq-g745-h8pq` in the transitive optional
`uuid@9.0.1` chain and reports a 7.5 CVSS score. The blocking, dated dependency ratchet classifies the
installed reachability chain among the six accepted moderate advisories and keeps its 3 October 2026
review date. It is not represented as remediated. Grype could not complete; Checkov and njsscan were
not installed. These optional depth-scanner outcomes do not replace the blocking Gitleaks, Semgrep,
dependency-ratchet and Trivy results, and remain visible for VAPT/dependency follow-up.

The post-staging Semgrep run reported timeouts for the dynamic-code and shell-exec rules on four
pre-existing large service files (`cases`, `da-replay`, `ptc-replay` and `secondary-transfer`). It
reported zero findings and no timeout on the changed identity, runtime, adapter or room-boundary
files. The timeout coverage gap remains visible for a later tuned/rule-specific scan and VAPT; it is
not described as an independently complete SAST proof.

## Separation demonstrated by this tranche

- no AssureLocker application or Prisma-client import in the Rail runtime;
- a Rail-owned repository, packages, schema/migrations and release controls;
- no AssureLocker, DigiKYC or Plaza host, path, header or provider default in executable adapter
  configuration;
- provider URLs, paths, credentials and modes selected independently by Rail deployment;
- no online legacy-room or subject-mapping API bridge;
- no caller-selected identity provider and no provider-granted admission/authority; and
- fail-closed demo/live/capability dependency rules.

## Evidence still open before “complete physical and network separation”

This source audit proves logical and configuration separation; it cannot prove deployed physical
facts. An unqualified production confirmation still requires:

1. the Azure Hyderabad-primary/Pune-recovery as-built inventory, policies and access exports;
2. distinct Rail resource, database, storage, key, identity, backup and logging evidence;
3. explicit egress allow-lists and private/provider endpoint maps showing no lateral path to
   AssureLocker;
4. Plaza tenant/data/key/operator separation and its executed MSA service schedule before use;
5. authenticated two-tenant E2E/DAST including provider failure and cross-tenant negative tests;
6. independent VAPT remediation and retest closure; and
7. named operational owners, access review, incident, BCP/DR and provider-exit rehearsals.

Until those records exist, the accurate statement is: **AssureRail is logically separated and its
provider boundaries are designed to be physically and network separated; deployed production
separation remains an evidence-backed activation gate.**
