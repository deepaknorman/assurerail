// A self-consistent synthetic tape so the venue runs standalone (no AssureLocker). Built with the
// SAME shared builder AssureLocker uses (@code/shared), so independent verification PASSES on it.
import { CoLending } from "@code/shared";
import type { AssurePoolTape } from "./tape.types";

export function buildDemoTape(poolId: string): AssurePoolTape {
  const loans: CoLending.TapeInputLoan[] = [
    { loanRef: `${poolId}-L1`, verdict: "ELIGIBLE", overridden: false, disbursedMinor: "12000000000", originationDate: "2025-01-10", classificationBucket: "STANDARD" },
    { loanRef: `${poolId}-L2`, verdict: "ELIGIBLE", overridden: false, disbursedMinor: "9000000000", originationDate: "2025-02-01", classificationBucket: "STANDARD" },
    { loanRef: `${poolId}-L3`, verdict: "WARNING", overridden: false, disbursedMinor: "6000000000", originationDate: "2025-02-15", classificationBucket: "STANDARD" },
    { loanRef: `${poolId}-L4`, verdict: "HARD_EXCLUDE", overridden: false, disbursedMinor: "5000000000", originationDate: "2025-03-01", classificationBucket: "NPA" },
  ];
  return CoLending.buildAssurePoolTape(
    { poolId, claId: "DEMO-CLA", cutoffDate: "2026-06-30", manifestHash: "sha256:demo-manifest", frozenAt: "2026-07-01T00:00:00Z" },
    loans,
    { state: "CONFIRMED", reference: "cbslock_demo", loanCount: 3 },
  );
}
