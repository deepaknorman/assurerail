# AssureRail AR-22 institutional-product evidence

**Status:** internal code evidence under EX-28; not deployment, customer acceptance or activation
**Date:** 2 September 2026

## 1. Implemented controls

| Control | Internal evidence |
|---|---|
| Fail-closed feature | API and web flags accept `off` or `shadow`, default off and are validated through examples, compose and the web image |
| Dependency gate | API mounts the module only with hosted alpha, participant admission and developer portal in shadow, internal RBAC enabled, and `REPLAY`/`SHADOW` runtime |
| Tenant boundary | Every route requires the path institution to equal the authenticated active institution |
| Authority | Four distinct mandate actions cover federation, service identity, access review and exit planning |
| Step-up | Every mutation consumes a purpose- and institution-bound step-up inside its transaction |
| Maker/checker | The proposer cannot perform the corresponding review; conditional updates reject concurrent review |
| Secret exclusion | APIs accept a credential fingerprint only; responses remove vault and step-up references |
| No silent activation | Identity and service approvals result in `SHADOW_APPROVED`; authentication remains false and generic reinstatement cannot promote shadow access targets |
| No silent authority change | Access-review and exit-plan approvals explicitly record that authority was unchanged and exit was not executed |
| Persistence safety | Additive migration, uniqueness, restrictive parent deletion, schema parity and backup/restore rehearsal |
| Customer journey | `/workspace/institution` shows ten independently evaluated stages and governed proposal/review controls |
| Action centre | Pending access records appear only to members with the relevant new authority |

## 2. Automated evidence

Executed acceptance evidence:

| Check | Result |
|---|---|
| Prisma schema validation and API typecheck | Passed |
| Complete API unit/contract/configuration suite | Passed: 304 tests, 0 failed, 0 skipped |
| AR-22, AR-21 and PR-18 web boundary/regression checks | Passed |
| Production AssureRail web build | Passed; `/workspace/institution` generated |
| Disposable PostgreSQL rehearsal | Passed: all 27 migrations, synthetic records, uniqueness, restrictive history, schema parity and backup/restore |
| Rehearsal script syntax | Passed with `bash -n`; `shellcheck` was unavailable |

The first API-suite run found an overly source-specific assertion for the compiled Prisma error
class; the assertion was corrected and the complete suite then passed. The local PostgreSQL
rehearsal initially lacked sandbox permission for shared memory; the identical rehearsal passed in
the permitted local environment. The production web build required network access for the deck's
existing Google font declarations and passed on the authorised rerun. Failed attempts are not
counted as acceptance evidence.

## 3. Open evidence

- No identity provider or customer has supplied or accepted real SAML/OIDC metadata.
- No federation login is enabled and no service secret has been created, stored, rotated or used.
- No external connector, transaction action, settlement, token, payment or authoritative record is
  changed.
- No customer has accepted the journey, role split, access-review cadence or exit procedure.
- Multi-institution DB/API isolation, accessibility review, VAPT and a real provider outage/exit
  rehearsal remain open.
- `SHADOW_APPROVED` records are internal preparation evidence only; they are not production-ready
  credentials or accepted counterparty connections.

## 4. Classification

Internal implementation may pass after the listed checks. Deployment, authentication activation,
controlled-live use and production acceptance remain separate and open.
