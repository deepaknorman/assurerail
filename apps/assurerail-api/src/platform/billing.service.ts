import { Injectable } from "@nestjs/common";
import { PrismaService } from "../store/prisma.service";

// Illustrative per-event venue fees (paise). Real pricing is subscription + minimum allowances +
// lender-scoped reuse (commercial red lines) — this meters usage into a to-date statement only.
const RATES_MINOR: Record<string, number> = { mint: 500000, dvp: 200000, close: 300000 }; // ₹5,000 / ₹2,000 / ₹3,000

@Injectable()
export class BillingService {
  constructor(private readonly db: PrismaService) {}

  /** Usage-to-date statement, metered from BillingEvent. */
  async statement() {
    const events = await this.db.billingEvent.findMany({ orderBy: { createdAt: "asc" } });
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
    const lines = Object.entries(counts).map(([type, count]) => {
      const rateMinor = RATES_MINOR[type] ?? 0;
      return { type, count, rateMinor, amountMinor: rateMinor * count };
    });
    const totalMinor = lines.reduce((s, l) => s + l.amountMinor, 0);
    return { period: "to-date", currency: "INR", events: events.length, lines, totalMinor };
  }

  recent(limit = 50) {
    return this.db.billingEvent.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 200) });
  }
}
