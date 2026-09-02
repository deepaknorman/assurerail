# AssureRail AR-27 conventional secondary product — internal evidence

**Date:** 2 September 2026
**Authority:** EX-28 implementation/check/commit/push only; no deployment or activation
**Evidence class:** software and disposable synthetic database rehearsal; not legal, participant,
trustee, recordkeeper, VAPT, controlled-live or production evidence

## Outcome

AR-27's institution-scoped conventional DA/PTC secondary register and case journey are implemented
behind default-off API and web flags. The checks below prove route separation, access boundaries,
evidence quality, maker-checker repair, idempotency, additive migration, evidence export, backup and
restore. They do not prove that a real transaction transferred cash or title or that an external
register changed.

## Executed checks

| Check | Result |
|---|---|
| Prisma schema validation | passed |
| AssureRail API TypeScript/Prisma build | passed |
| Focused secondary/configuration corpus after final review | 50 passed, 0 failed, 0 skipped |
| Full AssureRail API corpus through AR-27 | 341 passed, 0 failed, 0 skipped |
| Static architecture, secret and network invariants | passed |
| AR-21 through AR-27 plus PR-18 web boundary checks | 8 passed |
| AssureRail production web build | passed; 22 pages, including `/workspace/secondary` and `/workspace/cases/[caseId]/secondary` |
| AR-27 disposable PostgreSQL migration/service rehearsal | passed; all 30 migrations applied |
| AR-27 backup/restore and schema parity | passed; repair/evidence/audit restored as `1|3|3` |

The cumulative command was:

```text
bash scripts/assurerail-integrated-release-check.sh --code
```

The stage database command was:

```text
bash scripts/assurerail-ar27-db-rehearsal.sh
```

## Behaviours proven

- DA derives nine required evidence types and does not inject trustee control.
- PTC derives ten evidence types and keeps trustee control separate from the operative record.
- Missing, invalid, unsigned, expired, unverified, wrong-provider or digest-mismatched evidence fails
  closed.
- Evidence details and exports require separate `VIEW_EVIDENCE` authority; `VIEW_CASE` alone receives
  a redacted projection.
- Registry records are scoped to seller, buyer, trustee or recordkeeper participation.
- The seller maker cannot review their dossier proposal.
- A break owner maker cannot review their own repair proposal.
- An approved repair appends evidence version 2; evidence version 1 remains present.
- A matching replacement resolves the retained break and reconciles the Rail dossier without an
  external instruction.
- Repair commands are idempotent and audit events are written within the governed transaction.
- The evidence pack excludes internal step-up/idempotency/mandate material, states no legal effect,
  has a reproducible canonical content digest, and writes a governed access event.
- The migration is additive with restrictive foreign keys; deletion of a referenced break is
  rejected.
- Fresh migration, schema parity, dump and restore all pass.

## Defects found and corrected during review

1. The first schema test treated `ON UPDATE CASCADE` as a data-update statement. Its destructive-SQL
   assertion was narrowed to actual `UPDATE "..."` statements and rerun successfully.
2. The first service/database rehearsal found that the evidence-pack digest attempted to canonicalise
   Prisma `Date` objects. All retained timestamps in the pack are now explicit ISO-8601 strings. The
   complete migration/service/backup/restore rehearsal then passed.
3. Review identified that PR-14 evidence linking accepted a submitted assertion digest without
   proving equality to the retained current payload, and that `VIEW_CASE` could expose evidence
   details. AR-27 now requires digest equality, verified signature, explicit `VIEW_EVIDENCE`, and
   ownership/current grant; non-evidence viewers receive a redacted projection.
4. Final transaction review identified a time-of-check/time-of-use gap: evidence and provider
   eligibility were checked immediately before, but not inside, decisive write transactions. Initial
   evidence links, repair proposals and repair approvals now recheck current version, status,
   signature, expiry, grant, digest and provider admission inside the locked transaction.

## External checks not executed and still open

- counsel-ratified domestic DA/PTC secondary route packs;
- actual seller/buyer route and operating acceptance;
- actual trustee/RTA/depository/register authority and integration evidence;
- payment/cash acknowledgement evidence;
- VAPT and independent security acceptance;
- real historic replay or live shadow evidence;
- controlled-live rehearsal and PR-12 sign-off; and
- production activation.

Synthetic rows in the disposable rehearsal are labelled `SYNTHETIC_TEST_FIXTURE`. They prove code
behaviour only and may not be used to close any item above.
