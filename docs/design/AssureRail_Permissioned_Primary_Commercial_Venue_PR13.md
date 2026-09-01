# AssureRail permissioned primary commercial venue — PR-13

**Status:** implemented internal product foundation under EX-27; shadow-only; not deployed.
**Date:** 2 September 2026.
**Dependencies:** PR-03, PR-05, PR-06, PR-07 and PR-12 foundations plus the applicable route pack.

## 1. Outcome

PR-13 provides a governed place for institutions already admitted to Rail to display an opportunity
to named institutions, exchange exact commercial terms, record interest, run a private RFQ and
negotiation, and propose/review/respond to an allocation. It is deliberately a primary-commercial
record layer, not transaction completion and not a claim that AssureRail is legally permitted to
perform every commercial function represented by the data model.

The implementation separates the functions that are often casually collapsed into “marketplace”:

1. term display;
2. named solicitation/invitation;
3. participant interest response;
4. quote invitation/RFQ;
5. bilateral negotiation; and
6. allocation proposal and response.

Each function must be actively assigned in the case and permitted by the institution's effective
route entitlement. A record existing in Rail never establishes legal permission, asset ownership,
cash finality or completion.

## 2. Explicit non-scope and rejected shortcuts

PR-13 does not provide:

- anonymous or public opportunity discovery;
- an order book or priority queue;
- automatic counterparty matching;
- algorithmic allocation;
- public distribution or unsolicited outbound marketing;
- trade execution, document execution or transaction completion;
- payment, depository, RTA, registry, HTS, HCS or webhook dispatch;
- issuance, allotment, transfer, mint, burn or ownership mutation;
- a customer-facing workspace, which belongs to PR-18; or
- a controlled-live or production capability registration.

The following interpretations are rejected:

- `PUBLISHED` means legally distributable to the public;
- `ACCEPTED` allocation means a transaction completed;
- a negotiation message changes the governed term version;
- an RFQ response is an executed trade;
- named audience membership substitutes for participant admission or authority;
- a feature flag substitutes for legal, conduct, participant or operating evidence; or
- synthetic fixtures close an external readiness gate.

## 3. Runtime and activation boundary

`ARAIL_PRIMARY_COMMERCIAL_V1` accepts only `off` and `shadow`.

- Default: `off`.
- `shadow` requires `ARAIL_PARTICIPANT_ADMISSION_V1=shadow`,
  `ARAIL_NEUTRAL_INGRESS_V1=shadow` and `ARAIL_TRANSACTION_CASE_V1=shadow`.
- It is accepted only when `ASSURERAIL_OPERATING_MODE` is `REPLAY` or `SHADOW`.
- It is rejected in `DEMO`, `SANDBOX`, `CONTROLLED_LIVE` and `PRODUCTION`.
- The module is not mounted unless the full foundation and the PR-13 flag are shadow-enabled.
- PR-13 adds no ID to the implemented-live capability registry.

The current box should remain `ASSURERAIL_OPERATING_MODE=DEMO`. Deployment of these additive tables
and off-by-default code must not change that mode or activate PR-13.

## 4. Authority model

Every request derives the human, session and acting institution from authenticated request context.
Request bodies cannot select the actor or acting institution.

An action requires, as applicable:

- an active authenticated Rail session;
- an active institution context bound to that session;
- active institution membership;
- an effective, scoped human mandate for the exact action and case;
- an active case function assignment;
- an effective route entitlement for route, representation, asset class, lifecycle leg, function
  and operating mode;
- a named, current audience grant for counterparty actions; and
- single-use step-up evidence for the governed command.

The owner cannot invite or act as its own counterparty. Non-owners see only opportunities to which
they have a live named grant. Detail responses filter interests, RFQs, threads and allocations to
the requesting institution. Owner-only proposed changes are not disclosed to counterparties.

## 5. Persistence model

