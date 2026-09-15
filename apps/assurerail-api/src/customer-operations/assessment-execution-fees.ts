/** Exact INR-paise accrual for an already agreed per-seller mandate. No invoice or collection authority. */
import {calculateExactFee,exactMinor} from "./fee-calculation";
import {sha256Digest} from "../contracts/v1";
export type AssessmentExecutionTerms={
  quoteRef:string;currency:"INR";currencyScale:2;
  fixedPreparationMinor:string;commonExecutionShareMinor:string;minimumLifecycleMinor:string;maximumLifecycleMinor?:string;
  slabs:{throughPrincipalMinor:string|null;rateBps:string}[];
  reasonCodes:string[];scopeEvidenceRef:string;approvalRef:string;acceptedBy:string;acceptedAt:string;
  largeDealReviewRef?:string;
};
const reasons=new Set(["RECORD_VOLUME","EVIDENCE_COVERAGE","EXTRA_BUYER_PROCESS","SPECIALIST_WORK","ADDITIONAL_QA","NONSTANDARD_STRUCTURE","COMMON_WORK_SHARE","REUSE_DISCOUNT","SIZE_ECONOMIES","COMPARABLE_MARKET_QUOTE"]);
function amount(v:unknown,label:string){return BigInt(exactMinor(v,label));}
export function validateExecutionTerms(q:AssessmentExecutionTerms){
 if(q.currency!=="INR"||q.currencyScale!==2)throw new Error("explicit INR paise required");
 for(const field of ["quoteRef","scopeEvidenceRef","approvalRef","acceptedBy","acceptedAt"] as const)if(typeof q[field]!=="string"||!q[field].trim()||q[field].length>300)throw new Error(`${field} required`);
 if(!Number.isFinite(Date.parse(q.acceptedAt)))throw new Error("acceptedAt must be a valid instant");
 if(!q.reasonCodes.length||new Set(q.reasonCodes).size!==q.reasonCodes.length||q.reasonCodes.some(r=>!reasons.has(r)))throw new Error("structured fee justification required");
 const fixed=amount(q.fixedPreparationMinor,"fixedPreparationMinor"),floor=amount(q.minimumLifecycleMinor,"minimumLifecycleMinor");amount(q.commonExecutionShareMinor,"commonExecutionShareMinor");
 if(floor<fixed)throw new Error("lifecycle floor cannot be below agreed fixed preparation");
 if(q.maximumLifecycleMinor!==undefined&&amount(q.maximumLifecycleMinor,"maximumLifecycleMinor")<floor)throw new Error("cap cannot be below the agreed floor");
 if(!q.slabs.length||q.slabs.length>20||q.slabs.at(-1)!.throughPrincipalMinor!==null)throw new Error("ordered slabs with a final unbounded tier required");
 let last=0n;for(const [i,s] of q.slabs.entries()){
  if(amount(s.rateBps,"rateBps")>10000n)throw new Error("rate exceeds 10000 bps");
  if(s.throughPrincipalMinor===null){if(i!==q.slabs.length-1)throw new Error("unbounded tier must be last");}
  else{const upper=amount(s.throughPrincipalMinor,"throughPrincipalMinor");if(upper<=last)throw new Error("slab limits must increase");last=upper;}
 }
 return sha256Digest(q);
}
function lifecycle(q:AssessmentExecutionTerms,principal:bigint){
 const fixed=amount(q.fixedPreparationMinor,"fixedPreparationMinor");
 if(principal===0n)return {fixed,execution:0n,total:fixed,slabFees:[] as {principalMinor:string;rateBps:string;feeMinor:string}[]};
 let lower=0n,variable=0n;const slabFees=[];
 for(const s of q.slabs){const upper=s.throughPrincipalMinor===null?principal:amount(s.throughPrincipalMinor,"upper"),end=principal<upper?principal:upper,slice=end>lower?end-lower:0n;
  const fee=calculateExactFee({feeBasis:"NOTIONAL_BASIS_POINTS",rateValue:s.rateBps,roundingMode:"HALF_UP"},{quantityMinor:"1",notionalMinor:slice.toString()}).feeMinor;
  variable+=BigInt(fee);slabFees.push({principalMinor:slice.toString(),rateBps:s.rateBps,feeMinor:fee});lower=upper;if(principal<=upper)break;
 }
 let total=fixed+amount(q.commonExecutionShareMinor,"commonExecutionShareMinor")+variable;
 const floor=amount(q.minimumLifecycleMinor,"minimumLifecycleMinor");if(total<floor)total=floor;
 if(q.maximumLifecycleMinor!==undefined){const cap=amount(q.maximumLifecycleMinor,"maximumLifecycleMinor");if(total>cap)total=cap;}
 return {fixed,execution:total-fixed,total,slabFees};
}
export function assessmentExecutionAccrual(q:AssessmentExecutionTerms,input:{previousPrincipalMinor:string;cumulativePrincipalMinor:string;programmePrincipalMinor:string;priorCollectedServiceMinor:string;approvedCreditsMinor:string}){
 const quoteDigest=validateExecutionTerms(q),previous=amount(input.previousPrincipalMinor,"previousPrincipalMinor"),cumulative=amount(input.cumulativePrincipalMinor,"cumulativePrincipalMinor"),programme=amount(input.programmePrincipalMinor,"programmePrincipalMinor");
 if(cumulative<previous||programme<cumulative)throw new Error("principal must be cumulative and reconciled with programme total");
 const old=lifecycle(q,previous),current=lifecycle(q,cumulative),collected=amount(input.priorCollectedServiceMinor,"priorCollectedServiceMinor"),credits=amount(input.approvedCreditsMinor,"approvedCreditsMinor");
 if(collected+credits>current.total)throw new Error("overpayment or refund decision requires explicit reconciliation");
 const reviewRequired=(cumulative>=100000000000n||programme>=250000000000n)&&!q.largeDealReviewRef;
 return {quoteDigest,currency:"INR",currencyScale:2,reviewRequired,fixedPreparationMinor:current.fixed.toString(),executionEarnedMinor:current.execution.toString(),incrementalExecutionMinor:(current.execution-old.execution).toString(),lifecycleFeeMinor:current.total.toString(),collectedServiceMinor:collected.toString(),approvedCreditsMinor:credits.toString(),serviceBalanceMinor:(current.total-collected-credits).toString(),slabFees:current.slabFees,
  qualification:"Accepted terms input; arithmetic is not an issued invoice, proof of collection or a market benchmark. Tax, external costs and servicing are separate. Common share is frozen per seller, never recalculated after another seller exits."};
}
