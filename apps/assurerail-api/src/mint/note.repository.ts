import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { allocateAmortisation, type AmortiseAllocation } from "../amortise/amortise-math";

export interface NoteRecord {
  id: string;
  poolId: string;
  tapeHash: string;
  manifestHash: string;
  tokenId: string;
  serials: number[];
  t1Aggregates: unknown;
  state: string;
  createdAt: string;
  burnTxRef?: string | null;
  closeAnchorRef?: string | null;
  closeReason?: string | null;
  redeemedAt?: string | null;
}

export interface MintLogRecord {
  id: string;
  poolId: string;
  tapeHash: string;
  kAnonPassed: boolean;
  kAnonDetail: unknown;
  lockRef: string;
  htsTxRef: string;
  actor: string;
  createdAt: string;
}

export interface SurveillanceRecord {
  id: string;
  noteId: string;
  period: string;
  verdict: unknown;
  anchorRef: string; // topicId#sequenceNumber (HCS)
  createdAt: string;
}

export interface HoldingRecord {
  id: string;
  noteId: string;
  holderDid: string;
  units: string; // minor
  updatedAt: string;
}

export interface DvpRecord {
  id: string;
  noteId: string;
  sellerDid: string;
  buyerDid: string;
  units: string;
  settlementMinor: string;
  settlementToken: string;
  settlementRef: string;
  anchorRef: string;
  actor: string;
  createdAt: string;
}

export interface BreakGlassRecord {
  id: string;
  noteId: string;
  regulatorDid: string;
  lawfulPurpose: string;
  anchorRef: string;
  createdAt: string;
}

/** Thrown by settleDvp when the seller's balance is insufficient (atomically enforced). */
export class InsufficientUnitsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientUnitsError";
  }
}

/**
 * Transactional-outbox record — EventLog, neutral OutboxMessage and, when billable, BillingEvent are
 * written inside the same atomic transaction as the domain fact. The repo injects noteId/eventLogId,
 * canonicalises the payload and records its digest. Relay selection is feature-gated between the
 * transitional in-process path and the durable worker; neither is the first writer of the event.
 */
export interface OutboxWrite {
  event: string; // note.minted | dvp.settled | note.closed
  payload: Record<string, unknown>; // repo adds noteId
  billing?: { type: string; unitsMinor?: string; actor: string }; // metered in-tx; sourceEventId = the EventLog id
}

export interface CommitMintArgs {
  note: Omit<NoteRecord, "id" | "createdAt">;
  mintLog: Omit<MintLogRecord, "id" | "createdAt">;
  issuerDid: string;
  issuerUnits: bigint; // issuer's opening 100%-by-value holding
  outbox: OutboxWrite;
}

export interface SettleDvpArgs {
  noteId: string;
  sellerDid: string;
  buyerDid: string;
  units: bigint;
  dvp: Omit<DvpRecord, "id" | "createdAt">;
  outbox: OutboxWrite;
}

export interface CloseNoteArgs {
  noteId: string;
  burnTxRef: string;
  closeAnchorRef: string;
  closeReason: string; // maturity | clean_up_call | call | amortised | manual
  outbox: OutboxWrite;
}

export interface AmortiseNoteArgs {
  noteId: string;
  principalMinor: string; // principal repaid this cycle (burned pro-rata, distributed pro-rata)
  burnTxRef: string; // partial HTS burn ref (or full-burn ref if this paydown retires the note)
  anchorRef: string; // HCS anchor of the amortisation event
  outbox: OutboxWrite;
}

/**
 * The venue's store contract (async — the real backing is the venue's OWN Postgres). StoreModule
 * binds this token to {@link PrismaMintRepository} when DATABASE_URL is set, else to the in-memory
 * fallback below. Every consumer injects `MintRepository` and awaits — the backing is invisible.
 */
