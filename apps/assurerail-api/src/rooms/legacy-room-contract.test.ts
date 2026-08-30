import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_ROOM_EXPORT_FORMAT,
  assertLegacyRoomRefreshExtendsPrior,
  buildLegacyRoomExportBundle,
  legacyRoomEntryHash,
  legacyRoomExportDigest,
  parseLegacyRoomExportBundle,
  type LegacyRoomExportV1,
} from "./legacy-room-contract";

function fixture(): LegacyRoomExportV1 {
  const at = "2026-08-30T10:00:00.000Z";
  const first = { roomId: "troom-1", actorDid: "did:transferor", action: "ROOM_OPENED", objectRef: "pool:pool-1", at };
  const firstHash = legacyRoomEntryHash("GENESIS", first);
  const second = { roomId: "troom-1", actorDid: "did:transferee", action: "DECLARATION_RECORDED", objectRef: "category:BANK", at: "2026-08-30T10:01:00.000Z" };
  const secondHash = legacyRoomEntryHash(firstHash, second);
  return {
    format: LEGACY_ROOM_EXPORT_FORMAT,
    source: { system: "assurecla-data-db", version: "20260830", highWaterMark: "seq:2" },
    room: {
      id: "troom-1", poolId: "pool-1", claId: "cla-1", manifestHash: `sha256:${"a".repeat(64)}`,
      transferorDid: "did:transferor", purpose: "DA", status: "OPEN", relianceTextVersion: "v1",
      declarationTextVersion: "v1", openedAt: at, closedAt: null, createdBy: "did:transferor", createdAt: at,
    },
    invites: [{
      id: "invite-1", roomId: "troom-1", transfereeDid: "did:transferee", transfereeEmail: null,
      invitedBy: "did:transferor", eligibilityCategory: "BANK", declarationHash: `sha256:${"b".repeat(64)}`,
      declarationAt: second.at, relianceAcceptedAt: second.at, status: "ACTIVE", createdAt: at,
    }],
    accessLog: [
      { id: "event-1", seq: "1", roomId: first.roomId, actorDid: first.actorDid, action: first.action, objectRef: first.objectRef, prevHash: "GENESIS", entryHash: firstHash, at: first.at },
      { id: "event-2", seq: "2", roomId: second.roomId, actorDid: second.actorDid, action: second.action, objectRef: second.objectRef, prevHash: firstHash, entryHash: secondHash, at: second.at },
    ],
    messages: [{ id: "message-1", roomId: "troom-1", authorDid: "did:transferee", authorRole: null, body: "Please confirm the tape version.", at: "2026-08-30T10:02:00.000Z" }],
    sourceSnapshot: { manifestHash: `sha256:${"a".repeat(64)}`, tapeDigest: `sha256:${"c".repeat(64)}` },
  };
}

test("[PR07][LEGACY] deterministic export validates and preserves the original chain", () => {
  const exported = fixture();
  const parsed = parseLegacyRoomExportBundle({ export: exported, exportDigest: legacyRoomExportDigest(exported) });
  assert.equal(parsed.export.accessLog[1].entryHash, exported.accessLog[1].entryHash);
  assert.equal(parsed.export.accessLog[0].prevHash, "GENESIS");
  assert.equal(parsed.exportDigest, legacyRoomExportDigest(exported));
});

test("[PR07][LEGACY] source builder normalises row order to one stable export digest", () => {
  const ordered = fixture();
  const shuffled = structuredClone(ordered);
  shuffled.accessLog.reverse();
  assert.equal(buildLegacyRoomExportBundle(shuffled).exportDigest, buildLegacyRoomExportBundle(ordered).exportDigest);
});

test("[PR07][LEGACY] tamper, cross-room rows and incomplete active declarations fail closed", () => {
  const tampered = fixture();
  tampered.accessLog[1].objectRef = "category:NBFC";
  assert.throws(() => parseLegacyRoomExportBundle({ export: tampered, exportDigest: legacyRoomExportDigest(tampered) }), /hash does not verify/);
  const crossRoom = fixture();
  crossRoom.messages[0].roomId = "other-room";
  assert.throws(() => parseLegacyRoomExportBundle({ export: crossRoom, exportDigest: legacyRoomExportDigest(crossRoom) }), /different room/);
  const ungated = fixture();
  ungated.invites[0].declarationAt = null;
  assert.throws(() => parseLegacyRoomExportBundle({ export: ungated, exportDigest: legacyRoomExportDigest(ungated) }), /lacks declaration/);
  const duplicateInvite = fixture();
  duplicateInvite.invites.push(structuredClone(duplicateInvite.invites[0]));
  assert.throws(() => parseLegacyRoomExportBundle({ export: duplicateInvite, exportDigest: legacyRoomExportDigest(duplicateInvite) }), /duplicate identity/);
  const invalidSequence = fixture();
  invalidSequence.accessLog[0].seq = "0";
  assert.throws(() => parseLegacyRoomExportBundle({ export: invalidSequence, exportDigest: legacyRoomExportDigest(invalidSequence) }), /positive decimal integer/);
});

test("[PR07][LEGACY] invite tokens are rejected and digest replay conflicts", () => {
  const exported = fixture();
  const withToken = JSON.parse(JSON.stringify(exported));
  withToken.invites[0].inviteToken = "must-not-migrate";
  assert.throws(() => parseLegacyRoomExportBundle({ export: withToken, exportDigest: legacyRoomExportDigest(exported) }), /must not be exported/);
  assert.throws(() => parseLegacyRoomExportBundle({ export: exported, exportDigest: `sha256:${"0".repeat(64)}` }), /digest does not verify/);
});

test("[PR07][LEGACY] refreshes may extend history but cannot rewrite a sealed prefix or move state backwards", () => {
  const prior = fixture();
  const next = structuredClone(prior);
  const payload = { roomId: "troom-1", actorDid: "did:transferor", action: "VIEW_TAPE", objectRef: "pool:pool-1", at: "2026-08-30T10:03:00.000Z" };
  const previous = next.accessLog.at(-1)!.entryHash;
  next.accessLog.push({ id: "event-3", seq: "3", ...payload, prevHash: previous, entryHash: legacyRoomEntryHash(previous, payload) });
  assert.doesNotThrow(() => assertLegacyRoomRefreshExtendsPrior(prior, next));
  const rewritten = structuredClone(next);
  rewritten.messages[0].body = "rewritten";
  assert.throws(() => assertLegacyRoomRefreshExtendsPrior(prior, rewritten), /message history was rewritten/);
  const backwards = structuredClone(next);
  backwards.invites[0].status = "INVITED";
  assert.throws(() => assertLegacyRoomRefreshExtendsPrior(prior, backwards), /status moved backwards/);
  const changedPolicy = structuredClone(next);
  changedPolicy.room.declarationTextVersion = "v2";
  assert.throws(() => assertLegacyRoomRefreshExtendsPrior(prior, changedPolicy), /immutable room binding/);
});
