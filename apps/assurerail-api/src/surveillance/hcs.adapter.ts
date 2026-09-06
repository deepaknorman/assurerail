// Anchors a surveillance verdict to HCS via plaza (the Hedera operator lives in plaza — the venue
// holds no ledger keys). DEMO fakes a deterministic topic/sequence from the payload hash; LIVE calls
// plaza's HCS submit endpoint (fail-closed until wired + smoke-tested).
import { createHash } from "node:crypto";
import { Agent } from "undici";
import { config } from "../config";

export interface AnchorResult {
  topicId: string;
  sequenceNumber: string;
  adapter: "DEMO" | "LIVE";
}

export interface HcsAdapter {
  readonly mode: "DEMO" | "LIVE";
  anchor(payload: unknown): Promise<AnchorResult>;
}

const hashPayload = (payload: unknown): string => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export class DemoHcsAdapter implements HcsAdapter {
  readonly mode = "DEMO" as const;
  async anchor(payload: unknown): Promise<AnchorResult> {
    const h = hashPayload(payload);
    const topicNum = 100_000 + (parseInt(h.slice(0, 6), 16) % 900_000);
    const seq = (parseInt(h.slice(6, 14), 16) % 100_000).toString();
    return { topicId: `0.0.${topicNum}`, sequenceNumber: seq, adapter: "DEMO" };
  }
}

const h2Dispatcher = new Agent({ allowH2: true });

export class LiveHcsAdapter implements HcsAdapter {
  readonly mode = "LIVE" as const;
  async anchor(payload: unknown): Promise<AnchorResult> {
    // TODO(2c-live): POST to plaza's HCS submit endpoint; return the real topicId + sequenceNumber.
    const url = `${config.anchorProviderApiUrl}/internal/hcs/submit`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.anchorProviderApiKey ? { Authorization: `Bearer ${config.anchorProviderApiKey}` } : {}) },
      body: JSON.stringify({ message: hashPayload(payload) }),
      dispatcher: h2Dispatcher,
    } as RequestInit & { dispatcher: Agent });
    if (!res.ok) throw new Error(`plaza HCS anchor failed (${res.status})`);
    const j = (await res.json()) as { topicId?: string; sequenceNumber?: string };
    return { topicId: j.topicId ?? "", sequenceNumber: j.sequenceNumber ?? "", adapter: "LIVE" };
  }
}

export function selectHcsAdapter(): HcsAdapter {
  return config.hcsAnchor === "live" ? new LiveHcsAdapter() : new DemoHcsAdapter();
}