| Record | Responsibility |
|---|---|
| `CommercialOpportunity` | Case, owner, named-audience mode, controlled status, validity and aggregate version |
| `CommercialTermVersion` | Immutable exact amount, participation bounds, pricing, validity, evidence reference and digest |
| `CommercialAudienceGrant` | One named institution, purpose, conflict disclosure, effective/expiry and inviter authority |
| `CommercialOpportunityChange` | Maker-checker publication/pause/resume/withdraw/close proposal and decision |
| `CommercialInterestIndication` | Institution-scoped, idempotent non-binding interest against one term version |
| `CommercialRfq` | Institution-scoped exact amount and canonical requested/response terms |
| `CommercialNegotiationThread` | Private owner/counterparty thread tied to an RFQ |
| `CommercialNegotiationMessage` | Append-only attributable message, optional canonical term snapshot and idempotency |
| `CommercialAllocation` | Exact, basis-attributable proposal, internal review and counterparty response |

All relationships use restrictive deletion. Term versions are unique per opportunity and cannot be
overwritten. Interest, RFQ, message, allocation and opportunity creation carry scoped idempotency
keys plus canonical request digests, so key reuse with different content fails.

Amounts are ISO currency plus canonical integer `units` and integer `scale`. Pricing values are
canonical decimal strings with at most 12 fractional digits; JavaScript floats, exponent notation
and ambiguous leading-zero representations are rejected.

## 6. State and two-person controls

Opportunity status is:

```text
DRAFT --PUBLISH--> PUBLISHED --PAUSE--> PAUSED --RESUME--> PUBLISHED
  |                    |                    |
  +--WITHDRAW----------+--------------------+
                       +--CLOSE-------------+
```

Publication and resumption require an immutable current term, at least one active named audience,
and current owner permission for term display, solicitation and quote invitation. These gates are
checked both when the change is proposed and when a different person reviews it. Optimistic
aggregate-version checks prevent stale proposals from applying.

Commercial writes share a per-opportunity PostgreSQL advisory lock. The service rechecks status,
current term, expiry and named-audience authority inside the same transaction before accepting an
interest, RFQ, negotiation message or allocation action, so a concurrent pause, term change or
audience revocation cannot be bypassed by an earlier read.

An allocation must cite an attributable interest, RFQ or negotiation thread. The proposer cannot
approve their own proposal. Approval rechecks opportunity status, term currency/scale/version,
audience validity, allocation authority, expiry and aggregate allocated amount under a PostgreSQL
advisory lock. Offered plus accepted amounts cannot exceed the selected term amount. An accepted
allocation remains a commercial record only; it does not invoke a completion saga.

## 7. API surface

The 16 endpoints under `/v1/rail` cover:

- list and case-scoped detail;
- opportunity creation;
- immutable term creation;
- named audience invitation and revocation;
- opportunity change proposal and independent review;
- interest submission and withdrawal;
- RFQ submission and owner response;
- private negotiation messages; and
- allocation proposal, independent review and offeree response.

There is no endpoint containing match, order-book, execute, settle, issue, mint or burn semantics.

## 8. Open gates

Implementation does not close any of these:

- exact domestic-India legal/perimeter decision for each material function and performer;
- customer-approved invitation, conflict, RFQ, negotiation and allocation operating rules;
- market-conduct, fair-access, surveillance, complaint and correction controls from PR-17;
- participant acceptance and evidence-export verification;
- independent security assessment and accepted remediation;
- capacity, incident, continuity and out-of-hours operating acceptance;
- customer pilot acceptance; or
- controlled-live/production activation under PR-12.

Unavailable evidence remains `OPEN`. No fixture, unit test, database rehearsal or internal sign-off
may be reclassified as external evidence.

## 9. Rollback and safe pause

Before deployment, the flag remains `off`. A deployment can apply the additive migration while
leaving the module unmounted. In shadow, safe pause is `ARAIL_PRIMARY_COMMERCIAL_V1=off` followed by
a normal application restart. Rows remain retained and auditable.

Because PR-13 performs no external mutation, rollback does not need to reverse cash, ownership or
register state. Do not delete commercial history to simulate rollback. If a later stage adds an
external effect, that stage's saga, activation and reconciliation rules supersede this simple
off-switch procedure.
