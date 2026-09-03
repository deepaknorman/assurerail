# AssureRail public growth tranches — implementation evidence

**Date:** 3 September 2026
**Scope:** GTM-01, PUB-01, INBOUND-01, PUB-02 and CONTENT-01
**Deployment/publication:** not performed

## Executed checks

| Check | Result | Meaning |
|---|---|---|
| `check:inbound01` | 4 passed, 0 failed/skipped | Strict qualification contract, honeypot/extra-field/enum/consent/bounds and non-promotion tests |
| `check:public-growth` | Passed | Required routes/content, inbound controls and core public-claim guards present |
| `check:cx00` | Passed | Existing capability register and fail-closed web controls retained |
| `check:pub00` | Passed | Existing corporate/product/route claim corrections retained |
| `check:cx01-sim01` | Passed | Guided journey and synthetic sandbox boundaries retained |
| Repository public-page gate | 0 failed checks | Content, prose-density and changed-image gates passed; 48 report-only warnings were outside this tranche's AssureRail files |
| AssureRail production build | Passed; all public and existing application routes generated | TypeScript and static/dynamic route compilation green on Next.js 16.3.4 |
| Built-page loopback smoke | 11/11 returned HTTP 200 | Home, DA, PTC, trustee, trust, status, resources/article, replay, sitemap and robots rendered |
| INBOUND-01 default-off smoke | HTTP 503 with generic unavailable response | No CRM capture becomes live from code presence |
| INBOUND-01 negative smokes | Wrong origin 403; unexpected field 400; missing destination 503 | Origin, strict schema and fail-closed integration controls exercised locally |
| Desktop visual review | Home, replay, PTC and resources inspected | Compiled CSS, hierarchy, status labels, boundaries and footer rendered as intended |
| Mobile visual review | Replay page inspected at 390 × 844 | Responsive stacking, typography and disabled-intake notice remained readable |

## Open gates

- owner review and deliberate publication of the exact built pages;
- privacy/consent and CRM controller/processor review;
- durable CRM adapter, receiver HMAC/replay handling and field mapping;
- Azure Front Door/WAF, private origin, distributed abuse control and egress enforcement;
- accessibility/browser/structured-data review against the deployed public domain;
- analytics consent and conversion measurement design, if analytics is later added; and
- real replay/shadow evidence before any customer result or case study.

The local smoke used synthetic business-contact values and no external webhook. With inbound
disabled, the replay page displayed a contact-only fallback and instructed users not to attach deal
data. These checks are not Azure, CRM, privacy, VAPT, customer or production evidence.
