# AssureRail PR-13 primary-commercial internal evidence

**Status:** internal implementation evidence only; all external acceptance gates open.
**Date:** 2 September 2026.
**Exception:** EX-27.
**Deployment:** none.

## Implemented evidence

- Additive nine-model commercial persistence layer with restrictive history.
- Sixteen institution- and case-scoped endpoints.
- Named-institution audience only.
- Active membership/mandate, route-entitlement and material-function checks.
- Step-up evidence for every governed mutation.
- Immutable, digested term versions and exact-value bounds.
- Idempotent opportunity, interest, RFQ, message and allocation commands.
- Independent publication/resumption review.
- Independent allocation review with oversubscription lock.
- Counterparty-filtered reads and owner/self-counterparty prohibition.
- Shadow-only, off-by-default runtime control.
- No external adapter import or dispatch path.
- No implemented-live capability registration.

## Executed checks

Executed on 2 September 2026:

- `npm test` in `apps/assurerail-api`: **246 passed, 0 failed, 0 skipped**;
- `npm run build`: passed after Prisma Client generation;
- `bash -n scripts/assurerail-pr13-db-rehearsal.sh`: passed; and
- `npm run db:rehearse:pr13`: all **20 migrations** applied to disposable PostgreSQL; nine PR-13
  models, restrictive history, unique immutable versions, scoped idempotency and backup/restore
  were exercised. Restored counts were `1|1|1|1|1|1|1`. Final marker:
  `matching=not-implemented external-mutation=none external-evidence=not-claimed`.

The database rows are synthetic and prove persistence mechanics only. They do not represent a real
customer, communication, allocation, legal permission, operating acceptance or completed trade.

## Open external evidence

- Route/function legal and regulatory perimeter acceptance.
- Named performer and licensed/authorised-partner assignment where required.
- Real participant acceptance of commercial operating procedures.
- Conflict, fair-access, conduct, complaint and correction controls.
- Independent security assessment and remediation acceptance.
- Capacity, BCP/DR, incident and staffing acceptance.
- Controlled-live customer pilot and participant evidence export.

No item above is passed, waived or inferred by this document.
