# AssureRail tokenised PTC shadow route — PR-16 as built

**Status:** implemented for review; off by default; not deployed; no external dispatch

**Authority:** EX-27, 2 September 2026

## Outcome and boundary

PR-16 is a separate `PTC/TOKENISED` route. It does not rename a legacy `Note`, reuse the DA token
representation, or infer PTC support from the conventional replay. The canonical record remains the
route-defined depository/RTA/register; trustee transaction control remains separately recorded and
cannot mask a recordkeeper disagreement. Token authority is fixed to `MIRROR`.

`PtcTokenRepresentation` binds programme, trust, class/tranche, trustee, recordkeeper, trustee-
appointed assurance provider, authoritative-record declaration, network and token ID. It owns
explicit evidence gates and deterministic future action plans.

## Fourteen evidence gates

The route separately requires: real participant-authorised historic PTC replay acceptance;
programme/trust; trustee appointment; pool transfer/eligibility; class/tranche documents;
subscription/consideration; trustee transaction control; allotment; assurance appointment;
assurance result; authoritative-record acknowledgement; trustee/recordkeeper reconciliation;
token legal/finality analysis; and token custody/operating acceptance.

Missing evidence creates an `OPEN` gate. Evidence supplied later is added only to that open gate,
must be current, signed, valid, verified, case- and accountable-institution-scoped, and cannot be
labelled synthetic, fixture, demo or example. All gates must still be revalidated at independent
review time. The proposer cannot review their own proposal.

## Action plans and rejected shortcuts

Issue, transfer, distribution, lifecycle-anchor and burn plans carry candidate capability IDs, but
are not `ExternalInstruction`s. They remain blocked while any gate is open and become only
`SHADOW_READY` after independent approval. All candidate IDs remain outside the live registry.

Rejected: treating the 0.5% tokenised-PTC commercial fee as permission; using the DA connector or
Note model; treating trustee approval as the legal register; inventing a historic replay; requiring
AssurePlane/AssureLocker as assurance provider; dispatching token/cash/register actions; or calling
shadow-ready live/production.

## Runtime, rollback and open external work

The flag is `off|shadow`; `shadow` requires replay/shadow runtime, participant/ingress/case shadow,
required saga and PR-10 allow-list. Rollback is flag `off`, retaining evidence and audit history.

External work remains: the named real completed PTC replay; counsel-approved tokenised PTC route;
trustee/RTA/depository acceptance; assurance appointment; custody/finality/connector evidence;
security review; controlled pilot; permissions/licensed performers; and a later PR-12 activation
change. No internal test closes any of these.
