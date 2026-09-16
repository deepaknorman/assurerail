import test from "node:test";
import assert from "node:assert/strict";
import { engagementQuote, cumulativeExecutionFee, executionAccrual, quoteExpiryAt, withdrawalTopUp } from "./engagement-pricing";
import { allocateContractorDays } from "./contractor-days";
import { invoicePaymentPosition, validateReceiptReview } from "./payment-reconciliation";

const crore = (value: number) => String(value * 1_000_000_000);
const scope = (primaryPairCount: number, linkedPartyCount = 0, sellerCrore = 10, programmeCrore = sellerCrore) => ({
  primaryPairCount,
  linkedPartyCount,
  sellerProposedConsiderationMinor: crore(sellerCrore),
  aggregateProgrammeConsiderationMinor: crore(programmeCrore),
});

test("fixed routes price primary pairs, linked parties, minima and the common 30% initial invoice", () => {
  const minimum = engagementQuote(scope(1));
  assert.equal(minimum.committedFixedMinor, "80000000");
  assert.equal(minimum.standaloneFixedMinor, "104000000");
  assert.equal(minimum.initialAssessmentMinor, "31200000");
  assert.equal(minimum.primaryPairCount, 1);
  assert.equal(minimum.linkedPartyCount, 0);

  const representativePilot = engagementQuote(scope(750));
  assert.equal(representativePilot.committedFixedMinor, "80000000");
  assert.equal(representativePilot.standaloneFixedMinor, "104000000");
  assert.equal(representativePilot.initialAssessmentMinor, "31200000");
  assert.equal(representativePilot.committedPreparationBalanceMinor, "48800000");
  assert.equal(representativePilot.standalonePreparationBalanceMinor, "72800000");

  const variable = engagementQuote(scope(3_000, 400));
  assert.equal(variable.committedFixedMinor, "160000000");
  assert.equal(variable.standaloneFixedMinor, "208000000");
  assert.equal(variable.initialAssessmentMinor, "62400000");
  assert.equal(BigInt(variable.initialAssessmentMinor) + BigInt(variable.committedPreparationBalanceMinor), BigInt(variable.committedFixedMinor));
  assert.equal(BigInt(variable.initialAssessmentMinor) + BigInt(variable.standalonePreparationBalanceMinor), BigInt(variable.standaloneFixedMinor));
});

test("large-programme supplement applies only above ₹100cr and allocates by seller consideration", () => {
  const atThreshold = engagementQuote(scope(1, 0, 50, 100));
  assert.equal(atThreshold.committedLargeProgrammeSupplementMinor, "0");
  const sellerQuarter = engagementQuote(scope(1, 0, 50, 200));
  assert.equal(sellerQuarter.committedLargeProgrammeSupplementMinor, "25000000");
  assert.equal(sellerQuarter.standaloneLargeProgrammeSupplementMinor, "32500000");
  assert.equal(sellerQuarter.committedFixedMinor, "105000000");
  assert.equal(sellerQuarter.standaloneFixedMinor, "136500000");
  assert.equal(sellerQuarter.initialAssessmentMinor, "40950000");
});

test("quote rejects malformed scope and impossible programme allocations", () => {
  for (const value of [0, -1, 1.1, NaN, Infinity, "750", 1_000_001]) {
    assert.throws(() => engagementQuote({...scope(1), primaryPairCount: value}));
  }
  assert.throws(() => engagementQuote({...scope(1), linkedPartyCount: -1}));
  assert.throws(() => engagementQuote({...scope(1), sellerProposedConsiderationMinor: "1.5"}));
  assert.throws(() => engagementQuote({...scope(1), sellerProposedConsiderationMinor: crore(11), aggregateProgrammeConsiderationMinor: crore(10)}));
});

test("seller execution fee is marginal 40/30 bps with a ₹5L per-seller floor", () => {
  for (const [cr, lakh] of [[0,0],[1,5],[10,5],[25,10],[50,17.5],[100,32.5],[125,40],[300,92.5]]) {
    assert.equal(cumulativeExecutionFee(crore(cr)), String(lakh * 10_000_000));
  }
  assert.equal(cumulativeExecutionFee("1", "0"), "0");
  assert.equal(cumulativeExecutionFee("0"), "0");
});

