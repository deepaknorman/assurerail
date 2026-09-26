import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentEvidenceEnvelope, documentInventory, mergeHybridSegments, normaliseInrAmountToMinor, reconcileLoanDocuments, routeDocument } from "./document-review";
import { extractAndValidateOcr, modelTierConfiguration } from "./ocr.adapter";

test("structured loan tapes stay on the bounded native-library rung",()=>{
  const route=routeDocument({contentType:"text/csv",evidenceType:"LOAN_TAPE",segments:[{locator:"row:1",text:'["loan_id"]'}],exceptions:[]});
  assert.equal(route.route,"DETERMINISTIC_STRUCTURED");
  assert.deepEqual(route.visualRequiredLocators,[]);
});

test("PDF routing keeps good native pages and sends only deficient pages to visual extraction",()=>{
  const route=routeDocument({contentType:"application/pdf",evidenceType:"LOAN_AGREEMENT",segments:[{locator:"page:1",text:"Loan agreement between the lender and borrower with repayment terms."},{locator:"page:2",text:""}],exceptions:[{locator:"page:2",code:"OCR_REQUIRED"}]});
  assert.equal(route.route,"HYBRID");
  assert.deepEqual(route.nativeAcceptedLocators,["page:1"]);
  assert.deepEqual(route.visualRequiredLocators,["page:2"]);
  assert.deepEqual(mergeHybridSegments([{locator:"page:1",text:"native"},{locator:"page:2",text:""}],[{locator:"page:2",text:"visual"}],route.visualRequiredLocators),[{locator:"page:1",text:"native"},{locator:"page:2",text:"visual"}]);
});

test("nonblank but corrupt or unrecognisable agreement text cannot bypass visual routing",()=>{
  const corrupt=routeDocument({contentType:"application/pdf",evidenceType:"LOAN_AGREEMENT",segments:[{locator:"page:1",text:`${"x".repeat(80)}\uFFFD\uFFFD`}],exceptions:[]});
  assert.equal(corrupt.route,"VISUAL");
  assert.ok(corrupt.reasons.includes("EXPECTED_DOCUMENT_ANCHORS_NOT_FOUND"));
});

test("EV inventory exposes missing document families without making a credit or legal decision",()=>{
  const inventory=documentInventory("VEHICLE_EV",["LOAN_TAPE","LOAN_AGREEMENT"]);
  assert.equal(inventory.status,"EXCEPTIONS");
  assert.ok(inventory.missing.includes("SECURITY_DOCUMENT"));
  assert.equal(documentInventory("OTHER",["LOAN_TAPE"]).status,"INDETERMINATE");
});

test("document evidence envelope stores locators and provenance without duplicating source text",()=>{
  const routing=routeDocument({contentType:"application/pdf",evidenceType:"LOAN_AGREEMENT",segments:[{locator:"page:1",text:"Loan agreement borrower repayment terms and amount."}],exceptions:[]});
  const envelope=documentEvidenceEnvelope({evidenceVersionId:"ev1",evidenceObjectId:"doc1",documentType:"LOAN_AGREEMENT",sourceDigest:`sha256:${"a".repeat(64)}`,contentType:"application/pdf",routing,extractorVersion:"test",segments:[{locator:"page:1",text:"Sensitive borrower text"}],exceptions:[]});
  assert.equal(envelope.status,"accepted");
  assert.equal(envelope.evidence[0].locatorQuality,"page_only");
  assert.equal(JSON.stringify(envelope).includes("Sensitive borrower text"),false);
});

test("loan reconciliation uses observed fields only and measures every tape loan",()=>{
  assert.equal(normaliseInrAmountToMinor("INR 1,00,000.50"),"10000050");
  const documents=[{evidenceVersionId:"ev1",documentType:"LOAN_AGREEMENT",fields:[{fieldPath:"$.loan_id",valueState:"observed",values:["L1"]},{fieldPath:"$.current_position.principal_outstanding",valueState:"observed",values:["₹1,00,000"]}]}];
  const result=reconcileLoanDocuments([{loanId:"L1",principalMinor:"10000000"},{loanId:"L2",principalMinor:"20000000"}],documents);
  assert.equal(result.status,"EXCEPTIONS");assert.equal(result.documentedLoanCount,1);assert.equal(result.principalReconciledLoanCount,1);assert.equal(result.coveragePercent,50);assert.equal(result.unresolvedPrincipalMinor,"20000000");
  const inferred=reconcileLoanDocuments([{loanId:"L1",principalMinor:"10000000"}],[{...documents[0],fields:[{fieldPath:"$.loan_id",valueState:"inferred",values:["L1"]}]}]);
  assert.equal(inferred.documentedLoanCount,0);
});

