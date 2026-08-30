import { ConflictException } from "@nestjs/common";
import assert from "node:assert/strict";
import test from "node:test";
import { PersistenceFoundationService } from "./persistence-foundation.service";

const uniqueViolation = () => Object.assign(new Error("unique"), { code: "P2002" });

test("[PR02][IDEMPOTENCY] first command creates one in-progress record", async () => {
  let written: Record<string, unknown> | undefined;
  const service = new PersistenceFoundationService({
    idempotencyRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        written = data;
        return { ...data, id: data.id as string };
      },
    },
  } as never);
  const result = await service.beginIdempotentCommand({
    scope: "rail.case.transition",
    key: "command-001",
    requestDigest: "sha256:first",
    institutionId: "institution-001",
  });
  assert.equal(result.replay, false);
  assert.equal(result.status, "IN_PROGRESS");
  assert.equal(written?.scope, "rail.case.transition");
  assert.equal(written?.institutionId, "institution-001");
});

test("[PR02][IDEMPOTENCY] identical duplicate replays while a changed digest conflicts", async () => {
  const db = {
    idempotencyRecord: {
      create: async () => { throw uniqueViolation(); },
      findUniqueOrThrow: async () => ({
        id: "idem-existing",
        requestDigest: "sha256:same",
        status: "COMPLETED",
        responseDigest: "sha256:response",
        response: { ok: true },
        institutionId: null,
        transactionCaseId: null,
      }),
    },
  };
  const service = new PersistenceFoundationService(db as never);
  const replay = await service.beginIdempotentCommand({
    scope: "rail.external.instruction",
    key: "instruction-001",
    requestDigest: "sha256:same",
  });
  assert.equal(replay.replay, true);
  assert.equal(replay.recordId, "idem-existing");
  await assert.rejects(
    () => service.beginIdempotentCommand({
      scope: "rail.external.instruction",
      key: "instruction-001",
      requestDigest: "sha256:different",
    }),
    ConflictException,
  );
});

test("[PR02][IDEMPOTENCY] a matching digest cannot replay across an institution or case boundary", async () => {
  const service = new PersistenceFoundationService({
    idempotencyRecord: {
      create: async () => { throw uniqueViolation(); },
      findUniqueOrThrow: async () => ({
        id: "idem-existing",
        requestDigest: "sha256:same",
        status: "COMPLETED",
        responseDigest: "sha256:response",
        response: { confidential: true },
        institutionId: "institution-a",
        transactionCaseId: "case-a",
      }),
    },
  } as never);
  await assert.rejects(
    () => service.beginIdempotentCommand({
      scope: "rail.case.transition",
      key: "command-001",
      requestDigest: "sha256:same",
      institutionId: "institution-b",
      transactionCaseId: "case-a",
    }),
    (error: unknown) => error instanceof ConflictException && /ownership/.test(error.message),
  );
});

test("[PR02][IDEMPOTENCY] completing a command is a compare-and-set and retains a response digest", async () => {
  let write: Record<string, unknown> | undefined;
  const service = new PersistenceFoundationService({
    idempotencyRecord: {
      updateMany: async (args: Record<string, unknown>) => {
        write = args;
        return { count: 1 };
      },
    },
  } as never);
  const result = await service.completeIdempotentCommand("idem-1", "sha256:request", { result: "accepted" });
  assert.match(result.responseDigest, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(write?.where, { id: "idem-1", requestDigest: "sha256:request", status: "IN_PROGRESS" });
  assert.equal((write?.data as { status: string }).status, "COMPLETED");
});

test("[PR02][EXTERNAL] a repeated provider instruction cannot create a second external action", async () => {
  const existing = {
    id: "exti-existing",
    instructionType: "PAYMENT_REQUEST",
    requestDigest: "",
    institutionId: null,
    transactionCaseId: null,
  };
  const db = {
    externalInstruction: {
      create: async () => { throw uniqueViolation(); },
      findUniqueOrThrow: async () => existing,
    },
  };
  const service = new PersistenceFoundationService(db as never);
  // Calculate the canonical request digest through a successful first-write fake, then use it as the
  // persisted collision value. The next call must return the same instruction ID rather than write.
  const calculating = new PersistenceFoundationService({
    externalInstruction: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data, id: "exti-calculated" }),
    },
  } as never);
  const calculated = await calculating.createExternalInstruction({
    providerReferenceId: "provider-001",
    instructionType: "PAYMENT_REQUEST",
    idempotencyKey: "payment-001",
    request: { amountMinor: "10000", currency: "INR" },
  });
  existing.requestDigest = calculated.requestDigest;
  const replay = await service.createExternalInstruction({
    providerReferenceId: "provider-001",
    instructionType: "PAYMENT_REQUEST",
    idempotencyKey: "payment-001",
    request: { currency: "INR", amountMinor: "10000" },
  });
  assert.deepEqual(replay, {
    replay: true,
    instructionId: "exti-existing",
    requestDigest: calculated.requestDigest,
  });
});
