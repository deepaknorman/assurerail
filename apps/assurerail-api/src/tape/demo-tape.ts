// A self-consistent synthetic tape so the venue runs standalone. Built against Rail's explicit
// provider-boundary fixture profile, so independent verification passes without provider source. The
// pool VARIES deterministically by poolId (loan count / sizes / vintage / quality) so the portfolio
// looks real — while always clearing the k-anon floor (value ≥ ~₹16.6 Cr, seasoned, concentration <50%).
import { createHash } from "node:crypto";
import {
  buildAssurePoolTapeFixtureV1,
  computePoolManifestV1,
  type TapeInputLoanV1,
} from "../provider-contracts/v1";
import type { AssurePoolTape } from "./tape.types";

export function buildDemoTape(poolId: string): AssurePoolTape {
  const h = createHash("sha256").update(poolId).digest();
  const pick = (i: number) => h[i % h.length]; // 0..255, deterministic

  const n = 6 + (pick(0) % 6); // 6..11 loans → largest-loan concentration stays well under 50%
  const loans: TapeInputLoanV1[] = [];
  for (let i = 0; i < n; i++) {
    const sizeCr = 4 + (pick(i + 1) % 9); // ₹4–12 Cr
    const disbursedMinor = String(sizeCr * 1_000_000_000); // ₹1 Cr = 1e9 paise
    const month = 6 + (pick(i + 20) % 7); // 2024-06 .. 2024-12 → well-seasoned at the 2026-06 cutoff
    const q = pick(i + 40) % 100;
    const bucket = q < 88 ? "STANDARD" : q < 96 ? "SMA-1" : "NPA";
    const verdict = bucket === "NPA" ? "HARD_EXCLUDE" : bucket === "SMA-1" ? "WARNING" : "ELIGIBLE";
    loans.push({
      loanRef: `${poolId}-L${i + 1}`,
      verdict,
      overridden: false,
      disbursedMinor,
      originationDate: `2024-${String(month).padStart(2, "0")}-15`,
      classificationBucket: bucket,
    });
  }
  const eligible = loans.filter((l) => l.verdict === "ELIGIBLE").length;

  // H6: the manifest must be a genuine commitment to the published per-loan records so independent
  // verification (verifyTape recomputes it from tape.loans) PASSES on this self-consistent demo tape.
  // A hardcoded placeholder would now (correctly) fail the manifest-drift check.
  const manifestHash = computePoolManifestV1(loans);

  return buildAssurePoolTapeFixtureV1(
    { poolId, claId: "DEMO-CLA", cutoffDate: "2026-06-30", manifestHash, frozenAt: "2026-07-01T00:00:00Z" },
    loans,
    { state: "CONFIRMED", reference: `cbslock_${poolId}`, loanCount: eligible },
  );
}
