# AssureRail public and protected-diligence content governance

**Status:** operating baseline, 3 September 2026
**Owner:** founder or explicitly delegated investor-relations publisher
**Applies to:** anonymous AssureRail pages and the password-protected `/diligence` area

## 1. Two publication registers

Anonymous pages and diligence material are not two copies of the same status page.

| Register | Audience | Permitted content | Prohibited content |
|---|---|---|---|
| Public | Any internet visitor | Proposition, high-level DA/PTC explanation, current external availability and safe contact path | Work-package IDs, build state, architecture locations, security worklists, internal gates, partner/customer evidence without approval |
| Protected diligence | Authorised investors and advisers | Effective-dated implementation status, evidence gaps, stakeholder milestones and selected security/infrastructure facts | Secrets, credentials, borrower/transaction data, customer evidence outside its consent, raw vulnerability detail or legally privileged advice |

Detailed material moves into diligence first. It reaches the public register only after a separate,
recorded promotion decision. Access to diligence is not permission to quote or redistribute it.

The authenticated operational application is a third surface, not part of either publication
register. A public-only release keeps `ASSURERAIL_PRIVATE_UI_ENABLED=no`, so `/activity`, `/admin`,
`/cases`, `/console`, `/institutions`, `/internal`, `/onboard`, `/settings` and `/workspace` return
404 before rendering. Enabling that server-only mount gate does not replace Firebase/session/API
authorization and is reserved for an explicitly protected application deployment profile.

The anonymous domain must also use a public-only artifact or static origin that does not serve the
operational pages' client chunks. A route-level 404 is defence in depth, not confidentiality for
hashed JavaScript assets. The authenticated application belongs on a separately protected host/build
with its own server-side session boundary.

## 2. Milestone-driven update rule

Review the protected register whenever any of these events occurs, even if the scheduled review date
has not arrived:

1. counsel issues or changes a route/function conclusion;
2. an independent security test, remediation or clean retest completes;
3. a participant or trustee authorises a historic replay;
4. a DA or PTC replay result is accepted, qualified or rejected;
5. a live transaction shadow begins or completes;
6. a partner-executed pilot is approved, paused or completed;
7. a product capability or deployment posture materially changes; or
8. a customer withdraws consent to use its name, evidence or result.

For each event, record the evidence owner, effective date, exact affected statement, qualification,
confidentiality class and next review date. An absence of evidence remains `OPEN`; it is never
silently promoted from code, a demonstration or elapsed time.

The responsible relationship owner updates the register within one business day of a material
meeting, written decision or milestone change—even when the outcome is simply that evidence remains
open. Meeting notes are not themselves completion evidence: the register must identify the next
authoritative artefact required. The fortnightly review is a backstop, not the primary update method.

## 3. Promotion ceremony

1. The evidence owner supplies the authoritative artefact or signed outcome.
2. Product/operations maps it to the affected capability and route.
3. Legal, security or customer authority reviews it where applicable.
4. The diligence publisher updates the protected register, version and review window.
5. A separate public-claims decision records whether any smaller external statement is justified.
6. CI freshness and exposure checks pass before release.
7. Deployment evidence records the exact commit and pages published.

The public statement must be narrower than or equal to the underlying evidence. A milestone for one
customer, route, cohort, function or environment cannot upgrade another.

## 4. Review cadence and expiry

- Protected diligence: review at least every 14 days while fundraising, security testing or live
  stakeholder work is active.
- Public availability: review at least every 30 days and on every material milestone.
- Customer names/results: re-confirm permission before every new use and at least quarterly.
- Expired content fails the automated build check; changing the date without reviewing the claims is
  not an acceptable fix.

Current dates and version live in:

- `apps/assurerail/src/lib/public-capability.ts`; and
- `apps/assurerail/src/lib/diligence-content.ts`.

## 5. Access boundary

`/diligence` is disabled by default and returns 404 until explicitly enabled with a server-only
username and a password of at least 16 characters. Credentials are injected from the approved
secret store, never a `NEXT_PUBLIC_*` value or committed file. Responses are private/no-store and
carry no-index/no-archive directives; the route is absent from navigation and sitemap.
The deployment perimeter must enforce TLS, request throttling and password-attempt monitoring; access
logs must never record the `Authorization` header.

The initial password gate is suitable only for controlled, non-transactional evaluation material.
Before the room contains customer-specific evidence, raw security reports, cap-table documents or
other sensitive records, replace shared credentials with named users, MFA, expiry, revocation,
watermarking and access logs—or use an approved investor data-room provider.

## 6. Required checks

```bash
npm --workspace @code/assurerail run check:diligence-access
npm --workspace @code/assurerail run check:private-ui-access
npm --workspace @code/assurerail run check:public-exposure
npm --workspace @code/assurerail run check:content-freshness
npm --workspace @code/assurerail run check:public-growth
npm --workspace @code/assurerail run build
npm --workspace @code/assurerail run check:built-public-exposure
```

These checks verify code boundaries and staleness. They do not substitute for the evidence owner,
confidentiality review, named-access audit or public-claims approval.
