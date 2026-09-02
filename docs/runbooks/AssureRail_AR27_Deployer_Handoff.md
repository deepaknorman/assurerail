# AssureRail AR-27 deployer handoff

**Authority:** EX-28 permits implementation, commit and push. It does not permit deployment or
activation. The other coder owns deployment under separate user direction.

## Default posture

Deploy with both new flags unset or explicitly off:

```text
ARAIL_SECONDARY_PRODUCT_V1=off
NEXT_PUBLIC_ASSURERAIL_SECONDARY_PRODUCT_V1=off
```

The API migration `20260903000000_assurerail_ar27_secondary_product` adds only
`SecondaryTransferRepair` and restrictive indexes/foreign keys. With flags off, the secondary
register is absent from customer navigation, the product overview/repair/export paths refuse use,
and PR-14's existing foundation remains governed by its independent flag.

The normal deployment migration step must include:

```text
npx prisma migrate deploy --schema=apps/assurerail-api/prisma/schema.prisma
```

After deployment, confirm `prisma migrate status` is current, both services return health 200s, and
the effective runtime profile reports `secondaryProduct=off`. Deployment does not authorise a flag
change.

## Later replay/shadow activation

Only under separate activation authority, declare `ASSURERAIL_OPERATING_MODE=REPLAY|SHADOW` and
satisfy the runtime dependency chain:

- participant admission, neutral ingress and transaction cases in shadow;
- required external-action saga foundation;
- internal RBAC enabled;
- hosted alpha, developer portal and institutional product in shadow;
- conventional-secondary PR-14 in shadow;
- at least one applicable conventional DA/PTC product in shadow; and
- both AR-27 API/web flags set to `shadow`.

Keep every corresponding controlled-live capability absent. AR-27 is rejected outside replay/shadow.

## Smoke checks for an authorised shadow cohort

Use two cases and multiple institutions/humans:

1. DA: seller, buyer and recordkeeper; verify no trustee field or stage is accepted.
2. PTC: seller, buyer, trustee and route recordkeeper; verify trustee and register facts remain
   distinct and disagreement opens a critical break.
3. Verify unrelated institutions receive 404/403 from register, overview and exports.
4. Verify a member with `VIEW_CASE` but no `VIEW_EVIDENCE` receives no evidence IDs or digests.
5. Verify seller creation/evidence/proposal, a different seller reviewer, and stable idempotent retry.
6. Verify the break owner—not seller/platform support—proposes repair and a different owner human
   reviews it.
7. Verify invalid/expired/unsigned/unshared/wrong-digest evidence fails closed.
8. Verify original evidence remains, corrected evidence appends, audit events remain chained, and
   ambiguous concurrent review cannot duplicate a repair application.
9. Verify CSV/JSON export scope and the JSON pack digest.
10. Verify zero external instruction/outbox rows, zero cash/title/token/register mutation and all
    external activation gates still open.

Do not use synthetic fixtures as customer, trustee, counsel or live evidence.

## Rollback

Set both AR-27 flags to `off`, rebuild the web image and restart the services through the normal
process. Retain every secondary dossier, evidence version, leg, break, repair and audit row. Do not
drop the additive table or rewrite history to make rollback appear clean. Any open real case must be
safely paused and exported under its route-specific operating decision.