test("document review persistence is additive, restrictive and append-only",()=>{
  const migration=readFileSync(resolve(process.cwd(),"prisma/migrations/20260917163000_document_review_provenance/migration.sql"),"utf8");
  assert.equal((migration.match(/ON DELETE RESTRICT/g)??[]).length,3);
  assert.match(migration,/freeze_assessment_document_review BEFORE UPDATE OR DELETE/);
  assert.match(migration,/freeze_assessment_document_attempt BEFORE UPDATE OR DELETE/);
  assert.doesNotMatch(migration,/ON DELETE CASCADE/);
});

test("model batch provenance is closed, bounded and remains append-only",()=>{
  const migration=readFileSync(resolve(process.cwd(),"prisma/migrations/20260927043000_model_review_batches/migration.sql"),"utf8");
  assert.match(migration,/"method"='LANGUAGE_MODEL'/);
  assert.match(migration,/"requestCount" > 0 AND "requestCount" <= 3/);
  assert.match(migration,/MODEL_RATE_LIMITED/);
  assert.match(migration,/BATCH_MEMBERSHIP_MISMATCH/);
  assert.match(migration,/CREATE UNIQUE INDEX "AssessmentDocumentExtractionAttempt_review_batch_key"/);
  assert.doesNotMatch(migration,/DROP TRIGGER|DROP TABLE|ON DELETE CASCADE/);
});

test("[REVIEW] a misspelled model tier stops processing instead of silently keeping the default", () => {
  assert.throws(
    () => modelTierConfiguration({ ASSURERAIL_AI_MODEL_TIERS_JSON: JSON.stringify({ visual_defalut: { provider: "openai", model: "gpt-5.6-luna" } }) } as NodeJS.ProcessEnv),
    /INVALID_AI_MODEL_TIER_CONFIGURATION/,
  );
  assert.throws(
    () => modelTierConfiguration({ ASSURERAIL_AI_MODEL_TIERS_JSON: JSON.stringify([{ provider: "openai" }]) } as NodeJS.ProcessEnv),
    /INVALID_AI_MODEL_TIER_CONFIGURATION/,
  );
  // A correctly named tier still applies, and a swapped provider is still refused.
  assert.equal(
    modelTierConfiguration({ ASSURERAIL_AI_MODEL_TIERS_JSON: JSON.stringify({ visual_default: { provider: "openai", model: "approved-vision-1" } }) } as NodeJS.ProcessEnv).visual_default.model,
    "approved-vision-1",
  );
  assert.throws(
    () => modelTierConfiguration({ ASSURERAIL_AI_MODEL_TIERS_JSON: JSON.stringify({ visual_default: { provider: "gemini", model: "gemini-3-flash-preview" } }) } as NodeJS.ProcessEnv),
    /INVALID_AI_MODEL_TIER_CONFIGURATION/,
  );
});

test("[REVIEW] an oversized second OCR pass is recorded, not thrown away with the first call", async () => {
  const page = { page: 1, text: "x".repeat(29_000), uncertain: false };
  const pages = [1, 2, 3, 4, 5].map((number) => ({ ...page, page: number }));
  let calls = 0;
  const http = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ pages }) }] }], usage: { total_tokens: 10 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;

  const previous = { ...process.env };
  Object.assign(process.env, { ASSURERAIL_OPENAI_DATA_PROCESSING_APPROVED: "true", ASSURERAIL_OPENAI_API_KEY: "k".repeat(24) });
  try {
    const result = await extractAndValidateOcr({ bytes: Buffer.from("pdf"), contentType: "application/pdf" }, [1, 2, 3, 4, 5], http);
    assert.equal(calls, 1, "the second pass must not be attempted when its input cannot fit the budget");
    assert.equal(result.validation, null);
    assert.equal(result.validationSkippedReason, "VALIDATION_INPUT_BUDGET_EXCEEDED");
    assert.equal(result.changedOnValidation, false);
    assert.equal(result.pages.length, 5, "the completed first-pass transcription is still returned");
    assert.equal(result.qualification, "MODEL_TRANSCRIPTION_REQUIRES_HUMAN_REVIEW");
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test("[REVIEW] principal reconciliation is counted by rule id, not list position", () => {
  const result = reconcileLoanDocuments(
    [{ loanId: "L1", principalMinor: "100000" }],
    [{ evidenceVersionId: "ev1", documentType: "LOAN_AGREEMENT", fields: [
      { fieldPath: "$.loan_id", valueState: "observed", values: ["L1"] },
      { fieldPath: "$.current_position.principal_outstanding", valueState: "observed", values: ["1000.00"] },
    ] }],
  );
  assert.equal(result.principalReconciledLoanCount, 1);
  assert.equal(result.status, "RECONCILED");
  const rule = result.loans[0].validationResults.find((entry) => entry.ruleId === "LOAN-TAPE-PRINCIPAL-001");
  assert.equal(rule?.result, "pass");
});
