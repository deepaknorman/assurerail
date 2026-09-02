# AssureRail AR-26 primary venue product

**Status:** implemented for replay/shadow use; external permission and acceptance gates open
**Date:** 2 September 2026

AR-26 turns PR-13's commercial records into a usable, named-audience primary venue journey. An
institution can list permitted opportunities, inspect an opportunity, publish governed terms,
invite or revoke a named institution, exchange interest/RFQ/negotiation records, propose and accept
an allocation, and hand an accepted allocation into the transaction case already associated with
the opportunity.

The handoff does not create a second case and does not complete a transaction. It creates an
immutable receipt and, where absent, a proposed `CaseParty` role. The counterparty must separately
accept that role using the case authority ceremony. The receipt binds the exact opportunity,
allocation, term, named-audience grant, route-eligibility result, institutions and proposed party
role by retained identifiers and canonical digests.

Handoff requires all of the following at both initial validation and transactional recheck:

- an unlocked `DRAFT` or `INTAKE_OPEN` initial-transfer/issuance case;
- a published and currently open opportunity;
- the current, unexpired commercial term;
- a maker/checker-approved and counterparty-accepted, unexpired allocation;
- the same counterparty's active, effective and unexpired named-audience grant;
- active admission and route entitlement for the allocation function;
- the owner's case-scoped mandate and single-use step-up evidence; and
- an idempotency key whose retained request digest matches on retry.

Owner views may see the whole opportunity record. A current named audience sees only its own
grants, interests, RFQs, threads, allocations and handoffs. When its audience grant ends, a
counterparty with a retained handoff sees only the exact handoff-bound term, allocation, grant and
handoff receipt; it cannot see a later term or ongoing commercial conversation.

`ARAIL_PRIMARY_VENUE_PRODUCT_V1` and
`NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1` default to `off` and accept only `off|shadow`.
The API flag depends on the institutional product, PR-13 commercial capability, conduct tooling,
internal RBAC and at least one DA/PTC product. Runtime validation rejects it outside `REPLAY` or
`SHADOW`.

Rejected shortcuts:

- no public discovery or open order book;
- no autonomous matching, execution, payment, title, allotment, register or token action;
- no second transaction case created from an allocation;
- no owner acceptance on behalf of the counterparty;
- no status label used as legal completion; and
- no expired/revoked audience grant converted into continuing access to new deal information.
