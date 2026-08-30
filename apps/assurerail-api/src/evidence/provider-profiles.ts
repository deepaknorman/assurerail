import { BadRequestException } from "@nestjs/common";
import type { NeutralIntakeEnvelopeV1 } from "../contracts/v1";

export const INTAKE_PROFILE_IDS = [
  "assurerail.neutral-intake.v1",
  "assurepool.frozen-da-tape",
  "common-lender-registry.v1",
  "assuretransfer.receivables-da",
] as const;
export type IntakeProfileId = (typeof INTAKE_PROFILE_IDS)[number];

export const INTEGRATION_PROFILE_IDS = [
  ...INTAKE_PROFILE_IDS,
  "assurerail.legacy-room-proxy.v1",
  "assurepool.completion-ack.v1",
] as const;
export type IntegrationProfileId = (typeof INTEGRATION_PROFILE_IDS)[number];

export interface ConnectorSchemaProfile {
  readonly profileRef: IntegrationProfileId;
  readonly schemaId: string;
  readonly schemaVersion: string;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`${path} is required`);
  return value.trim();
}

export function parseConnectorSchemaProfiles(value: unknown): ConnectorSchemaProfile[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new BadRequestException("schemaProfiles must contain 1 to 20 declared profiles");
  }
  const profiles = value.map((entry, index) => {
    const candidate = object(entry, `schemaProfiles[${index}]`);
    const profileRef = nonEmpty(candidate.profileRef, `schemaProfiles[${index}].profileRef`);
    if (!INTEGRATION_PROFILE_IDS.includes(profileRef as IntegrationProfileId)) {
      throw new BadRequestException(`unsupported schemaProfiles[${index}].profileRef`);
    }
    return {
      profileRef: profileRef as IntegrationProfileId,
      schemaId: nonEmpty(candidate.schemaId, `schemaProfiles[${index}].schemaId`),
      schemaVersion: nonEmpty(candidate.schemaVersion, `schemaProfiles[${index}].schemaVersion`),
    };
  });
  const keys = new Set(profiles.map((profile) => `${profile.profileRef}|${profile.schemaId}|${profile.schemaVersion}`));
  if (keys.size !== profiles.length) throw new BadRequestException("schemaProfiles contains a duplicate declaration");
  return profiles;
}

export function assertConformancePassed(value: unknown): void {
  const result = object(value, "conformanceResult");
  if (result.passed !== true) throw new BadRequestException("connector conformance has not passed");
  if (!Array.isArray(result.criticalFailures) || result.criticalFailures.length !== 0) {
    throw new BadRequestException("connector conformance has unresolved critical failures");
  }
  if (typeof result.executedTests !== "number" || !Number.isInteger(result.executedTests) || result.executedTests < 1) {
    throw new BadRequestException("connector conformance must record at least one executed test");
  }
}

function extensionProfile(envelope: NeutralIntakeEnvelopeV1): string | null {
  const extensions = envelope.payload.extensions;
  if (!extensions || typeof extensions !== "object" || Array.isArray(extensions)) return null;
  const profileId = (extensions as Record<string, unknown>).profileId;
  return typeof profileId === "string" ? profileId : null;
}

/** Profile checks are deliberately narrow: a generic envelope cannot impersonate an approved source adapter. */
export function assertIntakeProfile(profileRef: string, envelope: NeutralIntakeEnvelopeV1): void {
  if (!INTAKE_PROFILE_IDS.includes(profileRef as IntakeProfileId)) throw new BadRequestException("unsupported intake profile");
  const declared = extensionProfile(envelope);
  if (profileRef === "assurerail.neutral-intake.v1") {
    if (declared && declared !== profileRef) throw new BadRequestException("generic intake profile conflicts with payload extension profile");
    return;
  }
  if (declared !== profileRef) throw new BadRequestException("payload extension profile does not match the certified connector profile");
  if (profileRef === "assurepool.frozen-da-tape") {
    if (envelope.transaction.transactionRoute !== "DA" || envelope.source.sourceObjectType !== "FROZEN_ASSET_TAPE") {
      throw new BadRequestException("AssurePool profile is restricted to frozen DA tapes");
    }
    const normalized = object(envelope.payload.normalized, "payload.normalized");
    nonEmpty(normalized.sourceManifestDigest, "payload.normalized.sourceManifestDigest");
  }
  if (profileRef === "assuretransfer.receivables-da" && envelope.transaction.transactionRoute !== "DA") {
    throw new BadRequestException("AssureTransfer receivables profile is restricted to DA");
  }
  if (profileRef === "common-lender-registry.v1") {
    if (envelope.source.sourceObjectType !== "COMMON_LENDER_REGISTRY_SNAPSHOT") {
      throw new BadRequestException("common lender registry profile requires a registry snapshot source object");
    }
    const normalized = object(envelope.payload.normalized, "payload.normalized");
    if (!/^(0|[1-9]\d*)$/.test(String(normalized.recordCount ?? ""))) {
      throw new BadRequestException("common lender registry recordCount must be a non-negative integer");
    }
    nonEmpty(normalized.recordsDigest, "payload.normalized.recordsDigest");
  }
}