export abstract class MintRepository {
  abstract saveNote(n: Omit<NoteRecord, "id" | "createdAt">): Promise<NoteRecord>;
  abstract saveMintLog(m: Omit<MintLogRecord, "id" | "createdAt">): Promise<MintLogRecord>;
  abstract listNotes(): Promise<NoteRecord[]>;
  /**
   * Index-only note tally by state ({ ISSUED, ACTIVE, REDEEMED, total }). The cheap path for /metrics
   * and dashboards — never hydrates the multi-KB t1Aggregates blob per row (a full listNotes() scan on
   * every scrape is both a scaling bottleneck and, on the @Public /metrics endpoint, a DoS amplifier).
   */
  abstract countNotesByState(): Promise<Record<string, number>>;
  /** DB-side sum of t1Aggregates.mintableMinor across all notes (no per-row JS hydration). */
  abstract sumMintableMinor(): Promise<string>;
  /** A bounded page of notes (for the portfolio list view — never the whole table). */
  abstract listNotesPage(limit: number, offset: number): Promise<NoteRecord[]>;
  abstract getNote(id: string): Promise<NoteRecord | undefined>;
  /** True only for a persistent legacy Note linked to a governed Rail token representation. */
  async isGovernedTokenRepresentation(_noteId: string): Promise<boolean> {
    return false;
  }
  abstract updateNoteState(id: string, state: string): Promise<void>;
  abstract saveSurveillance(rec: Omit<SurveillanceRecord, "id" | "createdAt">): Promise<SurveillanceRecord>;
  abstract listSurveillance(noteId: string): Promise<SurveillanceRecord[]>;
  abstract getHolding(noteId: string, holderDid: string): Promise<HoldingRecord | undefined>;
  abstract adjustHolding(noteId: string, holderDid: string, deltaMinor: bigint): Promise<HoldingRecord>;
  abstract listHoldings(noteId: string): Promise<HoldingRecord[]>;
  abstract saveDvp(d: Omit<DvpRecord, "id" | "createdAt">): Promise<DvpRecord>;
  abstract listDvp(noteId: string): Promise<DvpRecord[]>;
  abstract saveBreakGlass(b: Omit<BreakGlassRecord, "id" | "createdAt">): Promise<BreakGlassRecord>;
  abstract listBreakGlass(noteId: string): Promise<BreakGlassRecord[]>;

  // ── atomic value-path operations (single DB transaction on the persistent store) ──
  // Each also writes its outbox (EventLog + optional BillingEvent) IN THE SAME TX and returns the
  // EventLog id, so the sink can relay webhooks without being the first/only writer of those rows.
  /** Note + MintLog + issuer's opening holding + outbox commit together, or not at all. */
  abstract commitMint(args: CommitMintArgs): Promise<{ note: NoteRecord; eventLogId: string }>;
  /**
   * Atomic DvP asset leg: guarded seller-debit (throws InsufficientUnitsError if short — no negative,
   * no oversell), buyer-credit, the Dvp record, and the outbox, all in one transaction. Settlement +
   * HCS anchor are external and sequenced by the caller BEFORE this call.
   */
  abstract settleDvp(args: SettleDvpArgs): Promise<{ dvp: DvpRecord; holdings: HoldingRecord[]; eventLogId: string }>;
  /**
   * Closure / redemption — mint's mirror. Atomically: set the Note REDEEMED (burn + anchor refs + reason
   * + redeemedAt), zero every holding (supply retired), and write the outbox. Returns the closed Note,
   * total units burned, and the EventLog id.
   */
  abstract closeNote(args: CloseNoteArgs): Promise<{ note: NoteRecord; burnedUnits: string; eventLogId: string }>;
  /**
   * Partial pro-rata amortisation (pass-through). Atomically: compute each holder's pro-rata share of
   * the principal paydown (integer-exact conservation), debit their units (guarded — never negative),
   * write the outbox, and — if this paydown retires the last unit — auto-close the Note REDEEMED
   * (reason "amortised"). Allocation is computed from the holdings read INSIDE the tx, so it's consistent
   * under concurrency. Returns the Note, the per-holder allocations, whether it fully amortised, and the
   * EventLog id.
   */
  abstract amortiseNote(args: AmortiseNoteArgs): Promise<{ note: NoteRecord; allocations: AmortiseAllocation[]; fullyAmortised: boolean; eventLogId: string }>;
}

