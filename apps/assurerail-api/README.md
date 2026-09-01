# @code/assurerail-api — existing AssureRail tokenised-DA slice

> **PRODUCT SCOPE AMENDED — 30 August 2026.** The canonical target is
> `docs/design/AssureRail_Generic_Transfer_Infrastructure_Scope.md`: provider-neutral DA/PTC
> infrastructure supporting conventional and authorised-tokenised modes. This application is the
> existing tokenised-DA/Note implementation and a candidate adapter/kernel source, not the complete
> generic product. Its AssurePool-tape, Note, issuer, trustee, HTS and DvP assumptions are not
> automatically valid for PTC or conventional routes. Do not add PTC by renaming the existing Note
> flow; follow the as-built disposition and staged migration in that scope before route work.

Current implementation: a permissioned **tokenised-DA demo/application slice**. It is a **separate
app inside the monorepo** (like `plaza`/`plaza-api`) with its own DB, env, ports (**api :3006**, web
:3007), access management, screens and APIs. Its existing demo path consumes an AssureLocker frozen
**AssurePool tape** and mints/administers an object named the **AssurePool Note**. That name and the
trustee-related demo code do not constitute PTC support; they are current-code facts to re-baseline,
not the generic intake or instrument contract.

## Current deployment/separation assumptions — not final corporate architecture

- The app already has its own database, environment, ports and access surface. Preserve that useful
  isolation while the final company, IP licence, funding and outsourcing structure is decided.
- The **current live-source coupling** is the AssurePool tape API over HTTP/2
  (`GET /v1/co-lending/pools/:id/tape.json`); that is one adapter, not the target Rail intake
  contract. Stage 1 adds provider-neutral file/API intake and provider-exit continuity.
- The current code does not reach into the AssureLocker database. Future integrations must also use
  versioned, authenticated contracts and retain enough signed evidence for Rail continuity.
- Segregation must be anchored on function, appointments, access, fees, decisions, reconciliation
  and incident accountability; a company or division label cannot provide it by itself.
- The current slice holds no ledger keys (mint goes via plaza) and is designed not to hold borrower
  PII (T2). Those controls must survive generalisation.

## Historical tokenised-DA build sequence
- **2a (done)** — scaffold + tape client with **independent integrity verification** (recompute
  `tapeHash` via `@code/shared`; trust the math not the transport) + mint-readiness gate (lock must be
  CONFIRMED) + ring-fenced data model + own access management.
- **2b** — HTS adapter (DEMO / LIVE-via-plaza) + mint gate (lock CONFIRMED + k-anon) → Note + MintLog.
- **2c** — surveillance mirror + HCS anchoring via plaza. **T4** — DvP + settlement (e₹). **T5** — e2e.

## Run (DEMO — standalone, no AssureLocker needed)
```bash
npm run build --workspace=@code/assurerail-api
npm test  --workspace=@code/assurerail-api      # tape integrity + mint-readiness
npm start --workspace=@code/assurerail-api      # http://localhost:3006
```

Runtime evidence is explicit: `ASSURERAIL_OPERATING_MODE` is one of `DEMO`, `REPLAY`, `SHADOW`,
`SANDBOX`, `CONTROLLED_LIVE`, or `PRODUCTION`. `NODE_ENV` only controls Node/framework optimisation.
The current container/Hetzner demonstration therefore runs `NODE_ENV=production` with
`ASSURERAIL_OPERATING_MODE=DEMO`. Every non-demo mode requires the persistent store and Firebase
auth; controlled-live/production additionally refuse demo routes/adapters, fail-soft reCAPTCHA and
insecure provider transport. `DEMO` refuses live adapters; `REPLAY` and `SHADOW` refuse live mutating
HTS/HCS/settlement adapters. `SANDBOX` is the pre-live mode for provider test-environment mutations.
See `src/runtime/runtime-profile.ts` and its executable tests.

### Neutral contract package (PR-01)

`src/contracts/v1` defines the provider-neutral DA/PTC transaction taxonomy, provenance envelopes,
strict canonical serialization, exact money/unit values, additive schema compatibility and
read-only AssurePool/AssureTransfer mappings. It is not imported by `AppModule`, creates no endpoint
or database write, and defaults to `ARAIL_NEUTRAL_TAXONOMY_V1=off`; the only other accepted flag
value is `read_only`. `DEMO` remains a runtime/test label and is intentionally invalid as canonical
transaction evidence. See `docs/design/AssureRail_Neutral_Contracts_v1.md`.

