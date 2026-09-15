import { exactMinor } from "../customer-operations/fee-calculation";
import { sha256Digest } from "../contracts/v1";
export type EscrowInstruction = {programmeRef:string;closingRef:string;buyerInstitutionId:string;currency:"INR";grossConsiderationMinor:string;acceptedWaterfallDigest:string;sellerMandateEvidenceRef:string;legs:{legRef:string;sellerInstitutionId:string;beneficiaryRef:string;purpose:"DEBT_RELEASE"|"SELLER_NET"|"SERVICE_FEE"|"EXTERNAL_EXPENSE"|"TAX";amountMinor:string;invoiceRef:string|null}[]};
export function escrowInstruction(input:EscrowInstruction){
  if(input.currency!=="INR"||![input.programmeRef,input.closingRef,input.buyerInstitutionId,input.sellerMandateEvidenceRef].every(x=>typeof x==="string"&&x.length>0&&x.length<=160)||!/^sha256:[a-f0-9]{64}$/.test(input.acceptedWaterfallDigest)||!Array.isArray(input.legs)||input.legs.length<1||input.legs.length>1000)throw new Error("INVALID_ESCROW_INSTRUCTION");
  const gross=BigInt(exactMinor(input.grossConsiderationMinor,"gross consideration",false));
  const refs=new Set<string>();let total=0n;
  for(const leg of input.legs){
    if(![leg.legRef,leg.sellerInstitutionId,leg.beneficiaryRef].every(x=>typeof x==="string"&&x.length>0&&x.length<=160)||refs.has(leg.legRef)||!["DEBT_RELEASE","SELLER_NET","SERVICE_FEE","EXTERNAL_EXPENSE","TAX"].includes(leg.purpose))throw new Error("INVALID_ESCROW_LEG");
    if(["SERVICE_FEE","EXTERNAL_EXPENSE","TAX"].includes(leg.purpose)&&!leg.invoiceRef)throw new Error("INVOICED_DEDUCTION_REQUIRED");
    refs.add(leg.legRef);total+=BigInt(exactMinor(leg.amountMinor,"leg amount",false));
  }
  if(total!==gross)throw new Error("WATERFALL_DOES_NOT_BALANCE");
  return {...input,instructionDigest:sha256Digest(input),custodyProvidedByRail:false};
}
export function reconcileEscrow(input:ReturnType<typeof escrowInstruction>,observations:{legRef:string;providerTransferRef:string;status:"PENDING"|"SETTLED"|"FAILED"|"REVERSED";amountMinor:string;instructionDigest:string}[]){
  if(observations.length>input.legs.length||new Set(observations.map(o=>o.legRef)).size!==observations.length||new Set(observations.map(o=>o.providerTransferRef)).size!==observations.length)throw new Error("DUPLICATE_OR_EXCESS_SETTLEMENT_OBSERVATIONS");
  for(const o of observations){const leg=input.legs.find(l=>l.legRef===o.legRef);if(!leg||!o.providerTransferRef||o.instructionDigest!==input.instructionDigest||o.amountMinor!==leg.amountMinor||!["PENDING","SETTLED","FAILED","REVERSED"].includes(o.status))throw new Error("SETTLEMENT_OBSERVATION_MISMATCH");}
  const complete=observations.length===input.legs.length&&observations.every(o=>o.status==="SETTLED");
  return {status:complete?"RECONCILED":observations.some(o=>o.status==="REVERSED"||o.status==="FAILED")?"EXCEPTION":"PENDING",allLegsSettled:complete,railMayInferSettlementFromVan:false};
}