// In-memory fallback for running the DEMO with no database (DATABASE_URL unset). Data is lost on
// restart — the Prisma-backed store is the real thing. Same contract as {@link MintRepository}.
@Injectable()
export class InMemoryMintRepository extends MintRepository {
  private notes: NoteRecord[] = [];
  private mintLogs: MintLogRecord[] = [];
  private surveillance: SurveillanceRecord[] = [];
  private holdings: HoldingRecord[] = [];
  private dvps: DvpRecord[] = [];
  private breakGlass: BreakGlassRecord[] = [];

  async saveNote(n: Omit<NoteRecord, "id" | "createdAt">): Promise<NoteRecord> {
    const rec: NoteRecord = { ...n, id: `note_${randomUUID()}`, createdAt: new Date().toISOString() };
    this.notes.push(rec);
    return rec;
  }
  async saveMintLog(m: Omit<MintLogRecord, "id" | "createdAt">): Promise<MintLogRecord> {
    const rec: MintLogRecord = { ...m, id: `mint_${randomUUID()}`, createdAt: new Date().toISOString() };
    this.mintLogs.push(rec);
    return rec;
  }
  async listNotes(): Promise<NoteRecord[]> {
    return this.notes;
  }
  async countNotesByState(): Promise<Record<string, number>> {
    const out: Record<string, number> = { ISSUED: 0, ACTIVE: 0, REDEEMED: 0, total: this.notes.length };
    for (const n of this.notes) out[n.state] = (out[n.state] ?? 0) + 1;
    return out;
  }
  async sumMintableMinor(): Promise<string> {
    let s = 0n;
    for (const n of this.notes) {
      const m = (n.t1Aggregates as { mintableMinor?: string } | null)?.mintableMinor;
      if (m) s += BigInt(m);
    }
    return s.toString();
  }
  async listNotesPage(limit: number, offset: number): Promise<NoteRecord[]> {
    return this.notes.slice(offset, offset + limit);
  }
  async getNote(id: string): Promise<NoteRecord | undefined> {
    return this.notes.find((n) => n.id === id);
  }
  async updateNoteState(id: string, state: string): Promise<void> {
    const n = this.notes.find((x) => x.id === id);
    if (n) n.state = state;
  }
  /** Upsert per (noteId, period) — a corrected cycle overwrites its own period, never a different one. */
  async saveSurveillance(rec: Omit<SurveillanceRecord, "id" | "createdAt">): Promise<SurveillanceRecord> {
    const existing = this.surveillance.find((s) => s.noteId === rec.noteId && s.period === rec.period);
    if (existing) {
      Object.assign(existing, rec);
      return existing;
    }
    const out: SurveillanceRecord = { ...rec, id: `surv_${randomUUID()}`, createdAt: new Date().toISOString() };
    this.surveillance.push(out);
    return out;
  }
  async listSurveillance(noteId: string): Promise<SurveillanceRecord[]> {
    return this.surveillance.filter((s) => s.noteId === noteId);
  }

  async getHolding(noteId: string, holderDid: string): Promise<HoldingRecord | undefined> {
    return this.holdings.find((h) => h.noteId === noteId && h.holderDid === holderDid);
  }
  /** Increment (or create) a holder's units by a signed delta. */
  async adjustHolding(noteId: string, holderDid: string, deltaMinor: bigint): Promise<HoldingRecord> {
    let h = this.holdings.find((x) => x.noteId === noteId && x.holderDid === holderDid);
    if (!h) {
      h = { id: `hold_${randomUUID()}`, noteId, holderDid, units: "0", updatedAt: new Date().toISOString() };
      this.holdings.push(h);
    }
    h.units = (BigInt(h.units) + deltaMinor).toString();
    h.updatedAt = new Date().toISOString();
    return h;
  }
  async listHoldings(noteId: string): Promise<HoldingRecord[]> {
    return this.holdings.filter((h) => h.noteId === noteId);
  }
  async saveDvp(d: Omit<DvpRecord, "id" | "createdAt">): Promise<DvpRecord> {
    const rec: DvpRecord = { ...d, id: `dvp_${randomUUID()}`, createdAt: new Date().toISOString() };
    this.dvps.push(rec);
    return rec;
  }
  async listDvp(noteId: string): Promise<DvpRecord[]> {
    return this.dvps.filter((d) => d.noteId === noteId);
  }
  async saveBreakGlass(b: Omit<BreakGlassRecord, "id" | "createdAt">): Promise<BreakGlassRecord> {
    const rec: BreakGlassRecord = { ...b, id: `bg_${randomUUID()}`, createdAt: new Date().toISOString() };
    this.breakGlass.push(rec);
    return rec;
  }
  async listBreakGlass(noteId: string): Promise<BreakGlassRecord[]> {
    return this.breakGlass.filter((b) => b.noteId === noteId);
  }

