# AssureRail PR-04 institutional workspace — executed evidence

**Execution date:** 30 August 2026

**Branch:** `codex/assurerail-pr01-neutral-taxonomy`

**Implementation commit:** `5562ba91e` (`feat(assurerail): add institutional governance workspaces`)

**Scope:** local source, test and production-build verification. No environment was deployed and no
external identity, KYB, trustee, RTA/depository, payment, ledger or customer system was called.

## Result

PR-04 adds institutional participant and platform-review workspaces without adding a database model
or changing the shadow/compare feature boundary. The focused API corpus and web production build
passed. The build initially failed only because the restricted runner could not download the three
existing `next/font` Google font files; the identical build passed when that declared build-time
network access was permitted.

## Executed checks

| Check | Result |
|---|---|
| API Prisma generation + TypeScript | **PASS** |
| AssureRail API test suite | **135 passed, 0 failed, 0 skipped** |
| AssureRail web TypeScript | **PASS** |
| AssureRail web production build | **PASS**, 11 static + 1 dynamic app routes |
| Endpoint/access contract | **PASS**, 19 institutional endpoints / 6 platform-only |
| Repository AssureRail build/security gate | **PASS** (web step intentionally replaced by the separately passed final web build) |
| No-egress AssureRail API production build | **PASS** |
| AssureTransfer room golden gate | **26 passed, 0 failed, 0 skipped** |
| Outgoing-history Gitleaks | **PASS**, 5,671 commits / 928.33 MB / no leaks |
| Working-source Gitleaks | **PASS**, institution API + Rail web source / no leaks |
| Semgrep | **PASS**, 128 cached rules / 33 source targets plus 5 explicit new files / 0 findings |
| Diff whitespace check | **PASS** |

The PR-04 tests specifically prove:

- an identity without exact membership cannot discover an institution workspace;
- a pre-admission applicant receives application data and no route/appointment/change authority;
- an active member without an exact `VIEW_INSTITUTION` mandate is denied;
- an active member cannot read a governance workspace without the matching session institution;
- the platform-review workspace declares no act-for-participant or impersonation capability; and
- a non-platform administrator cannot list the approval queue.

The existing corpus also re-proved PR-03 session/institution binding, one-use purpose-bound step-up,
maker/checker separation, evidence expected-versus-achieved policy, route-mode bounds and immediate
suspension denial.

## Evidence boundary

This evidence does not prove:

- browser automation against a deployed identity provider;
- production TOTP recovery/secret handling;
- connector certification, evidence-object storage, malware quarantine or legal hold (PR-05);
- transaction-case or object-level legacy route enforcement (PR-06 onward);
- external participant or trustee acceptance;
- live/production DA or PTC operation; or
- deployment.
