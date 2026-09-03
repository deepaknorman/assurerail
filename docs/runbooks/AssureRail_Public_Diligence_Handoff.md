# AssureRail public-minimisation and diligence-zone handoff

**Status:** deployer handoff, 3 September 2026
**Scope:** `PUB-01A`; AssureRail web only
**Deployment performed by this change:** no

## Intended outcome

- Anonymous pages contain only the proposition, high-level institutional boundaries, current
  external availability and a safe enquiry path.
- Detailed implementation, readiness, security and stakeholder-gate material is available only at
  `/diligence` after server-side authentication.
- `/diligence` is absent from navigation and sitemap, is no-index/no-archive, and is never present in
  browser-delivered static bundles.
- The zone remains 404-disabled until all three server-only settings are valid.

## Environment settings

```text
ASSURERAIL_DILIGENCE_ENABLED=no
ASSURERAIL_DILIGENCE_USERNAME=
ASSURERAIL_DILIGENCE_PASSWORD=
```

For a controlled investor review, inject the username and a randomly generated password of at least
16 characters from the approved secret store, set the switch to `yes`, and restart only the web
service. Do not use `NEXT_PUBLIC_*`, commit credentials, pass them in a URL, or log the
`Authorization` header. The application perimeter must enforce HTTPS, throttling and failed-attempt
monitoring.

## Required smoke matrix

| Condition | Expected result |
|---|---|
| zone disabled | `/diligence` returns 404, private/no-store, no-index/no-archive |
| enabled but username/password absent or weak | 404 |
| enabled, no credentials | 401 with Basic challenge |
| enabled, wrong credentials | 401 |
| enabled, exact credentials | 200, private/no-store, no-index/no-archive |
| anonymous home/status/trust/route/resource pages | 200 with no work-package IDs, infrastructure locations or security worklist |
| sitemap | contains neither `/diligence` nor `/sandbox` |

## Content operation

The protected milestone register must be reviewed within one business day of a material stakeholder
meeting or evidence change and at least every 14 days while engagement is active. Public availability
is reviewed separately at least every 30 days. Follow
`docs/gtm/AssureRail_Public_And_Diligence_Content_Governance.md`; do not promote a protected statement
merely because the detailed register changed.

This shared-password gate is an interim control for non-transactional evaluation material. Before
adding customer evidence, raw security reports, cap-table documents or other sensitive records, move
to named users with MFA, expiry, revocation, watermarking and access logs, or an approved data room.
