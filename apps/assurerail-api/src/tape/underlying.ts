import { createHash } from "node:crypto";

export interface StratBucket {
  label: string;
  valueSharePct: number; // share of pool value in this bucket
  count: number; // anonymised loan count in this bucket
}
export interface StratTable {
  name: string;
  buckets: StratBucket[];
}
export interface AnonymisedStrat {
  tier: "T1.5-anonymised";
  poolId: string;
  loanCount: number;
  tables: StratTable[];
  note: string;
}

/**
 * Anonymised loan-level "underlying" (T1.5) — the disclosure tier between T1 (pool aggregates) and T2
 * (full loan-level + PII). It lets an investor assess pool composition WITHOUT any PII: only bucketed
 * distributions (strat tables), never an identifiable borrower. k-anon-safe by construction (aggregate
 * shares only). In production AssureLocker (which holds T2) emits this from the actual loans, stripped
 * of PII, as part of the tape; here (DEMO) it is synthesised deterministically from the poolId so the
 * venue runs standalone. Full loan-level + PII (T2) stays at AssureLocker — regulator break-glass only.
 */
export function buildAnonymisedStrat(poolId: string): AnonymisedStrat {
  const h = createHash("sha256").update(poolId).digest();
  const pick = (i: number) => h[i % h.length]; // 0..255, deterministic
  const loanCount = 180 + (pick(0) % 321); // 180..500

  const dist = (labels: string[], seed: number): StratBucket[] => {
    const raw = labels.map((_, i) => 1 + pick(seed + i * 7));
    const sum = raw.reduce((a, b) => a + b, 0);
    return labels.map((label, i) => ({
      label,
      valueSharePct: Math.round((raw[i] / sum) * 1000) / 10,
      count: Math.max(1, Math.round((raw[i] / sum) * loanCount)),
    }));
  };

  return {
    tier: "T1.5-anonymised",
    poolId,
    loanCount,
    tables: [
      { name: "Sector", buckets: dist(["MSME", "Retail", "Housing", "Vehicle", "Agri"], 1) },
      { name: "Residual tenor", buckets: dist(["< 1y", "1–3y", "3–5y", "> 5y"], 20) },
      { name: "Asset classification", buckets: dist(["Standard", "SMA-1", "SMA-2", "NPA"], 40) },
      { name: "Delinquency (DPD)", buckets: dist(["Current", "1–30", "31–90", "90+"], 60) },
    ],
    note: "Anonymised loan-level distribution (T1.5) — PII-stripped and k-anon-safe; no borrower is identifiable. Full loan-level detail (T2) stays at AssureLocker, available to the regulator via break-glass only.",
  };
}
