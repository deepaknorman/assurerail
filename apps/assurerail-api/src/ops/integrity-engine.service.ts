import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../store/prisma.service";
import { auditCanonical } from "../store/prisma-audit.service";

export interface Finding {
  checkKey: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  scopeType: "NOTE" | "GLOBAL" | "LEDGER" | "AUDIT" | "BILLING";
  scopeRef?: string;
  summary: string;
  observed?: unknown;
  expected?: unknown;
}

const bi = (v: string | null | undefined): bigint => {
  try {
    return BigInt(v ?? "0");
  } catch {
    return 0n;
  }
};

// Deterministic, READ-ONLY reconciliation/QA of the venue's money path. Pure re-derivations of code that
// already exists — the venue is pre-seed, so reading all rows + checking in TS is correct and cheap.
// Returns a break list; the OpsService turns it into deduped OpsFindings. Never mutates domain data.
@Injectable()
export class IntegrityEngineService {
  constructor(private readonly db: PrismaService) {}

  async run(): Promise<Finding[]> {
    const f: Finding[] = [];
    const [notes, holdings, dvps, mintlogs, survNoteIds, audits] = await Promise.all([
      this.db.note.findMany({ select: { id: true, poolId: true, state: true, t1Aggregates: true, burnTxRef: true, closeAnchorRef: true, redeemedAt: true } }),
      this.db.noteHolding.findMany({ select: { noteId: true, units: true } }),
      this.db.dvp.findMany({ select: { id: true, noteId: true, anchorRef: true } }),
      this.db.mintLog.findMany({ select: { htsTxRef: true, kAnonPassed: true, poolId: true } }),
      this.db.surveillanceMirror.findMany({ select: { noteId: true }, distinct: ["noteId"] }),
      this.db.auditLog.findMany({ orderBy: { seq: "asc" }, select: { seq: true, actor: true, event: true, detail: true, noteId: true, governed: true, prevHash: true, hash: true } }),
    ]);

    // sum holdings by note
    const held = new Map<string, bigint>();
    for (const h of holdings) held.set(h.noteId, (held.get(h.noteId) ?? 0n) + bi(h.units));
    const negatives = holdings.filter((h) => bi(h.units) < 0n);
    const survSet = new Set(survNoteIds.map((s) => s.noteId));

    // ── per-note value + lifecycle invariants ──
    for (const n of notes) {
      const sum = held.get(n.id) ?? 0n;
      const mintable = bi((n.t1Aggregates as { mintableMinor?: string })?.mintableMinor);
      if (n.state === "REDEEMED") {
        if (sum !== 0n) f.push({ checkKey: "supply.conservation", severity: "CRITICAL", scopeType: "NOTE", scopeRef: n.id, summary: `REDEEMED note still holds ${sum} units`, observed: sum.toString(), expected: "0" });
        if (!n.burnTxRef || !n.closeAnchorRef || !n.redeemedAt) {
          f.push({ checkKey: "mint.burn.symmetry", severity: "CRITICAL", scopeType: "NOTE", scopeRef: n.id, summary: "REDEEMED note missing burnTxRef / closeAnchorRef / redeemedAt" });
        }
      } else {
        if (sum !== mintable) f.push({ checkKey: "supply.conservation", severity: "CRITICAL", scopeType: "NOTE", scopeRef: n.id, summary: `holdings ${sum} != minted supply ${mintable}`, observed: sum.toString(), expected: mintable.toString() });
        if (n.burnTxRef) f.push({ checkKey: "mint.burn.symmetry", severity: "CRITICAL", scopeType: "NOTE", scopeRef: n.id, summary: `non-REDEEMED note has a burnTxRef (${n.burnTxRef})` });
      }
      if (!["ISSUED", "ACTIVE", "REDEEMED"].includes(n.state)) f.push({ checkKey: "state.machine.legal", severity: "CRITICAL", scopeType: "NOTE", scopeRef: n.id, summary: `illegal state "${n.state}"` });
      if ((n.state === "ACTIVE" || n.state === "REDEEMED") && !survSet.has(n.id)) {
        f.push({ checkKey: "state.machine.legal", severity: "WARN", scopeType: "NOTE", scopeRef: n.id, summary: `${n.state} note has no surveillance cycle (ISSUED→ACTIVE requires one)` });
      }
    }
    for (const h of negatives) f.push({ checkKey: "holdings.nonnegative", severity: "CRITICAL", scopeType: "NOTE", scopeRef: h.noteId, summary: `negative holding: ${h.units}` });

    // ── anchor presence ──
    for (const d of dvps) if (!d.anchorRef?.includes("#")) f.push({ checkKey: "anchor.presence", severity: "CRITICAL", scopeType: "LEDGER", scopeRef: d.id, summary: "DvP missing a well-formed HCS anchorRef" });

    // ── k-anon non-bypass ──
    for (const m of mintlogs) if (m.htsTxRef && m.htsTxRef !== "" && !m.kAnonPassed) f.push({ checkKey: "kanon.nonbypass", severity: "CRITICAL", scopeType: "LEDGER", scopeRef: m.poolId, summary: "a minted pool has kAnonPassed=false — the k-anon gate was bypassed" });

    // ── global count parity: billing + eventlog + audit vs lifecycle facts. Only mint + DvP are checked
    // by aggregate count; closure is NOT (a note can become REDEEMED via close OR full amortisation, so a
    // simple close-count == redeemed-count would false-positive — closure integrity is covered per-note by
    // mint.burn.symmetry above). ──
    const parity = (label: string, actual: number, expected: number, checkKey: string, scopeType: Finding["scopeType"]) => {
      if (actual !== expected) f.push({ checkKey, severity: "CRITICAL", scopeType, scopeRef: label, summary: `${label}: ${actual} != expected ${expected}`, observed: actual, expected });
    };
    const [bMint, bDvp, eMint, eDvp, aMint, aDvp] = await Promise.all([
      this.db.billingEvent.count({ where: { type: "mint" } }),
      this.db.billingEvent.count({ where: { type: "dvp" } }),
      this.db.eventLog.count({ where: { event: "note.minted" } }),
      this.db.eventLog.count({ where: { event: "dvp.settled" } }),
      this.db.auditLog.count({ where: { event: "mint.issued" } }),
      this.db.auditLog.count({ where: { event: "dvp.settled" } }),
    ]);
    parity("billing.mint", bMint, notes.length, "billing.completeness", "BILLING");
    parity("billing.dvp", bDvp, dvps.length, "billing.completeness", "BILLING");
    parity("eventlog.minted", eMint, notes.length, "eventlog.drift", "GLOBAL");
    parity("eventlog.settled", eDvp, dvps.length, "eventlog.drift", "GLOBAL");
    parity("audit.mint", aMint, notes.length, "audit.completeness", "AUDIT");
    parity("audit.dvp", aDvp, dvps.length, "audit.completeness", "AUDIT");

    // ── audit hash-chain continuity ──
    let prev = "genesis";
    for (const r of audits) {
      const expect = createHash("sha256").update(prev + auditCanonical(r)).digest("hex");
      if (r.hash !== expect || (r.prevHash !== prev)) {
        f.push({ checkKey: "audit.chain", severity: "CRITICAL", scopeType: "AUDIT", scopeRef: `seq:${r.seq}`, summary: `audit chain broken at seq ${r.seq} (tamper or gap)` });
        break;
      }
      prev = r.hash;
    }

    return f;
  }
}
