import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { EvidenceIntakeService } from "./evidence-intake.service";

function service() {
  return new EvidenceIntakeService(
    {} as never,
    { requireHuman: async () => ({}) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

async function shadow<T>(work: () => Promise<T>): Promise<T> {
  const previousIngress = process.env.ARAIL_NEUTRAL_INGRESS_V1;
  const previousAdmission = process.env.ARAIL_PARTICIPANT_ADMISSION_V1;
  process.env.ARAIL_NEUTRAL_INGRESS_V1 = "shadow";
  process.env.ARAIL_PARTICIPANT_ADMISSION_V1 = "shadow";
  try { return await work(); }
  finally {
    if (previousIngress === undefined) delete process.env.ARAIL_NEUTRAL_INGRESS_V1; else process.env.ARAIL_NEUTRAL_INGRESS_V1 = previousIngress;
    if (previousAdmission === undefined) delete process.env.ARAIL_PARTICIPANT_ADMISSION_V1; else process.env.ARAIL_PARTICIPANT_ADMISSION_V1 = previousAdmission;
  }
}

test("[PR05][TRUST] JSON intake cannot promote a participant assertion into VERIFIED", async () => {
  await assert.rejects(() => shadow(() => service().ingestJson("user-1", "inst-1", {
    result: "VERIFIED",
    envelope: {} as never,
  })), /cannot self-assert/);
});

test("[PR05][TRUST] document intake cannot promote a participant assertion into VERIFIED", async () => {
  await assert.rejects(() => shadow(() => service().ingestDocument("user-1", "inst-1", Readable.from(Buffer.from("test")), {
    result: "VERIFIED",
  })), /cannot self-assert/);
});
