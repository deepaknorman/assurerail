import { Injectable, NotFoundException } from "@nestjs/common";
import { MintRepository } from "../mint/note.repository";

@Injectable()
export class ReportsService {
  constructor(private readonly repo: MintRepository) {}

  /** Full lifecycle report for a Note: state, holdings, surveillance cycles, trades, closure. */
  async noteReport(noteId: string) {
    const note = await this.repo.getNote(noteId);
    if (!note) throw new NotFoundException("note not found");
    const [holdings, surveillance, dvps] = await Promise.all([
      this.repo.listHoldings(noteId),
      this.repo.listSurveillance(noteId),
      this.repo.listDvp(noteId),
    ]);
    const supply = holdings.reduce((s, h) => s + BigInt(h.units), 0n).toString();
    return {
      note: {
        id: note.id, poolId: note.poolId, tokenId: note.tokenId, state: note.state, tapeHash: note.tapeHash,
        createdAt: note.createdAt, redeemedAt: note.redeemedAt ?? null, closeReason: note.closeReason ?? null, burnTxRef: note.burnTxRef ?? null,
      },
      supply,
      holders: holdings.length,
      holdings: holdings.map((h) => ({ holderDid: h.holderDid, units: h.units })),
      surveillance: surveillance.map((s) => ({ period: s.period, anchorRef: s.anchorRef })),
      trades: dvps.map((d) => ({ buyer: d.buyerDid, units: d.units, price: d.settlementMinor, token: d.settlementToken, anchorRef: d.anchorRef, at: d.createdAt })),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Portfolio summary. De-scanned: byState + total via an index-only count, the value total via a DB-side
   * SUM (no per-note t1Aggregates hydration), and the items list is PAGINATED (never the whole table).
   */
  async portfolio(limit = 50, offset = 0) {
    const [counts, totalMintableMinor, page] = await Promise.all([
      this.repo.countNotesByState(),
      this.repo.sumMintableMinor(),
      this.repo.listNotesPage(limit, offset),
    ]);
    const { total, ...byState } = counts;
    return {
      notes: total ?? 0,
      byState,
      totalMintableMinor,
      items: page.map((n) => ({ id: n.id, poolId: n.poolId, tokenId: n.tokenId, state: n.state, mintableMinor: (n.t1Aggregates as { mintableMinor?: string } | null)?.mintableMinor ?? null })),
      page: { limit, offset, returned: page.length },
      generatedAt: new Date().toISOString(),
    };
  }

  /** Flat CSV of a Note's holdings + trades (for download). */
  csv(report: Awaited<ReturnType<ReportsService["noteReport"]>>): string {
    // Quote-wrapping alone does NOT stop spreadsheet formula injection (CWE-1236): Excel/Sheets still
    // evaluate a quoted cell that begins with `= + - @` (or a leading tab/CR). The cells below carry
    // counterparty-controlled strings — holderDid, buyer, token, anchorRef — so neutralise the leading
    // trigger first, then quote. Mirrors apps/api/src/common/csv.util.ts, including the numeric
    // exemption so signed amounts stay numeric instead of being coerced to text.
    const esc = (v: unknown) => {
      let s = v == null ? "" : String(v);
      const isPlainNumber =
        typeof v === "number" ? Number.isFinite(v) : /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(s);
      if (!isPlainNumber && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = ["section,party,units,price,token,anchorRef"];
    for (const h of report.holdings) lines.push([esc("holding"), esc(h.holderDid), esc(h.units), "", "", ""].join(","));
    for (const t of report.trades) lines.push([esc("trade"), esc(t.buyer), esc(t.units), esc(t.price), esc(t.token), esc(t.anchorRef)].join(","));
    return lines.join("\n") + "\n";
  }
}
