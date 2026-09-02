# AssureRail AR-25 deployer handoff

**Authority:** EX-28 permits implementation, commit and push. It does not permit deployment or
activation.

## Default posture

Keep `ARAIL_LIFECYCLE_PRODUCT_V1=off` and
`NEXT_PUBLIC_ASSURERAIL_LIFECYCLE_PRODUCT_V1=off`. Run the standard venue migration command before
an API restart; AR-25 adds four additive tables. With flags off, the API is not mounted and the web
link is absent.

## Later shadow activation

Only under separate authority, use a `REPLAY` or `SHADOW` runtime and satisfy the AR-22 plus selected
AR-23/24 flag chain, including participant admission, neutral ingress, transaction cases, required
external-action saga, hosted alpha and institutional product. Then set both lifecycle flags to
`shadow`. Never enable it to compensate for an unreconciled completion or open break.

Smoke-test non-party 404, missing-mandate 403, exact assignment enforcement, step-up/idempotent
retry, evidence-digest mismatch rejection, ordered observations, mismatch break, append-only
correction, different-human reconciliation and the absence of any external instruction/outbox row.

Rollback sets both flags off and rebuilds/restarts through the normal process. Retain all plans,
events and breaks; never delete or rewrite an external fact.
