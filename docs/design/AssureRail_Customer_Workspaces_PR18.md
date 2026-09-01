# AssureRail customer workspaces — PR-18

**Status:** implemented under EX-27 for review; not deployed or activated  
**Operating boundary:** replay/shadow presentation over existing institution-scoped APIs

## Outcome

PR-18 introduces an institution home, customer case cockpit and named-opportunity view. The
workspace connects the existing admission, membership, mandate, appointment, route-entitlement,
case, room, evidence, commercial, completion and replay services without creating a parallel
authorization model.

The UI is enabled only when `NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow` is present at web
build time. The API remains the authority. Seeing a card or action never grants the right to read or
change its backing object.

## Customer journeys now represented

- institutional readiness and governance;
- named opportunities, exact term versions, interests, RFQs, negotiation records and allocations;
- DA/PTC case parties and function assignments;
- diligence rooms and their migration state;
- conditions, decisions, approvals and transition timeline;
- case-scoped evidence with source as-of, expiry, result and qualifications;
- source completion and route-specific saga state;
- route break visibility and evidence-bound escalation; and
- evidence vault and export entry points.

The workspace deliberately presents `EXPECTED`, `RECEIVED`, `VERIFIED`, `RECONCILED` and
`LEGALLY_EFFECTIVE` as different states. An unavailable API is shown as unavailable, not as an empty
or passed register. A completed Rail workflow is not displayed as legally effective unless the case
itself records completion; external route authority and reconciliation remain controlling.

## Role and data boundaries

The active user summary uses only that user's active institution membership and mandates. Case and
opportunity payloads are returned by APIs that re-evaluate active institution context and object
scope. Named counterparties receive filtered opportunity detail. Evidence lists are filtered again
to the selected case in the client after the server has enforced ownership/grant and case-party
scope.

The legacy Note console remains available and is labelled `Legacy console`. It is not the default
institution workspace and remains a compatibility surface pending measured retirement.

## Deliberately not implemented in PR-18

- no client-side permission is treated as security enforcement;
- no public or anonymous discovery, order book or automatic matching;
- no transaction, settlement, token, register or external-provider mutation;
- no conversion of missing evidence into a successful state;
- no durable customer service-request system (PR-20 owns it); and
- no public-site, SEO, article or product-claim change.

## Rollback

Build the web app with `NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=off` or unset. The navigation
entry disappears and no API or persisted domain data is changed. Existing institution, case, room
and legacy console routes remain intact.

