// AssurePool provider adapter. The venue fetches the tape over a versioned HTTP boundary; it does
// not import or execute provider source code. Transport negotiates HTTP/2 over TLS/ALPN where the
// provider supports it. DEMO makes no HTTP call.
import { Agent } from "undici";
import { config } from "../config";
import type { AssurePoolTape } from "./tape.types";
import { buildDemoTape } from "./demo-tape";
import { buildReceivablesDemoTape, isReceivablesPool } from "./receivables-demo-tape";

// HTTP/2-capable dispatcher. allowH2 upgrades the connection to h2 when the server negotiates it.
const h2Dispatcher = new Agent({ allowH2: true });

export async function fetchTape(poolId: string): Promise<AssurePoolTape> {
  if (config.tapeSource === "demo") return isReceivablesPool(poolId) ? buildReceivablesDemoTape(poolId) : buildDemoTape(poolId);
  const url = `${config.tapeProviderApiUrl}/v1/co-lending/pools/${encodeURIComponent(poolId)}/tape.json`;
  const res = await fetch(url, {
    headers: config.tapeProviderApiKey ? { Authorization: `Bearer ${config.tapeProviderApiKey}` } : {},
    // undici extension on Node's global fetch — route via the HTTP/2 dispatcher.
    dispatcher: h2Dispatcher,
  } as RequestInit & { dispatcher: Agent });
  if (!res.ok) throw new Error(`tape fetch failed (${res.status}) from ${url}`);
  return (await res.json()) as AssurePoolTape;
}
