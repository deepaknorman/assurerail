# AssureRail — scaffold blueprint (design note, 21 Jul 2026)

**Status:** blueprint only — no code created yet. Becomes the AssureRail repo's README when the repo is
stood up. Governed by `AssurePool_Securitisation_Tokenisation_Path.md` §8 (the Note product), §11
(system architecture), §15 (entity & system separation).

## 0. What AssureRail is (and its relationship to AssureLocker)
AssureRail is the **domestic securitisation & tokenisation venue** — it consumes AssureLocker's frozen
pool tape and mints/administers the **AssurePool Note**. Posture (settled §15):
- **Separate codebase, separate instance, separate IP owner** (a distinct company) — for **function,
  conflict-of-interest and segregation-of-duties** reasons that hold regardless of regulatory tier.
- **Tightly coupled at runtime, by design.** AssureRail is NOT engineered for build-time independence.
  It **calls AssureLocker's authenticated APIs** for what it needs and **depends on AssureLocker being
  up** — the outsourcing/BCP-exit concern is handled by *contract*, not architecture.
- **Different regulators** describe the expected state (AssureLocker → RBI TSP/IT-governance;
  AssureRail → SEBI/IFSCA market conduct) — but per §15.2 this is the *descriptive* reason, not the
  load-bearing one. AssureLocker is AssureRail's **material technology outsourcing provider** (§15.4).

## 1. Runtime coupling map (what AssureRail calls AssureLocker for)
```
AssureRail (venue)                       AssureLocker (TSP, this repo)
  ├─ GET  /v1/co-lending/pools/:id/tape.json   → the abstracted T0+T1 frozen tape  [SHIPPED]
  ├─ POST plaza HTS create/mint  ───────────────→ mint the Note on Hedera (operator lives in plaza)
  ├─ POST plaza HCS submit  ────────────────────→ anchor Note lifecycle + surveillance
  └─ (T2 break-glass stays on AssureLocker; AssureRail NEVER holds T2)
```
- **AssureRail holds no ledger keys.** The Hedera operator is in `apps/plaza-api` (§8.10 spike); AssureRail
  requests mint/anchor via plaza. Keeps the ledger rail neutral + shared (doctrine: Hiero/Hashsphere via
  plaza only) and keeps signing material out of the venue.
- **Auth:** AssureRail is a registered API consumer of AssureLocker with a scoped credential
  (API-key / OAuth client-credentials — the existing `plaza-ledger-client` / BFSI-connector pattern).
  The credential scopes it to *its entitled tapes only* — never the cross-lender view (the CoI barrier
  is enforced at the API, not by a shared binary).

## 2. Directory / file layout (NestJS — mirrors AssureLocker apps/api conventions)
```
AssureRail/                         (separate git repo; sibling to Code/)
  package.json                     own deps (@nestjs/*, @hashgraph/sdk only if any local HTS; prisma)
  prisma/
    schema.prisma                  AssureRail's OWN database (ring-fenced) — see §4
    migrations/
  src/
    main.ts, app.module.ts
    common/
      audit.ts                     audit actor namespace = system:tokenco (segregation primitive)
      assurelocker-client.ts       the tape/plaza HTTP client + scoped-credential auth
    tape/
      tape.types.ts                thin copy of AssurePoolTape (the ONLY shared type; not a shared binary)
      tape.service.ts              fetch + verify tape (tapeHash, lock CONFIRMED)
    hts/
      hts.adapter.ts               OnBook-style DEMO/LIVE split (DEMO fake TokenId/serials; LIVE → plaza)
      mint.service.ts              mint gate (lock CONFIRMED + k-anon) → HTS create/mint → Note
    note/
      note.service.ts              Note lifecycle (issued → active → …); holdings; allow-list
    surveillance/
      surveillance.service.ts      per-cycle mirror; HCS anchoring via plaza
    settlement/                    (T4) DvP + settlement-token adapter (e₹ demo)
    access/
      roles.ts                     tokenisation roles + allow-list (issuer/desk/investor/trustee/regulator)
  README.md                        = this blueprint
```

