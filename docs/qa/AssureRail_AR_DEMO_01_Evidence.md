# AssureRail AR-DEMO-01 implementation evidence

**Executed:** 7 September 2026

**Scope:** private full-system synthetic demonstration and presenter rehearsal controls

**Evidence class:** software/build/browser evidence only; no external gate is tested or accepted

## Implemented

- deterministic ten-stage system fixture covering institution/authority, neutral intake, room,
  primary opportunity, conventional DA, conventional PTC, lifecycle/AssureLens, conventional
  secondary, token representation and operations/readiness;
- five role-specific institutional viewpoints;
- visible expected/observed/control consequence and evidence state at every stage;
- synthetic dossier download with explicit non-evidence and no-external-effect fields;
- preserved focused DA/PTC comparison lab;
- independent server-side Basic gate in addition to the build-time sandbox flag;
- `404` when disabled, `401` when uncredentialled, and no-store/noindex headers when enabled;
- local/offline authentication fail-safe so absence of Firebase cannot crash public/synthetic page
  hydration and login actions remain unavailable; and
- source, remote and browser preflight tooling plus Mumbai and deployer runbooks.

## Executed checks

| Check | Result |
|---|---|
| `bash -n scripts/assurerail-demo-preflight.sh` | passed |
| `npm run demo:preflight` | passed; access/data/static boundaries |
| existing `check:cx01-sim01` | passed; original DA/PTC sandbox contract retained |
| production web build with sandbox compiled at `shadow` | passed; TypeScript and 40 routes generated |
| unauthenticated local `/sandbox` | `401` |
| authenticated local `/sandbox` | `200`; full-system and synthetic markers present |
| AR-DEMO-01 browser gate | passed in Chromium and WebKit at 1440×900 and 390×844 |
| interaction checks | ten stages, five personas, trustee/PTC view, dossier download, PTC control lab |
| browser network boundary | no request to an external origin |
| visual inspection | desktop and full-page mobile reviewed; no horizontal page overflow |
| complete `npm run check` | passed; 370/370 API tests, all PR-18/AR-21–30 web boundaries, new demo boundaries and default-off production build |
| access/public exposure checks | passed; private UI, diligence, source/built exposure and PUB-00 claims boundaries |
| gitleaks on all edited source/scripts/docs | passed; no finding in AR-DEMO-01 files |

The first visual run correctly discovered an existing offline-build failure: `AuthProvider` called
Firebase `onAuthStateChanged` while Firebase was deliberately unconfigured. The provider now enters
a signed-out, non-loading state for public/synthetic rendering and refuses login functions with a
clear configuration error. The production web build and browser gate passed after the correction.

## Not tested or claimed

- no customer or historic transaction data;
- no authenticated two-tenant workspace E2E;
- no real institution admission or authority decision;
- no live AssureLens-to-Rail submission in this execution session;
- no payment, title, allotment, register, token or provider call;
- no Azure deployment, restore, failover, DAST or independent VAPT;
- no counsel, trustee, recordkeeper, customer or regulator acceptance; and
- no controlled-live or production activation.

These items remain open gates and must not be inferred from the synthetic fixture or this report.
