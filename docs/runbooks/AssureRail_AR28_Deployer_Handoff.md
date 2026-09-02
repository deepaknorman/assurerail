# AssureRail AR-28 deployer handoff

**Default instruction:** push/build only; do not activate without a separate founder instruction.

## Artifact boundary

AR-28 adds the tokenised product orchestration module, customer register/case cockpit, focused tests,
documentation and one API/web product flag. It adds no Prisma migration and no live capability ID.

## Safe deployment values

Keep these new values dark:

```text
ARAIL_TOKENISED_PRODUCT_V1=off
NEXT_PUBLIC_ASSURERAIL_TOKENISED_PRODUCT_V1=off
```

Do not infer the API flag from the web flag. The web value is compiled into the Next build and is
visibility only. Do not change `ARAIL_TOKENISED_DA_V1` to `live`.

## Build and verification

1. Confirm the intended commit and a clean/staged-file inventory.
2. Run `bash scripts/assurerail-integrated-release-check.sh --code`.
3. Build API and web artifacts from the same commit.
4. Apply the normal venue migration command; it should report no AR-28 migration and no pending
   prior migration.
5. Start the API and web with the two AR-28 flags `off`.
6. Confirm API health/readiness, web login and that `/workspace/tokenised` is not advertised.

## Shadow evaluation only after explicit instruction

The API will accept `ARAIL_TOKENISED_PRODUCT_V1=shadow` only when institutional, DA, PTC and
lifecycle products are shadow; tokenised DA is allow-listed; tokenised PTC is shadow; the saga is
required; internal RBAC is present; and runtime is REPLAY or SHADOW. The corresponding web flag may
then expose the UI after a fresh web build. This remains no-dispatch and does not activate a token
connector.

## Rollback

Return both flags to `off`, rebuild the web and restart. Retain all representation/evidence history.
Do not delete, rewrite or reverse a token, evidence object, acknowledgement or reconciliation as a
deployment rollback.

## Handoff assertions

- deployment is not activation;
- mirror state is not legal title;
- `SHADOW_READY` PTC action plans do not dispatch;
- connector/custody records do not replace external acceptance; and
- external gates remain open until their accountable authority supplies real evidence.
