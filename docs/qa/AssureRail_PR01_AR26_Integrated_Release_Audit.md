# AssureRail PR-01 through AR-26 integrated release audit

**Status:** software release-candidate audit; suitable for commit and dark/shadow handoff after the
recorded checks pass; **not** controlled-live or production approval
**Audit date:** 2 September 2026
**Code baseline:** `220afb53b01d50a955b77e00b1ac8f4fccd3da78` through the current AR-26
working candidate on `codex/assurerail-pr01-neutral-taxonomy`
**Authority:** EX-28 permits implementation, commit and push; no deployment or activation

## 1. Executive conclusion

The programme is a substantial, coherent shadow/replay product, not a finished production venue.
The neutral contract, durable persistence, participant authority, evidence, case, room, DA/PTC
replay, token mirror, readiness, commercial, secondary, conduct, customer, integration, operations
and product-journey layers compile and operate together against the current additive schema.

It is appropriate to keep committing the staged build behind default-off flags. It is not appropriate
to describe or activate it as controlled-live or production. The remaining boundary is not simply
"more testing": it includes real historic transactions, named accountable owners, counsel-approved
route packs, provider/trustee/recordkeeper acceptance, production connectors, VAPT remediation,
operational rehearsals and a signed PR-12 activation manifest.

This audit found and corrected five material integration defects:

1. six early upgrade rehearsals could apply later dependent migrations before the migration under
   test and still obscure the resulting SQL error;
2. the PR-16 disposable PostgreSQL port calculation could exceed port 65535;
3. the AR-26 handoff/read model could expose a later commercial term to a counterparty whose current
   audience grant had expired but whose earlier case handoff was retained; and
4. enforced internal RBAC removed the legacy administrator bypass but still allowed an otherwise
   valid legacy function/entity role to reach the known-unsafe legacy Note surface. Enforced mode now
   retires the whole decorator-gated legacy surface; and
5. AR-26 initially retained a pre-transaction route decision/digest even though the case function or
   participant entitlement could change before the handoff write. The governing function and route
   are now re-evaluated inside the same transaction, and the receipt digest is built from those
   transaction-current records.

No external gate was converted into a pass and no deployment was performed.

## 2. Scope reviewed

The AssureRail-specific cumulative change comprises approximately 384 files and 49,487 additions
from the PR-01 parent through the committed AR-25 tip, plus the uncommitted AR-26 candidate and this
audit. Review covered:

- API modules, controllers, service boundaries, policies and background workers;
- all Rail Prisma models and 29 migrations in the candidate schema;
- API and web feature flags, runtime dependencies, compose and Docker wiring;
- customer and internal workspace routes;
- exact-value, digest, idempotency, maker/checker, step-up, tenant/case and evidence controls;
- every available stage-specific disposable database rehearsal;
- migration from zero, pre-target upgrade fixtures, schema parity and backup/restore;
- the complete API test corpus and all current AssureRail web boundary checks;
- secret and static security scanning; and
- every existing PR/AR evidence record and deployer handoff for open external gates.

Unrelated AssureCLA, GTM, deck, security-log and root lockfile work present in the shared worktree was
not edited, staged or treated as this audit's work.

## 3. Stage disposition

