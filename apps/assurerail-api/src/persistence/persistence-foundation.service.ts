import { ConflictException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import {
  assertValidNeutralEnvelopeV1,
  sha256Digest,
  toCanonicalValue,
  type NeutralAcknowledgementEnvelopeV1,
  type NeutralIntakeEnvelopeV1,
} from "../contracts/v1";
import { PrismaService } from "../store/prisma.service";

export interface OwnershipScope {
  readonly institutionId?: string;
  readonly transactionCaseId?: string;
}

export interface IdempotentCommandInput extends OwnershipScope {
  readonly scope: string;
  readonly key: string;
  readonly requestDigest: string;
  readonly expiresAt?: Date;
}

export type IdempotentCommandResult =
  | { readonly replay: false; readonly recordId: string; readonly status: "IN_PROGRESS" }
  | {
    readonly replay: true;
    readonly recordId: string;
    readonly status: string;
    readonly responseDigest: string | null;
    readonly response: Prisma.JsonValue | null;
  };

function isUniqueConstraint(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

function json(value: unknown): Prisma.InputJsonValue {
  return toCanonicalValue(value) as unknown as Prisma.InputJsonValue;
}

function required(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  return trimmed;
}

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sameScope(
  stored: { institutionId: string | null; transactionCaseId: string | null },
  requested: { institutionId: string | null; transactionCaseId: string | null },
): boolean {
  return stored.institutionId === requested.institutionId
    && stored.transactionCaseId === requested.transactionCaseId;
}

/**
 * PR-02's internal persistence boundary. It is intentionally not a controller and grants no route
 * entitlement. Later case/ingress services call it after their own authz and route validation.
 */
@Injectable()
export class PersistenceFoundationService {
  constructor(private readonly db: PrismaService) {}

  async beginIdempotentCommand(input: IdempotentCommandInput): Promise<IdempotentCommandResult> {
    const scope = required(input.scope, "scope");
    const key = required(input.key, "key");
    const requestDigest = required(input.requestDigest, "requestDigest");
    const institutionId = optional(input.institutionId);
    const transactionCaseId = optional(input.transactionCaseId);
    try {
      const created = await this.db.idempotencyRecord.create({
        data: {
          id: `idem_${randomUUID()}`,
          scope,
          key,
          requestDigest,
          institutionId,
          transactionCaseId,
          expiresAt: input.expiresAt ?? null,
        },
      });
      return { replay: false, recordId: created.id, status: "IN_PROGRESS" };
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const existing = await this.db.idempotencyRecord.findUniqueOrThrow({
        where: { scope_key: { scope, key } },
      });
      if (existing.requestDigest !== requestDigest || !sameScope(existing, { institutionId, transactionCaseId })) {
        throw new ConflictException(`idempotency key ${scope}/${key} was already used for different request content or ownership`);
      }
      return {
        replay: true,
        recordId: existing.id,
        status: existing.status,
        responseDigest: existing.responseDigest,
        response: existing.response,
      };
    }
  }

  async completeIdempotentCommand(
    recordId: string,
    requestDigest: string,
    response: unknown,
  ): Promise<{ responseDigest: string }> {
    const canonicalResponse = json(response);
    const responseDigest = sha256Digest(canonicalResponse);
    const updated = await this.db.idempotencyRecord.updateMany({
      where: { id: recordId, requestDigest, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        response: canonicalResponse,
        responseDigest,
        completedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new ConflictException("idempotent command is absent, already terminal, or has a different request digest");
    return { responseDigest };
  }

  async persistIntake(
    providerReferenceId: string,
    carrier: string,
    envelope: NeutralIntakeEnvelopeV1,
    storageRef?: string,
  ): Promise<{ replay: boolean; submissionId: string; receiptId: string; receiptDigest: string }> {
    assertValidNeutralEnvelopeV1(envelope);
    const providerId = required(providerReferenceId, "providerReferenceId");
    const normalizedCarrier = required(carrier, "carrier");
    const signatureDigest = envelope.signature.signedDigest;
    await this.assertEnvelopeProvider(providerId, envelope.provider.institutionRef);
    try {
      return await this.db.$transaction(async (tx) => {
        const submission = await tx.intakeSubmission.create({
          data: {
            id: `int_${randomUUID()}`,
            providerReferenceId: providerId,
            transactionCaseId: envelope.transactionCaseId,
            idempotencyKey: envelope.idempotencyKey,
            carrier: normalizedCarrier,
            schemaId: envelope.schemaId,
            schemaVersion: envelope.schemaVersion,
            payloadDigest: envelope.payloadDigest,
            signatureDigest,
            signatureStatus: envelope.signature.status,
            storageRef: storageRef ?? null,
            payload: json(envelope.payload),
            validationStatus: "VALID",
            validationDetail: json({ schemaId: envelope.schemaId, schemaVersion: envelope.schemaVersion }),
            receivedAt: new Date(envelope.receivedAt),
          },
        });
        const receiptDigest = sha256Digest({
          intakeSubmissionId: submission.id,
          payloadDigest: submission.payloadDigest,
          status: "ACCEPTED",
        });
        const receipt = await tx.intakeReceipt.create({
          data: {
            id: `inr_${randomUUID()}`,
            intakeSubmissionId: submission.id,
            status: "ACCEPTED",
            receiptDigest,
            transactionCaseId: envelope.transactionCaseId,
          },
        });
        return { replay: false, submissionId: submission.id, receiptId: receipt.id, receiptDigest };
      });
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const existing = await this.db.intakeSubmission.findUniqueOrThrow({
        where: { providerReferenceId_idempotencyKey: { providerReferenceId: providerId, idempotencyKey: envelope.idempotencyKey } },
      });
      if (
        existing.payloadDigest !== envelope.payloadDigest
        || existing.schemaId !== envelope.schemaId
        || existing.schemaVersion !== envelope.schemaVersion
        || existing.transactionCaseId !== envelope.transactionCaseId
      ) {
        throw new ConflictException("intake idempotency key was already used for different content or schema");
      }
      const receipt = await this.db.intakeReceipt.findUniqueOrThrow({ where: { intakeSubmissionId: existing.id } });
      return { replay: true, submissionId: existing.id, receiptId: receipt.id, receiptDigest: receipt.receiptDigest };
    }
  }

  async receiveInbox(input: {
    providerReferenceId: string;
    externalMessageId: string;
    idempotencyKey: string;
    schemaId: string;
    schemaVersion: string;
    payload: unknown;
    signatureStatus: string;
    storageRef?: string;
  } & OwnershipScope): Promise<{ replay: boolean; messageId: string }> {
    const payload = json(input.payload);
    const payloadDigest = sha256Digest(payload);
    const providerReferenceId = required(input.providerReferenceId, "providerReferenceId");
    const externalMessageId = required(input.externalMessageId, "externalMessageId");
    const idempotencyKey = required(input.idempotencyKey, "idempotencyKey");
    const institutionId = optional(input.institutionId);
    const transactionCaseId = optional(input.transactionCaseId);
    try {
      const message = await this.db.inboxMessage.create({
        data: {
          id: `inb_${randomUUID()}`,
          providerReferenceId,
          externalMessageId,
          idempotencyKey,
          schemaId: required(input.schemaId, "schemaId"),
          schemaVersion: required(input.schemaVersion, "schemaVersion"),
          payloadDigest,
          payload,
          storageRef: input.storageRef ?? null,
          signatureStatus: required(input.signatureStatus, "signatureStatus"),
          institutionId,
          transactionCaseId,
        },
      });
      return { replay: false, messageId: message.id };
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const existing = await this.db.inboxMessage.findFirstOrThrow({
        where: {
          providerReferenceId,
          OR: [{ externalMessageId }, { idempotencyKey }],
        },
      });
      if (
        existing.externalMessageId !== externalMessageId
        || existing.idempotencyKey !== idempotencyKey
        || existing.payloadDigest !== payloadDigest
        || existing.schemaId !== input.schemaId
        || existing.schemaVersion !== input.schemaVersion
        || !sameScope(existing, { institutionId, transactionCaseId })
      ) {
        throw new ConflictException("inbox message identifier was already used for different content or schema");
      }
      return { replay: true, messageId: existing.id };
    }
  }

  async createExternalInstruction(input: {
    providerReferenceId: string;
    instructionType: string;
    idempotencyKey: string;
    request: unknown;
    storageRef?: string;
  } & OwnershipScope): Promise<{ replay: boolean; instructionId: string; requestDigest: string }> {
    const request = json(input.request);
    const requestDigest = sha256Digest(request);
    const providerReferenceId = required(input.providerReferenceId, "providerReferenceId");
    const idempotencyKey = required(input.idempotencyKey, "idempotencyKey");
    const institutionId = optional(input.institutionId);
    const transactionCaseId = optional(input.transactionCaseId);
    try {
      const instruction = await this.db.externalInstruction.create({
        data: {
          id: `exti_${randomUUID()}`,
          providerReferenceId,
          instructionType: required(input.instructionType, "instructionType"),
          idempotencyKey,
          requestDigest,
          request,
          storageRef: input.storageRef ?? null,
          institutionId,
          transactionCaseId,
        },
      });
      return { replay: false, instructionId: instruction.id, requestDigest };
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const existing = await this.db.externalInstruction.findUniqueOrThrow({
        where: { providerReferenceId_idempotencyKey: { providerReferenceId, idempotencyKey } },
      });
      if (
        existing.requestDigest !== requestDigest
        || existing.instructionType !== input.instructionType
        || !sameScope(existing, { institutionId, transactionCaseId })
      ) {
        throw new ConflictException("external instruction idempotency key was already used for a different instruction");
      }
      return { replay: true, instructionId: existing.id, requestDigest };
    }
  }

  async recordExternalAcknowledgement(
    providerReferenceId: string,
    envelope: NeutralAcknowledgementEnvelopeV1,
    storageRef?: string,
  ): Promise<{ replay: boolean; acknowledgementId: string }> {
    assertValidNeutralEnvelopeV1(envelope);
    const providerId = required(providerReferenceId, "providerReferenceId");
    const externalAcknowledgementId = required(envelope.externalReference ?? envelope.envelopeId, "externalAcknowledgementId");
    await this.assertEnvelopeProvider(providerId, envelope.provider.institutionRef);
    const instruction = await this.db.externalInstruction.findUniqueOrThrow({
      where: { id: envelope.instructionId },
      select: { providerReferenceId: true, transactionCaseId: true },
    });
    if (instruction.providerReferenceId !== providerId) {
      throw new ConflictException("external acknowledgement provider does not own the referenced instruction");
    }
    if (instruction.transactionCaseId !== envelope.transactionCaseId) {
      throw new ConflictException("external acknowledgement transaction case does not match the instruction");
    }
    try {
      const acknowledgement = await this.db.externalAcknowledgement.create({
        data: {
          id: `exta_${randomUUID()}`,
          externalInstructionId: envelope.instructionId,
          providerReferenceId: providerId,
          externalAcknowledgementId,
          status: envelope.status,
          finalityClass: envelope.finality,
          responseDigest: envelope.responseDigest,
          response: json(envelope),
          storageRef: storageRef ?? null,
          signatureStatus: envelope.signature.status,
          acknowledgedAt: new Date(envelope.occurredAt),
          transactionCaseId: envelope.transactionCaseId,
        },
      });
      return { replay: false, acknowledgementId: acknowledgement.id };
    } catch (error) {
      if (!isUniqueConstraint(error)) throw error;
      const existing = await this.db.externalAcknowledgement.findFirstOrThrow({
        where: {
          providerReferenceId: providerId,
          OR: [{ externalAcknowledgementId }, { externalInstructionId: envelope.instructionId, responseDigest: envelope.responseDigest }],
        },
      });
      if (
        existing.externalAcknowledgementId !== externalAcknowledgementId
        || existing.externalInstructionId !== envelope.instructionId
        || existing.responseDigest !== envelope.responseDigest
      ) {
        throw new ConflictException("external acknowledgement identifier was already used for a different response");
      }
      return { replay: true, acknowledgementId: existing.id };
    }
  }

  private async assertEnvelopeProvider(providerReferenceId: string, envelopeInstitutionRef: string): Promise<void> {
    const provider = await this.db.providerReference.findUniqueOrThrow({
      where: { id: providerReferenceId },
      select: { providerKey: true },
    });
    if (provider.providerKey !== envelopeInstitutionRef) {
      throw new ConflictException("neutral envelope provider does not match the Rail provider reference");
    }
  }
}
