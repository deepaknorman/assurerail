// Pro-rata (pass-through) partial amortisation — the correctness crux, kept pure + unit-tested.
//
// A single-class AssurePool Note is pari passu: when the underlying pool repays principal P, every
// holder is amortised by their pro-rata share of P (units burned = cash returned, at par). The one hard
// requirement is INTEGER-EXACT CONSERVATION — the per-holder amortised amounts must sum to EXACTLY P, so
// no value is created or destroyed. We use largest-remainder (Hamilton) rounding and BigInt throughout.
// (Sequential / waterfall models only apply once Notes are TRANCHED — deliberately out of scope here.)

export interface Holding {
  holderDid: string;
  units: string; // minor, by value
}

export interface AmortiseAllocation {
  holderDid: string;
  unitsBefore: string;
  amortised: string; // units burned = cash returned (par)
  unitsAfter: string;
}

export interface AmortiseResult {
  totalOutstanding: string;
  principal: string;
  allocations: AmortiseAllocation[];
  fullyAmortised: boolean; // P == outstanding → the Note should auto-close REDEEMED
}

/**
 * Allocate a principal paydown P across holders pro-rata to their holdings, with exact conservation
 * (Σ amortised == P). Deterministic: the leftover whole units from flooring are handed to the largest
 * fractional remainders, tie-broken by holderDid so the result is stable/reproducible.
 */
export function allocateAmortisation(holdings: Holding[], principalMinor: string): AmortiseResult {
  const P = BigInt(principalMinor);
  if (P <= 0n) throw new Error("principal must be positive");

  const positive = holdings.filter((h) => BigInt(h.units) > 0n);
  const total = positive.reduce((s, h) => s + BigInt(h.units), 0n);
  if (total === 0n) throw new Error("no outstanding units to amortise");
  if (P > total) throw new Error(`principal ${P} exceeds outstanding ${total}`);

  // floor(share) + fractional remainder numerator (rem/total) per holder
  const rows = positive.map((h) => {
    const u = BigInt(h.units);
    const num = u * P;
    return { holderDid: h.holderDid, u, floor: num / total, rem: num % total };
  });

  const allocated = rows.reduce((s, r) => s + r.floor, 0n);
  let leftover = P - allocated; // whole units still to distribute (0 .. rows.length)

  // largest remainder first; deterministic tie-break by holderDid
  const order = [...rows].sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.holderDid < b.holderDid ? -1 : 1));
  const bump = new Set<string>();
  for (const r of order) {
    if (leftover <= 0n) break;
    bump.add(r.holderDid);
    leftover -= 1n;
  }

  const allocations: AmortiseAllocation[] = rows.map((r) => {
    const amort = r.floor + (bump.has(r.holderDid) ? 1n : 0n);
    return { holderDid: r.holderDid, unitsBefore: r.u.toString(), amortised: amort.toString(), unitsAfter: (r.u - amort).toString() };
  });

  const sum = allocations.reduce((s, a) => s + BigInt(a.amortised), 0n);
  if (sum !== P) throw new Error(`conservation violation: allocated ${sum} != principal ${P}`);

  return { totalOutstanding: total.toString(), principal: P.toString(), allocations, fullyAmortised: P === total };
}
