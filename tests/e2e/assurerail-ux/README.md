# AssureRail authenticated UX gate

This suite checks the customer-facing authentication boundary in an explicitly authorised,
synthetic pre-production environment. It reuses the SEC-01 private account-file schema and requires
`participantOrgAdminA`; no password or session state is stored in the repository or test output.

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
Chromium and mobile WebKit. It does not yet register a new account, complete identity onboarding,
or exercise seller assessment, payment, uploads, reassessment or buyer onboarding.
