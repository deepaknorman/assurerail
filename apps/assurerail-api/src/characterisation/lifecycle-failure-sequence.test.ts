import assert from "node:assert/strict";
import test from "node:test";
import { AmortiseService } from "../amortise/amortise.service";
import { CloseService } from "../closure/close.service";
import { DvpService } from "../dvp/dvp.service";
import type { VenueEventBus } from "../events/venue-events";
import type { HtsAdapter } from "../hts/hts.adapter";
import { MintService } from "../mint/mint.service";
import type { HoldingRecord, MintRepository, NoteRecord } from "../mint/note.repository";
import type { SettlementAdapter } from "../settlement/settlement.adapter";
import type { AuditService } from "../store/audit.service";
import { SurveillanceService } from "../surveillance/surveillance.service";
import type { HcsAdapter } from "../surveillance/hcs.adapter";
import type { PoolSurveillance } from "../surveillance/surveillance.client";
import { buildDemoTape } from "../tape/demo-tape";

type HtsModule = { selectHtsAdapter: () => HtsAdapter };
type HcsModule = { selectHcsAdapter: () => HcsAdapter };
type SettlementModule = { selectSettlementAdapter: () => SettlementAdapter };
type SurveillanceClientModule = { fetchSurveillance: (poolId: string) => Promise<PoolSurveillance> };

const htsModule = require("../hts/hts.adapter") as HtsModule;
const hcsModule = require("../surveillance/hcs.adapter") as HcsModule;
const settlementModule = require("../settlement/settlement.adapter") as SettlementModule;
const surveillanceClientModule = require("../surveillance/surveillance.client") as SurveillanceClientModule;

const note: NoteRecord = {
  id: "note-characterisation",
  poolId: "POOL-CHARACTERISATION",
  tapeHash: "tape-hash-characterisation",
  manifestHash: "manifest-hash-characterisation",
  tokenId: "0.0.12345",
  serials: [1, 2],
  t1Aggregates: { mintableMinor: "1000" },
  state: "ISSUED",
  createdAt: "2026-08-30T00:00:00.000Z",
};

const sellerHolding: HoldingRecord = {
  id: "holding-seller",
  noteId: note.id,
  holderDid: "did:test:seller",
  units: "1000",
  updatedAt: note.createdAt,
};

function repoWith(methods: Record<string, unknown>): MintRepository {
  return methods as unknown as MintRepository;
}

function eventBus(emit: (event: string, payload: Record<string, unknown>) => void = () => undefined): VenueEventBus {
  return { emit } as unknown as VenueEventBus;
}

function auditService(append: AuditService["append"] = async () => undefined): AuditService {
  return { append } as AuditService;
}

test("[CURRENT_SEQUENCE][AR-C04] DvP can settle cash before an HCS failure prevents the asset commit", async () => {
  const originalSettlement = settlementModule.selectSettlementAdapter;
  const originalHcs = hcsModule.selectHcsAdapter;
  let cashSettled = false;
  let assetCommitted = false;
  settlementModule.selectSettlementAdapter = () => ({
    mode: "LIVE",
    settle: async (_from, _to, amountMinor, token) => {
      cashSettled = true;
      return { settlementRef: "cash-succeeded", token, amountMinor, adapter: "LIVE" };
    },
  });
  hcsModule.selectHcsAdapter = () => ({
    mode: "LIVE",
    anchor: async () => {
      throw new Error("characterised HCS outage");
    },
  });

  try {
    const repo = repoWith({
      getNote: async () => note,
      getHolding: async () => sellerHolding,
      settleDvp: async () => {
        assetCommitted = true;
        throw new Error("must not be reached");
      },
    });
    const service = new DvpService(repo, eventBus(), auditService());
    await assert.rejects(
      () => service.execute(note.id, { buyerDid: "did:test:buyer", sellerDid: sellerHolding.holderDid, unitsMinor: "100", priceMinor: "90" }),
      /characterised HCS outage/,
    );
    assert.equal(cashSettled, true);
    assert.equal(assetCommitted, false);
  } finally {
    settlementModule.selectSettlementAdapter = originalSettlement;
    hcsModule.selectHcsAdapter = originalHcs;
  }
});