test("four rounds retain one seller's cumulative slabs and premium credit", () => {
  let previous = "0", credit = 0n, net = 0n;
  for (const cr of [75,150,225,300]) {
    const result = executionAccrual({
      sellerId: "seller-1",
      previousSettledMinor: previous,
      cumulativeSettledMinor: crore(cr),
      eligiblePaidStandalonePremiumMinor: "45000000",
      previousAppliedPremiumMinor: credit.toString(),
    });
    credit += BigInt(result.incrementalPremiumCreditMinor);
    net += BigInt(result.incrementalExecutionDueMinor);
    previous = crore(cr);
  }
  assert.equal(credit, 45_000_000n);
  assert.equal(net, 880_000_000n);
  assert.throws(() => executionAccrual({sellerId:"",previousSettledMinor:"0",cumulativeSettledMinor:"1",eligiblePaidStandalonePremiumMinor:"0",previousAppliedPremiumMinor:"0"}));
  assert.throws(() => executionAccrual({sellerId:"seller-1",previousSettledMinor:"2",cumulativeSettledMinor:"1",eligiblePaidStandalonePremiumMinor:"0",previousAppliedPremiumMinor:"0"}));
});

test("withdrawal top-up uses the frozen quote and excludes failed closes", () => {
  const quote = engagementQuote(scope(750));
  const input = { route:"COMMITTED" as const, mandateAccepted:true, topUpTermAccepted:true, fixedServiceDelivered:true, previousTopUpMinor:"0" };
  assert.equal(withdrawalTopUp(quote,{...input,reason:"FAILED_CLOSE"}),"0");
  assert.equal(withdrawalTopUp(quote,{...input,reason:"VOLUNTARY_SWITCH"}),"24000000");
  assert.equal(withdrawalTopUp(quote,{...input,reason:"VOLUNTARY_SWITCH",previousTopUpMinor:"24000000"}),"0");
});

test("quote validity ends at 5pm IST on the first Monday after the twentieth calendar day", () => {
  assert.equal(quoteExpiryAt(new Date("2026-09-16T04:30:00.000Z")).toISOString(), "2026-10-12T11:30:00.000Z");
  // The twentieth day is Monday, so the deadline is the following Monday.
  assert.equal(quoteExpiryAt(new Date("2026-09-23T12:30:00.000Z")).toISOString(), "2026-10-19T11:30:00.000Z");
});

test("full-day liability survives sharing and unallocated time", () => {
  const day = {contractorId:"expert-1",workDate:"2026-09-15",worked:true,allocations:[{engagementId:"a",shareBps:2500},{engagementId:"b",shareBps:5000}]};
  const result=allocateContractorDays([day])[0];
  assert.equal(result.totalCostMinor,"2500000");assert.equal(result.unallocatedCostMinor,"625000");
  assert.equal(result.allocations.reduce((sum,x)=>sum+BigInt(x.costMinor),0n)+BigInt(result.unallocatedCostMinor),2500000n);
  assert.throws(()=>allocateContractorDays([day,day]),/duplicate/);
  assert.throws(()=>allocateContractorDays([{...day,worked:false}]),/not worked/);
});

test("receipts require independent review, exact allocation and explicit credit reconciliation", () => {
  const receipt={proposer:"maker",reviewer:"checker",status:"PROPOSED",netFeeMinor:"100",verifiedAmounts:["60"],proposedAmountMinor:"40"};
  assert.equal(validateReceiptReview(receipt).fullyReconciled,true);
  assert.throws(()=>validateReceiptReview({...receipt,reviewer:"maker"}),/own/);
  assert.throws(()=>validateReceiptReview({...receipt,proposedAmountMinor:"41"}),/overpayment/);
  assert.equal(invoicePaymentPosition("50",["100"]).reconciliationRequired,true);
});
