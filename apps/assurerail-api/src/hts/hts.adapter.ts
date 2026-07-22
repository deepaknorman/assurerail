// The mint rail. DEMO fakes a TokenId/serials deterministically (no testnet, no operator account).
// LIVE calls plaza's HTS endpoint (the Hedera operator lives in plaza — the venue holds no ledger
// keys); fail-closed until that endpoint exists AND the deferred live testnet smoke test passes.
import { createHash, randomBytes } from "node:crypto";
import { config } from "../config";

export interface MintResult {
  tokenId: string;
  serials: number[];
  adapter: "DEMO" | "LIVE";
}

export interface BurnResult {
  tokenId: string;
  burnedSerials: number[];
  txRef: string;
  adapter: "DEMO" | "LIVE";
}

export interface HtsAdapter {
  readonly mode: "DEMO" | "LIVE";
  mint(tapeHash: string, units: number): Promise<MintResult>;
  /** Retire the Note's tokens on closure/redemption (supply → 0) — the mirror of mint. */
  burn(tokenId: string, serials: number[]): Promise<BurnResult>;
  /** Retire a PARTIAL amount of supply (by value) on amortisation — supply decreases by amountMinor. */
  burnAmount(tokenId: string, amountMinor: string): Promise<BurnResult>;
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
  async burn(tokenId: string, serials: number[]): Promise<BurnResult> {
    const h = createHash("sha256").update(`${tokenId}:burn:${serials.join(",")}`).digest("hex");
    return { tokenId, burnedSerials: serials, txRef: `0.0.0@burn-${h.slice(0, 12)}`, adapter: "DEMO" };
  }
  async burnAmount(tokenId: string, amountMinor: string): Promise<BurnResult> {
    // Partial (value) burn — no specific serials retired in the value model; a unique tx ref per burn.
    const nonce = randomBytes(6).toString("hex");
    const h = createHash("sha256").update(`${tokenId}:amort:${amountMinor}:${nonce}`).digest("hex");
    return { tokenId, burnedSerials: [], txRef: `0.0.0@amort-${h.slice(0, 12)}`, adapter: "DEMO" };
  }
}

export class LiveHtsAdapter implements HtsAdapter {
  readonly mode = "LIVE" as const;
  async mint(): Promise<MintResult> {
    // TODO(2c/T3-live): POST to plaza's HTS endpoint (TokenCreate + TokenMint on the operator client).
    throw new Error("LIVE HTS not enabled — plaza HTS endpoint + testnet smoke test pending (HTS_ADAPTER=live blocked)");
  }
  async burn(): Promise<BurnResult> {
    // TODO(T3-live): POST to plaza's HTS TokenBurn on the operator client.
    throw new Error("LIVE HTS burn not enabled — plaza HTS endpoint + testnet smoke test pending");
  }
  async burnAmount(): Promise<BurnResult> {
    // TODO(T3-live): POST to plaza's HTS TokenBurn (partial amount) on the operator client.
    throw new Error("LIVE HTS partial burn not enabled — plaza HTS endpoint + testnet smoke test pending");
  }
}

export function selectHtsAdapter(): HtsAdapter {
  return config.htsAdapter === "live" ? new LiveHtsAdapter() : new DemoHtsAdapter();
}
