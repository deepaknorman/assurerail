// Optional AssurePool-profile surveillance adapter. DEMO returns a synthetic snapshot. The
// configured provider owns its facts; Rail retains received evidence and does not make this adapter
// a generic route dependency.
import { Agent } from "undici";
import { config } from "../config";

export interface SurveillanceCycle {
  period: string; // YYYY-MM
  waterfall: { balanced: boolean; differenceMinor: string };
  triggers: Array<{ trigger: string; state: string; detail?: string }>;
  problems: string[];
}
export interface PoolSurveillance {
  poolStatus: string;
  cycles: SurveillanceCycle[];
  periodGaps: string[];
  ok: boolean;
}

const h2Dispatcher = new Agent({ allowH2: true });

export async function fetchSurveillance(poolId: string): Promise<PoolSurveillance> {
  if (config.tapeSource === "demo") {
    return {
      poolStatus: "HEALTHY",
      ok: true,
      periodGaps: [],
      cycles: [
        { period: "2026-07", waterfall: { balanced: true, differenceMinor: "0" }, triggers: [{ trigger: "CE_UTILISATION", state: "OK" }], problems: [] },
        { period: "2026-08", waterfall: { balanced: true, differenceMinor: "0" }, triggers: [{ trigger: "CE_UTILISATION", state: "OK" }], problems: [] },
      ],
    };
  }
  if (config.tapeSource === "off") throw new Error("AssurePool-profile surveillance adapter is off for this deployment");
  const url = `${config.tapeProviderApiUrl}/v1/co-lending/pools/${encodeURIComponent(poolId)}/surveillance`;
  const res = await fetch(url, {
    redirect: "error",
    headers: config.tapeProviderApiKey ? { Authorization: `Bearer ${config.tapeProviderApiKey}` } : {},
    dispatcher: h2Dispatcher,
  } as RequestInit & { dispatcher: Agent });
  if (!res.ok) throw new Error(`surveillance fetch failed (${res.status}) from ${url}`);
  return (await res.json()) as PoolSurveillance;
}
