# @code/assurerail-api — AssureRail venue

Securitisation & tokenisation venue. A **separate app inside the monorepo** (like `plaza`/`plaza-api`):
its own DB, env, ports (**api :3006**, web :3007), access management, screens, APIs. Consumes
AssureLocker's frozen **AssurePool tape** and mints/administers the **AssurePool Note**.

## Separation model (see AssurePool_Securitisation_Tokenisation_Path.md §15)
- **The code never leaves this repo.** At the incorporation trigger, AssureRail (the legal entity)
  **licenses the running software** from AssureLocker (its TSP) for a recurring fee + support &
  maintenance, and runs its own separately-deployed instance (own infra/DB/creds). No repo fork.
- **Runtime coupling = the tape API over HTTP/2** (`GET /v1/co-lending/pools/:id/tape.json`) — the
  venue never reaches into AssureLocker's DB. Same-repo, still API-coupled (like `api` ↔ `plaza-api`).
- Segregation anchored on **function / conflict-of-interest / segregation-of-duties**, not regime.
- Holds **no ledger keys** (mint goes via plaza) and **no borrower PII (T2)**.

## Build sequence
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
