import { createHash } from "node:crypto";
import { sha256Digest, toCanonicalValue } from "../contracts/v1";

export const LEGACY_ROOM_EXPORT_FORMAT = "assurecla.transfer-room-export.v1" as const;
export const LEGACY_ROOM_PURPOSES = ["DA", "PTC_DATA_ROOM", "RECEIVABLES_DA"] as const;
const LEGACY_ROOM_STATUSES = ["DRAFT", "OPEN", "CLOSED", "WITHDRAWN"] as const;
const LEGACY_INVITE_STATUSES = ["INVITED", "ACTIVE", "REVOKED"] as const;
const HEX_64 = /^[a-f0-9]{64}$/;

export interface LegacyRoomExportV1 {
  format: typeof LEGACY_ROOM_EXPORT_FORMAT;
  source: { system: string; version: string; highWaterMark: string };
  room: {
    id: string; poolId: string; claId: string; manifestHash: string; transferorDid: string;
    purpose: string; status: string; relianceTextVersion: string; declarationTextVersion: string;
    openedAt: string | null; closedAt: string | null; createdBy: string; createdAt: string;
  };
  invites: Array<{
    id: string; roomId: string; transfereeDid: string; transfereeEmail: string | null; invitedBy: string;
    eligibilityCategory: string | null; declarationHash: string | null; declarationAt: string | null;
    relianceAcceptedAt: string | null; status: string; createdAt: string;
  }>;
  accessLog: Array<{
    id: string; seq: string; roomId: string; actorDid: string; action: string; objectRef: string | null;
    prevHash: string; entryHash: string; at: string;
  }>;
  messages: Array<{
    id: string; roomId: string; authorDid: string; authorRole: string | null; body: string; at: string;
  }>;
  sourceSnapshot: {
    manifestHash: string; tapeDigest?: string | null; findingsDigest?: string | null; dossierDigest?: string | null;
  };
}

export interface LegacyRoomExportBundleV1 {
  export: LegacyRoomExportV1;
  exportDigest: string;
}

function required(value: unknown, name: string, max = 2_000): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  if (value.length > max) throw new Error(`${name} exceeds ${max} characters`);
  return value;
}

function nullableString(value: unknown, name: string, max = 2_000): string | null {
  return value === null || value === undefined ? null : required(value, name, max);
}

