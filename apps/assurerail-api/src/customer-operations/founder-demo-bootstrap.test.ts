import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FOUNDER_DEMO_ACCOUNT_KEYS, FOUNDER_DEMO_JOURNEY_ACCOUNT_KEYS, configuredFounderDemoAccounts, founderDemoSellerMandates, founderDemoUploadProfile, seedFounderDemoDatabase, validateFounderDemoConfig } from "./founder-demo-bootstrap";
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

function journeyConfig() {
  const account = (key: string, index: number) => ({ email: `rail-demo-${key.toLowerCase()}@example.test`, password: `Synthetic-Only-${index}-Password!`, totpSecret: `JBSWY3DPEHPK3PX${String.fromCharCode(65 + index)}`, displayName: `Synthetic ${key}` });
  return {
    schemaVersion: 1, firebaseProjectId: "assurerail-demo-test", institutionId: "demo-nbfc-ev-001",
    accounts: Object.fromEntries(FOUNDER_DEMO_ACCOUNT_KEYS.map((key, index) => [key, account(key, index)])),
    journeyAccounts: Object.fromEntries(FOUNDER_DEMO_JOURNEY_ACCOUNT_KEYS.map((key, index) => [key, account(key, index + 4)])),
  };
}

test("journey extension requires all five approved roles and preserves the four-role config", () => {
  const input = journeyConfig();
  assert.equal(configuredFounderDemoAccounts(validateFounderDemoConfig(input)).length, 9);
  const { journeyAccounts, ...base } = input;
  assert.equal(configuredFounderDemoAccounts(validateFounderDemoConfig(base)).length, 4);
  delete input.journeyAccounts.buyerLegal;
  assert.throws(() => validateFounderDemoConfig(input), /buyerLegal.email/);
  assert.throws(() => validateFounderDemoConfig({ ...base, journeyAccounts: { ...journeyAccounts, administrator: journeyAccounts.buyerDesk } }), /exactly the five/);
});

test("reviewer and buyer emails must be independent of all other demo identities", () => {
  for (const role of ["sellerDataPreparer", "invoiceChecker"] as const) {
    const input = journeyConfig();
    input.journeyAccounts.preparationReviewer.email = input.accounts[role].email.toUpperCase();
    assert.throws(() => validateFounderDemoConfig(input), /emails must be unique/);
  }
  const input = journeyConfig();
  input.journeyAccounts.buyerLegal.email = input.journeyAccounts.buyerCredit.email;
  assert.throws(() => validateFounderDemoConfig(input), /emails must be unique/);
  input.journeyAccounts.buyerLegal.email = "person@assurelocker.com";
  assert.throws(() => validateFounderDemoConfig(input), /reserved example.test/);
});

test("bootstrap rejects missing or shared Firebase identities before connecting to a database", async () => {
  const config = validateFounderDemoConfig(journeyConfig());
  const users = Object.fromEntries(configuredFounderDemoAccounts(config).map(([key]) => [key, { uid: `firebase-${key}` }])) as Parameters<typeof seedFounderDemoDatabase>[1];
  users.preparationReviewer = users.invoiceChecker;
  await assert.rejects(() => seedFounderDemoDatabase(config, users), /distinct Firebase identity/);
  delete users.preparationReviewer;
  await assert.rejects(() => seedFounderDemoDatabase(config, users), /distinct Firebase identity/);
});
