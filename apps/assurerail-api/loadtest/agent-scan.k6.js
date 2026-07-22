// AssureRail — "agentic-fleet read-scan growth" load test (the first test to run).
//
// WHY THIS ONE FIRST: full-table scans on portfolio(), /venue/support/overview and the PUBLIC
// /metrics endpoint (all call repo.listNotes() unpaginated) are the venue's dominant, DATA-PROPORTIONAL
// bottleneck — the one a naive "deals/hour" model never surfaces. This test drives those three paths
// under agent-poll + human-refresh + Prometheus-scrape load, so the p95 delta between 1k and 10k seeded
// notes IS the finding (expected ~linear growth → justifies SQL-aggregate + cached /metrics + pagination).
//
// SAFETY — run ONLY against a dedicated STAGING/DEMO venue, never prod, never during a demo-freeze:
//   - its OWN Postgres (assurerail_venue_stg), NEVER the prod DB
//   - all adapters DEMO (TAPE_SOURCE/HTS_ADAPTER/HCS_ANCHOR=demo + demo settlement) → zero real
//     ledger / AssureLocker egress
//   - SEED_ON_BOOT to 1,000 then 10,000 varied notes+holdings (re-seed and re-run; compare)
//   - hit the ORIGIN directly on :3006 with the bypass header so Cloudflare's WAF/rate-limiter is not
//     under test and no prod protection is tripped
//
// RUN:
//   BASE=http://staging-origin:3006 TOKEN=<staging agent VenueUser JWT> \
//     k6 run -o experimental-prometheus-rw apps/assurerail-api/loadtest/agent-scan.k6.js
//   # then re-seed staging to 10k notes and re-run; compare portfolio_ms / overview_ms / metrics_ms p95.
//
// WATCH SERVER-SIDE (these name the bottleneck, not the k6 percentile): pg_stat_statements (which query
// dominates), active-vs-max connections (pool saturation), Node event-loop lag, and RSS.

import http from "k6/http";
import { check } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE || "http://staging-origin:3006";
const TOKEN = __ENV.TOKEN; // a staging agent VenueUser JWT (never a prod token)
const H = { headers: { Authorization: `Bearer ${TOKEN}`, "x-arail-loadtest": "1" } };

const portfolio = new Trend("portfolio_ms", true);
const overview = new Trend("overview_ms", true);
const metrics = new Trend("metrics_ms", true);

export const options = {
  scenarios: {
    // agentic fleet: per-note-ish poll cadence hitting the two authenticated full-scan endpoints
    agents: { executor: "constant-arrival-rate", rate: 15, timeUnit: "1s", duration: "10m", preAllocatedVUs: 60, exec: "agentPoll" },
    // prometheus: /metrics is PUBLIC (no auth) — a full scan per scrape
    prometheus: { executor: "constant-arrival-rate", rate: 1, timeUnit: "15s", duration: "10m", preAllocatedVUs: 2, exec: "scrape" },
    // humans: dashboard auto-refresh, ~3 reads / 30s
    humans: { executor: "ramping-vus", exec: "humanRefresh", stages: [{ target: 40, duration: "2m" }, { target: 40, duration: "6m" }, { target: 0, duration: "2m" }] },
  },
  thresholds: {
    portfolio_ms: ["p(95)<800"], // pre-fix gate at 1k notes; EXPECTED to breach at 10k → proves the case
    overview_ms: ["p(95)<800"],
    metrics_ms: ["p(95)<200"],
    http_req_failed: ["rate<0.01"],
  },
};

export function agentPoll() {
  const r1 = http.get(`${BASE}/venue/reports/portfolio`, H);
  portfolio.add(r1.timings.duration);
  const r2 = http.get(`${BASE}/venue/support/overview`, H);
  overview.add(r2.timings.duration);
  check(r1, { "portfolio 200": (x) => x.status === 200 });
  check(r2, { "overview 200": (x) => x.status === 200 });
}

export function scrape() {
  const r = http.get(`${BASE}/metrics`); // PUBLIC, unauthenticated — the DoS-amplifying full scan
  metrics.add(r.timings.duration);
  check(r, { "metrics 200": (x) => x.status === 200 });
}

export function humanRefresh() {
  http.get(`${BASE}/venue/support/overview`, H);
  http.get(`${BASE}/venue/notes`, H);
  http.get(`${BASE}/venue/reports/portfolio`, H);
}
