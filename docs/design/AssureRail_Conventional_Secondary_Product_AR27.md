# AssureRail conventional secondary product — AR-27

**Status:** implemented for internal review under EX-28; deployment and activation are not authorised
**Date:** 2 September 2026
**Foundation:** PR-14 conventional secondary records; AR-22 institutional authority; AR-23/24 route products; AR-25 lifecycle; AR-26 primary venue

## 1. Product outcome

AR-27 turns the PR-14 record layer into an institution-scoped customer journey for conventional DA
and conventional PTC secondary transfers. It provides a secondary register and case workspace for:

1. an eligible secondary case, active parties, function assignments and route entitlements;
2. current-holder and prior-transfer-chain evidence;
3. transfer restrictions, consents and notices;
4. seller authority and executed transfer documentation;
5. an exact-value cash-settlement observation;
6. a distinct trustee transaction-control assertion for PTC;
7. seller maker-checker proposal and review;
8. comparison with before/after authoritative-record evidence;
9. an append-only, independently reviewed correction when reconciliation breaks; and
10. comparison CSV and digest-bound evidence-pack export.

This is a productisation slice, not a new execution engine. Its operating boundary remains
`OBSERVE_ONLY` in `REPLAY` or `SHADOW`.

## 2. Route separation and authority

DA and PTC share only neutral evidence/version/reconciliation mechanics. DA requires nine evidence
types and does not inject a trustee. PTC requires the same nine plus a separate
`TRUSTEE_TRANSACTION_CONTROL` fact. The trustee's Rail workflow decision does not replace the
route-defined RTA, depository or register. A trustee/recordkeeper disagreement remains a critical
blocking break.

The seller institution creates, assembles and proposes the dossier. A different authorised seller
human reviews the proposal. The institution assigned as break owner—recordkeeper for DA and trustee
for the current PTC disagreement—proposes a repair, and a different authorised human at that same
institution reviews it. The API rechecks active institution membership, a scoped mandate and route
participation. Page visibility never grants those powers.

Evidence details require `VIEW_EVIDENCE`. A case participant without that mandate may see bounded
workflow metadata but receives no evidence rows, assertion/comparison digests, break digests or
repair evidence identifiers. An evidence object linked to a dossier or repair must be:

- scoped to the case;
- owned by the acting institution or shared through a current active grant;
- `AVAILABLE`, current, unexpired and `VALID`;
- `VERIFIED` with `VERIFIED` signature status;
- attributed to an admitted active provider; and
- digest-equal to the assertion submitted in the command.

## 3. Append-only repair

`SecondaryTransferRepair` is an additive proposal/review record linked to the original break and a
new retained evidence object. Approval appends a new `SecondaryTransferEvidence` version. It never
updates or deletes the earlier evidence. If the new latest authority facts compare successfully, the
break becomes `RESOLVED`, its planned legs become `MATCHED`, and the Rail dossier becomes
`RECONCILED`. These are Rail observation states only; they do not change the external register.

Every repair has a stable idempotency key, request digest, provider, evidence object, assertion
digest, authority reference, maker/checker identities, mandates, purpose-bound step-ups, timestamps
and governed audit events. The advisory transaction lock prevents concurrent repair reviews from
forking state.

## 4. Exports

The comparison CSV exposes ordered evidence legs, assigned performer, evidence type, expected
assertion digest and comparison state. The JSON evidence pack contains route/case metadata, exact
quantity and consideration, retained evidence/version identifiers, ordered legs, breaks and repair
history. It excludes step-up IDs, mandate IDs, idempotency keys, internal request digests and secret
material. The pack has a reproducible canonical content `sha256:` digest, records each snapshot
access in the governed audit chain and explicitly states `legalEffect=NONE_ASSERTED`.

Both exports require case participation, `VIEW_CASE` and `VIEW_EVIDENCE`. They are evidence products,
not transaction confirmations or ownership records.

## 5. Flags and runtime dependencies

- API: `ARAIL_SECONDARY_PRODUCT_V1=off|shadow`, default `off`.
- Web: `NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1=off|shadow`, default `off`.
- The API flag additionally requires institutional product shadow, conventional-secondary shadow,
  the required saga foundation, internal RBAC and at least one DA/PTC product in shadow.
- It is rejected outside a declared `REPLAY` or `SHADOW` runtime.
- PR-14's `ARAIL_CONVENTIONAL_SECONDARY_V1=shadow` remains independently required.

No AR-27 capability ID is added to the controlled-live registry. Deployment with flags off applies
only the additive repair table and serves no AR-27 customer navigation or commands.

## 6. Rejected shortcuts

- no trade, execution, cash movement, title transfer, token action, legal notice or register update;
- no inference of current ownership from a Rail case, token or successful comparison;
- no PTC trustee assertion used as a substitute for the operative record;
- no expected digest copied into a synthetic observation to close an external gate;
- no evidence access through `VIEW_CASE` alone;
- no repair by overwriting an evidence row or erasing the original break;
- no maker approving their own dossier or repair;
- no activation because code, schema, a green deployment or a customer page exists; and
- no claim that internal synthetic rehearsal is participant, trustee, recordkeeper, counsel, VAPT
  or controlled-live evidence.

## 7. Gates still open

The code does not close the counsel-ratified secondary route pack, seller/buyer route acceptance,
trustee/recordkeeper operating acceptance for PTC, authoritative-record integration, partner-executed
acknowledgements, VAPT, controlled-live rehearsal or production acceptance. Each remains owned by its
external accountable party and must be supplied before corresponding activation.
