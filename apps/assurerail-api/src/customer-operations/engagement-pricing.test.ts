import test from "node:test";
import assert from "node:assert/strict";
import { engagementQuote, cumulativeExecutionFee, executionAccrual, withdrawalTopUp } from "./engagement-pricing";
import { allocateContractorDays } from "./contractor-days";
import { invoicePaymentPosition, validateReceiptReview } from "./payment-reconciliation";
test("count routes conserve the common 30%-of-standalone initial payment and no rerun count inflation", () => {
  for (const n of [1,750,1000,1001,3000,1000000]) {
    const q = engagementQuote(n);
    assert.equal(BigInt(q.initialAssessmentMinor) + BigInt(q.committedPreparationBalanceMinor), BigInt(q.committedFixedMinor));
    assert.equal(BigInt(q.initialAssessmentMinor) + BigInt(q.standalonePreparationBalanceMinor), BigInt(q.standaloneFixedMinor));
    assert.equal(BigInt(q.standaloneFixedMinor) * 10n, BigInt(q.committedFixedMinor) * 13n);
  }
  assert.equal(engagementQuote(1).initialAssessmentMinor, "31200000");
  assert.equal(engagementQuote(3000).initialAssessmentMinor, "58500000");
  assert.equal(engagementQuote(3000).committedPreparationBalanceMinor, "91500000");
  for (const n of [0,-1,1.1,NaN,Infinity,"750",1000001]) assert.throws(() => engagementQuote(n));
});
test("settled consideration fees and four rounds conserve programme fee", () => {
  for (const [cr, lakh] of [[0,0],[10,5],[25,11],[50,21],[100,38.5],[125,46],[300,98.5]]) assert.equal(cumulativeExecutionFee(String(cr*1e9),"50000000"),String(lakh*1e7));
  let previous = "0", credit = 0n, net = 0n;
  for (const cr of [75,150,225,300]) {
    const r = executionAccrual({ previousSettledMinor: previous, cumulativeSettledMinor: String(cr*1e9), acceptedMinimumMinor: "50000000", eligiblePaidStandalonePremiumMinor: "45000000", previousAppliedPremiumMinor: credit.toString() });
    credit += BigInt(r.incrementalPremiumCreditMinor); net += BigInt(r.incrementalExecutionDueMinor); previous = String(cr*1e9);
  }
  assert.equal(credit,45000000n);assert.equal(net,940000000n);
  assert.equal(cumulativeExecutionFee("1","0"),"0");
  assert.equal(cumulativeExecutionFee("0","50000000"),"0");
  assert.throws(() => executionAccrual({ previousSettledMinor:"2",cumulativeSettledMinor:"1",acceptedMinimumMinor:"0",eligiblePaidStandalonePremiumMinor:"0",previousAppliedPremiumMinor:"0" }));
});
test("failed close creates no top-up and prior top-up cannot repeat", () => {
  const p = { route:"COMMITTED" as const, mandateAccepted:true,topUpTermAccepted:true,fixedServiceDelivered:true,previousTopUpMinor:"0" };
  assert.equal(withdrawalTopUp(750,{...p,reason:"FAILED_CLOSE"}),"0");
  assert.equal(withdrawalTopUp(750,{...p,reason:"VOLUNTARY_SWITCH"}),"24000000");
  assert.equal(withdrawalTopUp(750,{...p,reason:"VOLUNTARY_SWITCH",previousTopUpMinor:"24000000"}),"0");
  assert.equal(withdrawalTopUp(750,{...p,reason:"VOLUNTARY_WITHDRAWAL",topUpTermAccepted:false}),"0");
});
test("full-day liability survives sharing and unallocated time", () => {
  const day = {contractorId:"expert-1",workDate:"2026-09-15",worked:true,allocations:[{engagementId:"a",shareBps:2500},{engagementId:"b",shareBps:5000}]};
  const r=allocateContractorDays([day])[0];
  assert.equal(r.totalCostMinor,"2500000");assert.equal(r.unallocatedCostMinor,"625000");
  assert.equal(r.allocations.reduce((s,x)=>s+BigInt(x.costMinor),0n)+BigInt(r.unallocatedCostMinor),2500000n);
  assert.throws(()=>allocateContractorDays([day,day]),/duplicate/);
  assert.throws(()=>allocateContractorDays([{...day,worked:false}]),/not worked/);
  assert.throws(()=>allocateContractorDays([{...day,workDate:"2026-02-30"}]),/date/);
  assert.throws(()=>allocateContractorDays([{...day,allocations:[{engagementId:"a",shareBps:7500},{engagementId:"b",shareBps:7500}]}]),/overallocated/);
  assert.equal(allocateContractorDays([{...day,worked:false,allocations:[]}])[0].totalCostMinor,"0");
});
test("receipts require independent review, exact allocation and explicit credit reconciliation", () => {
  const r={proposer:"maker",reviewer:"checker",status:"PROPOSED",netFeeMinor:"100",verifiedAmounts:["60"],proposedAmountMinor:"40"};
  assert.equal(validateReceiptReview(r).fullyReconciled,true);
  assert.throws(()=>validateReceiptReview({...r,reviewer:"maker"}),/own/);
  assert.throws(()=>validateReceiptReview({...r,proposedAmountMinor:"41"}),/overpayment/);
  assert.throws(()=>validateReceiptReview({...r,status:"VERIFIED_SHADOW"}),/decided/);
  assert.equal(invoicePaymentPosition("50",["100"]).reconciliationRequired,true);
  assert.equal(invoicePaymentPosition("0",[]).fullyReconciled,false);
});
