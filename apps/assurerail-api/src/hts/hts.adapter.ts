// The mint rail. DEMO fakes a TokenId/serials deterministically (no testnet, no operator account).
// LIVE calls plaza's HTS endpoint (the Hedera operator lives in plaza — the venue holds no ledger
// keys); fail-closed until that endpoint exists AND the deferred live testnet smoke test passes.
import { createHash } from "node:crypto";
import { config } from "../config";

export interface MintResult {
  tokenId: string;
  serials: number[];
  adapter: "DEMO" | "LIVE";
}

export interface HtsAdapter {
  readonly mode: "DEMO" | "LIVE";
  mint(tapeHash: string, units: number): Promise<MintResult>;
}

/** Deterministic from the tapeHash — the same tape always mints the same demo TokenId (stable demos). */
export class DemoHtsAdapter implements HtsAdapter {
  readonly mode = "DEMO" as const;
  async mint(tapeHash: string, units: number): Promise<MintResult> {
    const h = createHash("sha256").update(tapeHash).digest("hex");
    const tokenNum = 1_000_000 + (parseInt(h.slice(0, 8), 16) % 9_000_000);
    const serials = Array.from({ length: Math.max(1, Math.min(units, 25)) }, (_, i) => i + 1);
    return { tokenId: `0.0.${tokenNum}`, serials, adapter: "DEMO" };
  }
}

export class LiveHtsAdapter implements HtsAdapter {
  readonly mode = "LIVE" as const;
  async mint(): Promise<MintResult> {
    // TODO(2c/T3-live): POST to plaza's HTS endpoint (TokenCreate + TokenMint on the operator client).
    throw new Error("LIVE HTS not enabled — plaza HTS endpoint + testnet smoke test pending (HTS_ADAPTER=live blocked)");
  }
}

export function selectHtsAdapter(): HtsAdapter {
  return config.htsAdapter === "live" ? new LiveHtsAdapter() : new DemoHtsAdapter();
}
