# AssureRail — Capacity Model & Performance-Test Plan

**Status:** Design / planning — buildable now (fixes + first test are concrete). **[July 2026]**
**Scope:** Predict real-world load (human + bot + agentic-AI users, deal volume), derive per-flow cost from the code, rank where the venue breaks first, and give a runnable performance-test programme. Companion to the [Agentic AI Operations architecture](./AssureRail_Agentic_AI_Operations.md).

> **All numbers are illustrative planning ranges, not observed traffic** — the venue is pre-seed with zero live customers. The point is to size *shapes and break-points*, then **measure and revise** (see open questions §11). Framing follows the founder's "don't overclaim" guidance: these are engineering estimates to test against, not commitments.

---

## 1. TL;DR — the load model inverts intuition

**A "deal" (a whole loan pool minted into one `Note`) is a rare, heavy, latency-tolerant write. Writes never bind.** Even the aspirational full-universe (~50 lender logos) case is ~500 mints/month ≈ **0.008 mints/sec** average; add trades, surveillance and closures and total writes stay under ~1.5 QPS.

Capacity is set by two things that scale with **cumulative notes ever minted** and **poll cadence**, *not* deal rate:

1. **Unbounded full-table scans.** `reports.portfolio()`, `/venue/support/overview`, and the **public, unauthenticated `/metrics`** all call `repo.listNotes()` (a `findMany` with no `WHERE`/pagination) and hydrate every row's multi-KB `t1Aggregates` in JS on *every* call/scrape.
2. **DvP hot-row contention.** `settleDvp`'s guarded `::numeric` debit locks the issuer's single `NoteHolding` row for the transaction, so all trades of *one* note serialize (~50–65/s worst case). Different notes don't contend.

**The dominant traffic source is the agentic ops fleet, not humans.** A naive per-note monitor loop at 60 s over ~2,000 notes is `2,000/60 ≈ 33 req/s` of fully-authenticated calls — each paying a `VenueUser` DB read in the auth guard *before* the handler runs. Budget capacity as:

```
RPS ≈ (agent_loops × notes / cadence) + (concurrent_humans × 3 / 30s) + prometheus_scrape_rate
```

**The hard architectural wall is the in-process `VenueEventBus`** ([events/venue-events.ts](../../apps/assurerail-api/src/events/venue-events.ts)) — a Node `EventEmitter` with a single `EventSinkService` subscriber. The instant a second API instance starts, the mint, DvP and close events emitted on instance B never reach the sink on instance A → **~50% of `EventLog`, `BillingEvent` (direct billing/revenue leakage) and webhooks silently vanish.** This is a *correctness* wall, and it blocks the obvious remedy (add an instance) for every CPU bottleneck below.

---

## 2. Scenario matrix