| Stage | Internally demonstrated | Status after cumulative review |
|---|---|---|
| PR-01 | Versioned neutral taxonomy, canonical envelopes, exact values and provider mappings | Internally complete; taxonomy governance/external legal semantics remain owner-approved inputs |
| PR-02 | Durable inbox/outbox/idempotency, webhook safety, Vault references and recovery | Internally complete; production Vault/provider operating evidence open |
| PR-03–04 | Institution, admission, membership, mandate, appointment, route entitlement and workspaces | Shadow complete; real provider/customer acceptance and production internal-admin bridge open |
| PR-05 | Immutable intake/evidence/document metadata, object-store and quarantine boundary | Internally complete; real object store, malware service, retention/legal-hold operation open |
| PR-06 | Neutral case, parties, functions, conditions, decisions and transitions | Shadow complete; no legal completion inference |
| PR-07–08 | Rail room, legacy-chain migration/cutover and source completion acknowledgement | Internally complete; no real legacy production backfill or customer cutover performed |
| PR-09 / AR-23 | Conventional DA replay kernel and coherent product journey | Software complete in observe-only mode; participant-authorised historic DA replay open |
| OP-01 | Internal roles, scoped assignments, elevations and workspaces | Foundation complete; remaining operational APIs must be ported from legacy admin authority |
| PR-10 / AR-24 | Conventional PTC replay plan, evidence, observations, repair and customer journey | Software complete in observe-only mode; all-leg trustee-authorised historic PTC replay open |
| PR-11 | Tokenised-DA mirror linked to the neutral case and reconciled authority | Shadow/mirror complete; legal status, custody, connector finality and live acceptance open |
| PR-12 | Readiness requirements, two-person decisions and build/environment/cohort activation manifest | Control machinery complete; its external evidence and signed activation decisions remain open |
| PR-13 / AR-26 | Named-audience terms, RFQ, negotiation, allocation and non-executing case handoff | Shadow product complete after projection correction; matching/execution permission not claimed |
| PR-14 / AR-27 foundation | Conventional secondary replay records and reconciliation | Observe-only foundation complete; AR-27 usable journeys and external route evidence remain |
| PR-15 | Certified connector/custody/finality boundary and durable dispatch preparation | Internal boundary complete; no live connector, keys, finality or recovery acceptance |
| PR-16 | Separately governed tokenised-PTC mirror | Shadow foundation complete; not inferred from DA and no external evidence supplied |
| PR-17 | Conduct policy, signals, alerts, investigation, controls and capacity | Internal tooling complete; legal/conduct ownership, calibration and live surveillance open |
| PR-18 / AR-21 | Customer workspaces and institution-scoped action centre | Product UI complete for current shadow functions; browser/device/accessibility acceptance open |
| PR-19 / AR-22 | Developer integration and institutional product records | Shadow complete; real SSO/client credentials and connector certification remain external |
| PR-20 / AR-25 | Customer operations/commercial records and lifecycle product | Shadow complete; finance/service/lifecycle operating acceptance open |

## 4. Verification executed

### 4.1 Code, tests and builds

- Prisma generation and TypeScript compilation completed with the full API test corpus.
- The final corpus contains 332 tests; characterization tests that demonstrate legacy defects are
  explicitly labelled and are not counted as fixes.
- Web boundary checks ran for PR-18 and AR-21 through AR-26.
- The Next.js production build generated the current customer workspace routes.
- `scripts/check-assurerail-invariants.mjs` verifies startup, endpoint, provider-boundary, persistence,
  institution-authority, legacy-surface and database-segregation invariants.
- `scripts/assurerail-integrated-release-check.sh --code` is the repeatable cumulative code gate;
  `--full` adds every database rehearsal below.

### 4.2 Database rehearsals

The candidate schema contains 29 ordered migrations. Twenty-one stage rehearsals passed against
disposable PostgreSQL instances: PR-02, PR-03, PR-05 through PR-17, PR-19, PR-20, OP-01, AR-22,
AR-25 and AR-26. They cover fresh migration, target-specific upgrade where applicable, real Prisma
service execution, idempotency/concurrency constraints, restrictive history, schema parity and
backup/restore. PR-01, PR-04, PR-18, AR-21, AR-23 and AR-24 do not add independent persistence and
are covered by contract, API or UI tests over their underlying stage schemas.

The PR-02/03/05/06/07/08 upgrade loops now stop before the target migration, so later migrations can
no longer contaminate the upgrade fixture. Every shell script passes `bash -n`; `shellcheck` is not
installed in the audit environment.

### 4.3 Security checks

- Gitleaks scanned 119 commits / approximately 4.63 MB from the PR-01 parent to the committed AR-25
  tip and found no secret. The final intended AR-26 paths require the normal staged scan before
  commit.
- Seven repository-pinned Semgrep rule packs scanned 426 tracked AssureRail/API/web/script targets:
  161 applicable rules, zero findings, approximately 98.1% parsed lines.
- A read-only npm production audit reported **0 critical, 7 high and 16 moderate** dependency
  advisories. The high findings include the installed `@grpc/grpc-js@1.12.6` crash advisories and
  transitive parser/upload/build-chain issues. These are not introduced by AR-26, but they block a
  production release until dependency ownership, non-breaking upgrades and regression tests close
  them. A forced major-version audit fix was deliberately not applied in the shared dirty worktree.
- Trivy's repository-wide scan likewise reported no critical finding and high findings across the
  root npm lockfile; unrelated Java SDK findings were excluded from the AssureRail conclusion.

## 5. Findings corrected in the candidate

