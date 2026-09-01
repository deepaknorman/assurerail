# AssureRail PR-11 tokenised-DA representation evidence

**Executed:** 2 September 2026

**Branch:** `codex/assurerail-pr01-neutral-taxonomy`

**Authority:** EX-26

**Deployment:** none

## Evidence summary

| Check | Result | Evidence meaning |
|---|---:|---|
| Prisma format and validation | PASS | PR-11 relations and migration datamodel are valid |
| AssureRail API build/typecheck | PASS | Generated Prisma client and TypeScript compile |
| Focused PR-11/config/legacy-fence tests | 38/38 PASS | Runtime, API, exact comparison, schema and compatibility gates |
| Complete AssureRail API suite | 221/221 PASS | No test regression across PR-00 through PR-11 and the legacy demonstration |
| Disposable PostgreSQL rehearsal | PASS | All 18 migrations, governed service flow, schema parity, backup and restore |
| Deployment | NOT RUN | Founder explicitly prohibited deployment |

## Commands executed

```text
npx prisma format --schema prisma/schema.prisma
npx prisma validate --schema prisma/schema.prisma
npm run build
node --test dist/token-representation/*.test.js \
  dist/persistence/feature-flags.test.js \
  dist/runtime/runtime-profile.test.js \
  dist/characterisation/lifecycle-failure-sequence.test.js
npm test
bash ./scripts/assurerail-pr11-db-rehearsal.sh
```

The PostgreSQL command was executed against a new `mktemp` cluster and newly created databases. The
script never reads a configured `DATABASE_URL`.

## Database rehearsal assertions

The rehearsal proved:

- all 18 migrations apply from an empty database;
- four PR-11 tables exist;
- linkage is one-to-one and idempotent;
- authority mode is `MIRROR` and representation type is `TOKENISED`;
- a prepared action is `OBSERVE_ONLY` and its external instruction says `dispatchProhibited`;
- acknowledgement with incorrect instruction/expected digest binding is rejected;
- authenticated acknowledgement with matching evidence is retained;
- exact supply/position/economic/authority evidence reconciles;
- repeated identical commands do not duplicate records;
- an authoritative-record divergence creates one critical open break;
- linked Note and case foreign-key restrictions hold;
- database schema has no PR-11 drift from the Prisma datamodel; and
- a later matching snapshot cannot hide or auto-resolve an earlier open break;
- backup/restore retains `1` representation, `1` action, `3` reconciliation snapshots and `1`
  break, with migration status current.

Final script receipt:

```text
[PR11-DB] PASS models=4 mirror=explicit actions=observe-only idempotency=verified
reconciliation=match+break+unresolved-break-persistence restore=1|1|3|1
```

## Findings disposition

| Finding | PR-11 disposition |
|---|---|
| `AR-C01` global Note access | Linked Notes are removed from global legacy list/report/holding paths; case read is institution scoped |
| `AR-C04` cash-first DvP | Linked Notes reject direct legacy DvP; PR-11 actions record no external mutation |
| `AR-C05` external mint/burn before DB | Linked Notes reject legacy burn paths; PR-11 persists instruction before observation and dispatches nothing |
| `AR-H07` body/hard-coded actor | Governed actor, institution and mandate derive from authenticated session/authority records |
| `AR-H08` unsafe exact values/idempotency | Canonical exact integers, action-specific validation and command idempotency are enforced |
| `AR-H10` audit after domain transaction | PR-11 governed audit is written inside each domain transaction |
| `AR-H14` local holdings without legal authority | Mirror mode plus exact external-authority reconciliation is mandatory |
| `AR-H16` provider coupling | Actions use provider-neutral `ProviderReference`; no AssureLocker/HTS/HCS/payment adapter import |

## Evidence qualification

This evidence proves a non-mutating replay/shadow foundation. It does not prove controlled-live or
production readiness, network/key custody, payment settlement, legal effectiveness, customer
acceptance, secondary trading or reconciliation-repair operation. Existing unlinked demo Notes
still exercise the characterised direct adapter sequences and remain demo evidence only.
