import assert from "node:assert/strict";
import test from "node:test";
import { AmortiseService } from "../amortise/amortise.service";
import { BreakGlassService } from "../breakglass/breakglass.service";
import { CloseService } from "../closure/close.service";
import { DvpService } from "../dvp/dvp.service";
import type { VenueEventBus } from "../events/venue-events";
import type { MintRepository, NoteRecord } from "../mint/note.repository";
import { ReportsService } from "../reports/reports.service";
import type { AuditService } from "../store/audit.service";
import { SurveillanceService } from "../surveillance/surveillance.service";

const note: NoteRecord = {
  id: "note-governed",
  poolId: "pool-governed",
  tapeHash: "tape-governed",
  manifestHash: "manifest-governed",
  tokenId: "0.0.11",
  serials: [1],
  t1Aggregates: { mintableMinor: "100" },
  state: "ACTIVE",
  createdAt: "2026-09-01T00:00:00.000Z",
};

const repo = {
  getNote: async () => note,
  isGovernedTokenRepresentation: async () => true,
} as unknown as MintRepository;
const events = { emit: () => undefined } as unknown as VenueEventBus;
const audit = { append: async () => undefined } as unknown as AuditService;

test("[PR11][COMPAT] linked Notes cannot use any direct legacy external-effect path", async () => {
  await assert.rejects(new DvpService(repo, events, audit).execute(note.id, { buyerDid: "did:buyer", unitsMinor: "1", priceMinor: "1" }), /governed token representation/);
  await assert.rejects(new AmortiseService(repo, events, audit).amortise(note.id, { principalMinor: "1" }), /governed token representation/);
  await assert.rejects(new CloseService(repo, events, audit).close(note.id, { reason: "manual" }), /governed token representation/);
  await assert.rejects(new SurveillanceService(repo).sync(note.id), /governed token representation/);
  await assert.rejects(new BreakGlassService(repo).request(note.id, { regulatorDid: "did:regulator", lawfulPurpose: "lawful purpose" }), /governed token representation/);
  await assert.rejects(new DvpService(repo, events, audit).holdings(note.id), /note not found/);
  await assert.rejects(new SurveillanceService(repo).list(note.id), /note not found/);
  await assert.rejects(new ReportsService(repo).noteReport(note.id), /note not found/);
});
