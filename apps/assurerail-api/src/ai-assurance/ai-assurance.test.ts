import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluateAiCandidate } from "./ai-evaluation";
import { createAiRunReceipt, verifyAiRunReceipt } from "./ai-run-receipt";
import { createInitialAssessmentReceipt } from "./assessment-ai-receipt";
import { PASSING_SYNTHETIC_EV_CANDIDATE_V1, SYNTHETIC_REDACTED_EV_LOAN_PACK_V1 } from "./fixtures/synthetic-redacted-ev-loan-pack-v1";
import { sha256Digest } from "../contracts/v1";

const digest = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;

test("[RAIL-AA-0] synthetic real-format pack measures every required control and passes a conforming candidate", () => {
  const report = evaluateAiCandidate(SYNTHETIC_REDACTED_EV_LOAN_PACK_V1, PASSING_SYNTHETIC_EV_CANDIDATE_V1);
  assert.equal(report.passed, true);
  assert.equal(report.numericFidelity.basisPoints, 10_000);
  assert.equal(report.citationGrounding.basisPoints, 10_000);
  assert.equal(report.pageCoverage.basisPoints, 10_000);
  assert.equal(report.criticalGapRecall.basisPoints, 10_000);
  assert.equal(report.falseClean.count, 0);
  assert.equal(report.abstention.basisPoints, 10_000);
  assert.equal(report.sourceDrift.basisPoints, 10_000);
  assert.equal(report.promptInjectionResistance.basisPoints, 10_000);
  assert.equal(report.reproducibility.basisPoints, 10_000);
  assert.equal(report.cost.observedMinor, "1800");
  assert.equal(report.exceptions.observed, 1);
});

test("[RAIL-AA-0] false-clean, numeric drift, hallucinated citation, injection and missing abstention fail closed", () => {
  const candidate = {
    ...PASSING_SYNTHETIC_EV_CANDIDATE_V1,
    numericFacts: PASSING_SYNTHETIC_EV_CANDIDATE_V1.numericFacts.map((fact) => fact.factId === "principal-outstanding" ? { ...fact, value: "7425000" } : fact),
    findings: [{ ...PASSING_SYNTHETIC_EV_CANDIDATE_V1.findings[0], quote: "Hypothecation is complete" }],
    abstentions: [],
    sourceDriftObservations: PASSING_SYNTHETIC_EV_CANDIDATE_V1.sourceDriftObservations.map((observation) => ({ ...observation, processingHalted: false })),
    promptInjectionObservations: [{ caseId: "embedded-eligibility-command", instructionTreatedAsData: false, prohibitedActionCount: 1 }],
    disposition: "CLEAN" as const,
    repeatedOutputDigests: [`sha256:${"a".repeat(64)}`, `sha256:${"b".repeat(64)}`],
    costMinor: "2501",
    exceptionCount: 3,
  };
  const report = evaluateAiCandidate(SYNTHETIC_REDACTED_EV_LOAN_PACK_V1, candidate);
  assert.equal(report.passed, false);
  assert.equal(report.numericFidelity.passed, false);
  assert.equal(report.citationGrounding.passed, false);
  assert.equal(report.criticalGapRecall.passed, false);
  assert.equal(report.falseClean.passed, false);
  assert.equal(report.abstention.passed, false);
  assert.equal(report.sourceDrift.passed, false);
  assert.equal(report.promptInjectionResistance.passed, false);
  assert.equal(report.reproducibility.passed, false);
  assert.equal(report.cost.passed, false);
  assert.equal(report.exceptions.passed, false);
});

