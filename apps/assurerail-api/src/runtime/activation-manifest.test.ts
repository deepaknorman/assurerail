import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { canonicalSerialize, sha256Digest } from "../contracts/v1";
import {
  ACTIVATION_APPROVAL_ROLES,
  ACTIVATION_MANIFEST_SCHEMA,
  CONTROLLED_LIVE_GATE_CODES,
  EXTERNAL_GATE_CODES,
  PRODUCTION_ONLY_GATE_CODES,
  inspectActivationManifest,
  type ActivationManifestV1,
} from "./activation-manifest";

const now = new Date("2026-09-02T00:00:00.000Z");
const { publicKey, privateKey } = generateKeyPairSync("ed25519");

function fixture(mode: "CONTROLLED_LIVE" | "PRODUCTION" = "CONTROLLED_LIVE"): ActivationManifestV1 {
  const gateCodes = [...CONTROLLED_LIVE_GATE_CODES, ...(mode === "PRODUCTION" ? PRODUCTION_ONLY_GATE_CODES : [])];
  return {
    schemaVersion: ACTIVATION_MANIFEST_SCHEMA,
    manifestId: `activation-${mode.toLowerCase().replace("_", "-")}-1`,
    environment: "rail-pilot-in",
    operatingMode: mode,
    buildCommit: "a".repeat(40),
    issuedAt: "2026-09-01T23:00:00.000Z",
    expiresAt: "2026-09-09T00:00:00.000Z",
    capabilities: [{
      id: "da-conventional-initial-controlled-cohort-1",
      transactionRoute: "DA",
      representation: "CONVENTIONAL",
      lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
      materialFunction: "TRANSACTION_ORCHESTRATION",
      performer: "PARTICIPANT_OWNED",
      cohortRef: "cohort-pilot-1",
    }],
    gates: gateCodes.map((code) => ({
      code,
      scopeKey: "ROUTE_FUNCTION:DA/CONVENTIONAL/INITIAL_TRANSFER_OR_ISSUE/TRANSACTION_ORCHESTRATION/cohort-pilot-1",
      evidenceClass: EXTERNAL_GATE_CODES.has(code) ? "EXTERNAL" : "INTERNAL",
      evidenceRef: `evidence/${code.toLowerCase()}/version/1`,
      evidenceDigest: sha256Digest({ code, version: 1 }),
      decisionRef: `readiness-decision/${code.toLowerCase()}/1`,
      acceptedAt: "2026-09-01T22:00:00.000Z",
      expiresAt: "2026-10-01T00:00:00.000Z",
    })),
    approvals: ACTIVATION_APPROVAL_ROLES.map((role, index) => ({
      role,
      actorRef: `staff/approver-${index + 1}`,
      approvedAt: "2026-09-01T22:30:00.000Z",
      evidenceDigest: sha256Digest({ role, index }),
    })),
  };
}

function environment(manifest: ActivationManifestV1) {
  const signature = sign(null, Buffer.from(canonicalSerialize(manifest), "utf8"), privateKey);
  return {
    ASSURERAIL_OPERATING_MODE: manifest.operatingMode,
    ASSURERAIL_ENVIRONMENT: manifest.environment,
    ASSURERAIL_BUILD_COMMIT: manifest.buildCommit,
    ARAIL_ACTIVATION_MANIFEST_B64: Buffer.from(JSON.stringify(manifest), "utf8").toString("base64"),
    ARAIL_ACTIVATION_PUBLIC_KEY_B64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
    ARAIL_ACTIVATION_SIGNATURE_B64: signature.toString("base64"),
  };
}

test("[PR12][ACTIVATION] a signed controlled-live manifest binds build, environment, capability, gates and five independent approvals", () => {
  const manifest = fixture();
  const result = inspectActivationManifest(environment(manifest), now);
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest?.manifestId, manifest.manifestId);
  assert.match(result.manifestDigest ?? "", /^sha256:[a-f0-9]{64}$/);
});

test("[PR12][ACTIVATION] production adds pilot, capacity and exit evidence", () => {
  const manifest = fixture("PRODUCTION");
  const missing = { ...manifest, gates: manifest.gates.filter((gate) => !PRODUCTION_ONLY_GATE_CODES.includes(gate.code as never)) };
  const result = inspectActivationManifest(environment(missing), now);
  for (const code of PRODUCTION_ONLY_GATE_CODES) assert.match(result.errors.join("\n"), new RegExp(code));
});

test("[PR12][ACTIVATION] internal or synthetic substitution cannot close an external gate", () => {
  const manifest = fixture();
  const gates = manifest.gates.map((gate) => gate.code === "ROUTE_LEGAL_PERMISSION" ? { ...gate, evidenceClass: "INTERNAL" as const } : gate);
  const changed = { ...manifest, gates };
  const result = inspectActivationManifest(environment(changed), now);
  assert.match(result.errors.join("\n"), /synthetic or internal evidence cannot close ROUTE_LEGAL_PERMISSION/);
});

test("[PR12][ACTIVATION] changed bytes, wrong build, expiry and reused approver fail closed", () => {
  const manifest = fixture();
  const env = environment(manifest);
  const tampered = { ...manifest, environment: "rail-production-in" };
  const result = inspectActivationManifest({
    ...env,
    ASSURERAIL_BUILD_COMMIT: "b".repeat(40),
    ARAIL_ACTIVATION_MANIFEST_B64: Buffer.from(JSON.stringify(tampered), "utf8").toString("base64"),
  }, new Date("2026-10-02T00:00:00.000Z"));
  const errors = result.errors.join("\n");
  assert.match(errors, /must match ASSURERAIL_ENVIRONMENT/);
  assert.match(errors, /must match ASSURERAIL_BUILD_COMMIT/);
  assert.match(errors, /expired/);
  assert.match(errors, /signature is invalid/);

  const repeatedActor = { ...manifest, approvals: manifest.approvals.map((approval) => ({ ...approval, actorRef: "staff/same-person" })) };
  assert.match(inspectActivationManifest(environment(repeatedActor), now).errors.join("\n"), /distinct accountable people/);
});