Cumulative notes reconciled across lenses to a defensible ~3-year horizon (one lens' 25k–50k XL was rejected as too aggressive for pre-seed — **measure and revise**).

| Tier | Active logos | Concurrent users | Deals/hr (mints) | Cumulative notes | RPS (avg → peak) | Read:write |
|---|---|---|---|---|---|---|
| **S** — design-partner pilot | 1–3 | 5–10 humans + 1–2 bots + 2–3 agents | <0.1 (~12/mo) | ~50 | **0.7 → 2–3** | ~5,000:1 |
| **M** — early commercial | ~8–10 | 25–50 + ~5 + 5–8 | ~0.3 (~50/mo) | ~300 | **5 → 15–25** | ~8,000:1 |
| **L** — scaled land-and-expand | ~20–30 | 100–200 + 15–25 + 15 | ~1 (~200/mo) | ~2,000 | **20–30 → 80–120** | ~12,000:1 |
| **XL** — full universe + stress | ~50 | 300–500 + 30–50 + 30–40 | ~3 (~500/mo); trade storms 20–65/s on a hot note | ~6,000 (3k–8k) | **50–80 → 300–400** | ~15,000:1 |

**Single-core saturation heuristic:** full-scan endpoints peg one Node core when `notes × scan_RPS ≈ 47,000 hydrations/s` (~15 µs/note proxy — **must be microbenchmarked**). L (~2,000 notes, ~5 scan-RPS) ≈ 22% of a core — comfortable. XL (~6,000 notes, ~15–18 scan-RPS) demands ~1.4 cores from a 1-core process → event-loop lag, p99 in seconds, mint/DvP queued behind scans.

Peak:avg is 3–4× normally (business hours + month-end clustering), **5–6× at quarter-end** when pool formation + a secondary trade rush + monthly surveillance coincide.

---

## 3. Per-flow resource cost (grounded in the code)

| Flow | DB reads | DB writes | Txns | External calls | CPU / crypto | Payload |
|---|---|---|---|---|---|---|
| **TAPE load+verify** (`tape.service`→`verify.ts`) | 0 | 0 | 0 | 1 HTTP/2 GET to AssureLocker (0 in DEMO) | 1 sha256 over FULL tape body + k-anon | 300 KB–2.5 MB in |
| **MINT** (`commitMint` + sink) | ~2 (auth + webhook-subs) | 3 in `$txn` (Note+MintLog+issuer upsert) + 2 async (EventLog+BillingEvent) + N WebhookDelivery | 1 | 1 tape + 1 HTS mint + N webhooks | full-tape sha256 + k-anon O(loans) + N HMAC | 300 KB–2.5 MB in; ~1–2 KB out |
| **DvP TRADE** (`settleDvp` + sink) | ~4 (auth + getNote + getHolding + in-txn findMany) | 3 in `$txn` (guarded `::numeric` debit + buyer upsert + Dvp.create) + 2 sink + N | 1 — **serializes on issuer holding row per note** | 1 settlement + 1 HCS anchor (**both before txn**) + N webhooks | BigInt compare + N HMAC | <5 KB |
| **SURVEILLANCE sync** | ~2 | ~1 upsert/cycle (+1 state flip first time) | per-upsert | 1 fetch + **1 HCS anchor/cycle (serial loop)**; no bus emit | negligible | tens of KB |
| **CLOSURE/burn** (`closeNote` + sink) | ~2 | UPDATE all holdings→0 + Note.update in `$txn` + 2 sink + N | 1 | 1 HTS burn + 1 HCS anchor + N webhooks | N HMAC | <5 KB |
| **READ portfolio / overview** | portfolio: auth + **listNotes FULL SCAN**; overview: **scan + 3 counts in 4-way Promise.all (4 conns)** | 0 | 0 | 0 | JS map/reduce over ALL notes O(N) | grows with note count |
| **READ /metrics** (`@Public`) | **listNotes FULL SCAN, no auth, per scrape** | 0 | 0 | 0 | JS map over ALL notes every 15 s | tiny response; scan cost in DB+CPU |
| **EVENT SINK** (per event) | 1 (active subs) | 1 EventLog + 0–1 BillingEvent + N WebhookDelivery | 0 | **N webhook POSTs serial, 5 s timeout each** | 1 HMAC/subscriber | <2 KB/POST |
| **AUTH** (every non-public req) | 1 (VenueUser resolve; **no cache**) | 0–1 (first-login upsert) | 0 | 0 (Firebase verify = local CPU) | 1 JWT verify | <1 KB |

**Writes are cheap and rare by design** — the expensive tape fetch, sha256 and HTS mint all happen *before* the `$transaction` opens, so no row lock is held across network I/O. **Two costs scale with the wrong variable:** the three full-scan read paths (proportional to cumulative notes × scrape/poll rate), and the per-request uncached `VenueUser` read (so DB QPS ≥ RPS even for pure reads — and the agent fleet multiplies it).

---

## 4. Bottleneck ranking (breaks first → last)

1. **In-process `VenueEventBus` + single-subscriber sink** — breaks *the instant a 2nd API instance starts*. A **correctness** wall, not throughput; ranked #1 because it blocks scaling out of every CPU bottleneck below. **Fix:** move bus + sink onto Redis pub/sub or BullMQ (reuse AssureLocker's `ioredis` + 4-queue stack). Until then `assurerail-api` **must stay `instances=1`**.
2. **Full-table scans** on `portfolio()`, `overview()`, public `/metrics` — breaks L→XL (~5k notes @ ~9 scan-RPS). `/metrics` unauth = also a DoS surface. **Fix:** `SELECT state, count(*) … GROUP BY` + a `SUM` over a stored numeric column; cache `/metrics` 30–60 s (or a sink-maintained counter); paginate + column-project `portfolio`/`/venue/notes` (drop `t1Aggregates` from list views); covering index `Note(state)`; route scans to a read replica. **Highest ROI, zero new hardware.**
3. **Inline serial webhook dispatch** (`webhooks.service.ts` — `for`-loop of `fetch` w/ 5 s timeout, no queue/backoff/cap) — breaks M onward once ≥1 partner is slow/down and events burst; in-flight fetches/sockets/RSS accumulate unboundedly. **Fix:** BullMQ queue, bounded concurrency, per-target circuit breaker, backoff + DLQ; remove inline fetch from the sink path.
4. **DvP hot-row serialization** (`settleDvp` guarded `::numeric` UPDATE) — ceiling ~50–65 trades/s on **one** note; cross-note doesn't contend. **Fix:** keep it (it's the oversell guarantee); add `lock_timeout`/`statement_timeout` + bounded retry; publish a per-hot-note ceiling; per-note in-app queue only if a marquee note demands more.
5. **Prisma default pool** (~9–17) on one client, Postgres shared with AssureLocker's 6 apps — breaks M→L under burst (`overview`'s 4-way `Promise.all` = 4 conns/req; agent fleet ~30 conns at XL) → P2024 timeouts cascading 500s. **Fix:** set `connection_limit` explicitly (currently absent); PgBouncer (transaction mode) *before* any 2nd instance; short-TTL LRU cache of `VenueUser` in the auth guard; narrow `overview`'s fan-out.
6. **Unbounded `EventLog`/`BillingEvent`/`WebhookDelivery` growth** + `overview`'s `count()` — breaks over months of L/XL. **Fix:** monthly partitioning + 90–180 d hot-window retention; approximate counts (`pg_class.reltuples`) or a maintained counter.
7. **Synchronous surveillance reconciliation** (serial per-cycle HCS anchor + upsert) — L/XL monthly batch = 12k–60k serial HCS calls, a self-inflicted DoS. **Fix:** rate-limited BullMQ background jobs, never synchronous.
8. **Single pm2 process + shared box** — API breaks at a few hundred mixed RPS (far lower once scans dominate); an AssureLocker mint storm starves the venue's one core. **Fix:** fix the bus first, then pm2-cluster; cluster the web tier now (no in-process bus there); migrate off the shared box to E2E India.

