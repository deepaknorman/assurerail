# AssureRail GTM-01, PUB-01, INBOUND-01, PUB-02 and CONTENT-01

**Status:** implementation record, updated 4 September 2026
**Authority:** founder instruction to proceed with the named tranches
**Deployment:** not performed by this tranche

## Delivered boundary

| Tranche | Repository outcome | Deliberate limit |
|---|---|---|
| GTM-01 | Current customer deck and objection playbook plus discovery, proposal, proof-scorecard and security/integration templates | No fabricated result, customer logo, testimonial or live claim |
| PUB-01 | Public status, trust and completed-deal replay foundation with reusable site navigation/footer | Code-ready is not published, customer-accepted or live |
| INBOUND-01 | Minimal fixed-field enquiry form and signed provider-neutral webhook; destination mapping to the existing Control Tower, Brevo and Agile CRM arrangement | Disabled by default; no files, free text, borrower or transaction data; Azure HMAC/durable-receipt bridge and operating evidence remain open |
| PUB-02 | Detailed DA/PTC and originator, transferee/investor and trustee pages | Educational route/persona depth only; capability state remains replay/shadow preparation |
| CONTENT-01 | Three effective-dated field notes, resource index, sitemap, robots policy and Organization/Service/Article JSON-LD | No legal opinion, regulatory conclusion, SEO-performance or inbound-volume claim |

## Publication gates

Before the public build is released, the owner must review the exact built pages, public capability
register date, privacy/consent wording, canonical domain, robots/sitemap response, structured data and
all links. Enquiry capture remains off until the INBOUND-01 environment, CRM, privacy, WAF, egress and
operating evidence is accepted.

PUB-02 does not populate customer-result sections because no participant-authorised replay or shadow
evidence exists. When real evidence matures, add only the exact route, date, owner-approved metric and
qualification. Never promote a result from a synthetic sandbox.

### PUB-01A correction — public minimisation and protected diligence

Founder preview review found that the first publication candidate exposed too much implementation,
security and readiness detail. Anonymous pages are therefore reduced to proposition, high-level
route/responsibility language, current external availability and replay contact. Work-package IDs,
infrastructure locations, security worklists and detailed open gates move to `/diligence`, which is
server-gated, disabled by default, no-store and excluded from indexing/navigation.

Public and diligence sources now carry separate review windows. Stakeholder milestones update the
protected register first; public promotion requires a separate claims decision. Governance:
`docs/gtm/AssureRail_Public_And_Diligence_Content_Governance.md`.

## Verification

```bash
npm --workspace @code/assurerail run check:inbound01
npm --workspace @code/assurerail run check:public-growth
npm --workspace @code/assurerail run check:cx00
npm --workspace @code/assurerail run check:pub00
npm --workspace @code/assurerail run check:cx01-sim01
npm --workspace @code/assurerail run build
```

The checks establish repository and build consistency only. They do not close publication, secure CRM delivery,
privacy, customer, counsel, VAPT, Azure or production activation gates.

Executed results are recorded in `docs/qa/AssureRail_Public_Growth_Tranches_Evidence.md`.
