# AssureRail AR-26 deployer handoff

**Authority:** EX-28 permits implementation, commit and push. It does not permit deployment or
activation.

## Default posture

Keep `ARAIL_PRIMARY_VENUE_PRODUCT_V1=off` and
`NEXT_PUBLIC_ASSURERAIL_PRIMARY_VENUE_PRODUCT_V1=off`. AR-26 adds the additive
`CommercialCaseHandoff` table; the normal deploy migration script now includes the AssureRail schema.
With flags off, `/workspace/venue` is absent from navigation and case-handoff commands refuse use.

## Later replay/shadow activation

Only under separate authority, use `ASSURERAIL_OPERATING_MODE=REPLAY|SHADOW` and satisfy the complete
runtime dependency chain: participant admission, neutral ingress, transaction cases, internal RBAC,
hosted alpha, institutional product, primary commercial, venue conduct, required saga and at least
one authorised DA/PTC replay product. Then set both AR-26 flags to `shadow`.

Smoke-test two institutions and two independent humans. Verify owner-only creation/term/audience and
allocation review; counterparty-only interest/RFQ/allocation response; wrong-institution 404/403;
step-up, maker/checker and idempotent retry; expiry/revocation races; separate case-party acceptance;
handoff-only term minimisation; zero external instruction/outbox mutation; and retained audit history.

Rollback sets both flags off and rebuilds/restarts through the normal process. Retain all opportunity,
term, grant, interaction, allocation, handoff, case-party and audit records. Do not delete or rewrite
them to make rollback appear clean.
