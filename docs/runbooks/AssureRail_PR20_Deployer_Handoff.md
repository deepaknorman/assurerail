# AssureRail PR-20 deployer handoff

Do not deploy from this work session. The designated coder owns deployment.

## Default/off profile

Keep the current box mode unchanged and add explicit defaults:

```text
ARAIL_CUSTOMER_OPERATIONS_V1=off
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1=off
```

Apply the additive migration through the normal pipeline before any later flag change. Do not edit
or backfill customer rows manually on the box.

## Approved replay/shadow review profile

Only after the existing PR-19 shadow dependencies are intentionally enabled:

```text
ASSURERAIL_OPERATING_MODE=SHADOW
ARAIL_PARTICIPANT_ADMISSION_V1=shadow
ARAIL_NEUTRAL_INGRESS_V1=shadow
ARAIL_DURABLE_RELAY_MODE=shadow
ARAIL_DEVELOPER_PORTAL_V1=shadow
ARAIL_INTERNAL_RBAC_V1=shadow
ARAIL_CUSTOMER_OPERATIONS_V1=shadow
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow
NEXT_PUBLIC_ASSURERAIL_CUSTOMER_OPERATIONS_V1=shadow
```

The two `NEXT_PUBLIC_` values are build-time. Rebuild the web and API through the normal release
pipeline. This profile enables shadow records only. It does not enable egress, live route actions,
tax invoices, collections or production claims.

After migration and before participant review, verify:

1. API startup reports `customerOperations=shadow` and `ASSURERAIL_OPERATING_MODE=SHADOW`;
2. an institution cannot see another institution's contracts, rates, statements, cases, requests
   or exit inventory;
3. a manager cannot review their own contract/rate/statement/credit and a support analyst cannot
   price or invoice;
4. a customer cannot see a draft/rejected commercial record;
5. renewal/reinstatement waits for new customer acceptance;
6. 30/50-bps tests use the contract's exact currency scale and do not create a platform default;
7. exit output excludes stale grants, secret/Vault material and document bytes; and
8. no PR-20 action changes a transaction case, evidence result, authoritative record,
   reconciliation break or completion status.

## Controlled-live and production

There is no `on`, `live` or production value for the PR-20 flag and no PR-20 capability in the live
registry. Do not invent one in environment configuration. The code path remains closed until the
external gates listed in `docs/qa/AssureRail_PR20_Customer_Operations_Evidence.md` are accepted and a
later reviewed change binds the applicable commands to the PR-12 activation guard.

## Rollback

Set both customer-operations flags to `off`, rebuild and restart normally. Preserve contract,
rate-card, metering, statement, credit, cohort, service, review and exit records; do not drop the
migration or rewrite historical digests. Existing PR-19 integration and earlier product flags are
independent and should not be changed as part of this rollback.
