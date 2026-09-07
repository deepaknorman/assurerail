# AssureRail AR-DEMO-01 deployer handoff

**Instruction:** commit and push only from the implementation session. Do not deploy or change the
current SHADOW API profile unless the founder separately directs the deployer.

## Safe first deployment

AR-DEMO-01 has no database migration and makes no API capability change. Deploy the web with the
showcase dark:

```dotenv
NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=off
ASSURERAIL_DEMO_SHOWCASE_ENABLED=no
```

Leave the following unchanged:

- `ASSURERAIL_OPERATING_MODE`;
- every `ARAIL_*` API capability flag;
- Firebase, database, AssureLens trust-key and provider configuration; and
- the existing public/private UI and investor-diligence gates.

Verify `/`, `/login`, `/healthz` and `/readyz`. Confirm unauthenticated `/sandbox` is `404`. The
authentication-provider correction in this tranche makes a build without Firebase safe for public
and synthetic rendering; it does not allow any login action without Firebase.

## Private showcase enablement

Only for an approved named meeting window:

1. generate a unique showcase username and random password of at least 16 characters;
2. store/inject them through the approved Azure Key Vault path;
3. set `NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=shadow` in the web build environment;
4. set the three server-only showcase values below;
5. rebuild/restart the web only; and
6. do not restart or reconfigure the API merely to enable the showcase.

```dotenv
ASSURERAIL_DEMO_SHOWCASE_ENABLED=yes
ASSURERAIL_DEMO_SHOWCASE_USERNAME=<named-presenter>
ASSURERAIL_DEMO_SHOWCASE_PASSWORD=<Key-Vault-reference-at-deploy-time>
```

Never place the password in a Docker build argument, `NEXT_PUBLIC_*`, Git, a screenshot or a
deployment log. Do not reuse a Firebase, administrator, investor-diligence or provider credential.

## Required smoke

1. `GET /sandbox` without a credential returns `401` and the `AssureRail demonstration` challenge.
2. A wrong credential returns `401`.
3. The exact credential returns `200`.
4. The response carries `Cache-Control: no-store, private` and
   `X-Robots-Tag: noindex, nofollow, noarchive`.
5. The page shows `SYNTHETIC · NON-EVIDENCE`, ten stages, five personas and zero external effects.
6. Switching to PTC and trustee shows the trustee/register boundary.
7. Downloaded JSON states `SYNTHETIC_NON_EVIDENCE`, `externalEffects: false` and
   `canSatisfyExternalGate: false`.
8. The DA/PTC control lab advances and resets.
9. API audit/outbox/external-instruction counts do not change while the showcase is used.
10. Run `scripts/assurerail-demo-preflight.sh --remote` with the dedicated operator environment.

## Authenticated SHADOW rehearsal

The showcase does not seed or bypass the actual workspace. The real AssureLens handshake remains a
separate rehearsal: admission, connector registration, independent evidence-profile approval, case
party acceptance and signed package submission. The result must remain `REVIEW_REQUIRED` and must
create no decision, transition, restriction or external instruction.

Do not enable the remaining workspace/product flags wholesale for visual completeness. Enable each
only with the dependency profile and scenario data documented in its existing PR/AR handoff.

## Disable

Set the server gate to `no` immediately after the approved window, rotate/destroy the showcase
credential, then rebuild with `NEXT_PUBLIC_ASSURERAIL_SANDBOX_V1=off` if the route should again be
absent. Disabling the showcase must not alter or delete any Rail, customer or provider record.

## External gates

This deployment proves presentation behaviour only. Historic DA/PTC replay, counsel, customer,
trustee, recordkeeper, Azure, two-tenant E2E/DAST, VAPT, DR, pilot and production gates remain open
until their accountable owners provide genuine evidence.
