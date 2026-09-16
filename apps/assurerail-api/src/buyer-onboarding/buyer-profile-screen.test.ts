import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBuyerPolicy, type BuyerPolicyCandidate } from "./buyer-profile-screen";

const crore = (value: number) => String(BigInt(value) * 1_000_000_000n);
const completeCriteria = () => ({ assets:["EV"], subtypes:["EV_THREE_WHEELER"], originators:["NEW_SUBJECT_TO_ONBOARDING"], borrowers:["INDIVIDUAL"], psl:"PREFERRED", geography:"ALL_INDIA", ticketCr:[25,100], sellerTicketCr:[5,25], remainingMonths:[12,48], maxSellers:5, maxDpd:0, minSeasoningMonths:6, maxLtvPct:80, maxOemPct:40, maxStatePct:50, exclusions:["RESTRUCTURED","DISPUTED","EVERGREENING_UNRESOLVED"], requiredEvidence:["TAPE_RECONCILIATION","REPAYMENT_HISTORY"], specialistReviews:[], historyMonths:12, diligence:"BUYER_LED", servicing:["ORIGINATOR","APPROVED_THIRD_PARTY"], remittance:"MONTHLY", reporting:"MONTHLY", formats:["CSV","APPROVED_API"], priceBasis:"CASHFLOW_YIELD", closingMode:"DEAL_SPECIFIC", exceptionPolicy:"EXPLICIT_BUYER_REVIEW", requireBuyerPrecheck:true, validFrom:"2026-09-15", validTo:"2027-01-01" });
const candidate = (patch: Partial<BuyerPolicyCandidate> = {}): BuyerPolicyCandidate => ({
  asset: "EV",
  subtype: "EV_THREE_WHEELER",
  originatorAcceptance: "NEW_SUBJECT_TO_ONBOARDING",
  borrowerTypes: ["INDIVIDUAL"],
  pslStatus: "PSL",
  programmeCorpusMinor: crore(50),
  sellerTickets: ["seller-1","seller-2","seller-3","seller-4","seller-5"].map((sellerRef) => ({ sellerRef, corpusMinor: crore(10) })),
  remainingMonths: [18, 36],
  sellerCount: 5,
  maxDpd: 0,
  minSeasoningMonths: 9,
  maxLtvPct: 75,
  maxOemPct: 35,
  maxStatePct: 45,
  geography: "ALL_INDIA",
  states: [],
  exclusionsPresent: [],
  evidenceAvailable: ["TAPE_RECONCILIATION", "REPAYMENT_HISTORY"],
  historyMonths: 18,
  servicing: "ORIGINATOR",
  remittance: "MONTHLY",
  reporting: "MONTHLY",
  formats: ["CSV"],
  priceBasis: "CASHFLOW_YIELD",
  closingMode: "SIMULTANEOUS",
  buyerPrecheckCompleted: true,
  ...patch,
});

test("worked example 1: five homogeneous EV sellers match the structured buyer policy", () => {
  const evaluation = evaluateBuyerPolicy(completeCriteria(), candidate());
  assert.equal(evaluation.decision, "BUYER_POLICY_MATCH");
  assert.deepEqual(evaluation.summary, { pass: evaluation.checks.length, fail: 0, review: 0 });
  assert.match(evaluation.evaluationDigest, /^sha256:[a-f0-9]{64}$/);
});

test("worked examples 2-7: hard policy mismatches fail with traceable reason codes", () => {
  const cases: [Partial<BuyerPolicyCandidate>, string][] = [
    [{ asset: "GOLD", subtype: "GOLD_JEWELLERY" }, "ASSET_NOT_ACCEPTED"],
    [{ originatorAcceptance: "APPROVED_ORIGINATORS" }, "ORIGINATOR_ROUTE_NOT_ACCEPTED"],
    [{ programmeCorpusMinor: crore(20), sellerCount: 4, sellerTickets: ["seller-1","seller-2","seller-3","seller-4"].map((sellerRef) => ({ sellerRef, corpusMinor: crore(5) })) }, "PROGRAMME_TICKET_OUTSIDE_RANGE"],
    [{ sellerTickets: [4,10,10,10,16].map((value, index) => ({ sellerRef: `seller-${index + 1}`, corpusMinor: crore(value) })) }, "SELLER_TICKET_OUTSIDE_RANGE"],
    [{ remainingMonths: [18, 60] }, "REMAINING_TERM_OUTSIDE_RANGE"],
    [{ maxOemPct: 55 }, "OEM_LIMIT"],
  ];
  for (const [patch, reason] of cases) {
    const evaluation = evaluateBuyerPolicy(completeCriteria(), candidate(patch));
    assert.equal(evaluation.decision, "BUYER_POLICY_MISMATCH");
    assert.ok(evaluation.checks.some((check) => check.result === "FAIL" && check.reasonCode === reason));
  }
});

test("worked examples 8-10: incomplete evidence, unverified PSL and pending precheck route to buyer review", () => {
  const cases: [Partial<BuyerPolicyCandidate>, string][] = [
    [{ evidenceAvailable: ["TAPE_RECONCILIATION"] }, "REQUIRED_EVIDENCE_MISSING"],
    [{ pslStatus: "UNVERIFIED" }, "PSL_STATUS_UNVERIFIED"],
    [{ buyerPrecheckCompleted: false }, "BUYER_PRECHECK_REQUIRED"],
  ];
  for (const [patch, reason] of cases) {
    const evaluation = evaluateBuyerPolicy(completeCriteria(), candidate(patch));
    assert.equal(evaluation.decision, "BUYER_REVIEW_REQUIRED");
    assert.ok(evaluation.checks.some((check) => check.result === "REVIEW" && check.reasonCode === reason));
  }
});

test("evaluation is deterministic and rejects malformed quantity boundaries", () => {
  const first = evaluateBuyerPolicy(completeCriteria(), candidate());
  const second = evaluateBuyerPolicy(completeCriteria(), candidate());
  assert.equal(first.evaluationDigest, second.evaluationDigest);
  assert.throws(() => evaluateBuyerPolicy(completeCriteria(), candidate({ sellerCount: 4 })));
  assert.throws(() => evaluateBuyerPolicy(completeCriteria(), candidate({ programmeCorpusMinor: "50.1" })));
  assert.throws(() => evaluateBuyerPolicy(completeCriteria(), candidate({ borrowerTypes: ["INDIVIDUAL", "INDIVIDUAL"] })));
  assert.throws(() => evaluateBuyerPolicy(completeCriteria(), candidate({ sellerTickets: ["seller-1","seller-2","seller-3","seller-4","seller-5"].map((sellerRef) => ({ sellerRef, corpusMinor: crore(9) })) })));
});
