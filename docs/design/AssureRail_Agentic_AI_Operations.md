# AssureRail — Agentic AI Operations Architecture

**Status:** Design — approved direction, phased build (Crawl live-buildable now). **[July 2026]**
**Scope:** How the AssureRail venue (`apps/assurerail-api` :3006, `apps/assurerail` :3007, own Postgres `assurerail_venue`) is *operated* — monitored, reconciled, QA'd, audited, and self-healed — with 1–2 humans and heavy, **bounded** reliance on AI, without ever letting an agent take an irreversible or governed action autonomously.

> **North star.** Run AssureRail's irreversible value lifecycle (tape → **MINT** → **SURVEILLANCE** → **DvP** → **BURN**) with 1–2 humans by making correctness *deterministic and self-proving*, and concentrating real AI into exactly one place — open-ended triage of confirmed breaks — while every irreversible or governed action stays permanently behind human maker-checker.

---

## 1. TL;DR

Six independent design lenses (monitoring, reconciliation, trend, QA/audit, orchestration, scaling) plus an adversarial critique of each converged on one honest verdict, and the code confirms it:

- **~90% of what the venue needs now is deterministic automation, not agents.** The remaining ~10% of genuine intelligence belongs at the **break**, not the event.
- The venue is **greenfield for ops**: no worker, no scheduler, `audit()` only `console.log`s ([common/audit.ts](../../apps/assurerail-api/src/common/audit.ts)), and the whole nervous system is one in-process `VenueEventBus` feeding a single **fire-and-forget** `EventSinkService` that writes `EventLog`/`BillingEvent` with `.catch(warn)` — i.e. **silent drops**. Atomic domain writes (`commitMint`/`settleDvp`/`closeNote`) but best-effort downstream projections is the venue's single largest silent-drift source.
- So the architecture **inverts the "agent fleet" framing**: a small deterministic core (a scheduler, a read-only integrity engine of pure-SQL invariants, a liveness sentinel with an off-box dead-man's switch) **plus exactly one genuinely agentic function — `OpsTriage`** — that reasons over *confirmed* breaks, forms falsifiable hypotheses, and drafts a plan or a maker-checker proposal. **It executes nothing.**
- **Root causes are fixed, not monitored around.** Move `EventLog`+`BillingEvent` writes *inside* the domain transaction (transactional outbox), add DB uniqueness so double-meter/double-anchor become *impossible*, and persist `audit()` to a hash-chained append-only `AuditLog`.
- **Safety is enforced in code and at the DB, never in a prompt.** The never-autonomous set is unreachable by the ops runtime's tool surface and least-privilege DB role; governed actions need **two distinct human approvers**; a DB-flag kill-switch halts the fleet out-of-band without a redeploy.

Cut as premature for a pre-seed, ~3-events/day venue: Ollama/local-LLM classifiers, EWMA baselines with no history to learn from, Langfuse/n8n/BullMQ/Redis Streams, pgvector memory, and a six-agent org chart. **Build the intelligence immediately; earn the autonomy deliberately.**

---

## 2. Why now, and what exists today

Designing the operating model in *before* scale is far cheaper than retrofitting it. Current reality in the venue:

| Primitive | State | Implication |
|---|---|---|
| `VenueEventBus` ([events/venue-events.ts](../../apps/assurerail-api/src/events/venue-events.ts)) | in-process, single-instance | a 2nd API node would miss events entirely (DR correctness bug) |
| `EventSinkService` ([platform/event-sink.service.ts](../../apps/assurerail-api/src/platform/event-sink.service.ts)) | fire-and-forget, `.catch(warn)` | `EventLog`/`BillingEvent`/webhook drops are **silent** |
| `audit()` ([common/audit.ts](../../apps/assurerail-api/src/common/audit.ts)) | `console.log` only | no queryable/tamper-evident audit trail — blocks continuous audit |
| Worker / scheduler | **none** | no reconciliation, no sweeps, no self-healing clock |
| `/metrics` ([platform/platform.controllers.ts](../../apps/assurerail-api/src/platform/platform.controllers.ts)) | minimal, `@Public`, full-scans notes | exists but not scraped, no alert rules |
| Adapters (HTS/HCS/settlement/tape) | DEMO/LIVE, fail-closed | LIVE throws until plaza endpoint + testnet smoke test land |

The domain layer is already correct where it matters — `commitMint`/`settleDvp`/`closeNote` are atomic `$transaction`s with guarded `::numeric` balance moves, and `tape/verify.ts` recomputes `tapeHash` for integrity. The *operational* layer around it is what we are building.

---

## 3. The operating model

Three tiers, in order of how much of the load they carry:

1. **Deterministic spine (does ~90%).** A scheduler (the missing clock), a read-only reconciliation/QA/audit engine of pure-SQL invariants, and a liveness sentinel. No LLM. Correctness here is *provable*, not *inferred*.
2. **One earned agent (`OpsTriage`).** Claude, invoked only on a **confirmed** break, to do the thing deterministic code cannot: decide *data bug vs mirror-node lag vs real credit event*, form ranked hypotheses with falsification tests, and draft a plan or proposal. Suggest-only.
3. **Human-gated irreversibility.** A maker-checker choke point. Reversible repairs run from a narrow allowlist; everything governed waits for two distinct humans.

---

## 4. The runtime roster

Five components (not a sprawling agent zoo). Autonomy tier in **bold**.

| Component | Kind | Autonomy | One-line mission |
|---|---|---|---|
| **OpsClock** | deterministic scheduler | **act-autonomous** (non-governed orchestration only) | the venue's absent cron: single leader-lease, drives ticks |
| **IntegrityEngine** | deterministic SQL invariants | **act-with-approval** (one non-value auto-repair) | prove the books tie out; open findings on any break |
| **LivenessSentinel** | deterministic health | **observe** | second-order liveness + the EventLog dead-man's switch |
| **OpsTriage** | **the** agent (Claude) | **suggest** | open-ended resolver: hypotheses, falsification, proposals |
| **RemediationExecutor** + maker-checker | action choke point | **act-with-approval** | the only thing that performs actions; dual-human for governed |

### OpsClock — the missing clock
`@nestjs/schedule` intervals inside `assurerail-api`, holding a **single Postgres advisory-lock leader lease** (fencing-tokened, never zero, never two) so the design is correct the day a second node exists. Drives: the IntegrityEngine sweep, **DEMO-only** surveillance sweeps of ACTIVE Notes missing a current-period mirror, webhook-backlog drains, and an ops heartbeat for the off-box dead-man. Reasons nothing. Surveillance sweeps run **only** when `config.hcsAnchor != live` (because `surveillance.sync` anchors to HCS *and* flips `ISSUED→ACTIVE` — a governed write in LIVE); in LIVE the sweep is proposal-only. All enqueues idempotent, keyed `noteId+period`, and **exclude ops-generated events** to avoid self-observation loops.

### IntegrityEngine — reconciliation, QA & continuous audit in one
Pure TypeScript/SQL re-derivations of code that already exists (`checkKAnon`, supply conservation, `settleDvp`). Runs under a **READ-ONLY DB role**; reconciles against source-of-truth **tables**, never the lossy event stream. The reconciliation + QA + audit-completeness lenses collapse into this single engine (§5). Its **only** autonomous repair is idempotent `EventLog` backfill (non-value, dedup by natural key, **no** webhook re-fire, **no** `BillingEvent` write). It never mutates `Note`/`NoteHolding`/`Dvp`/`BillingEvent` to force a match — value/ledger/governed drift becomes an `OpsFinding` + human proposal, never papered over. External source read failure = **SKIP, never FAIL**.

### LivenessSentinel — health & dead-man's switch
Second-order liveness of the venue and its hard dependencies: Postgres (`SELECT 1` + pool saturation), the AssureLocker tape source (with an **h2-ALPN-downgrade** check — the doctrine requires HTTP/2 to plaza), and — only when the matching adapter is LIVE — the plaza rails. Owns the **EventLog dead-man's switch**: newest `EventLog.createdAt` vs the freshest `MintLog`/`Dvp`/`Note` row — *divergence*, not silence, fires (low volume is normal pre-revenue). Its own liveness is guarded by a genuinely **off-box** dead-man (healthchecks.io / Cronitor) pinged by the OpsClock heartbeat — Alertmanager on the same box cannot detect a box-level failure of itself. Opens findings only; cannot page directly.

### OpsTriage — the one genuinely agentic function (Claude)
On a **confirmed** break it assembles **redacted** context (finding + adjacent `EventLog`/`AuditLog` window, metric snapshot, git SHA / pm2 markers), forms 2–4 ranked hypotheses **each with a falsification test**, runs the read-only tests, then drafts either an allowlisted reversible plan or a governed maker-checker proposal **with a rollback**. Also authors the weekly internal digest. **Executes nothing; cannot approve its own proposal.** Context is redacted by construction (hashes/row-ids only — never raw holder DIDs, tape bodies, or pool data; honours k-anon/DPDP). All untrusted text (log/event/webhook-error/tape strings) is treated as **data, never instructions** (prompt-injection isolation). Pre-flight per-incident token/₹ budget + spend circuit-breaker; a low-N re-identification guard suppresses originator/pool-named narrative below a `k` threshold.

### RemediationExecutor + maker-checker gate
The single choke point that actually performs actions: **(a)** OpsTriage's tiny reversible allowlist after a precondition re-check inside the lease, and **(b)** governed proposals **after two distinct humans approve**. Mirrors AssureLocker's break-glass. Every action written append-only to `AuditLog` under actor `system:tokenco-ops`. Obeys the DB-flag kill-switch checked each tick.

---

## 5. The invariant & check catalog (the deterministic heart)

These are concrete, venue-schema-specific invariants — the actionable core the IntegrityEngine ships. Each becomes an `OpsFinding` on failure. (Deduped from all six lenses.)

**Value & ledger integrity**
- `supply.conservation` — for each ISSUED/ACTIVE Note, `Σ NoteHolding.units == t1Aggregates.mintableMinor`; for REDEEMED, `Σ == 0`. (Value neither created nor destroyed. Note: assert against `mintableMinor`, **not** `serials` — DEMO caps serials at 25 and it is *not* the supply.)
- `mint.burn.symmetry` — `Note.state==REDEEMED` **IFF** `burnTxRef ∧ closeAnchorRef ∧ closeReason ∧ redeemedAt` all set **AND** every `NoteHolding.units=='0'`. A `burnTxRef` on a non-REDEEMED note is a break.
- `holdings.nonnegative` — no `NoteHolding.units < 0` (guarded debit prevents it; this catches rows inserted by raw SQL / manual ops).
- `demo.tokenid.determinism` — while DEMO, `Note.tokenId == 0.0.{1000000 + sha256(tapeHash)[0:8] % 9000000}`; mismatch ⇒ tampered or minted off-path.

**Lifecycle & state machine**
- `state.machine.legal` — `Note.state ∈ {ISSUED,ACTIVE,REDEEMED}`; an ACTIVE note has ≥1 `SurveillanceMirror` (ISSUED→ACTIVE only via first cycle); no `Dvp.createdAt > redeemedAt` on a REDEEMED note.
- `mintlog.note.linkage` — every successful `MintLog` (`kAnonPassed=true`, `htsTxRef` non-empty) has exactly one Note with matching `poolId+tapeHash`; blocked logs (`kAnonPassed=false`) have none.
- `surveillance.freshness` — each ACTIVE note's latest `SurveillanceMirror` period is within cadence and periods are contiguous `YYYY-MM` (surfaces a pool gone dark).
- `ingestedpool.flag` — `IngestedPool.minted==true` **IFF** a Note exists for that `poolId`.

**Projection parity (the fire-and-forget drift)**
- `eventlog.drift` — `count(EventLog note.minted)==count(Note)`, `note.closed==count(REDEEMED)`, `dvp.settled==count(Dvp)`, excluding domain rows younger than the grace window.
- `billing.completeness` — one `BillingEvent` per lifecycle event per type, no duplicates from replays, and each `unitsMinor` matches its domain record.
- `webhook.delivery.drift` — for each lifecycle event × each matching active `WebhookSubscription`, a `WebhookDelivery` exists; `ok=false`/`statusCode≥400` that never later succeeded is undelivered partner state.

**Provenance & anchoring**
- `anchor.presence` — every `Dvp.anchorRef`, `SurveillanceMirror.anchorRef`, and REDEEMED `Note.closeAnchorRef` is a non-empty parseable `topicId#sequenceNumber`. (Mint intentionally has **no** HCS anchor — provenance is `MintLog`+`tapeHash`; flag any code change assuming otherwise.)
- `anchor.uniqueness` — no two distinct events share a `topicId#sequenceNumber` (detects DEMO-adapter payload-hash collisions; same class as `Dvp.settlementRef` collisions).
- `tape.provenance` — re-fetch the source tape per distinct `poolId`, recompute; `tapeHash`+`manifestHash` still match. Changed hash at the **same** `tapeVersion` = **CRITICAL** provenance drift; an advanced `tapeVersion` = INFO re-issue. **Never auto-healed** — pages a human.

**QA gates (property checks on every mint/trade/close)**
- `kanon.nonbypass` — every `MintLog` with `htsTxRef != ''` has `kAnonPassed=true`; and re-running `checkKAnon(t1Aggregates)` per live note still holds (value floor, seasoning ≥90d, concentration ≤5000bps) — flag the known multi-loan-borrower understatement rather than papering it.
- `holder.allowlist` — every `holderDid` and `Dvp.buyerDid ∈ {ISSUER_DID} ∪ (allowlisted+ACTIVE VenueUser.did)`.
- `dvp.atomicity` — every `Dvp` has non-empty `settlementRef` + well-formed `anchorRef`, `buyer ≠ ISSUER_DID`, and the transfer conserves units.

**Audit & segregation of duties**
- `audit.completeness` — every mint/dvp/close/surveillance/breakglass domain record has a matching `AuditLog` row. (Requires persisting `audit()` — the first-slice prerequisite. The check **excludes** `system:tokenco-ops` rows so the checker can't forge what it verifies.)
- `audit.chain` — the `AuditLog` `prevHash→hash` chain is unbroken (detects tampering/deletion).
- `sod.matrix` — no conflicting role pairs; every governed action maps to exactly one human `OpsApproval` with distinct maker/checker; `system:tokenco` never self-approves; every `BreakGlass` has a REGULATOR DID + `lawfulPurpose ≥10` chars + anchor.
- `adapter.mode.sanity` — `HTS_ADAPTER/HCS_ANCHOR/SETTLEMENT_ADAPTER=live` while a rail probe is red, or a half-enabled LIVE flip, is a **P1** — surfaced, never auto-changed.

**Trend & early-warning (proactive — Walk/Run, gated on richer surveillance metrics)**
- `waterfall.trend` — count of non-balanced cycles (`differenceMinor != 0`) week-over-week; balanced→unbalanced is an immediate CONCERN.
- `trigger.headroom` — per ACTIVE note, `delinquency_bps` vs `delinquencyTriggerBps` and `ce_utilisation` vs `ceTriggerPct`, with projected cycles-to-breach; alert when headroom < 2 cycles. *(Needs numeric metrics the current `SurveillanceMirror.verdict` doesn't carry — see open question §11.)*
- `npa.migration` — `classificationBucket` drift STANDARD→SMA_x→NPA across re-reported cycles per originator, a leading credit signal.
- `concentration` — originator (`claId`) HHI, classification mix, vintage-cohort share each rollup; alert on excess single-originator/vintage share.
- `ingest.conversion` — `IngestedPool` rows `minted=false` older than SLA with positive `mintableMinor` = stale pipeline.
- `numbers.pinned` — every figure in the weekly Brief traces to a snapshot field id; unpinned numbers block publish.

---

## 6. Coordination fabric

A **DB-backed blackboard** in the venue's own Postgres (ring-fenced beside `Note`/`MintLog`) — **not** Redis Streams/BullMQ (cut as premature: one process, near-zero concurrency). OpsClock runs as `@nestjs/schedule` intervals; a Postgres advisory lock elects a **single leader** so it's correct the day a second node exists (the active-active DR bug every lens flagged).

Work and observations live in two tables — `OpsFinding` (the shared memory, deduped by `fingerprint = sha256(check|subjectId|window)`, `SUSPECTED→CONFIRMED` promotion) and `OpsApproval` (the maker-checker queue). Handoff is one-directional and safe:

```
deterministic detectors (IntegrityEngine, LivenessSentinel)
      │  open OpsFinding
      ▼
   OpsClock ── routes CONFIRMED/novel ──► OpsTriage (Claude, suggest-only)
                                              │  drafts plan / proposal
                                              ▼
                              RemediationExecutor
                              ├─ reversible allowlist → run (precondition re-check)
                              └─ governed → OpsApproval → wait for TWO humans
```

Reconciliation reads source-of-truth **tables**, never the lossy in-process bus. Dedupe by fingerprint, a **WARN-vs-FAIL** discipline with **suppression-with-expiry** for known-unfixable gaps, and a **maintenance/suppression window** (for migrations and the DEMO→LIVE cutover) prevent alert fatigue in a 1–2 person team. Human-in-loop is the `OpsApproval` queue in the Next app + a single push/Slack channel to the founder (PagerDuty cut). Two out-of-band rails sit **outside** the process: the off-box dead-man, and the DB-flag **kill-switch** (not a governed prod-config change) that drops the fleet to `observe` instantly. Vector memory is deferred until a real incident corpus exists.

---

## 7. Data-model additions

Minimal set (Prisma, `assurerail_venue`):

- **`AuditLog`** — makes `audit()` real: append-only, hash-chained, single-writer/advisory-locked append. `id, actor (system:tokenco | system:tokenco-ops | did:…), event, detail Json (redacted — hashes/row-ids only), noteId?, governed Bool, prevHash, hash, anchorRef? (governed, once LIVE), createdAt`.
- **`OpsFinding`** — the blackboard. `id, source (integrity|sentinel|triage), checkKey, fingerprint (unique-while-open), severity (INFO|WARN|CRITICAL), classification (SUSPECTED|CONFIRMED|BENIGN_LAG|WONTFIX), scopeType (NOTE|POOL|GLOBAL|WEBHOOK|BILLING|LEDGER), scopeRef, observed Json, expected Json, evidenceRefs Json, dataSource (demo|live), hypothesis?, status (OPEN|ACK|PROPOSED|RESOLVED), seenCount, firstSeenAt, resolvedAt?`. (Trend series come from querying this — no separate unbounded per-check timeseries table.)
- **`OpsApproval`** — maker-checker gate mirroring `BreakGlass`. `id, findingId, proposedBy, actionClass (BURN|BREAK_GLASS|LIVE_LEDGER_WRITE|ADAPTER_FLIP|PROD_CONFIG|DESTRUCTIVE_DB|BILLING_ADJUST|WEBHOOK_DISABLE|REVERSIBLE_HEAL), plan Json, rollbackPlan, rationale, status, approverDids Json (≥2 distinct HUMAN DIDs; agent DIDs rejected), decidedAt?, anchorRef?, createdAt`.
- **`OpsControl`** (singleton) — out-of-band control plane. `agentMode (observe|suggest|act), killSwitch Bool, lastSweepAt, lastHeartbeatAt, maintenanceWindowUntil?, updatedBy, updatedAt`. Read each tick; togglable without redeploy.
- **Changes to existing models (transactional outbox + preventive idempotency):** write `EventLog`+`BillingEvent` **inside** the atomic `commitMint`/`settleDvp`/`closeNote` tx (`EventLog` becomes the durable outbox; the sink relays *after* commit). Add `BillingEvent.sourceEventId @unique` (one meter per event), `SurveillanceMirror @@unique(noteId, period)`, `Dvp.settlementRef @unique`. Webhook fan-out carries a **partner idempotency key**.

---

## 8. Safety model

Enforced **in code and at the DB, never in a prompt.**

**Never autonomous (permanent human maker-checker, dual-control; deny-listed in code, absent from every agent's tool surface, cut off by least-privilege DB role):**
- Token **BURN** / note closure (irreversible supply destruction)
- Regulator **BREAK-GLASS** and any T2/PII access
- Any **LIVE ledger write** via plaza — HTS mint/burn, HCS anchor, settlement (incl. `surveillance.sync`'s anchor step when `config.hcsAnchor=live`)
- The **DEMO→LIVE adapter flip** and being the first LIVE write
- Prod config/secret changes; destructive DB ops (TRUNCATE, bulk mutate, schema drift)
- Any **`BillingEvent` write/adjustment** (value/revenue path — not a benign projection)
- Disabling/pausing a partner **webhook subscription** or bulk webhook re-dispatch
- Halting/pausing a lifecycle route (availability-impacting)
- `pm2 restart` **while a mint/DvP/close plaza call is in flight** (torn custodial-write risk)

**Autonomy tiers:**
1. **observe** — read, probe, detect, open findings, narrate. No mutation. *(LivenessSentinel; OpsTriage's read-only falsification tests)*
2. **suggest** — reason over confirmed breaks; draft hypotheses/plans/proposals. Executes nothing; cannot self-approve. *(OpsTriage)*
3. **act-reversible-autonomous** — a **narrow idempotent allowlist** only, each with a tested rollback + precondition re-check inside the lease: idempotent `EventLog` backfill (no webhook/billing side-effect), single webhook re-dispatch with a partner idempotency key, clear own stale lease, DEMO-only re-anchor, guarded `pm2 restart` with in-flight-lifecycle gate + crash-loop breaker (>3/15m → stop+page). Bounded step count then human checkpoint; **one-Note blast radius**. *(OpsClock non-governed ticks; RemediationExecutor allowlist)*
4. **act-with-approval** — governed/irreversible proposals executed **only** after **two distinct human** approvers, tested rollback, and an HCS anchor of the decision once LIVE. Unreachable by tool surface AND blocked by least-privilege DB grants until approved.
5. **never-autonomous** — the list above. A DB-flag kill-switch drops the whole fleet to `observe` out-of-band without a redeploy.

Critically: DEMO-vs-LIVE is today a single `config.hcsAnchor` branch, so the ops runtime is wired to a **hard DEMO-only adapter instance** that no config read can promote.

---

## 9. What we reuse from AssureLocker (don't rebuild)

The sibling app already runs a mature ops stack. The venue borrows patterns, not a fork:

| Need | Reuse | Venue gap to close |
|---|---|---|
| Scheduler model | `setInterval`/`scheduleSafeInterval` + `withJobLock` (skip-if-overrun, in-process lock) in `apps/worker/src/index.ts` | venue has no worker — OpsClock adopts the same skip-if-overrun + advisory-lock discipline |
| Reconciliation template | `reconcileIstOutboxAlerts` (stale/duplicate/decoupled drift heuristics → typed alerts) | IntegrityEngine is the venue analogue over `Note`/`Dvp`/`EventLog` |
| Metrics | `/metrics` convention (venue already mirrors it) | **add an `assurerail-api` scrape job** to `deploy/prometheus/prometheus.hetzner.yml` (none exists) + prom-client HTTP/latency/error histograms |
| Alerting | Prometheus→Alertmanager→**email**, plus `emitWorkerAlert → /internal/fire-webhook → HMAC` | **add venue alert rules** (dependency-down, sink-lag dead-man, no-run, adapter-live-without-smoke-test); no venue rules exist today |
| Dashboards | Grafana provisioning + `code-operations.json` (queue depth, delivery, latency) | add a venue ops dashboard (dependency matrix, findings, sink lag) |
| GRC evidence | worker T-B2 collectors → MinIO; eramba CE (`scripts/grc-eramba-*.sh`); `grc-evidence/` | IntegrityEngine's audit-completeness + `OpsFinding` export become venue control evidence |
| Security agent | **Strix already wired** for the venue (`scripts/assurerail-strix-daily.sh`, egress-free, targets `apps/assurerail-api/src`) + `assurerail-daily-qa.sh` launchd | keep; feed findings into the same ops report |
| Logs/traces | Loki/Promtail/Tempo (`deploy/`) | point Promtail at the venue's structured logs |

*(HostedScan is documented but not yet wired anywhere — treat as planned, not available.)*

---

## 10. Roadmap

**CRAWL (now — weeks, single Hetzner box, ~zero new spend): fix durability, persist the trail, ship read-only intelligence.**
- Persist `audit()` → append-only hash-chained `AuditLog` (single-writer append) — unblocks everything.
- **Transactional outbox**: write `EventLog`+`BillingEvent` inside `commitMint`/`settleDvp`/`closeNote`; relay webhooks after commit — ends the fire-and-forget silent drop.
- Preventive idempotency constraints (`BillingEvent.sourceEventId`, `SurveillanceMirror(noteId,period)`, `Dvp.settlementRef`).
- IntegrityEngine as a read-only `@nestjs/schedule` cron writing `OpsFinding` (the §5 catalog).
- LivenessSentinel + EventLog dead-man's switch; `GET /healthz` + `/readyz`; off-box dead-man ping; `OpsControl` kill-switch row.
- OpsTriage **suggest-only** (Claude): hypotheses + weekly internal digest over confirmed breaks, redacted context, prompt-injection isolation, pre-flight budget.
- Wire `assurerail-api` into Prometheus/Grafana/Loki/Alertmanager; keep the egress-free daily Strix.

**WALK (next — bounded reversible autonomy + maker-checker, still single box).**
- `OpsApproval` queue + endpoints; governed deny-list enforced by tool-surface **and** least-privilege DB role; hard-wired DEMO-only adapter instance for the ops runtime.
- RemediationExecutor's reversible allowlist with tested rollbacks + blast-radius caps.
- **Containerise** `assurerail-api` + `assurerail-web` + Postgres for E2E-migration ease (pm2 as interim supervisor).
- Grafana ops dashboard + Alertmanager routes; WARN/FAIL discipline + suppression-with-expiry + maintenance window.
- Structured `OpsAgentAction` cost/latency logging in Postgres (Langfuse deferred).

**RUN (later — post-seed, LIVE cutover + DR; gated on a real 2nd human checker, the plaza HTS endpoint, and the deferred testnet smoke test).**
- End-to-end act-with-approval with dual-human control + HCS-anchored decisions; **rehearsed governed-action drills** (burn / re-anchor / break-glass) *before* any `adapter=live` flip.
- Ledger-truth reconciliation against the plaza mirror node (with a mirror-lag tolerance window) — built only once LIVE.
- `dataSource(demo|live)` provenance on all findings/metrics so demo history never poisons live trends.
- E2E Networks India active-active DR: single-writer Postgres replication, fencing-tokened leader election, MinIO/S3 for inline `Document` bytes.
- Trend/capacity forecasting + `OpsMemory` recall **only** once real note volume creates statistics worth learning.

---

## 11. First slice (build immediately)

**What:** Ship the durability + audit foundation — persist `audit()` to an append-only hash-chained `AuditLog`, and move `EventLog`+`BillingEvent` writes inside the existing atomic mint/dvp/close transactions (transactional outbox) with preventive idempotency constraints. Smallest change that closes the confirmed silent-drop gap **and** unblocks every downstream check. No agent, no LLM, no new infra — read-model + durability only.

**Files:**
- [prisma/schema.prisma](../../apps/assurerail-api/prisma/schema.prisma) — add `AuditLog`; add `@unique` on `BillingEvent.sourceEventId`, `@@unique(noteId, period)` on `SurveillanceMirror`, `@unique` on `Dvp.settlementRef`; migration.
- [common/audit.ts](../../apps/assurerail-api/src/common/audit.ts) + new `src/store/audit.service.ts` — replace console-only `audit()` with a persisted single-writer append (advisory-locked `prevHash→hash`); keep the console line; add actor `system:tokenco-ops`.
- `src/mint/*`, dvp settlement service, close/redeem service — within the existing `commitMint`/`settleDvp`/`closeNote` tx, write the `EventLog` row (outbox) + `BillingEvent` with `sourceEventId` in the **same** tx.
- [platform/event-sink.service.ts](../../apps/assurerail-api/src/platform/event-sink.service.ts) — change the sink to **relay** the already-durable `EventLog` (dispatch webhooks + confirm metering), idempotent by `sourceEventId`, rather than being the first/only writer.
- [platform/platform.controllers.ts](../../apps/assurerail-api/src/platform/platform.controllers.ts) — add `GET /healthz` + `GET /readyz`.

**Acceptance:**
- Every mint/dvp/close persists a matching `EventLog` row atomically: killing the sink/process immediately after commit loses **no** ops-timeline row (reproduce the old drop, prove it's gone).
- `audit()` rows are append-only with an unbroken `prevHash→hash` chain; a deleted/edited row is detectable; concurrent writes don't fork the chain.
- `BillingEvent` cannot double-meter: a duplicate lifecycle replay hits the `sourceEventId` unique constraint; `SurveillanceMirror`/`Dvp` collision constraints proven by test.
- No new external dependency; DEMO flow unchanged; `npm run build` + `npm run test` green; `bash -n` on edited scripts.
- `/healthz` returns liveness; `/readyz` fails when Postgres is unreachable.

---

## 12. Open questions for the founder

1. **Second human checker.** Dual-control on irreversible actions is a hard requirement, but pre-seed you may be the only operator. Until a second trusted human DID exists, are you comfortable keeping **all** governed actions suggest-only (no autonomous execution at all), even reversible `pm2` restarts?
2. **Egress posture for OpsTriage.** The box runs an egress-free daily Strix scan. Should Claude-backed triage run autonomously **on** the box (needs an Anthropic egress allowance + redaction gate), or only **on-demand from your trusted workstation** so the locked-down box has zero outbound LLM calls?
3. **Trustee/partner-facing comms.** Is the rule "all external-facing output is internal-draft-only until a human forwards" acceptable, or do you want *any* automated external signal to be possible autonomously?
4. **AssureLocker dependency for real forecasting.** Trigger-headroom math needs numeric surveillance metrics (delinquency bps, CE utilisation, per-pool trigger thresholds) the current `SurveillanceMirror.verdict` does **not** carry. Open a dependency ticket to expose those over the surveillance API, or defer credit-trend intelligence until then?
5. **`pm2` restart safety.** The ops module shares one process with mint/burn. Split ops into a separate side process (so "restart ops" isn't ledger-adjacent), or accept human-gated restarts with an in-flight check for now?
6. **Kill-switch reach.** Is a DB-flag kill-switch (admin endpoint) sufficient out-of-band control, or also a filesystem sentinel the runtime reads (so agents stop even if the DB itself is the problem)?
7. **LIVE cutover gating.** Confirm the ordering: no `adapter=live` flip until (a) plaza HTS endpoint lands, (b) the deferred testnet smoke test passes, and (c) governed-action approval drills are rehearsed. Is the deferred HTS smoke test near-roadmap or genuinely parked?

---

*Derived from a 6-lens design + adversarial-critique + synthesis workflow (2026-07-22) grounded in the venue code and the AssureLocker ops infrastructure map. See also the companion [AssureRail Capacity & Load-Testing plan](./AssureRail_Capacity_And_Load_Testing.md).*
