import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import type {
  Note as PNote,
  MintLog as PMintLog,
  SurveillanceMirror as PSurv,
  NoteHolding as PHolding,
  Dvp as PDvp,
  BreakGlass as PBreakGlass,
} from "@prisma/assurerail-client";
import {
  MintRepository,
  InsufficientUnitsError,
  type NoteRecord,
  type MintLogRecord,
  type SurveillanceRecord,
  type HoldingRecord,
  type DvpRecord,
  type BreakGlassRecord,
  type CommitMintArgs,
  type SettleDvpArgs,
  type CloseNoteArgs,
  type AmortiseNoteArgs,
  type OutboxWrite,
} from "../mint/note.repository";
import { allocateAmortisation, type AmortiseAllocation } from "../amortise/amortise-math";
import { PrismaService } from "./prisma.service";

// Prisma-backed store over the venue's OWN Postgres. Ids keep the human-readable `note_…`/`dvp_…`
// prefixes (generated here, not DB defaults) so records read the same as the in-memory DEMO.
@Injectable()
export class PrismaMintRepository extends MintRepository {
  constructor(private readonly db: PrismaService) {
    super();
  }

  private toNote(r: PNote): NoteRecord {
    return {
      id: r.id,
      poolId: r.poolId,
      tapeHash: r.tapeHash,
      manifestHash: r.manifestHash,
      tokenId: r.tokenId,
      serials: (r.serials ?? []) as number[],
      t1Aggregates: r.t1Aggregates,
      state: r.state,
      createdAt: r.createdAt.toISOString(),
      burnTxRef: r.burnTxRef,
      closeAnchorRef: r.closeAnchorRef,
      closeReason: r.closeReason,
      redeemedAt: r.redeemedAt ? r.redeemedAt.toISOString() : null,
    };
  }
  private toMintLog(r: PMintLog): MintLogRecord {
    return {
      id: r.id,
      poolId: r.poolId,
      tapeHash: r.tapeHash,
      kAnonPassed: r.kAnonPassed,
      kAnonDetail: r.kAnonDetail,
      lockRef: r.lockRef,
      htsTxRef: r.htsTxRef ?? "",
      actor: r.actor,
      createdAt: r.createdAt.toISOString(),
    };
  }
  private toSurv(r: PSurv): SurveillanceRecord {
    return { id: r.id, noteId: r.noteId, period: r.period, verdict: r.verdict, anchorRef: r.anchorRef ?? "", createdAt: r.createdAt.toISOString() };
  }
  private toHolding(r: PHolding): HoldingRecord {
    return { id: r.id, noteId: r.noteId, holderDid: r.holderDid, units: r.units, updatedAt: r.updatedAt.toISOString() };
  }
  private toDvp(r: PDvp): DvpRecord {
    return {
      id: r.id,
      noteId: r.noteId,
      sellerDid: r.sellerDid,
      buyerDid: r.buyerDid,
      units: r.units,
      settlementMinor: r.settlementMinor,
      settlementToken: r.settlementToken,
      settlementRef: r.settlementRef,
      anchorRef: r.anchorRef,
      actor: r.actor,
      createdAt: r.createdAt.toISOString(),
    };
  }
  private toBreakGlass(r: PBreakGlass): BreakGlassRecord {
    return { id: r.id, noteId: r.noteId, regulatorDid: r.regulatorDid, lawfulPurpose: r.lawfulPurpose, anchorRef: r.anchorRef, createdAt: r.createdAt.toISOString() };
  }

  async saveNote(n: Omit<NoteRecord, "id" | "createdAt">): Promise<NoteRecord> {
    const r = await this.db.note.create({
      data: {
        id: `note_${randomUUID()}`,
        poolId: n.poolId,
        tapeHash: n.tapeHash,
        manifestHash: n.manifestHash,
        tokenId: n.tokenId,
        serials: n.serials,
        t1Aggregates: n.t1Aggregates as Prisma.InputJsonValue,
        state: n.state,
      },
    });
    return this.toNote(r);
  }

  async saveMintLog(m: Omit<MintLogRecord, "id" | "createdAt">): Promise<MintLogRecord> {
    const r = await this.db.mintLog.create({
      data: {
        id: `mint_${randomUUID()}`,
        poolId: m.poolId,
        tapeHash: m.tapeHash,
        kAnonPassed: m.kAnonPassed,
        kAnonDetail: m.kAnonDetail as Prisma.InputJsonValue,
        lockRef: m.lockRef,
        htsTxRef: m.htsTxRef,
        actor: m.actor,
      },
    });
    return this.toMintLog(r);
  }