  // In-memory ops are already atomic (single-threaded, no await between reads and writes on our arrays).
  // DEMO does not persist the outbox (no EventLog/BillingEvent store here, nothing queries them); we
  // still mint an eventLogId so the return shape matches the persistent store.
  async commitMint(args: CommitMintArgs): Promise<{ note: NoteRecord; eventLogId: string }> {
    const note = await this.saveNote(args.note);
    await this.saveMintLog(args.mintLog);
    await this.adjustHolding(note.id, args.issuerDid, args.issuerUnits);
    return { note, eventLogId: `evt_${randomUUID()}` };
  }

  async settleDvp(args: SettleDvpArgs): Promise<{ dvp: DvpRecord; holdings: HoldingRecord[]; eventLogId: string }> {
    const seller = await this.getHolding(args.noteId, args.sellerDid);
    if (!seller || BigInt(seller.units) < args.units) {
      throw new InsufficientUnitsError(`seller holds ${seller?.units ?? "0"} < requested ${args.units}`);
    }
    await this.adjustHolding(args.noteId, args.sellerDid, -args.units);
    await this.adjustHolding(args.noteId, args.buyerDid, args.units);
    const dvp = await this.saveDvp(args.dvp);
    return { dvp, holdings: await this.listHoldings(args.noteId), eventLogId: `evt_${randomUUID()}` };
  }

  async closeNote(args: CloseNoteArgs): Promise<{ note: NoteRecord; burnedUnits: string; eventLogId: string }> {
    const note = this.notes.find((n) => n.id === args.noteId);
    if (!note) throw new Error("note not found");
    const held = this.holdings.filter((h) => h.noteId === args.noteId);
    const burnedUnits = held.reduce((sum, h) => sum + BigInt(h.units), 0n).toString();
    for (const h of held) {
      h.units = "0";
      h.updatedAt = new Date().toISOString();
    }
    note.state = "REDEEMED";
    note.burnTxRef = args.burnTxRef;
    note.closeAnchorRef = args.closeAnchorRef;
    note.closeReason = args.closeReason;
    note.redeemedAt = new Date().toISOString();
    return { note, burnedUnits, eventLogId: `evt_${randomUUID()}` };
  }

  async amortiseNote(args: AmortiseNoteArgs): Promise<{ note: NoteRecord; allocations: AmortiseAllocation[]; fullyAmortised: boolean; eventLogId: string }> {
    const note = this.notes.find((n) => n.id === args.noteId);
    if (!note) throw new Error("note not found");
    const held = this.holdings.filter((h) => h.noteId === args.noteId && BigInt(h.units) > 0n);
    const alloc = allocateAmortisation(held.map((h) => ({ holderDid: h.holderDid, units: h.units })), args.principalMinor);
    for (const a of alloc.allocations) {
      const h = this.holdings.find((x) => x.noteId === args.noteId && x.holderDid === a.holderDid);
      if (h) {
        h.units = a.unitsAfter;
        h.updatedAt = new Date().toISOString();
      }
    }
    if (alloc.fullyAmortised) {
      note.state = "REDEEMED";
      note.burnTxRef = args.burnTxRef;
      note.closeAnchorRef = args.anchorRef;
      note.closeReason = "amortised";
      note.redeemedAt = new Date().toISOString();
    }
    return { note, allocations: alloc.allocations, fullyAmortised: alloc.fullyAmortised, eventLogId: `evt_${randomUUID()}` };
  }
}
