import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { documentEvidenceEnvelope, documentInventory, mergeHybridSegments, normaliseInrAmountToMinor, reconcileLoanDocuments, routeDocument } from "./document-review";

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
