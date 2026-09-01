# AssureRail PR-16 deployer handoff

**Owner:** other coder/operator; this agent did not deploy. **Authority:** EX-27.

Keep the reported box in its current demo state and add/retain:

```text
ASSURERAIL_OPERATING_MODE=DEMO
ARAIL_TOKENISED_PTC_V1=off
```

Back up the Rail DB, run `npm run db:rehearse:pr16 --workspace=@code/assurerail-api`, apply the
additive migration, restart with the flag off, and verify health/readiness and effective flags.

A separate replay/shadow environment may set `shadow` only with the documented PR-10/case/saga
foundation. It may record real authorised evidence but cannot execute issue, allotment, transfer,
cash, register, distribution or burn. Do not promote the rehearsal rows.

Rollback/safe pause is flag `off`; preserve all rows and do not reverse external records. Live or
production activation requires later code, external gates, permission review, certified performers
and a signed PR-12 activation. Pricing—including 0.5% for tokenised PTC—is never an authority gate.
