# AssureRail PTC-preparation Stage 4 deployer handoff

**Status:** code/config handoff; deploy dark, do not enable without separate approval
**Date:** 7 September 2026

## Delivered boundary

AssurePool may optionally submit its signed source-side PTC-preparation package to a conventional
PTC case. AssureRail verifies the package independently, preserves it as provider evidence and
forces the Rail result to `REVIEW_REQUIRED`. AssurePool does not host, structure, issue, complete or
operate the PTC, and its result cannot transition a case or replace trustee/counsel/recordkeeper
authority.

AssureRail imports no AssureLocker/AssurePool source package, database, identity, private key or
service credential. The connector speaks only the signed provider contract
`assurepool.ptc-prep-evidence.v1` through Rail's ordinary certified-connector intake.

## Deploy-dark configuration

Keep the new feature explicitly off in the API environment:

```text
ARAIL_ASSUREPOOL_PTC_PREPARATION_CONNECTOR_V1=off
```

The only accepted future enablement value is `shadow`; there is no `on`, `live` or `production`
posture. The module mounts only when all four flags are `shadow`:

```text
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_ASSUREPOOL_PTC_PREPARATION_CONNECTOR_V1=shadow
```

No schema migration is introduced by Stage 4. Existing neutral intake/evidence tables retain the
package and its source-specific extension.

## Public-key trust configuration

Before shadow enablement, place a separately verified public-key list in the environment secret
manager:

```text
ARAIL_ASSUREPOOL_TRUSTED_KEYS_JSON=[{"providerId":"<provider>","keyId":"<32-hex SPKI fingerprint>","publicKeyPem":"<PEM>"}]
```

Only public keys cross the provider boundary. Confirm the fingerprint through an independent
channel; never trust the public key or key identifier supplied with the package being verified.
Do not reuse the AssureLens trust list, an AssureLocker service secret or a shared private key.

## Shadow prerequisites

1. DB-mode authentication and active institution/session context work.
2. The target case is `PTC + CONVENTIONAL`, and the submitting institution is an accepted party.
3. A provider reference and institution-owned connector are registered.
4. A different authorised reviewer has approved profile `assurepool.ptc-prep-evidence.v1` against
   `assurerail.neutral-intake/1.0.0` after conformance evidence review.
5. The upstream package is generated after a frozen pool export and carries `PTC_PREP` plus the
   optional signed SSA block.
6. Counsel confirmation remains an open external gate; it is not replaced by this connector.

## Required smoke battery

- valid signed package persists once and returns provider result plus Rail `REVIEW_REQUIRED`;
- identical retry returns the same intake/evidence coordinates;
- changed SSA bytes under the prior signature fail;
- package/tape/manifest/performance/outer payload digest drift fails;
- unknown key, malformed signature and public-key fingerprint mismatch fail;
- `READY` while counsel confirmation is pending fails;
- a `FAIL` finding under any non-`FAIL` overall result fails;
- 500 bps maps only to `BAND_5PC`/`RMBS_5PC`, and 1,000 bps only to `BAND_10PC`;
- a DA package, DA case or tokenised PTC case fails this profile; and
- accepted source evidence cannot transition, complete, issue or restrict a Rail case.

## Verification evidence

The disposable SIM gate passed 208/208 assertions: the existing 200-case institutional matrix plus
eight signed PTC-preparation scenarios. It also preserved 20 intakes through process restart and
database backup/restore. This is synthetic software evidence only; real provider ceremony,
authenticated two-tenant E2E/DAST, independent VAPT, counsel review and institutional acceptance
remain open.

## Rollback

Set `ARAIL_ASSUREPOOL_PTC_PREPARATION_CONNECTOR_V1=off` and restart the API. The controller/module
then does not mount. Preserve all prior intake/evidence/audit rows; do not delete or rewrite them.
If a signing key is compromised, also remove it from the trust list, suspend the connector and
perform a package-impact review before any re-enable.
