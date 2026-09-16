import test from "node:test";
import assert from "node:assert/strict";
import { EngagementBillingService } from "./engagement-billing.service";
import { EngagementBillingParticipantController, EngagementBillingInternalController } from "./engagement-billing.controllers";

test("new billing refuses activation without both shadow flags",async()=>{
  const old=process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE;
  try {
    process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE="off";
    const service=new EngagementBillingService({} as never,{} as never,{} as never,{} as never);
    await assert.rejects(()=>service.preview({actorUserId:"u",actorSessionId:"s",actingInstitutionId:"a"},{primaryPairCount:750,linkedPartyCount:0,sellerProposedConsiderationMinor:"1",aggregateProgrammeConsiderationMinor:"1"}),/disabled/);
  } finally {if(old===undefined)delete process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE;else process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE=old;}
});
test("participant requests reject anonymous and mismatched session institution before calling service",()=>{
  let calls=0;const controller=new EngagementBillingParticipantController({preview:()=>{calls++;}} as never);
  const quote={primaryPairCount:750,linkedPartyCount:0,sellerProposedConsiderationMinor:"1",aggregateProgrammeConsiderationMinor:"1"};
  assert.throws(()=>controller.preview({} as never,"a",quote),/authenticated/);
  assert.throws(()=>controller.preview({user:{id:"u",session:{id:"s",activeInstitutionId:"b"},activeInstitution:{institutionId:"a"}}} as never,"a",quote),/context/);
  assert.throws(()=>controller.preview({user:{id:"u",session:{id:"s",activeInstitutionId:"a"},activeInstitution:{institutionId:"b"}}} as never,"a",quote),/context/);
  assert.equal(calls,0);
});
test("internal receipt requests reject participant context",()=>{
  let calls=0;const controller=new EngagementBillingInternalController({reviewReceipt:()=>{calls++;}} as never);
  assert.throws(()=>controller.review({user:{id:"u",session:{id:"s",activeInstitutionId:"a"},activeInstitution:{institutionId:"a"}}} as never,"a","r",{decision:"APPROVE"}),/context/);
  assert.equal(calls,0);
});
test("invoice position is scoped, and approved receipts never unlock live stages",async()=>{
  const oldMode=process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE,oldOps=process.env.ARAIL_CUSTOMER_OPERATIONS_V1;
  try {
    process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE="shadow";process.env.ARAIL_CUSTOMER_OPERATIONS_V1="shadow";
    const db={customerInvoiceStatement:{findUnique:async()=>({id:"i",customerContract:{institutionId:"a"},status:"ISSUED_SHADOW",currency:"INR",currencyScale:2,netFeeMinor:"100"})},customerPaymentReceipt:{findMany:async()=>[{amountMinor:"100"}]},engagementCheckout:{findUnique:async()=>null},customerPaymentAdjustment:{count:async()=>0}};
    const service=new EngagementBillingService(db as never,{requireHuman:async()=>({})} as never,{} as never,{} as never);
    const actor={actorUserId:"u",actorSessionId:"s",actingInstitutionId:"a"};
    const r=await service.paymentPosition(actor,"i");assert.equal(r.fullyReconciled,true);assert.equal(r.liveStageUnlock,false);
    await assert.rejects(()=>service.paymentPosition({...actor,actingInstitutionId:"b"},"i"),/not found/);
  } finally {
    if(oldMode===undefined)delete process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE;else process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE=oldMode;
    if(oldOps===undefined)delete process.env.ARAIL_CUSTOMER_OPERATIONS_V1;else process.env.ARAIL_CUSTOMER_OPERATIONS_V1=oldOps;
  }
});
