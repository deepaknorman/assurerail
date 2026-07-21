import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

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

export interface CommitMintArgs {
  note: Omit<NoteRecord, "id" | "createdAt">;
  mintLog: Omit<MintLogRecord, "id" | "createdAt">;
  issuerDid: string;
  issuerUnits: bigint; // issuer's opening 100%-by-value holding
}

export interface SettleDvpArgs {
  noteId: string;
  sellerDid: string;
  buyerDid: string;
  units: bigint;
  dvp: Omit<DvpRecord, "id" | "createdAt">;
}

export interface CloseNoteArgs {
  noteId: string;
  burnTxRef: string;
  closeAnchorRef: string;
  closeReason: string; // maturity | clean_up_call | call | amortised | manual
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
  abstract getNote(id: string): Promise<NoteRecord | undefined>;
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
  /** Note + MintLog + issuer's opening holding commit together, or not at all. */
  abstract commitMint(args: CommitMintArgs): Promise<NoteRecord>;
  /**
   * Atomic DvP asset leg: guarded seller-debit (throws InsufficientUnitsError if short — no negative,
   * no oversell), buyer-credit, and the Dvp record, all in one transaction. Settlement + HCS anchor are
   * external and sequenced by the caller BEFORE this call.
   */
  abstract settleDvp(args: SettleDvpArgs): Promise<{ dvp: DvpRecord; holdings: HoldingRecord[] }>;
  /**
   * Closure / redemption — mint's mirror. Atomically: set the Note REDEEMED (burn + anchor refs + reason
   * + redeemedAt) and zero every holding (supply retired). Returns the closed Note + total units burned.
   */
  abstract closeNote(args: CloseNoteArgs): Promise<{ note: NoteRecord; burnedUnits: string }>;
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
  async commitMint(args: CommitMintArgs): Promise<NoteRecord> {
    const note = await this.saveNote(args.note);
    await this.saveMintLog(args.mintLog);
    await this.adjustHolding(note.id, args.issuerDid, args.issuerUnits);
    return note;
  }

  async settleDvp(args: SettleDvpArgs): Promise<{ dvp: DvpRecord; holdings: HoldingRecord[] }> {
    const seller = await this.getHolding(args.noteId, args.sellerDid);
    if (!seller || BigInt(seller.units) < args.units) {
      throw new InsufficientUnitsError(`seller holds ${seller?.units ?? "0"} < requested ${args.units}`);
    }
    await this.adjustHolding(args.noteId, args.sellerDid, -args.units);
    await this.adjustHolding(args.noteId, args.buyerDid, args.units);
    const dvp = await this.saveDvp(args.dvp);
    return { dvp, holdings: await this.listHoldings(args.noteId) };
  }

  async closeNote(args: CloseNoteArgs): Promise<{ note: NoteRecord; burnedUnits: string }> {
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
    return { note, burnedUnits };
  }
}
