import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (name: string) => readFileSync(join(__dirname, name), "utf8");

test("execution invoice endpoints separate seller reads from internal maker-checker writes", () => {
  const controllers = source("execution-fee-invoice.controllers.js");
  const service = source("execution-fee-invoice.service.js");
  assert.match(controllers, /institutions\/:institutionId\/engagements\/:engagementId\/execution-fees/);
  assert.match(controllers, /internal\/engagements\/institutions\/:institutionId\/:engagementId\/execution-fees/);
  assert.match(service, /COMMERCIAL_INVOICE_PREPARE/);
  assert.match(service, /COMMERCIAL_INVOICE_REVIEW/);
  assert.match(service, /preparer cannot review/);
  assert.match(service, /ownerInstitutionId: institutionId/);
  assert.match(service, /partyRole: "TRANSFEROR"/);
  assert.match(service, /partyRole === "TRANSFEREE"/);
});

test("execution invoice implementation is offline and supplies a non-custodial settlement leg", () => {
  const service = source("execution-fee-invoice.service.js");
  const arithmetic = source("execution-fee-invoice.js");
  const genericBilling = source("customer-operations.service.js");
  assert.doesNotMatch(service, /fetch\(|undici|axios|Razorpay|Castler|Plaza/);
  assert.match(service, /validatedDesignPartnerPayable/);
  assert.match(arithmetic, /custodyProvidedByRail: false/);
  assert.match(arithmetic, /railMayReleaseFunds: false/);
  assert.match(arithmetic, /settlementProvedByInvoice: false/);
  assert.match(genericBilling, /use the execution-invoice review workflow/);
  assert.match(genericBilling, /execution-invoice credits require a new reviewed execution fee proposal/);
});