---

## 5. SLOs (targets to test against)

| Endpoint class | p95 target | Error budget |
|---|---|---|
| MINT (end-to-end) | DEMO <300 ms; LIVE <2.5 s (tape h2 + HTS dominate; DB-txn <100 ms); p99 <5 s | <0.1% 5xx |
| DvP settle (distinct notes) | DEMO <400 ms; LIVE <1.5 s; hot-note may degrade — track lock-wait separately | <0.1% 5xx; **never** oversell/negative |
| CLOSURE/burn | DEMO <400 ms; LIVE <2.5 s | <0.1% 5xx |
| Read — single-note (item, holdings, report, CSV) | <300 ms from cache/replica | <0.5% |
| Read — full-scan (portfolio, overview) | <500 ms and **independent of note count after de-scan** | <0.5% |
| `/metrics` (public scrape) | <100 ms and **O(1) in note count** (needs aggregate + cache); rate-limited or authed | <0.1% |
| Event-sink completeness | lag p95 <2 s; **100%** of lifecycle events → EventLog + BillingEvent, zero loss across **all** instances (violated the instant `instances>1` with the in-process bus) | **0% billing loss (hard)** |
| Webhook delivery (post-queue) | 99% within 30 s; a dead partner must not raise write-path p95 | ≥99% within 3 retries |
| Prisma pool | utilisation <70% at p95 | P2024 <0.1% (rising = early warning) |
| Availability | 99.5% at S/M (single-process risk acknowledged); 99.9% at L/XL behind LB + replica + DR | 0.5% / 0.1% monthly |

---

## 6. Performance-test programme (k6)

**Tooling:** k6 — open-model arrival-rate executors (models poll cadence honestly, unlike closed VU loops), Prometheus remote-write for correlation, scriptable in CI. Run against a **staging/DEMO venue** (all adapters DEMO, own Postgres, origin-direct bypassing Cloudflare), and watch **server-side signals** (`pg_stat_statements`, `pg_locks`, pool utilisation, event-loop lag, RSS) — those name which bottleneck bit, not the k6 percentile.

