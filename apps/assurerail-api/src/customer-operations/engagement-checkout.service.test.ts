import test from "node:test";
import assert from "node:assert/strict";
import { EngagementCheckoutService } from "./engagement-checkout.service";

test("bank transfer selection supports NEFT and IMPS without creating a gateway checkout",async()=>{
  const prior=process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS;
  process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS="collection-demo";
  try {
  const db={engagementCheckout:{findUnique:async()=>null}};
  const engagements={
    participant:async()=>({}),
    scoped:async()=>({status:"ACCEPTED_SHADOW",stages:[{stage:"INITIAL",invoice:{id:"invoice-1",status:"ISSUED_SHADOW",netFeeMinor:"36816000",currency:"INR"}}]}),
  };
  const service=new EngagementCheckoutService(db as never,engagements as never);
  const result=await service.selectBankTransfer({actorUserId:"seller",actorSessionId:"session",actingInstitutionId:"nbfc"},"engagement-1","INITIAL");
  assert.deepEqual(result.transferRails,["NEFT","IMPS"]);
  assert.equal(result.amountMinor,"36816000");
  assert.equal(result.status,"AWAITING_BANK_TRANSFER");
  assert.equal(result.liveStageUnlock,false);
  assert.deepEqual(result.collectionAccountRefs,["collection-demo"]);
  assert.equal(result.remittanceReference,"invoice-1");
  } finally {
    if(prior===undefined)delete process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS;else process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS=prior;
  }
});
