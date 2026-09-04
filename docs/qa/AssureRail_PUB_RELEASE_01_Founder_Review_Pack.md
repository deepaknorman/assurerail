# AssureRail PUB-RELEASE-01 founder review pack

**Status:** release-candidate checklist; founder approval and deployment remain open

**Prepared:** 4 September 2026

**Release boundary:** anonymous static pages only; inbound form remains off; diligence remains
disabled or separately protected; operational UI is unmounted; no transaction/product capability
flag changes

## 1. Review sequence

Review the built page—not source text—in this order:

1. `/` — proposition, route distinction, proof ladder and availability;
2. `/routes/direct-assignment` and `/routes/ptc` — route responsibilities and unavailable functions;
3. `/for/originators`, `/for/transferees-investors`, `/for/trustees` — audience-specific value;
4. `/replay` — NDA-first, no-file qualification boundary and disabled-form fallback;
5. `/trust` and `/status` — public responsibility and availability statements;
6. `/resources` and the three articles — educational depth; and
7. header/footer/navigation at desktop and 375px mobile widths.

For every page select `APPROVE`, `REVISE` or `REMOVE`. A revision must identify the exact sentence or
visual; approval applies only to this reviewed build.

## 2. Claims requiring explicit founder approval

| Claim family | Current public position | Founder decision |
|---|---|---|
| Product category | Institutional transaction infrastructure for DA and PTC | |
| Establishment | Domestic India first | |
| Current availability | Private institutional evaluation; completed-deal review by arrangement | |
| Live boundary | No public matching, execution, custody, funds handling or settlement currently offered | |
| DA authority | Transferee retains its credit/eligibility/purchase decision | |
| PTC authority | Trustee is final transaction-control authority in Rail; applicable holding/ownership record remains external | |
| Systems | Evaluation does not require immediate replacement of incumbent systems | |
| Tokenisation | Future/separately approved representation only; not a current live claim | |
| Replay | Observe-only diagnostic under agreed NDA/data scope; not certification or legal opinion | |
| Evidence | Gaps and disagreements remain visible; no claim of real customer result yet | |

No anonymous page discloses work-package identifiers, deployment topology, feature flags, security
findings, named prospects, investor economics, company-formation target date or protected diligence.

## 3. Visual and interaction review

- hierarchy and legibility at 1440px, 1024px, 768px and 375px;
- no horizontal scrolling, clipped controls or overlapping navigation;
- visible focus states and complete keyboard navigation;
- headings in logical order; meaningful link names and accessible labels;
- sufficient contrast and no colour-only meaning;
- no false product screenshot, transaction result, customer logo or implied endorsement;
- consistent AssureRail wordmark, colours, typography, spacing and footer boundary; and
- form disabled state shows the safe email fallback without accepting attachments.

## 4. Automated and live release evidence

Before approval candidate handoff:

```bash
npm --workspace @code/assurerail run check:public-exposure
npm --workspace @code/assurerail run check:pub00
npm --workspace @code/assurerail run check:public-growth
npm --workspace @code/assurerail run check:content-freshness
npm --workspace @code/assurerail run check:inbound01
npm --workspace @code/assurerail run check:private-ui-access
npm --workspace @code/assurerail run build
npm --workspace @code/assurerail run check:built-public-exposure
ARAIL_PUBLIC_BASE_URL=http://127.0.0.1:3007 npm --workspace @code/assurerail run check:pub-release-browser
```

Against the exact release candidate, also record:

- internal/external link status and redirects;
- Chrome, Safari and Edge results;
- 375px mobile overflow and touch-target review;
- accessibility/Lighthouse results and accepted warnings;
- parsed JSON-LD type, canonical URL, visible-claim consistency and validator output;
- sitemap/robots absence of `/diligence`, `/sandbox`, internal/admin/workspace routes; and
- anonymous requests to `/diligence` and inbound endpoint while disabled.

## 5. Release controls

Publication requires:

| Control | Owner | Result / evidence |
|---|---|---|
| Founder claims and visual approval | Founder | OPEN |
| Copy/privacy review | Founder / privacy owner | OPEN |
| Automated repository checks | Engineering | rerun for exact candidate |
| Browser/mobile/accessibility/JSON-LD | QA | OPEN |
| Public-only artifact and host boundary | Engineering / security | OPEN |
| Deployment manifest and exact commit | Deployer | OPEN |
| Post-deployment smoke and rollback owner | Deployer / engineering | OPEN |

Publish from a public-only artifact/host that does not serve private application chunks, with
`ASSURERAIL_INBOUND_ENABLED=no` and `ASSURERAIL_PRIVATE_UI_ENABLED=no`. The private-UI
mount gate is not a substitute for Firebase/API authentication; an authenticated application
release is a separate deployment profile. Static publication does not change
`ASSURERAIL_OPERATING_MODE`, route/function flags, sandbox eligibility or diligence access. If a
reviewed statement changes before release, rerun the relevant review and checks rather than carrying
forward the earlier approval.
