# AssurePool provider-v2 consumer evidence

**Status:** locally checked, feature-dark; 7 September 2026
**Scope:** standalone AssureRail parser, verifier, transport boundary, legacy projection and neutral
intake mapping

## Executed evidence

- AssureRail API build and focused provider/mapping/runtime tests: passed, 57/57.
- Complete AssureRail API suite after the final transport and branded-verifier changes: passed,
  388/388.
- AssureRail web production build: passed, 40 routes generated/classified.
- Static security, separation, endpoint, persistence, authority and adapter invariants: passed.
- Repository secret scan: passed with no leaks.
- Prisma schema validation and all AssureRail shell syntax checks: passed.

The managed execution environment would not permit the gate to nest macOS `sandbox-exec`, so its
NO-EGRESS build wrapper could not execute there. The same API build completed normally, and the
remaining complete gate stages passed. The independent deployment/build runner must retain the
NO-EGRESS check before activation; this limitation is not recorded as an application pass.

## Negative cases exercised

- unknown or missing fields;
- hostile prototype-shaped JSON keys;
- non-JSON and oversized response bodies;
- payload, package, tape, manifest, aggregate and performance-result tamper;
- wrong provider, unknown key and key/fingerprint mismatch;
- duplicate loan references and inconsistent lock counts;
- demo encumbrance facts in controlled-live/production; and
- override-only inclusion or missing live facts in controlled-live/production.

## Gates deliberately still open

No real provider conformance exchange, key rotation rehearsal, participant-authorised data receipt,
case-scoped neutral intake persistence or controlled-live activation was performed. Those require
the provider keys, network policy, participant authority and applicable Rail activation record.