| Phase | Type | Scenario | Pass gate |
|---|---|---|---|
| **0** | SMOKE (CI, every PR) | one of each lifecycle op in sequence on DEMO; assert EventLog + BillingEvent counts == emitted + every webhook delivered | all checks pass, 0 unexpected 5xx, counts exact at `instances=1` |
| **1** | LOAD (steady peak/tier) | hold avg→peak mixed RPS (~70% read / 20% dvp / 8% mint / 2% close) for 30 min at 1k/10k/50k seeded notes | per-class p95 SLOs hold; write err <0.1%, read <0.5%; pool-timeout <0.1%; M-peak holds on **one** instance |
| **2** | SOAK (2–4 h) | M load + a **black-hole webhook** (toxiproxy / 6 s-sleep sink), 1 healthy + 1 slow + 1 dead | flat RSS + socket count; mint/dvp p95 **unchanged** by the dead webhook; EventLog/billing 100% |
| **3** | SPIKE (month/quarter-end) | 8–12 mints in one hour + trade rush + surveillance batch (the coincidence case) | graceful degradation (queue, not crash); recovery to baseline within 2 min |
| **4** | STRESS / BREAKPOINT | (a) read fan-out: ramp scan-RPS at 1k/5k/10k/50k until p99>1s — validate the `47,000/s` formula and that the de-scan fix pushes the knee out >10×; (b) hot-note DvP: many VUs → one `noteId`; (c) pool exhaustion: constant `overview` until P2024 | record RPS at first breach = single-instance ceiling (confirm >2× M-peak); confirm hot-note ~50–65/s; confirm `connection_limit`+PgBouncer raise the pool knee |
| **5** | SCALE-OUT INTEGRITY (**ship-gate**) | a fixed set of mint, DvP and close events at `instances=1` then `instances=2`; assert EventLog+BillingEvent == emitted | `instances=1` = 100%. `instances=2` with the **in-process bus is expected to drop ~50%** — this proves the bus is broken for scale-out and must pass 100% only **after** the Redis-bus migration |

---

## 7. First test to run (the one the "deals/hour" model would miss)

**What:** the agentic-fleet **read-scan growth** test (phase-1 LOAD), run at **1k then 10k** seeded notes — full-scans on portfolio/overview/metrics are the dominant, data-proportional bottleneck, and this simultaneously exercises the auth-guard `VenueUser` read on every call and the public `/metrics` scan. The **delta between 1k and 10k is the finding.**

**How (safely):** a dedicated staging venue on a box **separate from prod** (not the shared Hetzner prod path, not during a demo-freeze): its own `assurerail_venue_stg` Postgres (**never** prod), all adapters DEMO (zero real ledger/AssureLocker egress), `SEED_ON_BOOT` to 1,000 then 10,000 varied notes. Run k6 from the same VPC hitting the **origin directly** on `:3006` with a bypass header so Cloudflare's WAF/rate-limiter isn't under test. Export k6 → Prometheus/Grafana; simultaneously watch `pg_stat_statements`, active-vs-max connections, event-loop lag, RSS.

The runnable script lives at [apps/assurerail-api/loadtest/agent-scan.k6.js](../../apps/assurerail-api/loadtest/agent-scan.k6.js) (see [loadtest/README.md](../../apps/assurerail-api/loadtest/README.md)). Expected result: p95 grows ~linearly with note count → justifies SQL-aggregate + cached `/metrics` + pagination.

---

## 8. Provisioning by tier

