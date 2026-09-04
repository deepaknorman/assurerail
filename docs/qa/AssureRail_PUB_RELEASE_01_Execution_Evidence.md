# AssureRail PUB-RELEASE-01 execution evidence

**Executed:** 4 September 2026

**Result:** content candidate passes local automated and browser checks; public-only artifact/host
separation, founder approval, Lighthouse, actual Edge and post-deployment evidence remain open

**Deployment:** not performed

## 1. Finding and correction

The first browser run found that anonymous `GET /internal` returned HTTP 200 and relied on a
client-side Firebase redirect. The Rail API still required authentication, but the operational page
shell and wording were rendered to an unauthenticated browser.

The correction adds a server-only, fail-closed `ASSURERAIL_PRIVATE_UI_ENABLED` mount gate for:

```text
/activity  /admin  /cases  /console  /institutions
/internal  /onboard  /settings  /workspace
```

Public-only configuration keeps it `no`, returning private/no-store/no-index 404 responses before
the page renders. A protected application environment may set it to `yes`; that only mounts the
shell and does not replace Firebase/session/API authorization.

The optimized combined application build still emits hashed client chunks for private pages. The
review found internal workflow labels and endpoint paths in two such chunks; it found no secret or
customer data. Route 404s do not make those downloadable assets confidential. Therefore the static
pages must be published from a public-only artifact/host that does not serve operational route
chunks; the combined Rail application build is not approved as the anonymous-site artifact.

## 2. Automated results

| Check | Result |
|---|---|
| AssureRail optimized production build | 40 routes generated; TypeScript/build passed |
| public-source exposure | 11 anonymous source files; passed |
| built client diligence exposure | 77 client assets; protected diligence markers absent |
| PUB-00 claims boundary | passed |
| public growth/routes/personas/resources/structured-data source checks | passed |
| content freshness and seven stakeholder milestones | passed |
| INBOUND-01 fixed-field contract | 4 passed, 0 failed |
| private operational UI classification/default | 3 passed, 0 failed |
| AssureLocker GTM destination projection | 3 passed, 0 failed |
| Azure SEC-01 target baseline | passed; target only, not deployment evidence |
| Azure inventory capture script | shell syntax passed |

## 3. Browser result

The exact optimized build ran on loopback with inbound, diligence and private UI disabled. The new
browser gate covered:

- 13 anonymous pages;
- desktop 1440×1000 and mobile 375×812;
- installed Google Chrome, bundled Chromium and Playwright WebKit;
- 14 discovered internal links;
- HTTP status, one non-empty H1, language/title/canonical URL;
- JSON-LD parse and Schema.org context/type;
- duplicate IDs, link/button names, form labels and image alternatives;
- horizontal overflow and protected/internal text markers; and
- 404 for `/diligence`, `/sandbox`, every private operational root listed in section 1 and
  representative nested admin/internal/workspace paths, plus 503 for disabled inbound.

Final rerun: **PASS — 13 pages, three browser engines, two viewports and 14 internal links**.

## 4. Still open

- founder claims and visual approval using
  `docs/qa/AssureRail_PUB_RELEASE_01_Founder_Review_Pack.md`;
- public-only artifact/host separation, with a negative scan proving no operational client chunk is
  served by the anonymous domain;
- privacy/consent review for the disabled inbound form;
- Lighthouse accessibility/SEO scoring and accepted warning register;
- actual Microsoft Edge testing (Edge is not installed on the current workstation);
- authenticated operational UI edge/BFF or separate-host enforcement before any private-UI mount
  is reachable from the Internet; the mount flag is only a release boundary, not authentication;
- deployed domain, TLS, header, redirect, robots, sitemap and external-link checks;
- deployment manifest, rollback owner and post-deployment smoke; and
- INBOUND-01, SEC-01, replay and any product activation.

No static page has been published and no environment or capability flag has been changed by this
execution.