function iso(value: unknown, name: string, nullable = false): string | null {
  if (nullable && (value === null || value === undefined)) return null;
  const result = required(value, name, 80);
  if (!Number.isFinite(new Date(result).getTime())) throw new Error(`${name} must be an ISO-8601 timestamp`);
  return result;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function records(value: unknown, name: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((entry, index) => record(entry, `${name}[${index}]`));
}

function exactEnum(value: unknown, name: string, allowed: readonly string[]): string {
  const result = required(value, name, 80);
  if (!allowed.includes(result)) throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  return result;
}

function positiveSequence(value: unknown, name: string): string {
  const result = required(value, name, 40);
  if (!/^[1-9][0-9]*$/.test(result)) throw new Error(`${name} must be a positive decimal integer`);
  return result;
}

function assertUnique(values: string[], name: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${name} contains a duplicate identity`);
}

function legacyCanonical(value: unknown): string {
  if (value === null) return "null";
  if (["string", "boolean", "number"].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(legacyCanonical).sort().join(",")}]`;
  const source = record(value, "legacy hash value");
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${legacyCanonical(source[key])}`).join(",")}}`;
}

export function legacyRoomEntryHash(previousHash: string, payload: {
  roomId: string; actorDid: string; action: string; objectRef: string | null; at: string;
}): string {
  return createHash("sha256").update(legacyCanonical({ prevHash: previousHash, payload }), "utf8").digest("hex");
}

export function legacyRoomExportDigest(value: LegacyRoomExportV1): string {
  return sha256Digest({
    ...value,
    sourceSnapshot: {
      manifestHash: value.sourceSnapshot.manifestHash,
      tapeDigest: value.sourceSnapshot.tapeDigest ?? null,
      findingsDigest: value.sourceSnapshot.findingsDigest ?? null,
      dossierDigest: value.sourceSnapshot.dossierDigest ?? null,
    },
  });
}

/** Deterministic source-side builder used by an offline/export adapter; it never exports invite tokens. */
export function buildLegacyRoomExportBundle(value: LegacyRoomExportV1): LegacyRoomExportBundleV1 {
  const normalized = structuredClone(value);
  normalized.invites.sort((left, right) => left.id.localeCompare(right.id));
  normalized.messages.sort((left, right) => left.at.localeCompare(right.at) || left.id.localeCompare(right.id));
  normalized.accessLog.sort((left, right) => BigInt(left.seq) < BigInt(right.seq) ? -1 : BigInt(left.seq) > BigInt(right.seq) ? 1 : 0);
  return parseLegacyRoomExportBundle({ export: normalized, exportDigest: legacyRoomExportDigest(normalized) });
}

export function parseLegacyRoomExportBundle(value: unknown): LegacyRoomExportBundleV1 {
  const root = record(value, "bundle");
  const raw = record(root.export, "bundle.export");
  const source = record(raw.source, "export.source");
  const room = record(raw.room, "export.room");
  const sourceSnapshot = record(raw.sourceSnapshot, "export.sourceSnapshot");
  if (raw.format !== LEGACY_ROOM_EXPORT_FORMAT) throw new Error(`export.format must be ${LEGACY_ROOM_EXPORT_FORMAT}`);
  const roomId = required(room.id, "room.id", 200);
  const parsed: LegacyRoomExportV1 = {
    format: LEGACY_ROOM_EXPORT_FORMAT,
    source: {
      system: required(source.system, "source.system", 160),
      version: required(source.version, "source.version", 160),
      highWaterMark: required(source.highWaterMark, "source.highWaterMark", 300),
    },
    room: {
      id: roomId,
      poolId: required(room.poolId, "room.poolId", 200),
      claId: required(room.claId, "room.claId", 200),
      manifestHash: required(room.manifestHash, "room.manifestHash", 200),
      transferorDid: required(room.transferorDid, "room.transferorDid", 500),
      purpose: exactEnum(room.purpose, "room.purpose", LEGACY_ROOM_PURPOSES),
      status: exactEnum(room.status, "room.status", LEGACY_ROOM_STATUSES),
      relianceTextVersion: required(room.relianceTextVersion, "room.relianceTextVersion", 100),
      declarationTextVersion: required(room.declarationTextVersion, "room.declarationTextVersion", 100),
      openedAt: iso(room.openedAt, "room.openedAt", true),
      closedAt: iso(room.closedAt, "room.closedAt", true),
      createdBy: required(room.createdBy, "room.createdBy", 500),
      createdAt: iso(room.createdAt, "room.createdAt")!,
    },
    invites: records(raw.invites, "export.invites").map((invite, index) => {
      if ("inviteToken" in invite) throw new Error(`invites[${index}].inviteToken must not be exported or migrated`);
      return {
        id: required(invite.id, `invites[${index}].id`, 200),
        roomId: required(invite.roomId, `invites[${index}].roomId`, 200),
        transfereeDid: required(invite.transfereeDid, `invites[${index}].transfereeDid`, 500),
        transfereeEmail: nullableString(invite.transfereeEmail, `invites[${index}].transfereeEmail`, 320),
        invitedBy: required(invite.invitedBy, `invites[${index}].invitedBy`, 500),
        eligibilityCategory: nullableString(invite.eligibilityCategory, `invites[${index}].eligibilityCategory`, 160),
        declarationHash: nullableString(invite.declarationHash, `invites[${index}].declarationHash`, 200),
        declarationAt: iso(invite.declarationAt, `invites[${index}].declarationAt`, true),
        relianceAcceptedAt: iso(invite.relianceAcceptedAt, `invites[${index}].relianceAcceptedAt`, true),
        status: exactEnum(invite.status, `invites[${index}].status`, LEGACY_INVITE_STATUSES),
        createdAt: iso(invite.createdAt, `invites[${index}].createdAt`)!,
      };
    }),
    accessLog: records(raw.accessLog, "export.accessLog").map((event, index) => ({
      id: required(event.id, `accessLog[${index}].id`, 200),
      seq: positiveSequence(event.seq, `accessLog[${index}].seq`),
      roomId: required(event.roomId, `accessLog[${index}].roomId`, 200),
      actorDid: required(event.actorDid, `accessLog[${index}].actorDid`, 500),
      action: required(event.action, `accessLog[${index}].action`, 160),
      objectRef: nullableString(event.objectRef, `accessLog[${index}].objectRef`, 500),
      prevHash: required(event.prevHash, `accessLog[${index}].prevHash`, 80),
      entryHash: required(event.entryHash, `accessLog[${index}].entryHash`, 80),
      at: iso(event.at, `accessLog[${index}].at`)!,
    })),
    messages: records(raw.messages, "export.messages").map((message, index) => ({
      id: required(message.id, `messages[${index}].id`, 200),
      roomId: required(message.roomId, `messages[${index}].roomId`, 200),
      authorDid: required(message.authorDid, `messages[${index}].authorDid`, 500),
      authorRole: nullableString(message.authorRole, `messages[${index}].authorRole`, 80),
      body: required(message.body, `messages[${index}].body`, 20_000),
      at: iso(message.at, `messages[${index}].at`)!,
    })),
    sourceSnapshot: {
      manifestHash: required(sourceSnapshot.manifestHash, "sourceSnapshot.manifestHash", 200),
      tapeDigest: nullableString(sourceSnapshot.tapeDigest, "sourceSnapshot.tapeDigest", 200),
      findingsDigest: nullableString(sourceSnapshot.findingsDigest, "sourceSnapshot.findingsDigest", 200),
      dossierDigest: nullableString(sourceSnapshot.dossierDigest, "sourceSnapshot.dossierDigest", 200),
    },
  };
  assertUnique(parsed.invites.map((item) => item.id), "export.invites");
  assertUnique(parsed.invites.map((item) => item.transfereeDid), "export.invites.transfereeDid");
  assertUnique(parsed.accessLog.map((item) => item.id), "export.accessLog");
  assertUnique(parsed.messages.map((item) => item.id), "export.messages");
  parsed.invites.sort((left, right) => left.id.localeCompare(right.id));
  parsed.messages.sort((left, right) => left.at.localeCompare(right.at) || left.id.localeCompare(right.id));
  parsed.accessLog.sort((left, right) => BigInt(left.seq) < BigInt(right.seq) ? -1 : BigInt(left.seq) > BigInt(right.seq) ? 1 : 0);
  if (parsed.sourceSnapshot.manifestHash !== parsed.room.manifestHash) throw new Error("source snapshot manifest does not match the room binding");
  if (parsed.invites.some((item) => item.roomId !== roomId) || parsed.messages.some((item) => item.roomId !== roomId)
    || parsed.accessLog.some((item) => item.roomId !== roomId)) throw new Error("legacy child record belongs to a different room");
  if (parsed.invites.some((item) => item.status === "ACTIVE" && (!item.declarationHash || !item.declarationAt || !item.relianceAcceptedAt))) {
    throw new Error("active legacy invite lacks declaration or reliance evidence");
  }
  let previous = "GENESIS";
  let previousSequence = -1n;
  for (const [index, event] of parsed.accessLog.entries()) {
    const sequence = BigInt(event.seq);
    if (sequence <= previousSequence) throw new Error(`accessLog[${index}].seq is not strictly increasing`);
    if (event.prevHash !== previous) throw new Error(`accessLog[${index}] does not link to the preceding hash`);
    if (!HEX_64.test(event.entryHash) || legacyRoomEntryHash(previous, {
      roomId: event.roomId, actorDid: event.actorDid, action: event.action, objectRef: event.objectRef, at: event.at,
    }) !== event.entryHash) throw new Error(`accessLog[${index}] hash does not verify`);
    previous = event.entryHash;
    previousSequence = sequence;
  }
  const exportDigest = required(root.exportDigest, "bundle.exportDigest", 80);
  const computed = legacyRoomExportDigest(parsed);
  if (exportDigest !== computed) throw new Error("legacy export digest does not verify");
  return { export: toCanonicalValue(parsed) as unknown as LegacyRoomExportV1, exportDigest: computed };
}

export function legacyRoomCounts(value: LegacyRoomExportV1) {
  return {
    rooms: 1,
    invites: value.invites.length,
    accessEvents: value.accessLog.length,
    messages: value.messages.length,
    total: 1 + value.invites.length + value.accessLog.length + value.messages.length,
  };
}

export function legacyRoomChainTail(value: LegacyRoomExportV1): string {
  return value.accessLog.at(-1)?.entryHash ?? "GENESIS";
}

/** A later snapshot may only extend append-only rows and advance invitation/room states. */
export function assertLegacyRoomRefreshExtendsPrior(prior: LegacyRoomExportV1, next: LegacyRoomExportV1): void {
  const stableBinding = (value: LegacyRoomExportV1) => ({
    id: value.room.id, poolId: value.room.poolId, claId: value.room.claId,
    manifestHash: value.room.manifestHash, transferorDid: value.room.transferorDid,
    purpose: value.room.purpose, relianceTextVersion: value.room.relianceTextVersion,
    declarationTextVersion: value.room.declarationTextVersion,
    createdBy: value.room.createdBy, createdAt: value.room.createdAt,
  });
  if (sha256Digest(stableBinding(prior)) !== sha256Digest(stableBinding(next))) throw new Error("legacy room refresh changed an immutable room binding");
  const roomTransitions: Record<string, readonly string[]> = {
    DRAFT: ["DRAFT", "OPEN", "CLOSED", "WITHDRAWN"], OPEN: ["OPEN", "CLOSED", "WITHDRAWN"],
    CLOSED: ["CLOSED"], WITHDRAWN: ["WITHDRAWN"],
  };
  if (!(roomTransitions[prior.room.status] ?? []).includes(next.room.status)) throw new Error("legacy room status moved backwards or changed after terminal state");
  if (prior.room.openedAt && prior.room.openedAt !== next.room.openedAt) throw new Error("legacy room open time was rewritten");
  if (prior.room.closedAt && prior.room.closedAt !== next.room.closedAt) throw new Error("legacy room close time was rewritten");
  if (["OPEN", "CLOSED", "WITHDRAWN"].includes(next.room.status) && !next.room.openedAt) throw new Error("legacy room status lacks its open time");
  if (["CLOSED", "WITHDRAWN"].includes(next.room.status) && !next.room.closedAt) throw new Error("terminal legacy room lacks its close time");
  if (next.accessLog.length < prior.accessLog.length || next.messages.length < prior.messages.length || next.invites.length < prior.invites.length) {
    throw new Error("legacy room refresh removed previously sealed child records");
  }
  for (let index = 0; index < prior.accessLog.length; index += 1) {
    if (sha256Digest(prior.accessLog[index]) !== sha256Digest(next.accessLog[index])) throw new Error("legacy access chain did not extend its exact prior prefix");
  }
  for (let index = 0; index < prior.messages.length; index += 1) {
    if (sha256Digest(prior.messages[index]) !== sha256Digest(next.messages[index])) throw new Error("legacy message history was rewritten");
  }
  const inviteTransitions: Record<string, readonly string[]> = {
    INVITED: ["INVITED", "ACTIVE", "REVOKED"], ACTIVE: ["ACTIVE", "REVOKED"], REVOKED: ["REVOKED"],
  };
  const nextInvites = new Map(next.invites.map((item) => [item.id, item]));
  for (const oldInvite of prior.invites) {
    const refreshed = nextInvites.get(oldInvite.id);
    if (!refreshed || refreshed.transfereeDid !== oldInvite.transfereeDid || refreshed.roomId !== oldInvite.roomId
      || refreshed.createdAt !== oldInvite.createdAt) throw new Error("legacy invite identity was rewritten");
    if (!(inviteTransitions[oldInvite.status] ?? []).includes(refreshed.status)) throw new Error("legacy invite status moved backwards");
    if (oldInvite.status !== "INVITED" && (oldInvite.invitedBy !== refreshed.invitedBy || oldInvite.transfereeEmail !== refreshed.transfereeEmail)) {
      throw new Error("legacy invite attribution was rewritten after activation or revocation");
    }
    if (oldInvite.eligibilityCategory && oldInvite.eligibilityCategory !== refreshed.eligibilityCategory) throw new Error("legacy invite classification was rewritten");
    if (oldInvite.declarationHash && oldInvite.declarationHash !== refreshed.declarationHash) throw new Error("legacy declaration evidence was rewritten");
    if (oldInvite.declarationAt && oldInvite.declarationAt !== refreshed.declarationAt) throw new Error("legacy declaration time was rewritten");
    if (oldInvite.relianceAcceptedAt && oldInvite.relianceAcceptedAt !== refreshed.relianceAcceptedAt) throw new Error("legacy reliance acceptance was rewritten");
  }
}
