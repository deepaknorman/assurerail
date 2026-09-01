# AssureRail PR-14 internal evidence

**Date:** 2 September 2026
**Exception:** EX-27.
**Evidence class:** internal software evidence only; not legal, trustee, customer, recordkeeper,
connector, controlled-live or production acceptance.

## Implemented

- separate domestic conventional DA and PTC secondary replay route packs;
- exact positive unit quantity and consideration;
- active case party, assignment, entitlement, human mandate and step-up controls;
- immutable provider-attributed evidence versions for holder, chain, authority, restrictions,
  documents, notices/consents, cash and register facts;
- separate PTC trustee-control and recordkeeper assertions;
- two-person proposal/review with transactional audit;
- ordered observation legs and an explicit critical break on PTC disagreement;
- off-by-default, replay/shadow-only runtime control; and
- no external adapter import or mutating endpoint.

## Executed checks

- AssureRail API suite: **253 passed, 0 failed, 0 skipped**.
- PR-14 route tests: DA nine-leg plan, missing/unverified fail-closed behaviour, PTC trustee versus
  recordkeeper disagreement, and exact-value rejection passed.
- Endpoint/schema/perimeter tests passed.
- `bash -n scripts/assurerail-pr14-db-rehearsal.sh` passed.
- Disposable PostgreSQL rehearsal applied all **21 migrations**, proved four PR-14 models,
  immutable evidence-version uniqueness, restrictive history, explicit break persistence, schema
  parity, backup and restore (`1|1|1|1`).

The database fixtures are synthetic structural fixtures and the rehearsal reports
`external-evidence=not-claimed` and `external-mutation=none`.

## Open external gates

- named participant-authorised completed conventional secondary DA replay;
- named trustee/participant-authorised completed conventional secondary PTC replay;
- route-specific legal permission and transfer-restriction interpretation;
- payment and authoritative recordkeeper connector certification;
- trustee operating acceptance for PTC;
- independent security/operations acceptance and controlled pilot; and
- production activation manifest for any future implemented-live capability.

No synthetic or internal result may close these gates.
