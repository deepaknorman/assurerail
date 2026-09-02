# AssureRail AR-30 deployer handoff

**Instruction:** deploy only when separately directed; this implementation commit does not deploy or
activate AR-30.

## Safe deployment state

Keep both flags explicitly off for the first deployment:

```text
ARAIL_PRODUCTION_SCALE_V1=off
NEXT_PUBLIC_ASSURERAIL_PRODUCTION_SCALE_V1=off
```

Apply the Rail Prisma migration before starting the new API:

```text
npx prisma migrate deploy --schema=apps/assurerail-api/prisma/schema.prisma
```

The repository migration wrapper includes the Rail schema. Verify `prisma migrate status` and
API/web health after rollout. Do not change operating mode as part of this deployment.

## Shadow enablement prerequisites

To expose the internal board deliberately, set both AR-30 flags to `shadow` and rebuild/restart the
web and API only after confirming:

- `ASSURERAIL_ENVIRONMENT` is an explicit stable environment identifier;
- `ASSURERAIL_BUILD_COMMIT` is the exact deployed lowercase 40-character commit;
- `ARAIL_INTERNAL_RBAC_V1` is not off;
- the durable relay is not in legacy mode;
- DB-mode authentication is active; and
- only authorised internal users have the new bounded permissions.

Shadow enablement creates no live transaction authority. Keep every route/function capability at
its separately approved value. Never set an external gate to accepted merely to make the board
green.

## Smoke checks

1. API and web health return 200.
2. An unauthenticated or participant-context request to the internal board is denied.
3. An internal viewer can read the catalogue and board but cannot generate/review.
4. `SYSADMIN` or `MANAGER` can generate only after step-up.
5. The same person cannot review their snapshot.
6. `SECURITY_ADMIN` or `RISK_COMPLIANCE_OFFICER` can review a current unchanged snapshot.
7. Open external gates remain visible and no activation appears without a genuine PR-12 record.
8. Missing/stale integrity sweep or capacity evidence appears as a blocker.
9. Exporting the same retained assessment twice produces the same manifest digest.
10. No `ExternalInstruction` is created by any AR-30 action.

## Rollback and safe pause

Set both AR-30 flags back to `off`, rebuild/restart, and retain the additive assessment rows. Do not
delete or rewrite an assessment. Disabling this UI does not revoke a genuine activation; use the
existing PR-12 revocation/safe-pause process for that. Conversely, never keep a transaction
capability active because this dashboard is unavailable.

## External gates

VAPT, counsel, route, customer, trustee, provider, authoritative-register, DR, pilot and exit
evidence must come from their accountable owners. Record unavailable evidence as open. Synthetic
rehearsals in the repository prove software behaviour only.
