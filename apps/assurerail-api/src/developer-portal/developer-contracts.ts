import { sha256Digest, toCanonicalValue } from "../contracts/v1";

export const DEVELOPER_CONTRACT_CATALOGUE_V1 = Object.freeze({
  catalogueVersion: "1.0.0",
  authority: "API enforcement; documentation does not grant an action",
  authentication: { human: "Bearer session + x-assurerail-institution-id", service: "institution-owned client credential (activation separately gated)" },
  idempotency: { header: "Idempotency-Key or contract field idempotencyKey", reuse: "same scope and canonical request digest only" },
  eventEnvelope: { required: ["eventId", "schemaVersion", "institutionId", "occurredAt", "recordedAt", "correlationId", "payloadDigest"] },
  contracts: [
    { id: "neutral-intake", version: "1.0.0", schemaId: "assurerail.neutral-intake-envelope", direction: "INBOUND" },
    { id: "neutral-acknowledgement", version: "1.0.0", schemaId: "assurerail.neutral-acknowledgement-envelope", direction: "BIDIRECTIONAL" },
    { id: "venue-event", version: "1.0.0", schemaId: "assurerail.venue-event", direction: "OUTBOUND" },
  ],
});

export const SANDBOX_FIXTURE_SET_V1 = Object.freeze({
  fixtureSetVersion: "1.0.0",
  sandboxNonEvidence: true,
  warning: "Synthetic fixtures prove software behaviour only. They are not transaction, legal, trustee, connector-certification or authoritative-record evidence.",
  fixtures: [
    { id: "valid-idempotent-replay", expectedStatus: "ACCEPTED", purpose: "same key and canonical digest returns the original receipt" },
    { id: "conflicting-idempotency-key", expectedStatus: "REJECTED", purpose: "same key with a different digest fails closed" },
    { id: "unknown-taxonomy-value", expectedStatus: "REJECTED", purpose: "unknown route values cannot silently pass" },
    { id: "stale-evidence", expectedStatus: "REVIEW_REQUIRED", purpose: "expired evidence cannot satisfy a gate" },
    { id: "duplicate-webhook-event", expectedStatus: "DEDUPLICATED", purpose: "stable event identity prevents duplicate processing" },
  ],
});

export type ConformanceObservation = { fixtureId?: unknown; observedStatus?: unknown; responseDigest?: unknown };

export function evaluateSoftwareConformance(observations: unknown): {
  result: "PASSED_SOFTWARE" | "FAILED_SOFTWARE" | "REVIEW_REQUIRED";
  assertions: Array<{ fixtureId: string; expectedStatus: string; observedStatus: string | null; passed: boolean; responseDigest: string | null }>;
  inputDigest: string;
  resultDigest: string;
} {
  const rows = Array.isArray(observations) ? observations as ConformanceObservation[] : [];
  const assertions = SANDBOX_FIXTURE_SET_V1.fixtures.map((fixture) => {
    const matching = rows.filter((item) => item.fixtureId === fixture.id);
    const observedStatus = matching.length === 1 && typeof matching[0].observedStatus === "string" ? matching[0].observedStatus : null;
    const responseDigest = matching.length === 1 && typeof matching[0].responseDigest === "string" && /^sha256:[a-f0-9]{64}$/.test(matching[0].responseDigest)
      ? matching[0].responseDigest : null;
    return { fixtureId: fixture.id, expectedStatus: fixture.expectedStatus, observedStatus, passed: observedStatus === fixture.expectedStatus && responseDigest !== null, responseDigest };
  });
  const extra = rows.some((item) => typeof item.fixtureId !== "string" || !SANDBOX_FIXTURE_SET_V1.fixtures.some((fixture) => fixture.id === item.fixtureId));
  const missing = assertions.some((item) => item.observedStatus === null || item.responseDigest === null);
  const result = missing ? "REVIEW_REQUIRED" : assertions.every((item) => item.passed) && !extra ? "PASSED_SOFTWARE" : "FAILED_SOFTWARE";
  const canonicalInput = toCanonicalValue({ fixtureSetVersion: SANDBOX_FIXTURE_SET_V1.fixtureSetVersion, observations: rows });
  return { result, assertions, inputDigest: sha256Digest(canonicalInput), resultDigest: sha256Digest({ result, assertions }) };
}