  async listNotes(): Promise<NoteRecord[]> {
    const rows = await this.db.note.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toNote(r));
  }

  // Index-only aggregate — reads the `state` column, never hydrates t1Aggregates. See the abstract doc.
  async countNotesByState(): Promise<Record<string, number>> {
    const grouped = await this.db.note.groupBy({ by: ["state"], _count: { _all: true } });
    const out: Record<string, number> = { ISSUED: 0, ACTIVE: 0, REDEEMED: 0, total: 0 };
    for (const g of grouped) {
      out[g.state] = g._count._all;
      out.total += g._count._all;
    }
    return out;
  }

  async sumMintableMinor(): Promise<string> {
    const rows = await this.db.$queryRaw<{ sum: string | null }[]>`SELECT COALESCE(SUM((("t1Aggregates" ->> 'mintableMinor')::numeric)), 0)::text AS sum FROM "Note"`;
    return rows[0]?.sum ?? "0";
  }

  async listNotesPage(limit: number, offset: number): Promise<NoteRecord[]> {
    const rows = await this.db.note.findMany({ orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 500), skip: Math.max(offset, 0) });
    return rows.map((r) => this.toNote(r));
  }

  async getNote(id: string): Promise<NoteRecord | undefined> {
    const r = await this.db.note.findUnique({ where: { id } });
    return r ? this.toNote(r) : undefined;
  }

  /** No-op if the note doesn't exist (updateMany never throws on 0 rows) — matches the in-memory store. */
  async updateNoteState(id: string, state: string): Promise<void> {
    await this.db.note.updateMany({ where: { id }, data: { state } });
  }

  async saveSurveillance(rec: Omit<SurveillanceRecord, "id" | "createdAt">): Promise<SurveillanceRecord> {
    const r = await this.db.surveillanceMirror.upsert({
      where: { noteId_period: { noteId: rec.noteId, period: rec.period } },
      create: { id: `surv_${randomUUID()}`, noteId: rec.noteId, period: rec.period, verdict: rec.verdict as Prisma.InputJsonValue, anchorRef: rec.anchorRef },
      update: { verdict: rec.verdict as Prisma.InputJsonValue, anchorRef: rec.anchorRef },
    });
    return this.toSurv(r);
  }

  async listSurveillance(noteId: string): Promise<SurveillanceRecord[]> {
    const rows = await this.db.surveillanceMirror.findMany({ where: { noteId }, orderBy: { period: "asc" } });
    return rows.map((r) => this.toSurv(r));
  }

  async getHolding(noteId: string, holderDid: string): Promise<HoldingRecord | undefined> {
    const r = await this.db.noteHolding.findUnique({ where: { noteId_holderDid: { noteId, holderDid } } });
    return r ? this.toHolding(r) : undefined;
  }

  /**
   * ATOMIC increment (or create) of a holder's units by a signed delta, as a SINGLE upsert statement
   * (INSERT … ON CONFLICT DO UPDATE with the add done in-database). No read-modify-write, so concurrent
   * adjustments to the same (noteId, holderDid) compose correctly instead of losing updates. units are a
   * big-integer string, so the add is done via ::numeric. Runs on the given tx (or the base client).
   */
  private async incHolding(tx: Prisma.TransactionClient, noteId: string, holderDid: string, delta: bigint): Promise<void> {
    const d = delta.toString();
    await tx.$executeRaw`
      INSERT INTO "NoteHolding" ("id", "noteId", "holderDid", "units", "createdAt", "updatedAt")
      VALUES (${`hold_${randomUUID()}`}, ${noteId}, ${holderDid}, ${d}, now(), now())
      ON CONFLICT ("noteId", "holderDid")
      DO UPDATE SET "units" = ("NoteHolding"."units"::numeric + ${d}::numeric)::text, "updatedAt" = now()`;
  }

  /**
   * Transactional outbox: write the EventLog row (durable ops-timeline record) and, when billable, the
   * BillingEvent (keyed to that EventLog via sourceEventId, so a replay can't double-meter) — IN THE
   * SAME tx as the domain write. Returns the EventLog id so the caller can relay webhooks. The noteId is
   * injected here so the persisted payload always carries it.
   */
  private async writeOutbox(tx: Prisma.TransactionClient, outbox: OutboxWrite, noteId: string): Promise<string> {
    const eventLogId = `evt_${randomUUID()}`;
    await tx.eventLog.create({
      data: { id: eventLogId, event: outbox.event, payload: { ...outbox.payload, noteId } as Prisma.InputJsonValue },
    });
    if (outbox.billing) {
      await tx.billingEvent.create({
        data: {
          id: `bill_${randomUUID()}`,
          type: outbox.billing.type,
          noteId,
          unitsMinor: outbox.billing.unitsMinor ?? null,
          actor: outbox.billing.actor,
          sourceEventId: eventLogId,
        },
      });
    }
    return eventLogId;
  }

  async adjustHolding(noteId: string, holderDid: string, deltaMinor: bigint): Promise<HoldingRecord> {
    const r = await this.db.$transaction(async (tx) => {
      await this.incHolding(tx, noteId, holderDid, deltaMinor);
      return tx.noteHolding.findUniqueOrThrow({ where: { noteId_holderDid: { noteId, holderDid } } });
    });
    return this.toHolding(r);
  }

  async listHoldings(noteId: string): Promise<HoldingRecord[]> {
    const rows = await this.db.noteHolding.findMany({ where: { noteId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toHolding(r));
  }

  async saveDvp(d: Omit<DvpRecord, "id" | "createdAt">): Promise<DvpRecord> {
    const r = await this.db.dvp.create({
      data: {
        id: `dvp_${randomUUID()}`,
        noteId: d.noteId,
        sellerDid: d.sellerDid,
        buyerDid: d.buyerDid,
        units: d.units,
        settlementMinor: d.settlementMinor,
        settlementToken: d.settlementToken,
        settlementRef: d.settlementRef,
        anchorRef: d.anchorRef,
        actor: d.actor,
      },
    });
    return this.toDvp(r);
  }

  async listDvp(noteId: string): Promise<DvpRecord[]> {
    const rows = await this.db.dvp.findMany({ where: { noteId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toDvp(r));
  }

  async saveBreakGlass(b: Omit<BreakGlassRecord, "id" | "createdAt">): Promise<BreakGlassRecord> {
    const r = await this.db.breakGlass.create({
      data: { id: `bg_${randomUUID()}`, noteId: b.noteId, regulatorDid: b.regulatorDid, lawfulPurpose: b.lawfulPurpose, anchorRef: b.anchorRef },
    });
    return this.toBreakGlass(r);
  }

  async listBreakGlass(noteId: string): Promise<BreakGlassRecord[]> {
    const rows = await this.db.breakGlass.findMany({ where: { noteId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => this.toBreakGlass(r));
  }

  // ── atomic value-path operations (single Postgres transaction) ──
  async commitMint(args: CommitMintArgs): Promise<{ note: NoteRecord; eventLogId: string }> {
    const { created, eventLogId } = await this.db.$transaction(async (tx) => {
      const n = await tx.note.create({
        data: {
          id: `note_${randomUUID()}`,
          poolId: args.note.poolId,
          tapeHash: args.note.tapeHash,
          manifestHash: args.note.manifestHash,
          tokenId: args.note.tokenId,
          serials: args.note.serials,
          t1Aggregates: args.note.t1Aggregates as Prisma.InputJsonValue,
          state: args.note.state,
        },
      });
      await tx.mintLog.create({
        data: {
          id: `mint_${randomUUID()}`,
          poolId: args.mintLog.poolId,
          tapeHash: args.mintLog.tapeHash,
          kAnonPassed: args.mintLog.kAnonPassed,
          kAnonDetail: args.mintLog.kAnonDetail as Prisma.InputJsonValue,
          lockRef: args.mintLog.lockRef,
          htsTxRef: args.mintLog.htsTxRef,
          actor: args.mintLog.actor,
        },
      });
      await this.incHolding(tx, n.id, args.issuerDid, args.issuerUnits);
      const eventLogId = await this.writeOutbox(tx, args.outbox, n.id);
      return { created: n, eventLogId };
    });
    return { note: this.toNote(created), eventLogId };
  }

  async settleDvp(args: SettleDvpArgs): Promise<{ dvp: DvpRecord; holdings: HoldingRecord[]; eventLogId: string }> {
    const u = args.units.toString();
    return this.db.$transaction(async (tx) => {
      // Guarded seller debit — decrements ONLY if the balance covers it (atomic; no oversell, no negative,
      // no TOCTOU). 0 rows affected ⇒ missing row or insufficient balance ⇒ roll the whole tx back.
      const affected = await tx.$executeRaw`
        UPDATE "NoteHolding"
        SET "units" = ("units"::numeric - ${u}::numeric)::text, "updatedAt" = now()
        WHERE "noteId" = ${args.noteId} AND "holderDid" = ${args.sellerDid} AND "units"::numeric >= ${u}::numeric`;
      if (affected !== 1) {
        throw new InsufficientUnitsError(`seller ${args.sellerDid} has insufficient units for ${u} on note ${args.noteId}`);
      }
      await this.incHolding(tx, args.noteId, args.buyerDid, args.units);
      const d = await tx.dvp.create({
        data: {
          id: `dvp_${randomUUID()}`,
          noteId: args.dvp.noteId,
          sellerDid: args.dvp.sellerDid,
          buyerDid: args.dvp.buyerDid,
          units: args.dvp.units,
          settlementMinor: args.dvp.settlementMinor,
          settlementToken: args.dvp.settlementToken,
          settlementRef: args.dvp.settlementRef,
          anchorRef: args.dvp.anchorRef,
          actor: args.dvp.actor,
        },
      });
      const holdings = await tx.noteHolding.findMany({ where: { noteId: args.noteId }, orderBy: { createdAt: "asc" } });
      const eventLogId = await this.writeOutbox(tx, args.outbox, args.noteId);
      return { dvp: this.toDvp(d), holdings: holdings.map((h) => this.toHolding(h)), eventLogId };
    });
  }

  async closeNote(args: CloseNoteArgs): Promise<{ note: NoteRecord; burnedUnits: string; eventLogId: string }> {
    return this.db.$transaction(async (tx) => {
      // Sum the outstanding supply (what gets burned), then zero every holding, then flip the Note to
      // REDEEMED with the burn/anchor refs — all atomic.
      const rows = await tx.noteHolding.findMany({ where: { noteId: args.noteId }, select: { units: true } });
      const burnedUnits = rows.reduce((s, r) => s + BigInt(r.units), 0n).toString();
      await tx.$executeRaw`UPDATE "NoteHolding" SET "units" = '0', "updatedAt" = now() WHERE "noteId" = ${args.noteId}`;
      const n = await tx.note.update({
        where: { id: args.noteId },
        data: {
          state: "REDEEMED",
          burnTxRef: args.burnTxRef,
          closeAnchorRef: args.closeAnchorRef,
          closeReason: args.closeReason,
          redeemedAt: new Date(),
        },
      });
      // burnedUnits is computed here in-tx; inject it into the outbox payload + billing meter so the
      // close event's persisted record carries the amount burned (the caller doesn't know it upfront).
      const outbox: OutboxWrite = {
        event: args.outbox.event,
        payload: { ...args.outbox.payload, burnedUnits },
        billing: args.outbox.billing ? { ...args.outbox.billing, unitsMinor: args.outbox.billing.unitsMinor ?? burnedUnits } : undefined,
      };
      const eventLogId = await this.writeOutbox(tx, outbox, args.noteId);
      return { note: this.toNote(n), burnedUnits, eventLogId };
    });
  }

  async amortiseNote(args: AmortiseNoteArgs): Promise<{ note: NoteRecord; allocations: AmortiseAllocation[]; fullyAmortised: boolean; eventLogId: string }> {
    return this.db.$transaction(async (tx) => {
      // Allocate from holdings read IN-TX (consistent under concurrency); pure integer-exact pro-rata.
      const held = await tx.noteHolding.findMany({ where: { noteId: args.noteId }, orderBy: { createdAt: "asc" } });
      const positive = held.filter((h) => BigInt(h.units) > 0n);
      const alloc = allocateAmortisation(positive.map((h) => ({ holderDid: h.holderDid, units: h.units })), args.principalMinor);
      // Guarded per-holder debit — never below the allocated share (defence-in-depth; the allocation
      // already can't exceed a holding, but a concurrent trade between read and write is caught here).
      for (const a of alloc.allocations) {
        if (BigInt(a.amortised) === 0n) continue;
        const affected = await tx.$executeRaw`
          UPDATE "NoteHolding"
          SET "units" = ("units"::numeric - ${a.amortised}::numeric)::text, "updatedAt" = now()
          WHERE "noteId" = ${args.noteId} AND "holderDid" = ${a.holderDid} AND "units"::numeric >= ${a.amortised}::numeric`;
        if (affected !== 1) throw new InsufficientUnitsError(`holder ${a.holderDid} has insufficient units for amortisation on note ${args.noteId}`);
      }
      // If this paydown retired the last unit, auto-close REDEEMED (reason "amortised"); else stay ACTIVE.
      const n = alloc.fullyAmortised
        ? await tx.note.update({ where: { id: args.noteId }, data: { state: "REDEEMED", burnTxRef: args.burnTxRef, closeAnchorRef: args.anchorRef, closeReason: "amortised", redeemedAt: new Date() } })
        : await tx.note.findUniqueOrThrow({ where: { id: args.noteId } });
      const eventLogId = await this.writeOutbox(tx, args.outbox, args.noteId);
      return { note: this.toNote(n), allocations: alloc.allocations, fullyAmortised: alloc.fullyAmortised, eventLogId };
    });
  }
}
