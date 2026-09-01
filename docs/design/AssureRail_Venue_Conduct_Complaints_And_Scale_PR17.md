# AssureRail venue conduct, complaints and scale controls — PR-17

**Status:** implemented for review under EX-27; not deployed
**Operating boundary:** internal, shadow-only control plane
**Dependencies:** PR-13 primary commercial records, OP-01 internal RBAC and PR-12 activation governance

## Outcome

PR-17 adds the internal tools needed to observe and govern commercial interaction before AssureRail
admits a broad customer cohort. It does not convert AssureRail into an exchange, make a regulatory
finding, sanction a participant automatically, or activate any cash, title, register or token action.

The implementation deliberately separates five facts:

1. a source event or communication occurred;
2. a versioned policy evaluated the supplied facts;
3. the deterministic evaluation either observed no configured indicator or requested human review;
4. an authorised person investigated and recorded a conclusion; and
5. a separately authorised maker/checker control action may be proposed and approved.

No earlier fact silently implies a later one.

## Durable records

| Record | Responsibility | Important boundary |
|---|---|---|
| `ConductPolicyRelease` | Effective-dated prohibited-action, fair-access, communications, allocation and SLA rules | Proposed and independently reviewed; old releases are superseded, not rewritten |
| `VenueConductSignal` | Immutable source/evidence/facts/policy/evaluation receipt | Result is only `REVIEW_REQUIRED` or `NO_ALERT` |
| `VenueConductAlert` | Owned, due-dated review queue | Classification defaults to `REVIEW_REQUIRED`; closure needs evidence |
| `VenueConductInvestigation` | Scope, evidence references, assignee, SLA, legal hold and bounded conclusion class | `CONTROL_FAILURE` is an internal control conclusion, not a legal finding |
| `VenueComplaint` | Attributable complaint, evidence, owner, due date and terminal response | Resolution is append/audit based; it does not overwrite source evidence |
| `VenueCorrection` | Before/after digests and correction evidence | Maker/checker; prior bytes remain preserved |
| `VenueControlAction` | Time-bounded safe pause or participant sanction proposal | Separately approved; does not grant participant authority or itself mutate external systems |
| `VenueCapacityBudget` | Versioned route/cohort metric warning and hard thresholds | Canonical integer values; prior budget is superseded |
| `VenueCapacityObservation` | Evidence-bound observation and deterministic state | `HARD_LIMIT` is dashboard evidence, not an ungoverned kill command |

The schema is additive and intentionally avoids importing participant authority into the internal
control plane. Customer action still requires institution membership, mandate, appointment,
entitlement and case authority from the neutral Rail kernel.

## Surveillance policy

The pure evaluator covers:

- declared conflicts;
- related-party declarations;
- fair-access exceptions;
- undocumented or overridden allocations;
- off-channel communications; and
- configured prohibited-action indicators.

Missing or ambiguous facts fail closed to `REVIEW_REQUIRED`. Only an explicit non-indicator fact can
produce `NO_ALERT`, labelled `NO_INDICATOR_OBSERVED`. Every output includes
`autonomousLegalConclusion: false`. The evaluation is bound to the policy digest, facts digest and
source evidence digest so it can be reproduced without silently applying a later policy.

## Complaints and corrections

A complaint carries an idempotency key, request digest, evidence references, owner and due date.
Terminal resolution requires a reason and evidence digest. A correction is not an update to the
original record: it records the target, prior digest, corrected digest and evidence, then requires an
independent reviewer. Any actual change in the target system is a later, separately controlled action.

## Safe pause and sanctions

`SAFE_PAUSE` and `PARTICIPANT_SANCTION` share a bounded control proposal because they require the same
minimum ceremony: scope, severity, reason, evidence, start/expiry, maker and independent checker.
Their scope may be global, environment, route, cohort, institution, case or opportunity. A proposal
cannot last more than 31 days; renewal requires a new record and review.

PR-17 records approved controls for internal operations. It deliberately does not wire them directly
to transaction mutation. Route command enforcement is a later capability-specific integration and
must preserve the PR-12 activation, participant-authority and safe-recovery gates.

## Internal authority

The module is available only to a staff session with no active participant institution context.
Internal permissions distinguish policy proposal/review, signal intake, alert review, investigation,
control proposal/review and capacity management. `MANAGER` can operate queues and propose a control;
`RISK_COMPLIANCE_OFFICER` owns policy review and independent control review. `SUPERADMIN` remains a
governance/break-glass role and receives no implicit case-operation or customer authority.

While OP-01 is `shadow`, legacy bootstrap is restricted to `SUPERADMIN`. With OP-01 `enforce`, each
endpoint uses the effective-dated internal assignment/elevation policy. All material writes consume
one-time step-up evidence scoped to an `INTERNAL_*` purpose.

## Runtime and activation

The new flag is:

```text
ARAIL_VENUE_CONDUCT_V1=off | shadow
```

It defaults to `off`. `shadow` is valid only when:

```text
ASSURERAIL_OPERATING_MODE=REPLAY | SHADOW
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_PRIMARY_COMMERCIAL_V1=shadow
ARAIL_INTERNAL_RBAC_V1=shadow | enforce
```

There is no `on`, `live` or `production` value, no live capability ID and no activation-manifest
entry. Consequently PR-17 cannot be used to assert controlled-live or production readiness. All
route-, trustee-, recordkeeper-, custody-, settlement-, legal- and participant-authorised evidence
gates from prior stages remain open until their accountable external owners close them.

## Deliberately rejected shortcuts

- treating an alert as a breach, misconduct or regulatory conclusion;
- treating `NO_ALERT` as proof of compliance;
- applying the newest policy retrospectively without retaining the evaluated release;
- allowing the signal recorder to close their own alert by implication;
- overwriting the original record when a correction is approved;
- allowing a dashboard threshold to dispatch a cash, title, register or token action;
- unbounded sanctions or safe pauses;
- letting an internal role satisfy a participant mandate or trustee appointment; and
- using synthetic/demo/fixture/example references as control evidence.

## Remaining work and open gates

- connect approved safe-pause/sanction records to each later route command through an independently
  tested enforcement adapter and recovery SOP;
- ingest authorised-channel communications and allocation events from real source connectors;
- approve the first policy release and SLA matrix with accountable risk/compliance and counsel input;
- rehearse complaint, investigation, legal-hold and correction SOPs with named operators; and
- establish route/cohort capacity thresholds from measured pilot load and service obligations.

These are activation prerequisites, not reasons to fabricate passing evidence in this build.
