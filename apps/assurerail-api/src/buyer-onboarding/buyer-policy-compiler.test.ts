import test from "node:test";
import assert from "node:assert/strict";
import { compileBuyerPolicy, evaluateCompiledBuyerPolicy, type AdmittedFact, type AdmittedPolicyRecord, type BuyerPolicyRow } from "./buyer-policy-compiler";

const digest = (character: string) => `sha256:${character.repeat(64).slice(0, 64)}`;
const fact = (value: AdmittedFact["value"], field: string, ai = false): AdmittedFact => ({ status: "PRESENT", value, sourceRefs: [`evidence:${field}`], ...(ai ? { aiRunReceiptRef: `receipt:${field}` } : {}) });
const citation = (id: string) => ({ requirementRef: "buyer-policy-ev-v1", anchor: id, excerptDigest: digest("a") });
const row = (checkId: string, scope: BuyerPolicyRow["scope"], predicates: BuyerPolicyRow["predicates"], severity: BuyerPolicyRow["severity"], evidenceGap: BuyerPolicyRow["evidenceGap"], when?: BuyerPolicyRow["when"]): BuyerPolicyRow => ({ checkId, scope, predicates, ...(when ? { when } : {}), severity, evidenceGap, sourceFields: [...new Set([...predicates, ...(when ?? [])].map((item) => item.field))], citation: citation(checkId) });

const rows: BuyerPolicyRow[] = [
  row("EV01_SEASONING", "LOAN", [{ field: "months_on_book", operator: "GTE", value: 6 }], "EXCLUDE", "EXCLUDE"),
  row("EV02_DPD", "LOAN", [{ field: "max_dpd_6m", operator: "LTE", value: 30 }], "EXCLUDE", "REMEDIATE"),
  row("EV03_LTV", "LOAN", [{ field: "orig_ltv_bps", operator: "LTE", value: 8500 }], "EXCLUDE", "REMEDIATE"),
  row("EV04_RC", "DOCUMENT", [{ field: "rc_hypothecation", operator: "EQ", value: "RECORDED" }], "REMEDIATE", "REMEDIATE"),
  row("EV05_INSURANCE", "DOCUMENT", [{ field: "insurance_valid_through", operator: "DATE_GTE_AS_OF" }, { field: "insurance_hyp_clause", operator: "EQ", value: true }], "REMEDIATE", "REMEDIATE"),
  row("EV06_KYC", "BORROWER", [{ field: "kyc_docs", operator: "CONTAINS_ALL", value: ["OVD", "PAN_OR_FORM60"] }], "REMEDIATE", "REMEDIATE"),
  row("EV07_CONCENTRATION", "BORROWER", [{ field: "borrower_principal_share_bps", operator: "LTE", value: 50 }], "EXCLUDE", "EXCLUDE"),
  row("EV08_STAMP", "DOCUMENT", [{ field: "stamp_evidence", operator: "PRESENT" }], "REMEDIATE", "DISCLOSE"),
  row("EV09_GUARANTOR_KYC", "LINKED_PARTY", [{ field: "guarantor_kyc_complete", operator: "EQ", value: true }], "REMEDIATE", "REMEDIATE", [{ field: "guarantee_exists", operator: "EQ", value: true }]),
  row("EV10_RESTRUCTURED", "LOAN", [{ field: "restructured_flag", operator: "EQ", value: false }], "EXCLUDE", "DISCLOSE"),
];

const policy = () => compileBuyerPolicy({ policyId: "hdfc-ev-working-session-1", buyerInstitutionId: "buyer-hdfc-design", version: 1, effectiveFrom: "2026-09-17", effectiveTo: "2027-03-17", approvedProfileDigest: digest("b"), rows });
const records = (): AdmittedPolicyRecord[] => [
  { recordId: "loan-1", scope: "LOAN", fields: { months_on_book: fact(9, "seasoning", true), max_dpd_6m: fact(0, "dpd"), orig_ltv_bps: fact(8000, "ltv"), restructured_flag: fact(false, "restructured") } },
  { recordId: "doc-1", scope: "DOCUMENT", fields: { rc_hypothecation: fact("RECORDED", "rc"), insurance_valid_through: fact("2027-01-01", "insurance-date"), insurance_hyp_clause: fact(true, "insurance-hyp"), stamp_evidence: fact("STAMP-CERT-1", "stamp") } },
  { recordId: "borrower-1", scope: "BORROWER", fields: { kyc_docs: fact(["OVD", "PAN_OR_FORM60"], "kyc"), borrower_principal_share_bps: fact(40, "concentration") } },
  { recordId: "guarantor-1", scope: "LINKED_PARTY", fields: { guarantee_exists: fact(true, "guarantee"), guarantor_kyc_complete: fact(true, "guarantor-kyc") } },
];

