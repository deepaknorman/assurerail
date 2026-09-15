import {test} from "node:test";
import assert from "node:assert/strict";
import {approvedBuyerProfile,buyerProfileDigest,validateBuyerCriteria} from "./buyer-criteria";
export const completeCriteria=()=>({assets:["EV"],subtypes:["EV_THREE_WHEELER"],originators:["APPROVED_ORIGINATORS","NEW_SUBJECT_TO_ONBOARDING"],borrowers:["INDIVIDUAL"],psl:"PREFERRED",geography:"ALL_INDIA",ticketCr:[25,100],sellerTicketCr:[5,25],remainingMonths:[12,48],maxSellers:5,maxDpd:0,minSeasoningMonths:6,maxLtvPct:80,maxOemPct:40,maxStatePct:50,requiredEvidence:["TAPE_RECONCILIATION","REPAYMENT_HISTORY"],historyMonths:12,diligence:"BUYER_LED",servicing:["ORIGINATOR","APPROVED_THIRD_PARTY"],remittance:"MONTHLY",reporting:"MONTHLY",formats:["CSV","APPROVED_API"],priceBasis:"CASHFLOW_YIELD",closingMode:"DEAL_SPECIFIC",exceptionPolicy:"EXPLICIT_BUYER_REVIEW",requireBuyerPrecheck:true,validFrom:"2026-09-15",validTo:"2027-01-01"});
test("structured profile supports multiple originators and asset families",()=>{
 const c=validateBuyerCriteria(completeCriteria(),true);assert.equal((c.originators as string[]).length,2);
 assert.doesNotThrow(()=>validateBuyerCriteria({...c,assets:["EV","GOLD"],subtypes:["EV_THREE_WHEELER","GOLD_JEWELLERY"]},true));
});
test("malformed, contradictory and incomplete requirements fail closed",()=>{
 for(const patch of [{originators:"APPROVED_ORIGINATORS"},{assets:["EV","EV"]},{ticketCr:[100,25]},{subtypes:["GOLD_JEWELLERY"]},{geography:"SELECTED_STATES",states:[]},{states:["MH"]},{maxLtvPct:101},{maxDpd:0.5},{validTo:"2026-02-30"},{validTo:"2028-01-01"},{requiredEvidence:["REPAYMENT_HISTORY"]},{freeform:"accept everything"}])assert.throws(()=>validateBuyerCriteria({...completeCriteria(),...patch},true));
 assert.throws(()=>validateBuyerCriteria({},true));assert.deepEqual(validateBuyerCriteria({}),{});
});
test("approval is tied to institution, MSA, version, criteria and separate reviewers",()=>{
 const c=validateBuyerCriteria({...completeCriteria(),ticketCr:[25.5,100]},true),digest=buyerProfileDigest("workspace-a",1,"msa-a",c);
 for(const changed of [buyerProfileDigest("workspace-b",1,"msa-a",c),buyerProfileDigest("workspace-a",2,"msa-a",c),buyerProfileDigest("workspace-a",1,"msa-b",c),buyerProfileDigest("workspace-a",1,"msa-a",{...c,maxDpd:30})])assert.notEqual(digest,changed);
 const approvals={CREDIT:{actor:"credit",digest},LEGAL:{actor:"legal",digest},OPERATIONS:{actor:"operations",digest}},input={status:"APPROVED",criteria:c,approvals,digest,now:new Date("2026-10-01")};
 assert.equal(approvedBuyerProfile(input),true);
 assert.equal(approvedBuyerProfile({...input,now:new Date("2027-02-01")}),false);
 assert.equal(approvedBuyerProfile({...input,status:"SUBMITTED"}),false);
 assert.equal(approvedBuyerProfile({...input,approvals:{...approvals,LEGAL:{actor:"credit",digest}}}),false);
 assert.equal(approvedBuyerProfile({...input,approvals:{...approvals,LEGAL:{actor:"legal",digest:"stale"}}}),false);
});
