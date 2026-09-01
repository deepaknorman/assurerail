# AssureRail PR-12 internal implementation evidence

**Status:** internal evidence only; external acceptance gates open.
**Date:** 2 September 2026.
**Exception:** EX-27.
**Deployment:** none.

## Implemented evidence

- Strict, canonical, Ed25519-verified activation manifest.
- Exact environment, operating mode and 40-character build binding.
- Expiring route/representation/lifecycle/function/performer/cohort allow-list.
- Controlled-live and production-specific gate registries.
- External-evidence classification for legal, connector, customer/trustee and security gates.
- Five distinct accountable release-approval roles.
- Additive durable requirement, decision, activation and binding models.
- Independent gate review and independent activation review.
- Activation/gate expiry and revocation checks.
- Internal RBAC enforcement coverage and legacy bypass retirement.
- Disposable migration, constraint, backup and restore rehearsal.
- Deployer environment matrix, activation checklist, smoke tests and safe-pause process.
- Empty-by-default implemented-live capability registry; a manifest cannot invent build support.
- Live-mode fences on legacy mint, DvP, amortisation, closure, surveillance and break-glass effects.

## Tests and labels

The executable suite labels this evidence `[PR12]`. It proves canonical validation, signature
binding, required gates, external-evidence non-substitution, expiry, build mismatch, approver
separation, internal staff coverage, additive schema and endpoint separation.

Executed on 2 September 2026:

- `npm test -- --runInBand` in `apps/assurerail-api`: **238 passed, 0 failed, 0 skipped**;
- `npm run typecheck`: passed after Prisma Client generation;
- `bash -n scripts/assurerail-pr12-db-rehearsal.sh`: passed; and
- `npm run db:rehearse:pr12`: all **19 migrations** applied to a disposable PostgreSQL database,
  immutable decisions and exact activation bindings were exercised, and backup/restore retained
  `1|1|1|1` gate/decision/activation/binding rows. Final marker:
  `external-evidence=not-claimed`.

`scripts/assurerail-pr12-db-rehearsal.sh` is deliberately synthetic and proves only database
migration, restrictive history, unique decision versions, binding preservation and backup/restore.
Its final output explicitly says `external-evidence=not-claimed`.

## Open external evidence

- Independent security assessment and accepted remediation.
- Real participant/trustee evidence export and independent verification.
- Exact route/function legal and regulatory permission.
- Real connector certification and ambiguous-success recovery test.
- Operating-party acceptance and out-of-hours rehearsal.
- Controlled-live customer pilot.
- Capacity/coverage acceptance.
- Customer exit rehearsal.

No item above is passed, waived or inferred by this document.
