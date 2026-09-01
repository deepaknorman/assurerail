# AssureRail PR-12 activation and deployer handoff

**Audience:** authorised AssureRail deployer, SRE, security, operations and release approvers.
**Current instruction:** commit and push only; do not deploy this PR from the implementation
session. The other coder owns deployment.

## 1. Environment matrix

| Environment | `ASSURERAIL_OPERATING_MODE` | Internal RBAC | External mutation | Activation manifest |
|---|---|---|---|---|
| Local/demo | `DEMO` | `off` or `shadow` | Demo adapters only | Forbidden/not used |
| Historical replay | `REPLAY` | `shadow` | Prohibited | Not used |
| Customer comparison | `SHADOW` | `shadow`, then rehearsed `enforce` | Prohibited | Not used |
| Provider sandbox | `SANDBOX` | `enforce` before shared use | Test-provider only | Later sandbox profile, never live evidence |
| Controlled pilot | `CONTROLLED_LIVE` | `enforce` | Exact signed capability/cohort only | Mandatory |
| Production | `PRODUCTION` | `enforce` | Exact signed capability/cohort only | Mandatory plus production-only gates |

The existing box should remain explicitly `ASSURERAIL_OPERATING_MODE=DEMO` until the deployer is
given a reviewed shadow or controlled-live release record. Deployment of code is not activation.

## 2. New live-only environment variables

```dotenv
ASSURERAIL_ENVIRONMENT=<stable-environment-id>
ASSURERAIL_BUILD_COMMIT=<exact-40-character-deployed-git-commit>
ARAIL_INTERNAL_RBAC_V1=enforce
ARAIL_ACTIVATION_MANIFEST_B64=<base64-canonical-manifest-json>
ARAIL_ACTIVATION_SIGNATURE_B64=<base64-ed25519-signature>
ARAIL_ACTIVATION_PUBLIC_KEY_B64=<base64-der-spki-public-key>
```

Existing live requirements remain in force: persistent Postgres, Firebase Admin, live/certified
adapters, HTTPS provider endpoints, enforced reCAPTCHA, durable relay and Vault AppRole. Never store
the activation private key, Vault secret ID, provider secret or Firebase private key in Git.

## 3. Deployment sequence

1. Confirm branch commit and compare it with the approved build commit.
2. Take and verify a pre-migration backup.
3. Run `prisma migrate deploy`; never use `migrate dev` on a shared environment.
4. Keep the current operating mode and route flags unchanged for the first code deployment.
5. Run API build/unit checks and a startup probe in the unchanged mode.
6. Populate internal assignments in `shadow`; independently review them.
7. Rehearse `enforce` in a non-live environment. It must reject incomplete staff coverage.
8. Enter real readiness evidence and obtain independent gate decisions.
9. Create the canonical manifest, sign it offline and register it as a draft.
10. A different authorised person reviews the activation and its still-current gate bindings.
11. Install the exact approved manifest/signature/public key/build variables.
12. Start one controlled instance and verify startup, durable activation and route capability.
13. Run route-specific external smoke and reconciliation tests.
14. Add only the approved cohort; watch breaks, audit, outbox and provider health.
15. Expand only through a newly signed manifest and fresh release decision.

## 4. Pre-activation evidence checklist

- [ ] No unresolved critical finding.
- [ ] Every high finding has owner, treatment, due date and acceptance authority.
- [ ] Independent security report and remediation evidence received.
- [ ] Backup/restore reconciled to retained and external-authority evidence.
- [ ] Failover, BCP/DR and RTO/RPO rehearsed.
- [ ] Incident, cyber, provider outage and out-of-hours escalation rehearsed.
- [ ] Participant/trustee exported and independently verified its evidence.
- [ ] Exact route/function/performer permission accepted.
- [ ] Exact connector/profile/version certified, including ambiguous-success recovery.
- [ ] Operating parties accepted the SOP, roles and safe-pause path.
- [ ] Five distinct release approvers recorded.
- [ ] Manifest build, environment, cohort and expiry are exact.
- [ ] Production only: controlled pilot, capacity/coverage and customer exit accepted.

Unchecked external items remain open. Do not replace them with the PR-12 synthetic database
rehearsal; that rehearsal proves only persistence and restore mechanics.

## 5. Smoke checks

- Process refuses missing, altered, expired or wrongly signed manifest.
- Process refuses manifest/build/environment/mode mismatch.
- Process refuses incomplete or concentrated internal staff coverage.
- Legacy admin/superadmin bypass routes refuse under enforcement.
- Durable activation exists, is `APPROVED`, unexpired and matches the manifest digest.
- Every bound readiness decision remains accepted, current and unexpired.
- A command outside the manifest capability/cohort is refused before connector invocation.
- Readiness and audit logs contain no secret material or borrower PII.

## 6. Safe pause and rollback

For a pre-external-action failure, stop new commands and revert the application deployment if the
previous schema-compatible version is still approved. Additive PR-12 rows remain retained.

For a post-external-action failure:

1. revoke or expire the deployment activation;
2. stop new affected capabilities/cohorts;
3. preserve instructions, acknowledgements, audit and provider receipts;
4. reconcile exact external state;
5. follow the route compensation/manual-repair process; and
6. issue a new signed activation only after independent closure.

Never perform a database rollback to pretend confirmed cash, ownership, register or token effects
did not occur.

## 7. Current deployment instruction

Do not change the current box from `DEMO` as part of merely deploying PR-12. The first intended
effect is additional fail-closed code and additive tables. Runtime mode and feature activation are
separate, later release decisions.
