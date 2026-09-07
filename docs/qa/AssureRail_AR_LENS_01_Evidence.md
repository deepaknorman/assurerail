# AssureRail AR-LENS-01 build evidence

**Date:** 7 September 2026
**Scope:** optional provider-neutral AssureLens monitoring-evidence connector
**Disposition:** build evidence only; no deployment or shadow activation

## Boundary demonstrated

- no AssureLocker package, database, identity service, internal API or private key dependency;
- connector absent unless four independent Rail shadow flags are deliberately enabled;
- independent Ed25519 public-key trust list with SPKI fingerprint verification;
- strict package, timestamp, coverage, result and boundary validation;
- minimised explanation schema and recursive rejection of raw entity identifiers, including values
  embedded in explanatory text;
- ordinary certified-connector/evidence intake rather than a privileged provider path; and
- provider result retained as evidence while the Rail result is always `REVIEW_REQUIRED` and no
  transaction state is changed.

## Executed checks

| Check | Result |
|---|---|
| Static architecture, secret/env, network, atomicity, database-separation and adapter invariants | Passed |
| Complete AssureRail API compile/test corpus after the final privacy patch | Passed: 370/370, zero skipped |
| Existing customer-web boundary checks PR-18 and AR-21 through AR-30 | Passed |
| AssureRail web production build | Passed: 40 routes generated |
| Scoped diff hygiene and secret-pattern scan | Passed; no matching secret material |

The cumulative code gate explicitly reported `external-evidence=not-tested` and
`deployment=not-performed`.

## Evidence not yet available

Trusted-key ceremony, connector registration/conformance, DB-mode authenticated two-tenant E2E,
DAST, independent VAPT, customer data rights, case-specific monitoring scope, real signed provider
traffic and operating acceptance remain open. The connector ships `off`; none of these gates may be
replaced by synthetic evidence.
