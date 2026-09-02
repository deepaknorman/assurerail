# AssureRail AR-29 deployer handoff

**Instruction:** deploy only if separately directed; keep the new capability dark.

## Artifact boundary

AR-29 adds one venue migration, an API module, two web workspaces, tests and documentation. It adds
no live capability ID and no external dispatch path.

## Safe values

```text
ARAIL_ENTERPRISE_INTEGRATION_V1=off
NEXT_PUBLIC_ASSURERAIL_ENTERPRISE_INTEGRATION_V1=off
```

The web value is build-time visibility only. Do not infer either flag from the other.

## Deployment handoff

1. Confirm the intended commit and keep unrelated working-tree files excluded.
2. Run `bash scripts/assurerail-integrated-release-check.sh --code`.
3. Build API and web from the same commit.
4. Run the venue migration through `scripts/db-migrate.sh`; confirm the AR-29 migration and all
   preceding migrations are applied.
5. Restart API/web with both new flags `off`.
6. Confirm API health/readiness and web login; `/workspace/integrations` must not be advertised.

## Shadow evaluation

Only a separate instruction may set the flags to `shadow`. The API additionally requires
institutional product, developer portal, customer operations and durable relay in shadow plus
internal RBAC, under REPLAY or SHADOW runtime. A web rebuild is required for the public environment
variable. Shadow enables governance and evidence recording only—not external execution.

## Rollback

Return both flags to `off`, rebuild web and restart. Keep the additive tables and all evidence,
reviews, observations and bindings. Never delete or rewrite integration history as rollback.
