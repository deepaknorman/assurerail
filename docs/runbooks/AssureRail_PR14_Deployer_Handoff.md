# AssureRail PR-14 deployer handoff

**Scope:** migration and inert conventional secondary replay code only.
**Deployment owner:** the other coder/operator. This implementation agent did not deploy.
**Authority:** EX-27.

## Safe initial environment

Keep the box's existing declared mode. For the currently reported demo box, retain:

```text
ASSURERAIL_OPERATING_MODE=DEMO
ARAIL_CONVENTIONAL_SECONDARY_V1=off
```

Do not change the box to `REPLAY` or `SHADOW` merely to expose PR-14. Do not set any live adapter.
The additive migration may be deployed while the flag remains off.

## Pre-deploy

1. Confirm the deployed commit is the reviewed PR-14 commit and the working tree contains no
   operator-owned changes that the deployment would overwrite.
2. Back up the Rail database and record the backup identifier/checksum.
3. Run `npm run db:rehearse:pr14 --workspace=@code/assurerail-api` on an appropriate build host.
4. Confirm `ARAIL_CONVENTIONAL_SECONDARY_V1=off` in the effective service environment.
5. Build the API and review the startup profile before switching traffic.

## Deploy with module off

1. Apply Prisma migrations.
2. Restart the API with the existing mode and the PR-14 flag `off`.
3. Verify health/readiness, authentication and existing smoke checks.
4. Verify the startup profile reports `conventionalSecondary=off`.
5. Record deployed commit, migration status, operator, reviewer, times and rollback decision.

## Optional later replay/shadow enablement

Only a non-live replay/shadow environment with the complete foundation may use:

```text
ASSURERAIL_OPERATING_MODE=REPLAY   # or SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_TRANSACTION_CASE_V1=shadow
ARAIL_EXTERNAL_ACTION_SAGA_V1=required
ARAIL_CONVENTIONAL_SECONDARY_V1=shadow
```

Before enabling, prepare admitted seller, buyer and recordkeeper institutions; add trustee for PTC;
create route-specific active parties, mandates, assignments and entitlements; and retain real
participant-authorised historic evidence objects. Never create synthetic evidence to make a
customer replay appear complete.

## Rollback / safe pause

Set `ARAIL_CONVENTIONAL_SECONDARY_V1=off` and restart. Preserve all PR-14 rows. The migration is
additive and should not be rolled back destructively. There is no external compensation because
PR-14 has no dispatch path. Investigate any database or audit discrepancy before re-enabling.

## Prohibited handoff actions

- do not deploy controlled-live or production merely because the build succeeds;
- do not add a PR-14 live capability to the registry without a later reviewed implementation;
- do not treat trustee evidence as the operative record or a Rail row as ownership;
- do not convert missing evidence into `VERIFIED`; and
- do not claim secondary execution, settlement or trading in public material.
