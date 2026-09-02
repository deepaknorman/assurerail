# AssureRail conventional DA product — AR-23

**Status:** implemented for internal review under EX-28; not deployed or activated
**Date:** 2 September 2026
**Operating boundary:** `REPLAY` / `SHADOW`, `OBSERVE_ONLY`

## 1. Outcome

AR-23 makes the PR-09 conventional-DA controls usable as one customer journey. The product follows
a DA case from source intake and invitation-only diligence through the transferee's credit decision,
executed documents, independent case/replay approval, an immutable completion plan, partner-owned
observations, reconciliation, break repair and a reproducible dossier.

It does not add a Rail execution role. Cash, title, notices, source systems and the route-defined
authoritative record remain actions of the assigned participant or external authority. In this
stage Rail records signed final observations, compares them with retained expectations and blocks
divergence. It dispatches none of those acts.

## 2. Customer workflow

The case product exposes ten evidence-derived stages:

1. intake;
2. diligence;
3. transferee credit decision;
4. documentation;
5. case approval;
6. replay authorisation;
7. completion plan;
8. partner execution observations;
9. reconciliation; and
10. dossier.

Unavailable evidence/room authority is shown as `UNAVAILABLE`, not zero, failed or complete. The
credit and document stages pass only from a visible evidence object whose current version is valid,
signed `VERIFIED`, result `VERIFIED` and unexpired. Later stages stay blocked without their prior
durable records. Intake requires a source plus current valid evidence; an open room is still in
progress; case approval also requires active transferor and transferee parties; and a completion
plan with no required legs cannot satisfy execution or reconciliation.

The customer page at `/workspace/cases/:caseId/da` supports:

- maker/checker replay authorisation;
- JSON-assisted construction of the existing strict PR-09 saga command;
- stable client idempotency keys across ambiguous retry;
- evidence-backed observation by the institution assigned to that leg;
- independent reconciliation only after a matched final observation;
- append-only corrected observations through maker/checker break repair; and
- authenticated comparison CSV and evidence-pack downloads.

The general case cockpit links into this journey only for conventional DA and only when its web
flag is shadow.

## 3. Access and disclosure

The product overview first proves active case participation and `VIEW_CASE`. It separately evaluates
`OPERATE_CASE`, `OPERATE_ROUTE`, `VIEW_EVIDENCE` and `VIEW_CASE_ROOM`. Source references appear only
with evidence authority and source ownership. Evidence objects require evidence authority and
ownership or a current institution grant. Non-owner rooms appear only under a current named room
grant.

The aggregate response excludes evidence bytes/storage references, credential/step-up references,
expected/observed payload bodies and repair replacement bodies. Digests, external references and
comparison states are sufficient for the journey; full evidence remains behind its receipt-logged
object access path.

## 4. External gates remain explicit

The overview always reports these separately:

- counsel-ratified route pack;
- transferor/transferee acceptance, separate from Rail's internal replay approval;
- acknowledgements from every assigned performer;
- route-recordkeeper confirmation; and
- PR-12 controlled-live acceptance.

Internal observation/reconciliation cannot close counsel or controlled-live acceptance. A historic
or shadow result cannot become a live legal-effectiveness claim.

## 5. Rejected shortcuts

- Calling a Rail stage, case status or green comparison legal completion.
- Prefilling an observation with its expected body or permitting fixtures to close an external gate.
- Letting the platform perform or simulate cash/title/register/notice acts in the product path.
- Treating a transferee credit decision as Rail's decision.
- Showing source/evidence identifiers merely because a user can view the case.
- Rewriting a mismatched observation; repair must append and be independently reviewed.
- Regenerating idempotency keys during an ambiguous client retry.
- Enabling conventional DA product UI in controlled-live or production from a feature flag alone.

## 6. Remaining gates

One participant-authorised completed historic DA replay is still required as real acceptance
evidence, followed by customer workflow/accessibility validation, VAPT, a live shadow comparison,
counsel-ratified route pack and PR-12 sign-off. These stay open and cannot be replaced with synthetic
data. AR-25 will add post-completion lifecycle; AR-29 will add production-grade external connectors.
