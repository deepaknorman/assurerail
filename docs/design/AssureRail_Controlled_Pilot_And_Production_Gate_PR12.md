# AssureRail controlled-pilot and production gate — PR-12

**Status:** implemented internal control foundation under EX-27; no deployment or production
acceptance.
**Date:** 2 September 2026
**Scope:** AssureRail only.
**Controlling baseline:** `AssureRail_Code_Capability_Baseline_And_Implementation_Register.md`.

## 1. Outcome

PR-12 separates five facts that were previously easy to conflate:

1. code exists;
2. a feature flag names a mode;
3. an internal test passed;
4. accountable external parties accepted evidence; and
5. an exact build/environment/cohort is authorised to perform an exact function.

Only the fifth fact may open a controlled-live or production capability. The implementation is
fail-closed and additive: existing DEMO, REPLAY and SHADOW operation remains available; no route is
made live by this PR.

The build also owns an explicit implemented-live capability registry. PR-12 initializes it empty.
A signed manifest narrows capabilities already implemented in the exact build; it cannot create a
capability merely by naming one. Later PRs add an ID only with a case-scoped command that invokes
the durable activation guard before any external mutation.

## 2. Activation chain

```text
versioned requirement
  → evidence submission
  → independent gate decision
  → signed activation manifest proposal
  → durable gate/decision snapshot
  → independent release approval
  → deployer installs exact manifest + signature + build
  → startup verifies signature and environment/build binding
  → startup verifies RBAC coverage and durable activation
  → each live command verifies its exact capability allow-list entry
```

Revocation or expiry of the activation or any bound gate blocks subsequent governed commands. It
does not reverse a legally effective external action; the relevant route safe-pause/repair/exit SOP
applies.

## 3. Required controlled-live gates

| Gate | Evidence class | Meaning |
|---|---|---|
| `NO_CRITICAL_OR_UNOWNED_HIGH_FINDINGS` | Internal | No unresolved critical and no high finding without owner/treatment |
| `INDEPENDENT_SECURITY_REVIEW` | External | Independent security assessment and accepted remediation state |
| `BACKUP_RESTORE_RECONCILIATION` | Internal | Restored state compared with retained and external authority evidence |
| `FAILOVER_BCP_DR_REHEARSAL` | Internal | RTO/RPO, failover and degraded operation exercised |
| `INCIDENT_AND_ESCALATION_REHEARSAL` | Internal | Named coverage, communications and out-of-hours escalation rehearsed |
| `PARTICIPANT_EVIDENCE_EXPORT` | External | Participant/trustee independently validated exported evidence |
| `ROUTE_LEGAL_PERMISSION` | External | Exact function/route/performer permission accepted by accountable authority |
| `CONNECTOR_CERTIFICATION` | External | Exact connector/profile/version and recovery behaviour certified |
| `OPERATING_ACCEPTANCE` | External | Customer/trustee/route operators accepted the controlled operating model |

Production adds:

- `CONTROLLED_PILOT_ACCEPTANCE`;
- `CAPACITY_AND_COVERAGE_ACCEPTANCE`; and
- `CUSTOMER_EXIT_REHEARSAL`.

An external gate cannot be accepted with evidence marked internal. References containing obvious
synthetic/demo/fixture markers are rejected. This string defence is supplemental: independent
review, immutable evidence digest, exact decision binding and offline release signing are the real
controls.

## 4. Signed activation manifest

The manifest is strict canonical JSON and includes:

- schema version and unique manifest ID;
- environment, operating mode and exact 40-character Git commit;
- issue and expiry times, with a maximum 31-day validity;
- explicit route, representation, lifecycle leg, function, performer and customer cohort;
- every required gate's scope, evidence class/reference/digest, decision ID and validity;
- engineering, security, operations, product/risk and legal/regulatory approvals; and
- a distinct accountable person for every approval role.

The release authority signs canonical bytes with Ed25519. Runtime accepts only the separately
configured public key. The private key is never stored in application configuration or Git.

## 5. Durable records

- `OperationalReadinessGate`: versioned requirement and current state.
- `OperationalReadinessDecision`: immutable independent accept/reject decision and evidence.
- `DeploymentActivation`: signed manifest proposal, independent approval, expiry and revocation.
- `DeploymentActivationGate`: exact accepted gate/decision/digest snapshot.

All historical foreign keys use `RESTRICT`. No acceptance record is deleted or rewritten to make a
later release appear valid.

## 6. Internal operational separation

`ARAIL_INTERNAL_RBAC_V1=enforce`:

- disables legacy `ADMIN`/`SUPERADMIN` route bypasses;
- requires new internal-permission checks for readiness and access governance;
- requires active, time-bounded, identity-bound GLOBAL assignments for governance, system,
  security, organisation, management, reconciliation, risk and audit roles;
- requires two independent SUPERADMIN holders;
- prohibits SYSADMIN and SECURITY_ADMIN concentration; and
- requires at least six distinct critical-control holders.

Internal employment remains incapable of satisfying participant, trustee, recordkeeper or case
authority.

## 7. Deliberately rejected shortcuts

- `PRODUCTION=true` or presence of live credentials as production evidence;
- one unrestricted global launch switch;
- indefinite activation manifests;
- one person approving multiple control roles;
- accepting a screenshot/email without digest, scope, decision and expiry;
- synthetic VAPT, customer, trustee, counsel or connector evidence;
- database-only activation without a build-bound offline signature;
- environment-only activation without the durable approved record;
- silently continuing after a bound gate expires or changes; and
- using an old direct-adapter Note endpoint as an alternative live execution path; and
- treating rollback as reversal of confirmed cash, register or token state.

## 8. External gates still open

No external PR-12 gate is claimed complete by this implementation. Specifically open are the
independent security review, real participant/trustee export validation, real route/legal
permission, real connector certification, operating rehearsal, controlled pilot, capacity/coverage
and customer exit evidence. They will be entered only when received and independently reviewed.

The legacy mint, DvP, amortisation, closure, surveillance-anchor and break-glass-anchor paths remain
available below live mode for demonstrations and comparison. Each rejects `CONTROLLED_LIVE` and
`PRODUCTION` before loading a transaction or calling an adapter. Later live functions must use the
case-scoped saga and activation guard; a manifest is not a waiver of that architecture.

## 9. Relationship to later PRs

PR-13 onward adds capability IDs and live command paths one function at a time. A later PR must:

1. implement the route/function and its fault/recovery tests;
2. call `OperationalActivationGuardService.requireCapability()` before external mutation;
3. document the exact capability ID and performer;
4. supply deployer environment values; and
5. leave the capability absent from the signed manifest until its external gates close.