| Tier | API | Postgres | Web | Notes |
|---|---|---|---|---|
| **S** | 1 pm2 inst, 1–2 vCPU / 1–2 GB (single-instance is **correct** — in-process bus) | shared; **set `connection_limit` explicitly to 5–10** | 1 inst, 0.5–1 vCPU | fits the existing box; no Redis needed; still fix the full scans |
| **M** | 1 inst, 2 vCPU / 2 GB | 2 vCPU / 4–8 GB, `max_connections` 150–200, pool 10–15; PgBouncer optional | 1 inst, 1 vCPU | **introduce Redis+BullMQ now** (to become 2nd-instance-ready, not for load); ~30–50 GB/mo egress cached |
| **L** | **2 inst** × 2 vCPU / 4 GB behind LB — **requires the Redis-bus migration done first** | 4 vCPU / 16 GB + **1 read replica** (route scans there); PgBouncer txn mode; pool 15–20/inst | 2 inst × 1 vCPU (cluster freely) | ship de-scan fixes **before** the 2nd instance; queue the monthly reconciliation; add idempotency keys to mint/DvP |
| **XL** | **3–4 inst** × 4 vCPU / 8 GB + a dedicated webhook worker pool | 8 vCPU / 32 GB + 1–2 replicas; PgBouncer mandatory; EventLog/WebhookDelivery partitioning + retention; materialized counters | 3–4 inst × 2 vCPU + Cloudflare/ISR | unreachable without **all** prerequisites; on E2E India give the venue its **own** Postgres + shared Redis + MinIO/S3 for `Document` bytes; headroom 5–10× avg peak |

---

## 9. Sequenced fixes (highest ROI first)

1. **De-scan the reads** — SQL aggregate for `/metrics` + `overview`, cache `/metrics` 30–60 s, paginate/project `portfolio`. *No new hardware; removes the dominant bottleneck; also closes the unauthenticated `/metrics` DoS surface.*
2. **Tune Postgres access** — explicit `connection_limit`, PgBouncer, `VenueUser` auth-cache.
3. **Move bus + sink + webhooks to Redis/queue** — unblocks horizontal scale and stops the silent event/billing loss the moment you'd otherwise add an instance.
4. **Then** run 2+ API instances behind Caddy, add a read replica, partition the log tables.

Fixes 1–2 need no new hardware and are worth doing at S. Fix 3 is a *correctness prerequisite* for any scale-out and pairs directly with the ops-doc first slice (transactional outbox makes `EventLog` durable; the Redis bus makes it multi-instance).

---

## 10. Security note surfaced by this analysis

`/metrics` is `@Public()` and runs a full `listNotes()` scan **per scrape** — both a scaling bottleneck **and** a trivial unauthenticated DoS amplifier (an attacker can force repeated full scans with no credentials). Folding the aggregate-count + cache fix (or gating/rate-limiting the endpoint) closes both at once. Tracked as a `P1` `adapter/config` finding in the ops IntegrityEngine catalog.

---

## 11. Open questions for the founder (measure these — they move the model most)

1. **Real cumulative-note trajectory** (3k–8k vs 25k–50k at "XL") — sets the full-scan ceiling and the replica/partitioning timeline. **Highest-leverage unknown.** Decide a planning horizon (18 mo? 3 yr?) and pools/month/logo.
2. **Actual `t1Aggregates` size + `listNotes` hydration cost on real tapes** — every break formula scales with the ~15 µs/note and ~1–3 KB/note proxies. Microbenchmark before trusting any threshold.
3. **Will the ops fleet poll per-note or via a changed-since delta endpoint?** A naive 60 s per-note loop *is* the scaling denominator; a delta cursor collapses L/XL RPS by an order of magnitude. (Design decision you control — and it ties directly to the ops-doc's OpsClock.)
4. **Webhook subscribers per event + their real latency/reliability** — determines sink pile-up risk and whether the Redis queue is urgent at M or can wait to L.
5. **DEMO→LIVE timing + real plaza/AssureLocker/HTS/HCS latencies** — all write-path p95 budgets are DEMO today; LIVE adds 100–500 ms/call. Re-baseline once live.
6. **E2E India sizing + own-vs-shared Postgres** — the pool/`max_connections` math depends entirely on this; shared substrate = a much earlier ceiling.
7. **Secondary-market shape** — will any single note become "hot"? If yes, the ~50–65 trades/s single-note ceiling matters (per-note queue); if trading spreads across notes, it never binds.
8. **Gate/authenticate `/metrics`?** — a small but security-relevant call (see §10).
9. **Retention for `EventLog`/`BillingEvent`/`WebhookDelivery`** — a hot-window (90–180 d) + partitioning decision needed before L; interacts with billing/audit compliance you must state.

---

*Derived from a 5-lens capacity-analysis + synthesis workflow (2026-07-22) grounded in the venue code. Companion to the [Agentic AI Operations architecture](./AssureRail_Agentic_AI_Operations.md); both independently identified the fire-and-forget sink + in-process bus as the top structural issues.*
