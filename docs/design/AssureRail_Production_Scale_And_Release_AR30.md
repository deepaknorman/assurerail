# AssureRail production-scale and release control plane — AR-30

**Status:** implemented under EX-28 for review; fail-closed; no deployment or activation authority

**Date:** 3 September 2026

**Scope:** final first-spine product stage; no bond-domain capability

## 1. Outcome

AR-30 turns existing readiness, security, operations, reconciliation, capacity and signed-activation
records into one internal release view. It does not create another route engine or a substitute for
PR-12. Its purpose is to make an unsafe or incomplete release visible, attributable and difficult
to misstate.

| State                        | Meaning                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `OPEN_EXTERNAL_GATES`        | Required VAPT, counsel, participant, provider, pilot or customer-owned evidence is not current |
| `OPEN_INTERNAL_GATES`        | External gates are current but internal rehearsal/control evidence is not current              |
| `OPERATIONAL_BLOCK`          | Gate codes are present but a current runtime control has a blocking condition                  |
| `AWAITING_SIGNED_ACTIVATION` | Gates and runtime controls are clear, but no exact PR-12 activation exists                     |
| `ACTIVATED`                  | The exact signed activation is current and no runtime blocker is present                       |
| `SAFE_PAUSED`                | An approved activation exists but is stale, mismatched or contradicted by a current blocker    |

State precedence is deliberate: an approved activation does not conceal a later operational break;
open external evidence cannot be hidden behind internal readiness; and a clear dashboard cannot
invent a signature.

## 2. Control inputs

The board reads, without mutating:

- every controlled-live or production readiness gate required by PR-12;
- the latest approved activation for the exact environment and target mode;
- open critical integrity findings and the freshness of the deterministic integrity sweep;
- the operational kill switch, which is always a blocker when engaged;
- settlement, token, lifecycle, secondary-transfer and room-migration reconciliation breaks;
- durable outbox dead letters;
- each active capacity budget's latest observation, including missing/stale observations and hard
  limits;
- absence of any active capacity budget for the target environment;
- overdue critical customer-service requests; and
- internal-RBAC coverage, separation and identity-binding checks.

An integrity sweep or capacity observation older than 24 hours is not current. Missing observations
fail closed. The readiness gate `NO_CRITICAL_OR_UNOWNED_HIGH_FINDINGS` remains the broader signed
evidence for ownership of high findings; the machine board separately counts the schema's current
`CRITICAL` findings and does not pretend that an unmodelled owner field was checked.

## 3. Gate and activation semantics

The gate summary is an operational inventory: for each required code it reports whether at least
one current accepted scoped decision exists. This does not select the route/cohort for activation.

Exact authority remains in the PR-12 activation record. A current activation must satisfy all of
the following:

1. status is `APPROVED` and it has not expired;
2. its build equals the requested exact lowercase 40-character Git commit;
3. the retained manifest digest recomputes exactly;
4. manifest ID, environment, operating mode and build equal their activation record;
5. the manifest and database contain the same number of gate bindings;
6. every bound readiness decision is still accepted, effective, unexpired and tied to the same
   evidence reference/digest; and
7. every manifest gate has the same code, scope, decision reference and evidence digest.

The board does not generate, sign, approve or revoke that activation.

## 4. Immutable assessment and review

An authorised `SYSADMIN` or `MANAGER` can generate a build-bound snapshot using purpose-bound
step-up. The record retains the canonical board payload, control digest, assessment digest,
idempotency/request digests, authority reference and time. Reusing an idempotency key for a
different request fails.

A different `SECURITY_ADMIN` or `RISK_COMPLIANCE_OFFICER` can acknowledge or reject the snapshot.
Acknowledgement fails if it is more than 24 hours old or the recomputed control digest has changed.
The review has its own authority reference, step-up evidence, reason and digest. `SUPERADMIN` may
view release state but deliberately receives neither assessment nor review permission; its signed
activation responsibility is separate.

The evidence-pack export is deterministic for a retained assessment. It binds the immutable
assessment and review record while stating the non-authority boundary.

## 5. API and UI

All routes are internal-only under `/v1/rail/internal/production-scale`:

- `GET /catalogue/v1`
- `GET /board`
- `GET /assessments`
- `POST /assessments`
- `POST /assessments/:assessmentId/review`
- `GET /assessments/:assessmentId/evidence-pack`

They reject an active participant-institution context. The UI is available at
`/internal/production-scale`, separates readiness gates, operational blockers, activation and
assessment history, and requires explicit TOTP-based step-up for mutations.

## 6. Rejected shortcuts

- A green board is not a signed activation.
- Assessment acknowledgement is not release approval.
- A synthetic fixture cannot close an external gate.
- Presence of one gate code is not permission for every route or cohort.
- Missing sweep, capacity or provider evidence is not healthy.
- Deployment does not change operating mode or capability authority.
- AR-30 does not add a live capability or external dispatch path.
- Trustee covenant monitoring and tokenised-bond assurance are excluded; they remain counsel and
  discovery gated under a separate future authority.

## 7. Remaining real-world work

Accountable humans and institutions must still perform VAPT, route/counsel review,
participant/trustee/provider acceptance, authoritative-record confirmation, failover/DR, controlled
historic replay, shadow comparison, partner-executed pilot, capacity/coverage acceptance and
customer exit rehearsal. Until then, the corresponding gates stay open and the product remains
replay/shadow or safely dark.
