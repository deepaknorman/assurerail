// The runtime coupling to AssureLocker (the TSP): the venue fetches the tape over HTTP — same-repo,
// still API-coupled (exactly like apps/api ↔ apps/plaza-api). Transport is HTTP/2, not 1.1: h2 is
// negotiated over TLS/ALPN in production (the reverse proxy must offer h2); DEMO makes no HTTP call.
import { Agent } from "undici";
import { config } from "../config";
import type { AssurePoolTape } from "./tape.types";
import { buildDemoTape } from "./demo-tape";
import { buildReceivablesDemoTape, isReceivablesPool } from "./receivables-demo-tape";

// HTTP/2-capable dispatcher. allowH2 upgrades the connection to h2 when the server negotiates it.
const h2Dispatcher = new Agent({ allowH2: true });

export async function fetchTape(poolId: string): Promise<AssurePoolTape> {
  if (config.tapeSource === "demo") return isReceivablesPool(poolId) ? buildReceivablesDemoTape(poolId) : buildDemoTape(poolId);
  const url = `${config.assureLockerApiUrl}/v1/co-lending/pools/${encodeURIComponent(poolId)}/tape.json`;
  const res = await fetch(url, {
    headers: config.assureLockerApiKey ? { Authorization: `Bearer ${config.assureLockerApiKey}` } : {},
    // undici extension on Node's global fetch — route via the HTTP/2 dispatcher.
    dispatcher: h2Dispatcher,
  } as RequestInit & { dispatcher: Agent });
  if (!res.ok) throw new Error(`tape fetch failed (${res.status}) from ${url}`);
  return (await res.json()) as AssurePoolTape;
}