### Persistence and durable integration foundation (PR-02)

The Rail database now has additive provider/source, immutable intake/receipt, idempotency,
inbox/outbox, external-instruction/acknowledgement and migration-receipt records. Existing Note
lifecycle writes commit their legacy `EventLog`, billing event and a digest-bound `OutboxMessage` in
one Postgres transaction. This does not make the current external mint/settlement sequence safe; the
external-action saga remains PR-09/PR-11 work.

Webhook egress has three explicit modes: `legacy` (transitional in-process relay), `shadow` (durable
fanout records with network suppression) and `durable` (claimed jobs, exponential retry,
dead-letter/replay and stable delivery IDs). New endpoints are HTTPS/public-DNS checked at write and
connect time, challenge-verified, and use an HMAC secret held in HashiCorp Vault KV-v2; Postgres stores
only its opaque reference. The PR-02 migration disables every legacy subscription and clears its
plaintext secret, so it must be re-provisioned and verified. See
`docs/runbooks/AssureRail_PR02_Persistence_And_Relay.md`.

Run the disposable database evidence rehearsal (never a configured database):

```bash
npm run db:rehearse:pr02 --workspace=@code/assurerail-api
```

### Tokenised-DA representation adapter (PR-11)

The case-scoped PR-11 adapter links an existing legacy Note to a neutral DA/TOKENISED transaction
case and active authoritative-record declaration. The token is always a `MIRROR`; governed actions
are durable `OBSERVE_ONLY` instructions with authenticated observations and exact reconciliation.
It is off by default (`ARAIL_TOKENISED_DA_V1=off`), can be allow-listed only in `REPLAY`/`SHADOW`,
and exposes no external dispatch. Linked Notes are removed from the global legacy read/mutation
paths. See `docs/design/AssureRail_Tokenised_DA_Representation_PR11.md`.

Run its disposable database evidence rehearsal:

```bash
npm run db:rehearse:pr11 --workspace=@code/assurerail-api
```

### Endpoints
```
GET  /health
GET  /venue/tape/:poolId                       # fetch + independently verify a tape (2a)
POST /venue/mint/:poolId                       # k-anon gate → HTS mint → Note (2b)
GET  /venue/notes
POST /venue/notes/:id/surveillance/sync        # mirror + HCS-anchor cycles; Note→ACTIVE (2c)
GET  /venue/notes/:id/surveillance
POST /venue/notes/:id/dvp                       # atomic DvP (asset ↔ e₹ settlement) (T4)
GET  /venue/notes/:id/dvp | /holdings
POST /venue/notes/:id/break-glass              # regulator T2 access — anchored (T4)
POST /venue/demo/run/:poolId                    # ONE-CALL end-to-end: mint→surveillance→DvP (T5)
```
### One-call demo
```bash
curl -sX POST http://localhost:3006/venue/demo/run/POOL-DEMO-1 -H 'content-type: application/json' -d '{}'
# → mint → k-anon → 2 HCS-anchored surveillance cycles → Note ACTIVE → atomic DvP (30% sold, e₹) → holdings
```
`TAPE_SOURCE=live` + `ASSURELOCKER_API_URL/_KEY` switches to the real `tape.json` (HTTP/2).
`HTS_ADAPTER` / `HCS_ANCHOR` / `SETTLEMENT_ADAPTER=live` are gated until the plaza endpoints +
deferred live testnet smoke test land.

## Next generic-infrastructure sequence

1. **Stage 1A:** adapt/extract existing institution, membership/SAML, maker-checker, evidence-case
   and connector-certification controls; add Rail-local participant, mandate, appointment and
   route-entitlement records.
2. **Stage 1B:** add a neutral transaction case/room and migrate the tested room currently under
   `apps/api/src/co-lending`, preserving an AssurePool adapter and legacy compatibility.
3. **Stage 1C:** add neutral evidence/state/document/reconciliation/deadline services and replay one
   completed conventional DA and one completed conventional PTC.
4. Keep this Note/mint/DvP path behind the tokenised-representation adapter boundary throughout.

The detailed file disposition, migration rules, onboarding acceptance tests and rejected shortcuts
are in `docs/design/AssureRail_Generic_Transfer_Infrastructure_Scope.md` §§0.2–0.3 and 9.
