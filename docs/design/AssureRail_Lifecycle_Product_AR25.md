# AssureRail route-neutral lifecycle product — AR-25

**Status:** implemented for internal review under EX-28; not deployed or activated
**Date:** 2 September 2026
**Operating boundary:** `REPLAY` / `SHADOW`, `OBSERVE_ONLY`

## Outcome

AR-25 adds an evidence-led lifecycle workspace shared by DA and PTC cases after an observe-only
completion has reconciled. A versioned plan defines ordered collections, servicing reports,
waterfall calculations, distributions, notices, triggers, substitutions, repurchases, defaults and
maturity/redemption obligations. Each obligation names its material function, accountable
institution, performer class, due time, expected canonical fact and—where relevant—exact amount.

An assigned institution may append a signed, verified observation whose digest is bound to a
current case evidence object. Exact comparison either leaves the fact awaiting independent
reconciliation or opens a durable break. A different authorised human must reconcile it. A
corrected observation is a new event version; the original event and break remain in history.

## Authority and perimeter

The lifecycle register is not a servicer, payment system, trustee, notice agent or ownership
register. It creates no `ExternalInstruction`, outbox dispatch or mutation of an external system.
Function assignment and institution/case mandates are both checked. Rail state cannot establish
legal effectiveness.

The API is scoped to `/v1/rail/cases/:caseId/lifecycle`; the web workspace is
`/workspace/cases/:caseId/lifecycle`. Both flags default off and are valid only in replay/shadow.

## Rejected shortcuts

- Reusing token `Note` surveillance as the generic DA/PTC lifecycle.
- Treating an expected value, uploaded file or provider capability as an observed fact.
- Letting Rail perform or self-acknowledge an external lifecycle act.
- Allowing the recorder to reconcile their own observation.
- Correcting a mismatch by overwriting history.
- Starting lifecycle before completion reconciliation or while a completion break is open.
- Calling internally reconciled evidence legally effective or production accepted.

## Open gates

Historic participant-authorised lifecycle data, route/counsel approval, assigned-performer
acceptance, trustee/RTA/depository evidence where applicable, payment/account confirmation, VAPT,
live shadow comparison and PR-12 controlled-live approval remain external and open.
