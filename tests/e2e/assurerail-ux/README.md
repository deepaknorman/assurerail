# AssureRail authenticated UX gate

This suite checks the customer-facing authentication boundary in an explicitly authorised,
synthetic pre-production environment. It accepts the SEC-01 `participantOrgAdminA` account or the
founder-demo `sellerCommercialAdmin` account; no password or session state is stored in the
repository or test output.

Set:

- `ARAIL_UX_AUTHORISED=yes`;
- `ARAIL_UX_WEB_URL` and `ARAIL_UX_API_URL` to bare HTTPS origins;
- `ARAIL_UX_ACCOUNTS_FILE` to an absolute, mode-`0600` account file.

The corresponding `ARAIL_E2E_*` values are accepted as fallbacks so the existing secure SEC-01
account setup can be reused. Local HTTP additionally requires `ARAIL_UX_ALLOW_LOCAL_HTTP=yes`.

Run `npm run ux:e2e:list` to inspect the suite without credentials or network access. Run
`npm run ux:e2e` only against the authorised target. Credential-bearing browser traces, screenshots
and videos are disabled deliberately.

The current foundation covers anonymous redirects, safe authentication errors, sign-in/register
state transitions, keyboard reachability, provisioned sign-in, refresh persistence, accessible
names and labels, duplicate IDs, horizontal overflow and common technical-error leakage on desktop
Chromium, desktop Firefox and mobile WebKit. The seller-readiness spec additionally verifies a real
API quote changes with submitted scope, refresh persistence and separate commercial/data sessions.
It requires the founder-demo `sellerCommercialAdmin` and `sellerDataPreparer` identities and the
assessment workspace to be enabled. Quote preview creates no engagement or payment.

Run `npm run ux:e2e -- --project=ux-firefox-desktop` for the presenter's browser family. Playwright
uses its own Firefox runtime and fresh contexts; it does not touch the presenter's Firefox profile.
Install that runtime with `npx playwright install firefox` if needed.

Automatic failure-prompt ARIA snapshots are disabled with `PLAYWRIGHT_NO_COPY_PROMPT`, because
they can retain password-field values even with screenshots, video and tracing disabled.

The suite does not yet register an account, complete identity onboarding, create/accept an
engagement, pay, upload, run/reassess evidence, release expert preparation or onboard a buyer.
See `docs/demo/assurerail/Hetzner_Demo_Readiness_Plan.md` for the remaining acceptance milestones.
