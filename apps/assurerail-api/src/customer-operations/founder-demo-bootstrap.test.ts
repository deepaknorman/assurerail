import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { founderDemoSellerMandates, founderDemoUploadProfile, validateFounderDemoConfig } from "./founder-demo-bootstrap";
import { loanTapeMetrics } from "./loan-tape-metrics";

const demoRoot = resolve(__dirname, "../../../../demo/assurerail/founder-initial-assessment");

test("founder demo account config rejects placeholders and non-synthetic identities", () => {
  const example = JSON.parse(readFileSync(resolve(demoRoot, "accounts.example.json"), "utf8"));
  assert.throws(() => validateFounderDemoConfig(example), /non-placeholder password/);
  const valid = structuredClone(example);
  valid.firebaseProjectId = "assurerail-demo-test";
  for (const [index, key] of Object.keys(valid.accounts).entries()) { valid.accounts[key].password = `Synthetic-Only-${index}-Password!`; valid.accounts[key].totpSecret = `JBSWY3DPEHPK3PX${["A", "B", "C", "D"][index]}`; }
  assert.equal(validateFounderDemoConfig(valid).institutionId, "demo-nbfc-ev-001");
  valid.accounts.invoiceChecker.email = "person@real-company.example";
  assert.throws(() => validateFounderDemoConfig(valid), /example\.test/);
});

test("founder demo publishes the exact non-secret assessment upload profile", () => {
  assert.deepEqual(founderDemoUploadProfile("demo-nbfc-ev-001"), {
    connectorRegistrationId: "demo-connector-assessment-upload-demo-nbfc-ev-001",
    schemaId: "assurerail.neutral-intake",
    schemaVersion: "1.0.0",
    retentionDays: 365,
  });
});

test("founder demo separates commercial and evidence-management authority", () => {
  assert.deepEqual(founderDemoSellerMandates("sellerCommercialAdmin"), [
    "VIEW_CUSTOMER_OPERATIONS", "MANAGE_CUSTOMER_OPERATIONS", "VIEW_EVIDENCE",
  ]);
  assert.deepEqual(founderDemoSellerMandates("sellerDataPreparer"), [
    "VIEW_CUSTOMER_OPERATIONS", "VIEW_EVIDENCE", "MANAGE_EVIDENCE",
  ]);
});

test("packaged EV tapes demonstrate one attributable gap and a corrected reassessment", async () => {
  const manifest = JSON.parse(readFileSync(resolve(demoRoot, "demo-manifest.json"), "utf8"));
  const segments = (name: string) => readFileSync(resolve(demoRoot, name), "utf8").trim().split("\n").map(line => ({ text: JSON.stringify(line.split(",")) }));
  const initial = loanTapeMetrics([{ contentType: "text/csv", segments: segments("loan-tape-v1-with-gap.csv") }], 12, 0);
  const corrected = loanTapeMetrics([{ contentType: "text/csv", segments: segments("loan-tape-v2-corrected.csv") }], 12, 0);
  assert.deepEqual({ status: initial.status, primary: initial.parsedPrimaryPairCount, duplicates: initial.duplicateRecords }, { status: "RECORD_EXCEPTIONS", primary: 12, duplicates: 1 });
  assert.deepEqual({ status: corrected.status, primary: corrected.parsedPrimaryPairCount, duplicates: corrected.duplicateRecords }, { status: "MATCHED", primary: 12, duplicates: 0 });
  assert.equal(initial.parsedPrincipalMinor, corrected.parsedPrincipalMinor);
  assert.equal(corrected.parsedPrincipalMinor, manifest.sellerProposedConsiderationMinor);
});
