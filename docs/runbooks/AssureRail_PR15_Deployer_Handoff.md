# AssureRail PR-15 deployer handoff

**Scope:** additive migration and dormant token connector/custody path only

**Deployment owner:** other coder/operator; this implementation agent did not deploy

**Authority:** EX-27

## Safe deployment state

For the reported demo box, retain:

```text
ASSURERAIL_OPERATING_MODE=DEMO
ARAIL_TOKENISED_DA_V1=off
```

Do not copy controlled-live examples into the box. Do not add candidate token capabilities to an
activation manifest: this build's live registry is intentionally empty, so startup rejects them.

## Pre-deploy and deploy

1. Confirm the reviewed commit and preserve unrelated operator changes.
2. Back up the Rail database and retain backup ID/checksum.
3. Run `npm run db:rehearse:pr15 --workspace=@code/assurerail-api` on a suitable host.
4. Confirm the effective token flag is `off` and current mode remains `DEMO`.
5. Apply migrations, build, restart and verify health/readiness/authentication.
6. Verify the runtime profile reports `tokenisedDa=off` and no token connector worker claims work.
7. Record commit, migration, operator, reviewer, time and rollback decision.

## Permitted non-live follow-up

PR-11 observation/reconciliation may still be enabled only in a separate replay/shadow environment
with `ARAIL_TOKENISED_DA_V1=allow_list` and its documented shadow foundation. It cannot dispatch.

## Future activation handoff—not authorised now

Before any `live` setting, close and independently review every external gate in the PR-15 design,
add only the proven capability IDs to the live registry in a new reviewed commit, create current
case-specific custody/legal/operating evidence, certify the exact connector/runtime profile, and
complete the PR-12 activation ceremony for the exact build/environment/cohort. Production further
requires production-specific pilot, capacity, exit and restore evidence. Never self-certify with
the disposable rehearsal fixtures.

## Safe pause and rollback

For an active future cohort, revoke the PR-12 activation and safe-pause its binding before restart;
ambiguous/dispatched instructions must be reconciled, not cancelled. Set
`ARAIL_TOKENISED_DA_V1=off` to prevent new work and preserve all rows. Do not roll back the additive
migration or reverse confirmed external state by database action.

## Prohibited actions

- no deployment by this implementation agent;
- no live flag or capability registry entry based on internal tests;
- no token private key in Rail, `.env`, database or logs;
- no synthetic evidence promoted to verified external evidence; and
- no public claim of live token issuance, transfer, payment, anchoring or burn.
