# AssureRail PR-19 deployer handoff

Do not deploy from this work session. The designated coder owns deployment.

## Default/off

```text
ARAIL_DEVELOPER_PORTAL_V1=off
```

Keep the current DEMO box unchanged. Apply the additive migration before any later flag change.

## Approved replay/shadow review profile

```text
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_DURABLE_RELAY_MODE=shadow
ARAIL_DEVELOPER_PORTAL_V1=shadow
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow
```

The web variable is build-time. API and web must be rebuilt through the normal pipeline. Shadow
relay records/suppresses delivery according to the PR-02 policy; it must not be changed to durable
egress in SHADOW merely to make a demo send.

Before customer review, verify two institutions cannot list each other's clients, webhooks,
deliveries, conformance or exit output. Confirm client and exit responses contain neither raw
secrets nor `credentialVaultRef`.

## Rollback

Set `ARAIL_DEVELOPER_PORTAL_V1=off`, rebuild and restart the API normally. Hide the developer centre
by setting the customer workspace build flag off if required. Preserve all client credential
versions, conformance runs, webhook delivery history and exit manifests; do not drop the migration.