test("compiler creates a deterministic, buyer-specific policy with no default reuse", () => {
  const first = policy(), second = policy();
  assert.equal(first.policyDigest, second.policyDigest);
  assert.equal(first.buyerDecisionReplaced, false);
  assert.equal(first.rows.length, 10);
  assert.throws(() => compileBuyerPolicy({ ...first, policyId: "other", rows: [] }));
  assert.throws(() => compileBuyerPolicy({ ...first, policyId: "other", rows: [{ ...rows[0], citation: { ...rows[0].citation, excerptDigest: "bad" } }] }));
});

test("ten worked checks pass on admitted evidence and link AI-consumed facts to a run receipt", () => {
  const evaluation = evaluateCompiledBuyerPolicy(policy(), records(), "2026-09-17");
  assert.deepEqual(evaluation.counts, { PASS: 4, EXCLUDE: 0, REMEDIATE: 0, DISCLOSE: 0, NOT_APPLICABLE: 0 });
  const seasoning = evaluation.results.find((record) => record.recordId === "loan-1")?.checks.find((check) => check.checkId === "EV01_SEASONING");
  assert.deepEqual(seasoning?.aiRunReceiptRefs, ["receipt:seasoning"]);
  assert.match(evaluation.evaluationDigest, /^sha256:[a-f0-9]{64}$/);
});

test("failed predicates use buyer-authored severity at loan, document, borrower and linked-party scope", () => {
  const changed = records();
  changed[0].fields.months_on_book = fact(3, "seasoning");
  changed[1].fields.rc_hypothecation = fact("MISSING", "rc");
  changed[2].fields.borrower_principal_share_bps = fact(70, "concentration");
  changed[3].fields.guarantor_kyc_complete = fact(false, "guarantor-kyc");
  const evaluation = evaluateCompiledBuyerPolicy(policy(), changed, "2026-09-17");
  assert.deepEqual(evaluation.results.map((record) => record.outcome), ["EXCLUDE", "REMEDIATE", "EXCLUDE", "REMEDIATE"]);
});

test("unknown evidence never passes and follows each row's explicit gap behaviour", () => {
  const changed = records();
  changed[0].fields.max_dpd_6m = { status: "UNKNOWN", sourceRefs: [] };
  changed[1].fields.stamp_evidence = { status: "UNKNOWN", sourceRefs: [] };
  const evaluation = evaluateCompiledBuyerPolicy(policy(), changed, "2026-09-17");
  const dpd = evaluation.results[0].checks.find((check) => check.checkId === "EV02_DPD");
  const stamp = evaluation.results[1].checks.find((check) => check.checkId === "EV08_STAMP");
  assert.equal(dpd?.outcome, "REMEDIATE");
  assert.deepEqual(dpd?.missingFields, ["max_dpd_6m"]);
  assert.equal(stamp?.outcome, "DISCLOSE");
});

test("conditional guarantor check becomes not applicable when no guarantee exists", () => {
  const changed = records();
  changed[3].fields.guarantee_exists = fact(false, "guarantee");
  delete changed[3].fields.guarantor_kyc_complete;
  const check = evaluateCompiledBuyerPolicy(policy(), changed, "2026-09-17").results[3].checks[0];
  assert.equal(check.outcome, "NOT_APPLICABLE");
  assert.equal(evaluateCompiledBuyerPolicy(policy(), changed, "2026-09-17").results[3].outcome, "NOT_APPLICABLE");
});

test("expired policies, duplicate records, unsupported expressions and invented fields fail closed", () => {
  assert.throws(() => evaluateCompiledBuyerPolicy(policy(), records(), "2027-03-18"));
  assert.throws(() => evaluateCompiledBuyerPolicy(policy(), [...records(), records()[0]], "2026-09-17"));
  assert.throws(() => compileBuyerPolicy({ ...policy(), policyId: "bad-op", rows: [{ ...rows[0], predicates: [{ field: "months_on_book", operator: "EVAL" as never, value: 6 }] }] }));
  assert.throws(() => compileBuyerPolicy({ ...policy(), policyId: "bad-source", rows: [{ ...rows[0], sourceFields: ["other_field"] }] }));
});
