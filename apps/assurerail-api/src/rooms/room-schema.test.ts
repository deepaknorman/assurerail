import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

test("[PR07][SCHEMA] legacy chains are sealed separately and room history is restrictive", () => {
  for (const model of ["CaseRoom", "RoomGrant", "RoomAccessEvent", "RoomMessage", "LegacyRoomImport", "RoomParityRun", "RoomParityBreak"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  const events = schema.slice(schema.indexOf("model RoomAccessEvent {"), schema.indexOf("model RoomMessage {"));
  assert.match(events, /sequence\s+BigInt/);
  assert.match(events, /chainOrigin\s+String/);
  assert.match(events, /hashRoomReference\s+String/);
  const imported = schema.slice(schema.indexOf("model LegacyRoomImport {"), schema.indexOf("model RoomParityRun {"));
  assert.match(imported, /sealedExport\s+Json/);
  assert.match(imported, /chainTailHash\s+String/);
});