## 3. HTS adapter (DEMO / LIVE) — same pattern as AssureLocker's on-book adapter
- `DemoHtsAdapter` — deterministic fake `TokenId` (`0.0.<hash>`) + serials from a hash of the tapeHash;
  fully demoable, **no testnet, no operator account**.
- `LiveHtsAdapter` — calls plaza's HTS endpoint (to be added to plaza-api) which does
  `TokenCreateTransaction` + `TokenMintTransaction` on the operator client. **Gated `HTS_ADAPTER=live`**
  and blocked until the **deferred live testnet smoke test** passes (see the memory + §8.10).
- `selectHtsAdapter()` — DEMO by default.

## 4. AssureRail's own data model (ring-fenced — its DB, not AssureLocker's)
- **Note** — tokenId, serials, poolId, tapeHash (provenance link back to the AssureLocker tape),
  T1 aggregates snapshot, state (ISSUED/ACTIVE/REDEEMED), createdAt.
- **NoteHolding** — noteId, holderDid (allow-listed), units, acquiredAt.
- **MintLog** — append-only: tape consumed, k-anon check result, lock reference, HTS tx ref, actor.
- **SurveillanceMirror** — per-cycle: pulls AssureLocker surveillance (or receives it), anchors via plaza.
- **(T4) DvPLog / SettlementLog.**
No borrower PII (T2) ever lands here — only T0 commitments + T1 aggregates from the tape.

## 5. Mint flow (T3)
1. Fetch tape (`tape.json`) for a pool; verify `tapeHash` and that `tape.lock.state === "CONFIRMED"`
   (the reserve-then-mint gate — AssureLocker owns the lock; AssureRail refuses to mint without it).
2. **k-anon mint gate** (§8.4): mintable pool ≥ USD 2M **AND** ≥ 90 days seasoning **AND** ≤ 50%
   single-borrower concentration. Computed from the tape's T1 aggregates (+ per-loan structural).
3. Mint via the HTS adapter → `TokenId` + serials.
4. Write the **Note** (T0 commitments + T1 on the object; T2 stays off, at AssureLocker) + MintLog.
5. Anchor the mint event via plaza HCS.

## 6. Segregation primitives — from AssureRail commit 1 (cheap now, ruinous to retrofit — §15.6)
Separate repo + separate DB + separate instance (own port + pm2 process on the demo box) + audit actor
`system:tokenco` + **separate change-approval/deploy path** + **IAM boundary** (AssureRail staff can't
reach AssureLocker prod/data, and vice-versa) + a short **segregation memorandum** documenting the line.

## 7. Deploy topology
- **Demo box (now):** separate pm2 process under the `deploy` user, own port (proposed **3010**), own
  DB namespace/database. Calls AssureLocker over the internal network.
- **Trigger 1 (sandbox app):** own ring-fenced deploy target + creds + Hedera operator account; VAPT of
  the venue surface; DPA with AssureLocker finalised.
- **e₹ / DvP (T4):** plaza `settlement/` module (`ISettlementAdapter`, already stubbed) is the leg.

## 8. Build sequence (in the AssureRail repo, once created)
- **2a** — scaffold NestJS + `assurelocker-client` (auth + `tape.json`) + own Prisma + DEMO fixtures.
- **2b** — `hts.adapter` (DEMO) + `mint.service` (lock-CONFIRMED + k-anon gate) → Note + MintLog.
- **2c** — surveillance mirror + HCS anchoring via plaza; Note lifecycle.
- **T4** — DvP + settlement-token adapter (e₹ demo) + demo trustee/registrar/venue + regulator break-glass.
- **T5** — end-to-end: (AssureLocker) assemble → lock → freeze → tape.json  ⇢  (AssureRail) mint →
  surveillance → DvP.

## 9. Open / deferred
- ⏳ **Live testnet HTS smoke test** (funded operator account) before `HTS_ADAPTER=live` — captured in
  memory + §8.10.
- Add the **plaza HTS endpoint** (`apps/plaza-api`) for the LIVE path (mirrors `hcs.service`).
- Access management: real investor KYC/allow-list onboarding is Trigger-1, not now (DEMO allow-list now).