test("[CURRENT_SEQUENCE][AR-C04] DvP can settle cash and anchor before the asset transaction fails", async () => {
  const originalSettlement = settlementModule.selectSettlementAdapter;
  const originalHcs = hcsModule.selectHcsAdapter;
  const sequence: string[] = [];
  settlementModule.selectSettlementAdapter = () => ({
    mode: "LIVE",
    settle: async (_from, _to, amountMinor, token) => {
      sequence.push("cash-settled");
      return { settlementRef: "cash-succeeded", token, amountMinor, adapter: "LIVE" };
    },
  });
  hcsModule.selectHcsAdapter = () => ({
    mode: "LIVE",
    anchor: async () => {
      sequence.push("anchored");
      return { topicId: "0.0.777", sequenceNumber: "1", adapter: "LIVE" };
    },
  });

  try {
    const repo = repoWith({
      getNote: async () => note,
      getHolding: async () => sellerHolding,
      settleDvp: async () => {
        sequence.push("asset-commit-attempted");
        throw new Error("characterised database outage");
      },
    });
    const service = new DvpService(repo, eventBus(), auditService());
    await assert.rejects(
      () => service.execute(note.id, { buyerDid: "did:test:buyer", sellerDid: sellerHolding.holderDid, unitsMinor: "100", priceMinor: "90" }),
      /characterised database outage/,
    );
    assert.deepEqual(sequence, ["cash-settled", "anchored", "asset-commit-attempted"]);
  } finally {
    settlementModule.selectSettlementAdapter = originalSettlement;
    hcsModule.selectHcsAdapter = originalHcs;
  }
});

test("[CURRENT_SEQUENCE][AR-C05] an HTS mint can succeed before the local mint transaction fails", async () => {
  const originalHts = htsModule.selectHtsAdapter;
  const poolId = "POOL-CHARACTERISATION-MINT";
  const tape = buildDemoTape(poolId);
  let externalMintSucceeded = false;
  htsModule.selectHtsAdapter = () => ({
    mode: "LIVE",
    mint: async () => {
      externalMintSucceeded = true;
      return { tokenId: "0.0.external-mint", serials: [1], adapter: "LIVE" };
    },
    burn: async () => { throw new Error("unused"); },
    burnAmount: async () => { throw new Error("unused"); },
  });

  try {
    const service = new MintService(
      { load: async () => ({ tape, verification: { ok: true, mintReady: true, reasons: [] } }) } as never,
      repoWith({ commitMint: async () => { throw new Error("characterised database outage"); } }),
      eventBus(),
      auditService(),
    );
    await assert.rejects(() => service.mint(poolId), /characterised database outage/);
    assert.equal(externalMintSucceeded, true);
  } finally {
    htsModule.selectHtsAdapter = originalHts;
  }
});

test("[CURRENT_SEQUENCE][AR-C05] an HTS burn and HCS anchor can succeed before close persistence fails", async () => {
  const originalHts = htsModule.selectHtsAdapter;
  const originalHcs = hcsModule.selectHcsAdapter;
  const sequence: string[] = [];
  htsModule.selectHtsAdapter = () => ({
    mode: "LIVE",
    mint: async () => { throw new Error("unused"); },
    burn: async () => {
      sequence.push("burned");
      return { tokenId: note.tokenId, burnedSerials: note.serials, txRef: "burn-succeeded", adapter: "LIVE" };
    },
    burnAmount: async () => { throw new Error("unused"); },
  });
  hcsModule.selectHcsAdapter = () => ({
    mode: "LIVE",
    anchor: async () => {
      sequence.push("anchored");
      return { topicId: "0.0.777", sequenceNumber: "2", adapter: "LIVE" };
    },
  });

  try {
    const service = new CloseService(
      repoWith({
        getNote: async () => note,
        closeNote: async () => {
          sequence.push("close-commit-attempted");
          throw new Error("characterised database outage");
        },
      }),
      eventBus(),
      auditService(),
    );
    await assert.rejects(() => service.close(note.id, { reason: "maturity" }), /characterised database outage/);
    assert.deepEqual(sequence, ["burned", "anchored", "close-commit-attempted"]);
  } finally {
    htsModule.selectHtsAdapter = originalHts;
    hcsModule.selectHcsAdapter = originalHcs;
  }
});

