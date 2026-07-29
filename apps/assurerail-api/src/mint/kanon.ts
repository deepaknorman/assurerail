// k-anonymity mint floor (spec §8.4): a Note may mint only if the mintable pool is big enough,
// seasoned enough, and diversified enough. Pure function of the tape's T1 data (already integrity-
// verified). Honesty carries over: an unknown input (e.g. missing origination date) is NOT treated
// as satisfied.
import type { AssurePoolTape, TapeLoan } from "../tape/tape.types";

export const KANON = {
  // ≈ USD 2M at a reference FX, in INR paise. Override via env for other currencies/FX.
  minPoolValueMinor: BigInt(process.env.KANON_MIN_VALUE_MINOR ?? "16600000000"),
  minSeasoningDays: Number(process.env.KANON_MIN_SEASONING_DAYS ?? "90"),
  maxConcentrationBps: Number(process.env.KANON_MAX_CONCENTRATION_BPS ?? "5000"), // ≤ 50.00%
};

export interface KAnonResult {
  ok: boolean;
  reasons: string[];
  detail: { mintableMinor: string; minSeasoningDays: number; maxConcentrationBps: number };
}

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.floor((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

export function checkKAnon(tape: AssurePoolTape): KAnonResult {
  const reasons: string[] = [];
  const mintable = tape.loans.filter((l: TapeLoan) => l.mintable);
  const mintableMinor = BigInt(tape.aggregates.mintableMinor);

  // 1) value floor
  if (mintableMinor < KANON.minPoolValueMinor) {
    reasons.push(`mintable value ${mintableMinor} below floor ${KANON.minPoolValueMinor}`);
  }

  // 2) seasoning floor — the YOUNGEST mintable loan must be ≥ minSeasoningDays at cutoff
  let minSeasoning = Number.POSITIVE_INFINITY;
  for (const l of mintable) {
    if (!l.originationDate) {
      reasons.push(`loan ${l.loanRef}: origination date absent — seasoning unknown (unknown ≠ seasoned)`);
      continue;
    }
    minSeasoning = Math.min(minSeasoning, daysBetween(l.originationDate, tape.cutoffDate));
  }
  if (Number.isFinite(minSeasoning) && minSeasoning < KANON.minSeasoningDays) {
    reasons.push(`min seasoning ${minSeasoning}d below floor ${KANON.minSeasoningDays}d`);
  }

  // 3) concentration — max single position ≤ maxConcentrationBps.
  //    NOTE: grouped by loanRef (= borrower only when one loan per borrower). TRUE single-BORROWER
  //    concentration needs a T1 borrower-concentration aggregate from AssureLocker (borrower grouping
  //    is T2) — follow-up. Until then this can UNDERSTATE concentration for multi-loan borrowers.
  let maxConcBps = 0;
  if (mintableMinor > 0n) {
    for (const l of mintable) {
      const bps = Number((BigInt(l.disbursedMinor ?? "0") * 10_000n) / mintableMinor);
      maxConcBps = Math.max(maxConcBps, bps);
    }
  }
  if (maxConcBps > KANON.maxConcentrationBps) {
    reasons.push(`single-position concentration ${maxConcBps}bps exceeds ${KANON.maxConcentrationBps}bps`);
  }

  return {
    ok: mintable.length > 0 && reasons.length === 0,
    reasons: mintable.length === 0 ? ["no mintable loans in tape"] : reasons,
    detail: {
      mintableMinor: mintableMinor.toString(),
      minSeasoningDays: Number.isFinite(minSeasoning) ? minSeasoning : 0,
      maxConcentrationBps: maxConcBps,
    },
  };
}
