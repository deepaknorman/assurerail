# AssureRail conventional PTC product — AR-24

**Status:** implemented for internal review under EX-28; not deployed or activated
**Date:** 2 September 2026
**Operating boundary:** `REPLAY` / `SHADOW`, `OBSERVE_ONLY`

## 1. Outcome

AR-24 makes the PR-10 conventional-PTC replay controls usable as one customer journey. It preserves
the distinct responsibilities of the originator, trustee, subscriber/payment performer, counsel,
rating agency, assurance provider, servicer and route-defined RTA/depository/register. It does not
turn Rail into any of those performers.

The trustee remains final for Rail transaction control. Legal ownership/finality remains with the
recordkeeper declared by the route, even when the trustee refers Rail to a depository or RTA. A
conflict between the trustee decision and external legal record is a blocking reconciliation break,
not a choice Rail resolves itself.

## 2. Customer workflow

The case product exposes fourteen independently derived stages:

1. case foundation;
2. diligence;
3. replay authorisation;
4. programme/trust and trustee appointment;
5. pool transfer and eligibility;
6. counsel, rating and trustee-appointed assurance;
7. executed documents and tranche/class terms;
8. subscription and consideration;
9. trustee transaction control;
10. issue/allotment;
11. authoritative-record acknowledgement;
12. lifecycle and notice setup;
13. reconciliation; and
14. dossier.

Before a saga exists, visible current evidence can show preparation in progress but cannot complete a
transaction stage. Evidence invisible to the current institution is `UNAVAILABLE`, never inferred
to be absent. After the immutable saga is created, each stage follows all applicable required legs;
multiple counsel/rating/assurance legs must all reconcile. Empty required-leg plans cannot complete
reconciliation, and any open break blocks its function and aggregate reconciliation.

The customer page at `/workspace/cases/:caseId/ptc` supports maker/checker replay authorisation,
strict JSON-assisted PR-10 planning, assigned-performer observations, independent reconciliation,
append-only repair, authoritative-record status and authenticated comparison/evidence-pack exports.
Observation bodies begin blank and expected bodies are not disclosed or copied into them.

## 3. Evidence, access and minimisation

The overview requires active case participation and `VIEW_CASE`. `VIEW_EVIDENCE`,
`VIEW_CASE_ROOM`, `OPERATE_CASE` and `OPERATE_ROUTE` are separately evaluated. Source references
require source ownership. Evidence requires ownership or a current institution grant. Non-owner
rooms require a current named room grant.

The aggregate excludes evidence bytes/storage references, credential or step-up references,
expected and observed payload bodies, and repair replacement bodies. It exposes only the minimum
identifiers, digests, external references, comparison states and route-control metadata needed to
operate the journey.

## 4. External gates

AR-24 always exposes these independently:

- counsel-ratified route pack;
- originator/trustee historic replay acceptance;
- trustee transaction-control acceptance;
- route-required rating/assurance provider evidence;
- trustee plus route-recordkeeper confirmation; and
- PR-12 controlled-live acceptance.

An internally reconciled leg is described as internally recorded with external acceptance still
open. If rating/assurance is absent before planning, route determination remains open; if the
retained route plan validly omits it, the product says so without claiming that counsel approved the
omission. AssurePlane remains an optional, provider-neutral assurance adapter.

## 5. Rejected shortcuts

- Calling a `PTC_DATA_ROOM`, Note, token or enum value a PTC venue.
- Treating Rail workflow state or trustee acceptance as the legal ownership register.
- Treating an internal maker/checker decision as originator, trustee or recordkeeper acceptance.
- Requiring AssureLocker, AssurePlane or one named trustee/provider.
- Combining trustee control and RTA/depository acknowledgement into one untraceable event.
- Marking one reconciled review complete when multiple required-review legs exist.
- Showing expected bodies as observation defaults or using fixtures to close an external gate.
- Dispatching cash, issuance, allotment, notice or register changes from this journey.
- Activating PTC pricing, solicitation or secondary trading merely because AR-24 is deployed.

## 6. Remaining gates

The participant/trustee-authorised all-leg historic PTC replay remains open. It needs a named data
owner, completed transaction documents, trustee decision, relevant provider evidence, and the
route-defined recordkeeper acknowledgements. Customer workflow/accessibility validation, VAPT,
counsel ratification, live shadow comparison, provider integration and PR-12 sign-off also remain
open. Synthetic fixtures are software evidence only.
