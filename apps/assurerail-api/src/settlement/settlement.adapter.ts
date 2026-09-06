// The settlement leg of atomic DvP. The token is a PARAMETER (e₹ domestic; FCY for GIFT later) and
// the adapter isolates it. The venue OPERATES the swap but holds neither leg → no custody/payment
// licence (§11.4). DEMO simulates the settlement-token transfer; LIVE calls plaza's settlement/e₹
// rail (fail-closed until wired).
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
    // TODO(T4-live): call plaza's settlement adapter (ISettlementAdapter / e₹) for the atomic leg.
    const url = `${config.settlementProviderApiUrl}/internal/settlement/transfer`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.settlementProviderApiKey ? { Authorization: `Bearer ${config.settlementProviderApiKey}` } : {}) },
      body: JSON.stringify({ fromDid, toDid, amountMinor, token }),
      dispatcher: h2Dispatcher,
    } as RequestInit & { dispatcher: Agent });
    if (!res.ok) throw new Error(`plaza settlement failed (${res.status})`);
    const j = (await res.json()) as { settlementRef?: string };
    return { settlementRef: j.settlementRef ?? "", token, amountMinor, adapter: "LIVE" };
  }
}

export function selectSettlementAdapter(): SettlementAdapter {
  return config.settlementAdapter === "live" ? new LiveSettlementAdapter() : new DemoSettlementAdapter();
}
