// Receivables-shaped demo tape (Receivables_Pool_Tokenisation_Path.md §8.5.2). Each seeded record is a
// RECEIVABLE — buyer (anchor) DID+name, GST IRN, acceptance state + timestamp, invoice amount, and an
// invoice due date as a BULLET maturity (no EMI/tenor/amortisation — the whole point of §2's structural
// diff vs a loan pool). The records still roll up into the SAME mint-compatible aggregate the loan pool
// uses (via the shared CoLending builder), so k-anon / mint / surveillance / DvP reuse unchanged, and
// independent verification passes. Deterministic per poolId so the demo console looks real and repeats.
//
// This is the DEMO shape, not the production `TapeReceivable` shared type + eligibility engine (the
// ~3-week item 1: isAcceptedForFinancing / IRN check / live AssureFirst double-financing / per-buyer
// concentration / acceptance seasoning) — that stays deferred. Here the acceptance state is asserted by
// the seed, not adjudicated.
import { createHash } from "node:crypto";
import { CoLending } from "@code/shared";
import type { AssurePoolTape } from "./tape.types";

export type ReceivableAcceptanceState = "EXPLICITLY_ACCEPTED" | "CONTRACTUALLY_DEEMED_ACCEPTED";

export type DemoReceivable = {
  receivableRef: string;
  sellerName: string; // the MSME supplier being financed
  buyerDid: string; // the anchor (large buyer) — DID
  buyerName: string; // anchor name
  irn: string; // GST Invoice Reference Number (high-entropy)
  acceptanceState: ReceivableAcceptanceState;
  acceptedAt: string; // ISO date — acceptance timestamp (the seasoning basis)
  invoiceAmountMinor: string; // financed face value, in paise
  dueDate: string; // bullet maturity — a single date, no amortisation
  currency: "INR";
};

const CUTOFF = "2026-06-30";

// A small readable demo cast. Anchors are large buyers; sellers are MSME suppliers.
const ANCHORS: Record<string, string> = {
  TATASTEEL: "27AAACT2727Q1ZW-tata-steel",
  RELIANCE: "27AAACR5055K1Z7-reliance-industries",
  MARUTI: "27AAACM4950E1Z5-maruti-suzuki",
  LT: "27AAACL0140P1ZL-larsen-toubro",
  ULTRATECH: "27AAACG0569P1ZK-ultratech-cement",
};
const SELLERS = [
  "Sri Velan Auto Components", "Kaveri Precision Forgings", "Deccan Polymers", "Narmada Fasteners",
  "Konkan Castings", "Malwa Diecast", "Indus Gears", "Vega Electricals", "Bhilai Sheetmetal", "Chola Springs",
];

/** did:web institution form for an anchor buyer (matches DEMO_BUYER_DIDS grammar). */
const anchorDid = (slug: string) => `did:web:IND:institution:${slug}`;

/** Parse `{lender}-RECV-{ANCHOR}-{period}`; fall back to a deterministic anchor when unparseable. */
function anchorFor(poolId: string, pick: (i: number) => number): { key: string; name: string; did: string } {
  const m = /-RECV-([A-Z0-9]+)-/i.exec(poolId);
  const keys = Object.keys(ANCHORS);
  const key = (m && keys.includes(m[1]!.toUpperCase())) ? m[1]!.toUpperCase() : keys[pick(3) % keys.length]!;
  const slug = ANCHORS[key]!;
  const name = slug.split("-").slice(1).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
  return { key, name, did: anchorDid(slug) };
}

/**
 * Deterministic seeded receivables for a pool.
 *
 * MULTI-BUYER by construction. The k-anon concentration cap is measured PER OBLIGOR — for a
 * receivable that is the BUYER who owes the invoice, not the individual invoice — so a pool whose
 * receivables all name one anchor is 100% concentrated on that buyer and cannot pass a ≤50% cap. The
 * pool id still names its LEAD anchor (`{lender}-RECV-{ANCHOR}-{period}`), but the book is spread
 * across that lead plus two supporting buyers, with the lead held under the cap. Previously every
 * seeded pool was single-anchor and only "passed" because concentration was measured per invoice.
 */
