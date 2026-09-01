# AssureRail PR-18 deployer handoff

PR-18 is committed for deployment by the designated coder. It must not be activated on the current
DEMO box as a transaction capability.

## Safe initial web setting

```text
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=off
```

This is a Next.js public build-time variable. Changing it requires a normal web rebuild/redeploy.
It is a presentation flag, not a permission or production-readiness override.

## Replay/shadow review setting

Only after the API is in its approved replay/shadow profile and PR-03–PR-17 modules required by the
review cohort are available:

```text
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow
```

Verify that an institution member sees only their institution, cases, granted evidence and named
opportunities; suspended membership or removed mandate must continue to fail at the API. Optional
modules returning 403/404 must appear as unavailable and must not be presented as zero findings.

## Rollback

Return the variable to `off` and rebuild/redeploy the web app through the normal release process.
No database rollback is required. Do not alter or delete case, room, evidence or commercial history.
