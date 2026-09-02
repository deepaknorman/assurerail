# AssureRail tokenised-route product — AR-28

**Status:** implemented under EX-28; build and push authority only; no deployment or activation
**Date:** 3 September 2026
**Dependencies:** AR-23 through AR-27, PR-11, PR-15, PR-16 and the PR-12 activation boundary

## 1. Product outcome

AR-28 turns the existing tokenised-DA representation adapter and tokenised-PTC shadow route into
coherent customer journeys. It does not create a new ledger, infer ownership from a token, or merge
DA and PTC policy. Both routes use the common Rail institution, case, evidence, exact-value,
lifecycle and audit controls, but retain separate representation records, stages and external gates.

The product has one institution-scoped register and one route-aware case cockpit:

- **tokenised DA** links the current `Note` projection to a DA/TOKENISED case as `MIRROR`, records
  externally performed actions in observe-only mode, and compares token supply, token holdings,
  economic interests and the declared authoritative record;
- **tokenised PTC** binds programme, trust, class/tranche, trustee, recordkeeper and optional
  assurance-provider facts, then holds five deterministic action plans dormant until all 14 current
  external evidence gates pass independent review; and
- both journeys expose a digest-bound evidence pack and the open legal-finality, custody/connector,
  authoritative-record and controlled-live gates.

## 2. Why no new schema or migration

PR-11, PR-15 and PR-16 already added the durable records required by this slice:
`TokenRepresentation`, connector bindings, actions, acknowledgements, reconciliation snapshots and
breaks for DA; and `PtcTokenRepresentation`, evidence gates and action plans for PTC. AR-28 adds a
read/product orchestration layer and customer UI over those records. Adding a second product-status
table would create duplicate authority and divergence, so this stage deliberately derives its
status from the governed source records.

## 3. API and access boundary

New endpoints:

| Endpoint | Purpose | Authority |
|---|---|---|
| `GET /v1/rail/tokenised-routes` | Visible DA/PTC tokenised-case register with bounded counts | active institution member with `VIEW_CASE`; owner or active case party only |
| `GET /v1/rail/cases/:caseId/tokenised-product` | Route-specific stages, representation summary and external gates | case participant with `VIEW_CASE`; evidence digests redacted without `VIEW_EVIDENCE` |
| `GET /v1/rail/cases/:caseId/tokenised-product/evidence-pack` | Digest-bound JSON pack | explicit case-scoped `VIEW_EVIDENCE` |

All mutations continue through the pre-existing PR-11/15/16 APIs, which re-check institution,
membership, mandate, route entitlement, function assignment, current evidence, step-up and
idempotency. The product UI is not an authority layer.

## 4. DA journey

The DA stages are case/route binding, mirror linkage, connector/custody visibility, observe-only
action recording, four-way reconciliation, lifecycle availability and evidence export.

Important controls retained:

- the linked representation is always `MIRROR`;
- the active authoritative-record declaration belongs to the same case;
- product mode uses `ARAIL_TOKENISED_DA_V1=allow_list`, never `live`;
- a prepared action creates a `SHADOW_RECORDED` instruction with `dispatchProhibited=true`;
- an observation must bind the exact instruction-request and expected-action digests and have a
  current signed evidence object whose digest matches the response;
- `MATCHED` requires supply, holdings, economic interest and authoritative-record equality and no
  unresolved break; and
- lifecycle visibility never turns a mirror event into a legal act.

Connector/custody bindings may be displayed, but their presence does not close provider
certification, custody acceptance, legal finality or PR-12 approval.

## 5. PTC journey

The PTC stages are case/route binding, programme/trust/party definition, 14 external evidence gates,
independent maker-checker review, dormant action plans, trustee/register reconciliation, lifecycle
availability and evidence export.

The trustee controls Rail transaction workflow. The route-defined RTA, depository or register
remains legally operative. `TRUSTEE_RECORD_RECONCILIATION` is therefore a distinct gate; trustee
approval cannot conceal a recordkeeper discrepancy. An assurance provider is named by the case and
may be AssurePlane or another appointed provider. It is not hard-coded or presumed verified.

Even `SHADOW_READY` action plans do not create an `ExternalInstruction`. Issue, transfer,
distribution, lifecycle anchor and burn remain candidate capabilities absent from the live
capability registry.

## 6. Feature and deployment contract

`ARAIL_TOKENISED_PRODUCT_V1=shadow` requires all of the following:

- `ASSURERAIL_OPERATING_MODE=REPLAY|SHADOW`;
- institutional, DA, PTC and lifecycle products in `shadow`;
- tokenised DA in `allow_list` and tokenised PTC in `shadow`;
- the external-action saga in `required`; and
- internal RBAC present.

The API and web examples, compose configuration and web Docker build argument all default the new
flag to `off`. The web flag controls visibility only. No environment supplied in this change is
activated, and no deployment is performed.

## 7. Deliberately rejected shortcuts

- treating the legacy Note as PTC or legal title;
- sharing DA reconciliation semantics as the PTC legal route pack;
- interpreting a connector certification record as current counterparty acceptance;
- calling a PTC action plan issuance, allotment or execution;
- hiding expired PTC evidence behind its historical `VERIFIED` state;
- exposing evidence IDs/digests to a case viewer without `VIEW_EVIDENCE`;
- setting `ARAIL_TOKENISED_DA_V1=live` as part of productisation; or
- implying tokenised secondary DA/PTC trading from an initial-route observation action; and
- using fixtures, demo acknowledgements or synthetic replay to close an external gate.

## 8. Remaining activation evidence

The code gate can prove deterministic stages, access controls, redaction, no-dispatch boundaries,
configuration invariants and build integrity. It cannot prove token legal finality, a real
connector/custody arrangement, external signing authority, an authoritative recordkeeper's
acceptance, historic PTC replay acceptance, VAPT closure or the PR-12 controlled-live/production
manifest. Those remain open until their named accountable parties provide and approve real evidence.