export function buildReceivablesRecords(poolId: string): DemoReceivable[] {
  const h = createHash("sha256").update(`recv:${poolId}`).digest();
  const pick = (i: number) => h[i % h.length]!;
  const lead = anchorFor(poolId, pick);
  // Two supporting buyers, deterministically chosen and distinct from the lead.
  const others = Object.keys(ANCHORS).filter((k) => k !== lead.key);
  const support = [others[pick(7) % others.length]!, others[(pick(11) + 1) % others.length]!]
    .filter((k, i, a) => a.indexOf(k) === i);
  const buyerFor = (i: number): { did: string; name: string } => {
    // ~40% of receivables to the lead (under the 50% cap), the rest split across the supporting buyers.
    const key = i % 5 < 2 ? lead.key : support[i % Math.max(support.length, 1)] ?? lead.key;
    const slug = ANCHORS[key]!;
    const name = slug.split("-").slice(1).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");
    return { did: anchorDid(slug), name };
  };

  const n = 8 + (pick(0) % 3); // 8..10 receivables across 3 buyers
  const out: DemoReceivable[] = [];
  for (let i = 0; i < n; i++) {
    const buyer = buyerFor(i);
    const sizeCr = 3 + (pick(i + 1) % 7); // ₹3–9 Cr each → pool sums well past the ₹16.6 Cr floor
    const invoiceAmountMinor = String(sizeCr * 1_000_000_000); // ₹1 Cr = 1e9 paise
    // Acceptance seasoned ≥ 90d before cutoff: accept in 2025-08 .. 2025-12.
    const am = 8 + (pick(i + 20) % 5); // month 8..12 of 2025
    const acceptedAt = `2025-${String(am).padStart(2, "0")}-12`;
    // Bullet maturity AFTER the cutoff (a single due date; no amortisation).
    const dm = 8 + (pick(i + 40) % 4); // 2026-08 .. 2026-11
    const dueDate = `2026-${String(dm).padStart(2, "0")}-15`;
    // Most receivables are explicitly accepted; a minority ride the contractually-deemed-accepted rung.
    const acceptanceState: ReceivableAcceptanceState = pick(i + 60) % 5 === 0 ? "CONTRACTUALLY_DEEMED_ACCEPTED" : "EXPLICITLY_ACCEPTED";
    const irn = createHash("sha256").update(`irn:${poolId}:${i}`).digest("hex"); // 64-char high-entropy IRN stand-in
    out.push({
      receivableRef: `${poolId}-R${i + 1}`,
      sellerName: SELLERS[(pick(i + 3) + i) % SELLERS.length]!,
      buyerDid: buyer.did,
      buyerName: buyer.name,
      irn,
      acceptanceState,
      acceptedAt,
      invoiceAmountMinor,
      dueDate,
      currency: "INR",
    });
  }
  return out;
}

/**
 * The mint-compatible tape for a receivables pool. Each receivable maps to one tape entry (invoice
 * amount → financed value; acceptance date → the seasoning basis). Built with the SAME shared builder
 * the loan pool uses, so k-anon / mint / surveillance / DvP need no change and verifyTape passes.
 */
export function buildReceivablesDemoTape(poolId: string): AssurePoolTape {
  const receivables = buildReceivablesRecords(poolId);
  const entries: CoLending.TapeInputLoan[] = receivables.map((r) => ({
    loanRef: r.receivableRef,
    verdict: "ELIGIBLE",
    overridden: false,
    disbursedMinor: r.invoiceAmountMinor,
    originationDate: r.acceptedAt, // seasoning is measured from acceptance for a receivable
    classificationBucket: "STANDARD",
    // The obligor is the BUYER who owes the invoice — the party whose default the pool is exposed to.
    // This is what the k-anon concentration cap must aggregate on.
    obligorRef: r.buyerDid,
  }));
  const manifestHash = CoLending.computePoolManifest(entries);
  return CoLending.buildAssurePoolTape(
    { poolId, claId: "DEMO-RECV-CLA", cutoffDate: CUTOFF, manifestHash, frozenAt: "2026-07-01T00:00:00Z" },
    entries,
    { state: "CONFIRMED", reference: `cbslock_${poolId}`, loanCount: entries.length },
  );
}

/** A pool is a receivables pool when its id carries the RECV marker (`{lender}-RECV-{anchor}-{period}`). */
export function isReceivablesPool(poolId: string): boolean {
  return /-RECV-/i.test(poolId);
}
