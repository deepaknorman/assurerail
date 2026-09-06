// The settlement leg of atomic DvP. The token is a PARAMETER (e₹ domestic; FCY for GIFT later) and
// the adapter isolates it. The venue OPERATES the swap but holds neither leg → no custody/payment
// licence (§11.4). DEMO simulates the transfer; LIVE calls a deployment-selected settlement
// provider through a distinct endpoint and credential (fail-closed until certified and activated).
import { createHash, randomBytes } from "node:crypto";
import { Agent } from "undici";
import { config } from "../config";

export interface SettlementResult {
  settlementRef: string;
  token: string;
  amountMinor: string;
  adapter: "DEMO" | "LIVE";
}

export interface SettlementAdapter {
  readonly mode: "DEMO" | "LIVE";
  settle(fromDid: string, toDid: string, amountMinor: string, token: string): Promise<SettlementResult>;
}

export class DemoSettlementAdapter implements SettlementAdapter {
  readonly mode = "DEMO" as const;
  async settle(fromDid: string, toDid: string, amountMinor: string, token: string): Promise<SettlementResult> {
    // A settlement reference is unique PER settlement (as in a real rail) — include a nonce so two
    // otherwise-identical trades (same buyer/seller/amount/token) don't collide. This makes the
    // Dvp.settlementRef @unique integrity check meaningful instead of a false-collision trap.
    const nonce = randomBytes(8).toString("hex");
    const ref = createHash("sha256").update(`${fromDid}|${toDid}|${amountMinor}|${token}|${nonce}`).digest("hex").slice(0, 16);
    return { settlementRef: `settle_${ref}`, token, amountMinor, adapter: "DEMO" };
  }
}

const h2Dispatcher = new Agent({ allowH2: true });

export class LiveSettlementAdapter implements SettlementAdapter {
  readonly mode = "LIVE" as const;
  async settle(fromDid: string, toDid: string, amountMinor: string, token: string): Promise<SettlementResult> {
    const url = new URL(config.settlementProviderTransferPath, `${config.settlementProviderApiUrl}/`);
    const res = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json", ...(config.settlementProviderApiKey ? { Authorization: `Bearer ${config.settlementProviderApiKey}` } : {}) },
      body: JSON.stringify({ fromDid, toDid, amountMinor, token }),
      dispatcher: h2Dispatcher,
    } as RequestInit & { dispatcher: Agent });
    if (!res.ok) throw new Error(`settlement provider failed (${res.status})`);
    const j = (await res.json()) as { settlementRef?: string };
    return { settlementRef: j.settlementRef ?? "", token, amountMinor, adapter: "LIVE" };
  }
}

export function selectSettlementAdapter(): SettlementAdapter {
  if (config.settlementAdapter === "live") return new LiveSettlementAdapter();
  if (config.settlementAdapter === "demo") return new DemoSettlementAdapter();
  throw new Error("settlement adapter is off for this deployment");
}