test("[RAIL-AA-0] receipt binds sources, locations, model/rule versions, checks, changes and usage", () => {
  const secret = "receipt-test-secret-".repeat(3);
  const receipt = createAiRunReceipt({
    runId: "aprocess_synthetic",
    stage: "INITIAL",
    createdAt: "2026-09-17T00:00:00.000Z",
    provider: "openai",
    model: "gpt-5.6-luna",
    qualification: "REVIEW_REQUIRED",
    promptVersion: "rail-findings-1",
    ruleVersion: "rail-ia-rules-1",
    analysisOutput: { findings: [{ severity: "CRITICAL" }] },
    sources: [{ evidenceVersionId: "v1", digest: digest("source"), locator: "page:1", characterCount: 25 }],
    citations: [{ evidenceVersionId: "v1", locator: "page:1", quoteDigest: digest("quote"), quoteCharacterCount: 5 }],
    abstentions: [{ code: "ILLEGIBLE", evidenceVersionId: "v1", locator: "page:1" }],
    deterministicChecks: [{ code: "CITATIONS_GROUNDED", status: "PASS", evidenceDigest: digest("check") }],
    corrections: [{ kind: "CORRECTION", code: "OCR_SECOND_PASS", evidenceVersionId: "v1", locator: "page:1", actorType: "MODEL_VALIDATION_PASS", evidenceDigest: digest("correction") }],
    overrides: [],
    usage: { input_tokens: 100, output_tokens: 25 },
    exceptionCount: 1,
    hmac: { secret, keyRef: "vault:ai-receipt/test" },
  });
  assert.equal(receipt.integrity.algorithm, "HMAC-SHA256");
  assert.equal(receipt.coverage.readablePageCoverageBps, 10_000);
  assert.deepEqual(receipt.usage, { inputTokens: "100", outputTokens: "25", estimatedCostMinor: null, costCurrency: "INR", costStatus: "NOT_CONFIGURED" });
  assert.equal(verifyAiRunReceipt(receipt, secret), true);
  assert.equal(verifyAiRunReceipt(receipt, "wrong-secret-that-is-still-at-least-32-characters"), false);
  assert.equal(verifyAiRunReceipt({ ...receipt, exceptionCount: 2 }, secret), false);
});

test("[RAIL-AA-0] hash receipt remains verifiable when a signing key is not configured", () => {
  const receipt = createAiRunReceipt({
    runId: "aprocess_hash_only",
    stage: "INITIAL",
    createdAt: "2026-09-17T00:00:00.000Z",
    provider: "NOT_RUN",
    model: null,
    qualification: "AI_INPUT_BUDGET_EXCEEDED",
    promptVersion: "rail-findings-1",
    ruleVersion: "rail-ia-rules-1",
    analysisOutput: { findings: [] },
    sources: [{ evidenceVersionId: "v1", digest: digest("source"), locator: "row:1", characterCount: 6 }],
    citations: [], abstentions: [{ code: "AI_INPUT_BUDGET_EXCEEDED", evidenceVersionId: null, locator: null }],
    deterministicChecks: [{ code: "AI_EXECUTED", status: "NOT_RUN", evidenceDigest: null }],
    exceptionCount: 1,
  });
  assert.equal(receipt.integrity.algorithm, "SHA-256");
  assert.equal(receipt.integrity.outerBinding, "ASSESSMENT_RESULT_DIGEST");
  assert.equal(verifyAiRunReceipt(receipt), true);
});

test("[RAIL-AA-0] automated Initial Assessment emits an explicit receipt even when AI does not run", () => {
  const receipt = createInitialAssessmentReceipt({
    runId: "aprocess_budget_skip",
    completedAt: new Date("2026-09-17T00:00:00.000Z"),
    sources: [{ evidenceVersionId: "v1", digest: digest("source"), locator: "page:1", text: "Synthetic evidence" }],
    analysis: { provider: "NOT_RUN", model: null, qualification: "AI_INPUT_BUDGET_EXCEEDED", findings: [] },
    exceptions: [],
    ocrProvenance: [],
    dataQuality: { status: "MATCHED" },
    env: {},
  });
  assert.equal(receipt.execution.qualification, "AI_INPUT_BUDGET_EXCEEDED");
  assert.deepEqual(receipt.abstentions, [{ code: "AI_INPUT_BUDGET_EXCEEDED", evidenceVersionId: null, locator: null }]);
  assert.equal(receipt.deterministicChecks.find((check) => check.code === "AI_EXECUTED")?.status, "NOT_RUN");
  assert.equal(verifyAiRunReceipt(receipt), true);
});

test("[RAIL-AA-0] structured document-field citations are digest-bound without retaining quote text",()=>{
  const quote="Principal outstanding INR 100,000";
  const receipt=createInitialAssessmentReceipt({runId:"aprocess_fields",completedAt:new Date("2026-09-17T00:00:00.000Z"),sources:[{evidenceVersionId:"v1",digest:digest("source"),evidenceType:"REPAYMENT_HISTORY",locator:"page:2",text:quote}],analysis:{provider:"openai",model:"gpt-5.6-luna",qualification:"REVIEW_REQUIRED",findings:[],documentExtractions:[{fields:[{citations:[{evidenceVersionId:"v1",locator:"page:2",quote}]}]}]},exceptions:[],ocrProvenance:[],dataQuality:{status:"MATCHED"},env:{}});
  assert.equal(receipt.citations.length,1);assert.equal(receipt.citations[0].quoteDigest,sha256Digest(quote));assert.equal(JSON.stringify(receipt).includes(quote),false);assert.equal(verifyAiRunReceipt(receipt),true);
});
