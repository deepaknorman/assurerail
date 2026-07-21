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

  /** Portfolio summary across all Notes. */
  async portfolio() {
    const notes = await this.repo.listNotes();
    const byState: Record<string, number> = {};
    let totalMintable = 0n;
    for (const n of notes) {
      byState[n.state] = (byState[n.state] ?? 0) + 1;
      const agg = n.t1Aggregates as { mintableMinor?: string } | null;
      if (agg?.mintableMinor) totalMintable += BigInt(agg.mintableMinor);
    }
    return {
      notes: notes.length,
      byState,
      totalMintableMinor: totalMintable.toString(),
      items: notes.map((n) => ({ id: n.id, poolId: n.poolId, tokenId: n.tokenId, state: n.state, mintableMinor: (n.t1Aggregates as { mintableMinor?: string } | null)?.mintableMinor ?? null })),
      generatedAt: new Date().toISOString(),
    };
  }

  /** Flat CSV of a Note's holdings + trades (for download). */
  csv(report: Awaited<ReturnType<ReportsService["noteReport"]>>): string {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["section,party,units,price,token,anchorRef"];
    for (const h of report.holdings) lines.push([esc("holding"), esc(h.holderDid), esc(h.units), "", "", ""].join(","));
    for (const t of report.trades) lines.push([esc("trade"), esc(t.buyer), esc(t.units), esc(t.price), esc(t.token), esc(t.anchorRef)].join(","));
    return lines.join("\n") + "\n";
  }
}
