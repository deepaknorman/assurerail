import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(__dirname, "../..");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(resolve(root, "prisma/migrations/20260902190000_assurerail_pr20_customer_operations/migration.sql"), "utf8");
const service = readFileSync(resolve(__dirname, "customer-operations.service.js"), "utf8");
const controller = readFileSync(resolve(__dirname, "customer-operations.controllers.js"), "utf8");

test("[PR20][SCHEMA] contracts, rates, metering, statements, service and exit are durable and restrictive", () => {
  for (const model of ["CustomerContract", "CustomerContractChange", "CustomerRateCard", "CustomerFeeRule", "CustomerUsageEvent", "CustomerInvoiceStatement", "CustomerInvoiceLine", "CustomerCreditCorrection", "CustomerImplementationCohort", "CustomerServiceRequest", "CustomerServiceMessage", "CustomerOperationalReview", "CustomerDataExitExport"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
    assert.match(migration, new RegExp(`CREATE TABLE "${model}"`));
  }
  assert.match(schema, /currencyScale\s+Int/);
  assert.match(schema, /@@unique\(\[institutionId, sourceEventRef\]/);
  assert.match(schema, /@@unique\(\[customerContractId, statementRef\]/);
  assert.ok((migration.match(/ON DELETE RESTRICT/g) ?? []).length >= 16);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/i);
});

test("[PR20][AUTHORITY] participant and internal routes use distinct contexts and maker-checker issuance", () => {
  assert.match(controller, /institutions\/:institutionId\/customer-operations/);
  assert.match(controller, /internal\/customer-operations\/institutions\/:institutionId/);
  assert.match(controller, /path institution must match active session context/);
  assert.match(controller, /internal customer operations require no participant institution context/);
  assert.match(service, /statement preparer cannot issue the same statement/);
  assert.match(service, /change proposer cannot review the same proposal/);
  assert.match(service, /credit proposer cannot review the same proposal/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /review was concurrently decided|issuance was concurrently decided/);
  assert.match(service, /CUSTOMER_CONTRACT_ACKNOWLEDGE/);
});

test("[PR20][BOUNDARY] pricing cannot execute transactions or rewrite evidence and exports filter stale grants", () => {
  assert.doesNotMatch(service, /selectSettlementAdapter|selectHtsAdapter|selectHcsAdapter|\.dispatch\(|mint\(|burn\(|CaseTransition/);
  assert.match(service, /pricingChangesAuthority: false/);
  assert.match(service, /transactionAuthorityAffected: false/);
  assert.match(service, /granteeInstitutionId: institutionId, status: "ACTIVE"/);
  assert.match(service, /expiresAt: \{ gt: highWaterAt \}/);
  assert.match(service, /cohort requires an active shadow contract/);
  assert.match(service, /service request transition/);
  assert.match(service, /secretsExcluded: true/);
  assert.match(service, /documentBytes: "AVAILABLE_SEPARATELY_THROUGH_RECEIPT_LOGGED_EVIDENCE_DOWNLOADS"/);
});