| ID | Finding | Correction and evidence |
|---|---|---|
| `IA-01` | Historical upgrade rehearsals could be false-green/noisy | Pre-target sorted migration sets plus fail-fast rerun; PR-02–08 all pass cleanly |
| `IA-02` | PR-16 ephemeral port could exceed 65535 | Bounded to 65300–65399; rehearsal passes |
| `IA-03` | Legacy users could still reach known-unsafe role endpoints under internal RBAC enforcement | Roles guard now rejects all legacy function/entity/platform decorators in enforced mode; guard-chain and static invariant tests cover it |
| `IA-04` | AR-26 handoff could proceed against stale case/allocation/term/audience state | Preconditions are checked before and inside the governed transaction; immutable handoff binds term, allocation, audience and route-decision digests |
| `IA-05` | Handoff status could be mistaken for counterparty acceptance | Receipt remains `HANDOFF_RECORDED`; case-party acceptance is a separate counterparty step and live status is projected from `CaseParty` |
| `IA-06` | Handoff-only access could reveal the latest later term and ongoing conversation data | Projection now returns only the handoff-bound term, allocation, grant and receipt after grant expiry/revocation or terminal opportunity state; DB rehearsal creates a later term and proves it is hidden |
| `IA-07` | Handoff receipt could retain a stale pre-transaction entitlement decision and digest | Case function and counterparty route are rechecked transactionally; the immutable digest is calculated from the transaction-current allocation, term, grant, case and decision |

## 6. Open engineering and external gates

These items do not block committing or deploying the build dark. They **do** block the corresponding
controlled-live/production claim or activation.

### 6.1 Engineering blockers before controlled live

1. Current customer/product flags from PR-13 onward intentionally support only `shadow`; a general
   controlled-live DA/PTC command path has not been implemented. PR-15 registers a narrowly bounded
   token connector path but does not make the whole venue live.
2. **Resolved by SEP-01:** the human identity path now uses a deployment-selected, provider-neutral
   HTTPS contract, and no DigiKYC/AssureLocker endpoint, header or default provider remains in the
   executable identity boundary. Provider conformance and certification remain activation evidence,
   not a code-presence claim. The legacy AssurePool-profile source adapter remains optional and
   separate from generic DA/PTC intake.
3. Institution/evidence administration still uses some legacy `@AdminOnly` endpoints. Enforced
   internal RBAC now correctly blocks those endpoints, so equivalent permission-specific internal
   operations APIs and UIs must be built before production participant onboarding.
4. The 7 high and 16 moderate npm production dependency advisories require a separately reviewed
   dependency upgrade; no `--force` major upgrade may be treated as a security fix without tests.
5. The local checkout's installed `bignumber.js@9.1.1` does not satisfy the shared workspace's
   `^9.3.1` declaration, although the lockfile describes a nested 9.3.1 copy and the API build/tests
   pass. Verify a clean `npm ci` artefact/SBOM in CI or the deploy build rather than certifying the
   existing developer `node_modules` tree.
6. Browser E2E, assistive-technology/device coverage, authenticated multi-institution HTTP testing,
   fuzzing, load/soak, failover and production restore evidence remain incomplete.

### 6.2 External gates

- named, authorised historic DA and PTC data owners and complete transaction evidence;
- participant and trustee acceptance of all relevant replay legs and the resulting dossiers;
- counsel-ratified domestic-India DA/PTC route packs and function-performer conclusions;
- trustee/RTA/depository/register, payment, signing/stamping, rating, servicer and other selected
  provider contracts, conformance and finality evidence;
- VAPT/penetration-test findings closed and independently accepted;
- key custody, secrets rotation, incident, BCP/DR, capacity and provider-exit rehearsals;
- staffed SOP ownership, escalation/on-call coverage and independent reconciliation sign-off; and
- PR-12 build/environment/cohort-specific approval and activation manifest.

## 7. Release decision

**Approved technical disposition:** commit and push the cohesive AR-26/audit changes; keep all new
flags off unless a separately authorised replay/shadow cohort satisfies its prerequisites. No deploy
is part of this disposition.

**Explicitly not approved:** controlled-live or production activation, public availability claims,
marketplace/matching claims, legal ownership/finality claims, or treating synthetic rehearsals as
customer/trustee/provider evidence.

AR-27 should begin only after this checkpoint is retained. AR-27 may build the usable conventional
secondary journeys in observe-only mode, while the production-admin, provider-neutrality and
dependency findings above remain named AR-29/AR-30 gates rather than being forgotten.