test("[CURRENT_SEQUENCE][AR-C05] a partial HTS burn and HCS anchor can succeed before amortisation persistence fails", async () => {
  const originalHts = htsModule.selectHtsAdapter;
  const originalHcs = hcsModule.selectHcsAdapter;
  const sequence: string[] = [];
  htsModule.selectHtsAdapter = () => ({
    mode: "LIVE",
    mint: async () => { throw new Error("unused"); },
    burn: async () => { throw new Error("unused"); },
    burnAmount: async () => {
      sequence.push("partially-burned");
      return { tokenId: note.tokenId, burnedSerials: [], txRef: "partial-burn-succeeded", adapter: "LIVE" };
    },
  });
  hcsModule.selectHcsAdapter = () => ({
    mode: "LIVE",
    anchor: async () => {
      sequence.push("anchored");
      return { topicId: "0.0.777", sequenceNumber: "3", adapter: "LIVE" };
    },
  });

  try {
    const service = new AmortiseService(
      repoWith({
        getNote: async () => note,
        listHoldings: async () => [sellerHolding],
        amortiseNote: async () => {
          sequence.push("amortise-commit-attempted");
          throw new Error("characterised database outage");
        },
      }),
      eventBus(),
      auditService(),
    );
    await assert.rejects(() => service.amortise(note.id, { principalMinor: "100" }), /characterised database outage/);
    assert.deepEqual(sequence, ["partially-burned", "anchored", "amortise-commit-attempted"]);
  } finally {
    htsModule.selectHtsAdapter = originalHts;
    hcsModule.selectHcsAdapter = originalHcs;
  }
});

test("[CURRENT_SEQUENCE][AR-H10] durable domain/outbox commit can precede an audit append failure", async () => {
  const originalSettlement = settlementModule.selectSettlementAdapter;
  const originalHcs = hcsModule.selectHcsAdapter;
  let domainCommitted = false;
  let eventEmitted = false;
  settlementModule.selectSettlementAdapter = () => ({
    mode: "LIVE",
    settle: async (_from, _to, amountMinor, token) => ({ settlementRef: "cash-succeeded", token, amountMinor, adapter: "LIVE" }),
  });
  hcsModule.selectHcsAdapter = () => ({
    mode: "LIVE",
    anchor: async () => ({ topicId: "0.0.777", sequenceNumber: "4", adapter: "LIVE" }),
  });

  try {
    const repo = repoWith({
      getNote: async () => note,
      getHolding: async () => sellerHolding,
      settleDvp: async () => {
        domainCommitted = true;
        return {
          dvp: { id: "dvp-characterisation" },
          holdings: [],
          eventLogId: "event-characterisation",
        };
      },
    });
    const service = new DvpService(
      repo,
      eventBus(() => { eventEmitted = true; }),
      auditService(async () => { throw new Error("characterised audit failure"); }),
    );
    await assert.rejects(
      () => service.execute(note.id, { buyerDid: "did:test:buyer", sellerDid: sellerHolding.holderDid, unitsMinor: "100", priceMinor: "90" }),
      /characterised audit failure/,
    );
    assert.equal(domainCommitted, true);
    assert.equal(eventEmitted, false);
  } finally {
    settlementModule.selectSettlementAdapter = originalSettlement;
    hcsModule.selectHcsAdapter = originalHcs;
  }
});

test("[CURRENT_SEQUENCE][AR-C06] breached/problem surveillance currently activates an issued note", async () => {
  const originalFetch = surveillanceClientModule.fetchSurveillance;
  const originalHcs = hcsModule.selectHcsAdapter;
  const transitions: string[] = [];
  surveillanceClientModule.fetchSurveillance = async () => ({
    poolStatus: "BREACHED",
    ok: false,
    periodGaps: ["2026-07"],
    cycles: [{
      period: "2026-08",
      waterfall: { balanced: false, differenceMinor: "10" },
      triggers: [{ trigger: "CE_UTILISATION", state: "BREACHED" }],
      problems: ["waterfall mismatch"],
    }],
  });
  hcsModule.selectHcsAdapter = () => ({
    mode: "LIVE",
    anchor: async () => ({ topicId: "0.0.777", sequenceNumber: "5", adapter: "LIVE" }),
  });

  try {
    const service = new SurveillanceService(repoWith({
      getNote: async () => note,
      saveSurveillance: async (record: Record<string, unknown>) => ({ id: "surveillance-characterisation", ...record }),
      updateNoteState: async (_noteId: string, state: string) => { transitions.push(state); },
    }));
    const result = await service.sync(note.id);
    assert.equal(result.ok, false);
    assert.deepEqual(result.problems, ["waterfall mismatch"]);
    // Characterises AR-C06. A later lifecycle-state PR must replace this ACTIVE transition with the
    // approved exception/quarantine state policy; PR-00 deliberately records rather than fixes it.
    assert.deepEqual(transitions, ["ACTIVE"]);
  } finally {
    surveillanceClientModule.fetchSurveillance = originalFetch;
    hcsModule.selectHcsAdapter = originalHcs;
  }
});
