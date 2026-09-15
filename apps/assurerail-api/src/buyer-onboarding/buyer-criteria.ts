import { sha256Digest } from "../contracts/v1";

export const BUYER_CHOICES = {
  assets: ["EV", "HOUSING", "GOLD", "EDUCATION"],
  subtypes: ["EV_THREE_WHEELER", "EV_TWO_WHEELER", "EV_PASSENGER_FLEET", "EV_COMMERCIAL_FLEET", "HOUSING_COMPLETED", "HOUSING_CONSTRUCTION", "HOUSING_IMPROVEMENT", "GOLD_JEWELLERY", "EDUCATION_DOMESTIC", "EDUCATION_OVERSEAS", "EDUCATION_VOCATIONAL"],
  originators: ["APPROVED_ORIGINATORS", "NEW_SUBJECT_TO_ONBOARDING"],
  borrowers: ["INDIVIDUAL", "SOLE_PROPRIETOR", "PARTNERSHIP_LLP", "COMPANY"],
  psl: ["REQUIRED", "PREFERRED", "NO_PREFERENCE"],
  closingMode: ["SEQUENTIAL", "SIMULTANEOUS", "DEAL_SPECIFIC"],
  exclusions: ["RESTRUCTURED", "DISPUTED", "EVERGREENING_UNRESOLVED", "BULLET_BALLOON"],
  requiredEvidence: ["TAPE_RECONCILIATION", "REPAYMENT_HISTORY", "EXECUTED_DOCUMENTS", "DEBT_RELEASE", "KYC_AUTHORITY", "INSURANCE_COLLATERAL", "ORIGINATOR_FINANCIALS"],
  specialistReviews: ["LEGAL", "FACTUAL_VERIFICATION", "COLLATERAL_TECHNICAL", "FINANCIAL_MODEL", "SCOPE_AFTER_EVIDENCE"],
  diligence: ["BUYER_LED", "EXTERNAL_ASSISTED_BUYER_LED"],
  servicing: ["ORIGINATOR", "BUYER", "APPROVED_THIRD_PARTY"],
  remittance: ["DAILY", "WEEKLY", "MONTHLY", "DEAL_SPECIFIC"],
  reporting: ["MONTHLY", "FORTNIGHTLY", "WEEKLY"],
  formats: ["CSV", "XLSX", "APPROVED_API"],
  priceBasis: ["PAR_OR_DISCOUNT", "CASHFLOW_YIELD", "DEAL_SPECIFIC"],
  exceptionPolicy: ["NO_EXCEPTIONS", "EXPLICIT_BUYER_REVIEW"],
  geography: ["ALL_INDIA", "SELECTED_STATES"],
  states: ["AN","AP","AR","AS","BR","CH","CG","DN","DL","GA","GJ","HR","HP","JK","JH","KA","KL","LA","LD","MP","MH","MN","ML","MZ","NL","OD","PY","PB","RJ","SK","TN","TS","TR","UP","UK","WB"],
} as const;
const multi = new Set(["assets", "subtypes", "originators", "borrowers", "exclusions", "requiredEvidence", "specialistReviews", "servicing", "formats", "states"]);
const ranges: Record<string,[number,number]> = { ticketCr:[0,100000], sellerTicketCr:[0,100000], remainingMonths:[0,600], walMonths:[0,600], yieldBps:[0,10000] };
const numbers: Record<string,[number,number]> = { maxSellers:[1,100], maxDpd:[0,3650], minSeasoningMonths:[0,120], maxLtvPct:[0,100], maxOemPct:[0,100], maxStatePct:[0,100], historyMonths:[1,120] };
export type BuyerCriteria=Record<string,string|string[]|number|number[]|boolean>;
export function validateBuyerCriteria(raw:unknown,complete=false):BuyerCriteria {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("structured buyer criteria required");
  const c=raw as BuyerCriteria;
  for(const [key,value] of Object.entries(c)){
    if(Object.hasOwn(BUYER_CHOICES,key)){
      const choices=BUYER_CHOICES[key as keyof typeof BUYER_CHOICES] as readonly string[];
      if(multi.has(key)){
        if(!Array.isArray(value)||value.length>choices.length||new Set<string|number>(value).size!==value.length||value.some(v=>typeof v!=="string"||!choices.includes(v)))throw new Error(`${key}: choose distinct permitted options`);
      }else if(typeof value!=="string"||!choices.includes(value))throw new Error(`${key}: choose a permitted option`);
    }else if(Object.hasOwn(ranges,key)){
      const [min,max]=ranges[key];
      if(!Array.isArray(value)||value.length!==2||value.some(v=>typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)||Number(value[0])>Number(value[1]))throw new Error(`${key}: valid ordered range required`);
    }else if(Object.hasOwn(numbers,key)){
      const [min,max]=numbers[key];if(typeof value!=="number"||!Number.isInteger(value)||value<min||value>max)throw new Error(`${key}: integer ${min} to ${max} required`);
    }else if(key==="requireBuyerPrecheck"){
      if(typeof value!=="boolean")throw new Error("requireBuyerPrecheck must be boolean");
    }else if(key==="validFrom"||key==="validTo"){
      if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw new Error(`${key}: valid date required`);
    }else throw new Error(`unknown buyer criterion: ${key}`);
  }
  if(c.assets&&c.subtypes)for(const sub of c.subtypes as string[])if(!(c.assets as string[]).includes(sub.split("_")[0]))throw new Error("subtype does not belong to a selected asset family");
  if(c.geography==="ALL_INDIA"&&(c.states as string[]|undefined)?.length)throw new Error("all-India geography must not retain selected-state restrictions");
  if(c.validFrom&&c.validTo&&(c.validFrom>c.validTo||Date.parse(String(c.validTo))-Date.parse(String(c.validFrom))>366*86400000))throw new Error("profile validity must be ordered and no more than 366 days");
  if(c.ticketCr&&c.sellerTicketCr&&Number((c.sellerTicketCr as number[])[0])>Number((c.ticketCr as number[])[1]))throw new Error("minimum seller ticket exceeds maximum programme ticket");
  if(complete){
    const required=["assets","subtypes","originators","borrowers","psl","geography","ticketCr","sellerTicketCr","remainingMonths","maxSellers","maxDpd","minSeasoningMonths","maxLtvPct","maxOemPct","maxStatePct","requiredEvidence","historyMonths","diligence","servicing","remittance","reporting","formats","priceBasis","closingMode","exceptionPolicy","requireBuyerPrecheck","validFrom","validTo"];
    for(const k of required)if(c[k]===undefined||(Array.isArray(c[k])&&!c[k].length))throw new Error(`${k}: required before submission`);
    if(c.geography==="SELECTED_STATES"&&!(c.states as string[]|undefined)?.length)throw new Error("select at least one state");
    if(!(c.requiredEvidence as string[]).includes("TAPE_RECONCILIATION"))throw new Error("tape reconciliation evidence is required");
  }
  return JSON.parse(JSON.stringify(c)) as BuyerCriteria;
}
export function buyerProfileDigest(workspaceId:string,version:number,msaDigest:string,criteria:BuyerCriteria){return sha256Digest({schema:"assurerail-buyer-profile/1",workspaceId,version,msaDigest,criteria:Object.fromEntries(Object.entries(criteria).map(([key,value])=>[key,typeof value==="number"?String(value):Array.isArray(value)?value.map(v=>typeof v==="number"?String(v):v):value]))});}

export function approvedBuyerProfile(input:{status:string;criteria:BuyerCriteria;approvals:Record<string,{actor:string;digest:string}>;digest:string;now?:Date}){
  const now=(input.now??new Date()).toISOString().slice(0,10),required=["CREDIT","LEGAL","OPERATIONS"];
  return input.status==="APPROVED"&&String(input.criteria.validFrom)<=now&&String(input.criteria.validTo)>=now&&Boolean(input.digest)&&required.every(r=>Boolean(input.approvals[r]?.actor)&&input.approvals[r]?.digest===input.digest)&&new Set(required.map(r=>input.approvals[r]?.actor)).size===3;
}
