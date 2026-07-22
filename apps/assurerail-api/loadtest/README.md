# AssureRail venue — load-test harness

Performance/capacity tests for `assurerail-api`. Full plan, scenario matrix, SLOs and bottleneck
ranking: [`docs/design/AssureRail_Capacity_And_Load_Testing.md`](../../../docs/design/AssureRail_Capacity_And_Load_Testing.md).

## Golden rules

- **Never run against prod.** Use a dedicated staging venue with its **own** Postgres
  (`assurerail_venue_stg`), all adapters **DEMO** (zero real ledger / AssureLocker egress), and the
  origin bypass header so Cloudflare's WAF/rate-limiter is not under test.
- **Never during a demo-freeze window.**
- The finding is the **server-side** signal, not the k6 percentile — watch `pg_stat_statements`,
  active-vs-max connections, Node event-loop lag, and RSS alongside every run.

## Tests

| File | Phase | What it proves |
|---|---|---|
| `agent-scan.k6.js` | 1 — LOAD (**run first**) | full-scan (`portfolio`/`overview`/`/metrics`) cost grows ~linearly with cumulative note count → justifies SQL-aggregate + cached `/metrics` + pagination. Re-seed 1k → 10k, compare p95. |

Further phases (SOAK w/ black-hole webhook, SPIKE, STRESS/breakpoint, SCALE-OUT integrity ship-gate)
are specified in the capacity doc §6 and land here as they're built.

## Prereqs

- [k6](https://k6.io/) installed.
- A staging venue reachable on its origin `:3006`, seeded (`SEED_ON_BOOT`) to the target note count.
- A **staging** agent `VenueUser` JWT (never a prod token) in `TOKEN`.

## Run

```bash
BASE=http://staging-origin:3006 TOKEN=<staging-jwt> \
  k6 run -o experimental-prometheus-rw apps/assurerail-api/loadtest/agent-scan.k6.js
# then: re-seed staging to 10k notes, re-run, and compare portfolio_ms / overview_ms / metrics_ms p95.
```

The `x-arail-loadtest: 1` header marks synthetic traffic (bypass Cloudflare when hitting the origin
directly; can also be used server-side to exclude load-test requests from billing/metrics later).
