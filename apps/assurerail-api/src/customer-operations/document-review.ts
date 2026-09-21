import { createHash } from "node:crypto";

export const DOCUMENT_REVIEW_POLICY_VERSION = "ev-secured-term-da-1.0.0";
export const DOCUMENT_EVIDENCE_SCHEMA_VERSION = "rail-document-evidence-1.0.0";

export const SUPPORTED_ASSESSMENT_DOCUMENT_TYPES = [
  "LOAN_TAPE",
  "LOAN_AGREEMENT",
  "SECURITY_DOCUMENT",
  "REPAYMENT_HISTORY",
  "KYC_AUTHORITY",
  "INSURANCE_COLLATERAL",
  "REPAYMENT_MANDATE",
  "REGISTRATION_RECORD",
  "MODIFICATION_DOCUMENT",
  "OTHER_EVIDENCE",
] as const;

export type AssessmentDocumentType = typeof SUPPORTED_ASSESSMENT_DOCUMENT_TYPES[number];
export type DocumentRoute = "DETERMINISTIC_STRUCTURED" | "NATIVE" | "VISUAL" | "HYBRID";
export type ValueState = "observed" | "derived" | "inferred" | "absent" | "unreadable" | "contradictory";
export type ValidationResult = "pass" | "fail" | "indeterminate" | "not_applicable";
export type ExtractedSegment = { locator:string; text:string };
export type ExtractionException = { locator:string; code:string };

const STRUCTURED_TYPES = new Set([
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const TYPE_ANCHORS:Partial<Record<AssessmentDocumentType,string[]>> = {
  LOAN_AGREEMENT:["loan","borrower","repayment"],
  SECURITY_DOCUMENT:["security","hypothecation","collateral","vehicle","registration"],
  REPAYMENT_HISTORY:["loan","account","balance","principal","instalment","installment"],
  KYC_AUTHORITY:["borrower","identity","pan","address","director","authorised","authorized"],
  INSURANCE_COLLATERAL:["insurance","policy","insured","vehicle","collateral"],
  REPAYMENT_MANDATE:["mandate","nach","debit","account"],
  REGISTRATION_RECORD:["registration","vehicle","chassis","engine","owner"],
  MODIFICATION_DOCUMENT:["amendment","modification","restructure","waiver","moratorium"],
};

function pageNumber(locator:string) {
  const match=/^page:(\d+)$/.exec(locator);
  return match ? Number(match[1]) : null;
}

function textQuality(text:string) {
  const characters=[...text];
  const nonWhitespace=characters.filter(character=>!/\s/.test(character));
  const printable=nonWhitespace.filter(character=>!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(character));
  const replacements=characters.filter(character=>character==="\uFFFD").length;
  return {
    characters:characters.length,
    printableRatio:nonWhitespace.length ? printable.length/nonWhitespace.length : 0,
    replacementRatio:characters.length ? replacements/characters.length : 0,
  };
}

/** Routing decides which extractor may read a page. It does not establish document completeness or eligibility. */
export function routeDocument(input:{contentType:string;evidenceType:string;segments:ExtractedSegment[];exceptions:ExtractionException[]}) {
  const evidenceType=SUPPORTED_ASSESSMENT_DOCUMENT_TYPES.includes(input.evidenceType as AssessmentDocumentType)?input.evidenceType as AssessmentDocumentType:"OTHER_EVIDENCE";
  if(STRUCTURED_TYPES.has(input.contentType))return {
    policyVersion:DOCUMENT_REVIEW_POLICY_VERSION,
    route:"DETERMINISTIC_STRUCTURED" as const,
    nativeAcceptedLocators:input.segments.map(segment=>segment.locator),
    visualRequiredLocators:[] as string[],
    reasons:["TRUSTED_STRUCTURE_PARSED_WITH_BOUNDED_LIBRARY"],
  };
  if(input.contentType==="image/png"||input.contentType==="image/jpeg")return {
    policyVersion:DOCUMENT_REVIEW_POLICY_VERSION,
    route:"VISUAL" as const,
    nativeAcceptedLocators:[] as string[],
    visualRequiredLocators:["page:1"],
    reasons:["IMAGE_REQUIRES_VISUAL_EXTRACTION"],
  };
  const required=new Set(input.exceptions.filter(exception=>exception.code==="OCR_REQUIRED").map(exception=>exception.locator));
  const reasons=new Set<string>();
  for(const segment of input.segments){
    const quality=textQuality(segment.text);
    if(!segment.text.trim()||quality.characters<40){required.add(segment.locator);reasons.add("INSUFFICIENT_NATIVE_TEXT");}
    if(quality.printableRatio<0.95){required.add(segment.locator);reasons.add("LOW_PRINTABLE_CHARACTER_RATIO");}
    if(quality.replacementRatio>0.005){required.add(segment.locator);reasons.add("ENCODING_CORRUPTION");}
  }
  const anchors=TYPE_ANCHORS[evidenceType]??[];
  const combined=input.segments.map(segment=>segment.text.toLocaleLowerCase("en-IN")).join(" ");
  if(anchors.length&&!anchors.some(anchor=>combined.includes(anchor))){
    input.segments.forEach(segment=>required.add(segment.locator));
    reasons.add("EXPECTED_DOCUMENT_ANCHORS_NOT_FOUND");
  }
  const pageLocators=input.segments.filter(segment=>pageNumber(segment.locator)!==null).map(segment=>segment.locator);
  const visualRequiredLocators=[...required].filter(locator=>pageNumber(locator)!==null).sort((a,b)=>pageNumber(a)!-pageNumber(b)!);
  const nativeAcceptedLocators=pageLocators.filter(locator=>!required.has(locator));
  const route:DocumentRoute=visualRequiredLocators.length===0?"NATIVE":nativeAcceptedLocators.length?"HYBRID":"VISUAL";
  return {policyVersion:DOCUMENT_REVIEW_POLICY_VERSION,route,nativeAcceptedLocators,visualRequiredLocators,reasons:reasons.size?[...reasons].sort():["NATIVE_TEXT_QUALITY_ACCEPTED"]};
}

export function mergeHybridSegments(nativeSegments:ExtractedSegment[],visualSegments:ExtractedSegment[],visualRequiredLocators:string[]) {
  const required=new Set(visualRequiredLocators),visual=new Map(visualSegments.map(segment=>[segment.locator,segment]));
  const merged=nativeSegments.map(segment=>required.has(segment.locator)?visual.get(segment.locator)??segment:segment);
  for(const locator of required)if(!merged.some(segment=>segment.locator===locator)&&visual.has(locator))merged.push(visual.get(locator)!);
  return merged.sort((a,b)=>(pageNumber(a.locator)??Number.MAX_SAFE_INTEGER)-(pageNumber(b.locator)??Number.MAX_SAFE_INTEGER)||a.locator.localeCompare(b.locator));
}

const REQUIRED_EV_INVENTORY:AssessmentDocumentType[]=["LOAN_TAPE","LOAN_AGREEMENT","SECURITY_DOCUMENT","REPAYMENT_HISTORY","KYC_AUTHORITY","INSURANCE_COLLATERAL"];

export function documentInventory(assetFamily:string,documentTypes:string[]) {
  const received=[...new Set(documentTypes.filter(type=>SUPPORTED_ASSESSMENT_DOCUMENT_TYPES.includes(type as AssessmentDocumentType)))].sort();
  if(assetFamily!=="VEHICLE_EV")return {policyVersion:DOCUMENT_REVIEW_POLICY_VERSION,status:"INDETERMINATE" as const,required:[],received,missing:[],reason:"ASSET_POLICY_NOT_CONFIGURED"};
  const missing=REQUIRED_EV_INVENTORY.filter(type=>!received.includes(type));
  return {policyVersion:DOCUMENT_REVIEW_POLICY_VERSION,status:missing.length?"EXCEPTIONS" as const:"COMPLETE" as const,required:REQUIRED_EV_INVENTORY,received,missing,reason:missing.length?"REQUIRED_DOCUMENT_FAMILIES_MISSING":"REQUIRED_DOCUMENT_FAMILIES_PRESENT"};
}

type StructuredDocument={evidenceVersionId:string;documentType:string;fields:{fieldPath:string;valueState:string;values:string[]}[]};

function oneObserved(document:StructuredDocument,path:string) {
  const field=document.fields.find(candidate=>candidate.fieldPath===path);
  return field?.valueState==="observed"&&field.values.length===1?field.values[0].trim():null;
}

export function normaliseInrAmountToMinor(value:string) {
  const compact=value.replace(/₹|INR|Rs\.?/gi,"").replaceAll(",","").trim();
  if(!/^(0|[1-9][0-9]{0,17})(\.[0-9]{1,2})?$/.test(compact))return null;
  const [rupees,paise=""]=compact.split(".");
  return (BigInt(rupees)*100n+BigInt((paise+"00").slice(0,2))).toString();
}

/** Deterministic loan/tape reconciliation. Inferred model values are deliberately excluded. */
export function reconcileLoanDocuments(tapeLoans:{loanId:string;principalMinor:string}[],documents:StructuredDocument[]) {
  const byLoan=new Map<string,StructuredDocument[]>(),unallocatedEvidenceVersionIds:string[]=[];
  for(const document of documents){
    const loanId=oneObserved(document,"$.loan_id");
    if(!loanId){unallocatedEvidenceVersionIds.push(document.evidenceVersionId);continue;}
    byLoan.set(loanId,[...(byLoan.get(loanId)??[]),document]);
  }
  const tapeByLoan=new Map(tapeLoans.map(loan=>[loan.loanId,loan]));
  const loans=tapeLoans.map(loan=>{
    const matched=byLoan.get(loan.loanId)??[];
    const observedPrincipal=matched.map(document=>oneObserved(document,"$.current_position.principal_outstanding")).filter((value):value is string=>Boolean(value)).map(normaliseInrAmountToMinor);
    const validPrincipal=observedPrincipal.filter((value):value is string=>value!==null);
    const uniquePrincipal=[...new Set(validPrincipal)];
    const principalResult:ValidationResult=!observedPrincipal.length?"indeterminate":validPrincipal.length!==observedPrincipal.length||uniquePrincipal.length!==1?"indeterminate":uniquePrincipal[0]===loan.principalMinor?"pass":"fail";
    return {loanId:loan.loanId,tapePrincipalMinor:loan.principalMinor,documentEvidenceVersionIds:matched.map(document=>document.evidenceVersionId).sort(),validationResults:[{ruleId:"LOAN-FILE-COVERAGE-001",ruleVersion:"1.0.0",result:matched.length?"pass" as const:"fail" as const,severity:"error",messageCode:matched.length?"LOAN_FILE_DOCUMENT_MATCHED":"LOAN_FILE_DOCUMENT_NOT_MATCHED"},{ruleId:"LOAN-TAPE-PRINCIPAL-001",ruleVersion:"1.0.0",result:principalResult,severity:"error",observed:uniquePrincipal,expected:loan.principalMinor,messageCode:principalResult==="pass"?"POOL_TAPE_PRINCIPAL_RECONCILES":principalResult==="fail"?"POOL_TAPE_PRINCIPAL_MISMATCH":"PRINCIPAL_RECONCILIATION_INDETERMINATE"}]};
  });
  const extraLoanIds=[...byLoan.keys()].filter(loanId=>!tapeByLoan.has(loanId)).sort();
  const documentedLoanCount=loans.filter(loan=>loan.documentEvidenceVersionIds.length).length;
  const ruleResult=(loan:typeof loans[number],ruleId:string)=>loan.validationResults.find(result=>result.ruleId===ruleId)?.result;
  const principalReconciledLoanCount=loans.filter(loan=>ruleResult(loan,"LOAN-TAPE-PRINCIPAL-001")==="pass").length;
  const unresolvedPrincipalMinor=loans.filter(loan=>loan.validationResults.some(result=>result.result!=="pass")).reduce((sum,loan)=>sum+BigInt(loan.tapePrincipalMinor),0n).toString();
  return {policyVersion:DOCUMENT_REVIEW_POLICY_VERSION,coveragePolicy:"EVERY_ADMITTED_TAPE_LOAN",tapeLoanCount:tapeLoans.length,documentedLoanCount,principalReconciledLoanCount,coveragePercent:tapeLoans.length?Number(((BigInt(documentedLoanCount)*10000n)/BigInt(tapeLoans.length)))/100:0,unresolvedPrincipalMinor,unallocatedEvidenceVersionIds:[...new Set(unallocatedEvidenceVersionIds)].sort(),extraDocumentLoanIds:extraLoanIds,status:tapeLoans.length>0&&documentedLoanCount===tapeLoans.length&&principalReconciledLoanCount===tapeLoans.length&&!extraLoanIds.length?"RECONCILED" as const:"EXCEPTIONS" as const,loans};
}

export function documentEvidenceEnvelope(input:{
  evidenceVersionId:string;evidenceObjectId:string;documentType:string;sourceDigest:string;contentType:string;
  routing:ReturnType<typeof routeDocument>;extractorVersion:string;segments:ExtractedSegment[];exceptions:ExtractionException[];
  visualProvenance?:unknown;
}) {
  const createdAt=new Date().toISOString();
  const status=input.exceptions.length?"exception":"accepted";
  const envelope={
    extractionId:`ext_${createHash("sha256").update(`${input.evidenceVersionId}:${input.sourceDigest}:${DOCUMENT_EVIDENCE_SCHEMA_VERSION}`).digest("hex").slice(0,32)}`,
    documentId:input.evidenceObjectId,
    evidenceVersionId:input.evidenceVersionId,
    documentType:input.documentType,
    schemaVersion:DOCUMENT_EVIDENCE_SCHEMA_VERSION,
    sourceSha256:input.sourceDigest,
    status,
    fields:{},
    fieldAssessments:{} as Record<string,{valueState:ValueState}>,
    evidence:input.segments.map(segment=>({locator:segment.locator,locatorQuality:"page_only",sourceMethod:input.routing.visualRequiredLocators.includes(segment.locator)?"visual_model":"native_parser"})),
    unreadableFields:input.exceptions.filter(exception=>exception.code.includes("OCR")||exception.code.includes("UNREADABLE")),
    contradictions:[],
    validationResults:input.exceptions.map(exception=>({ruleId:"DOCUMENT-READABILITY-001",ruleVersion:"1.0.0",result:"indeterminate" as ValidationResult,severity:"error",fieldPaths:[],messageCode:exception.code,locator:exception.locator})),
    provenance:{policyVersion:input.routing.policyVersion,extractorVersion:input.extractorVersion,contentType:input.contentType,route:input.routing.route,routeReasons:input.routing.reasons,visualProvenance:input.visualProvenance??null},
    createdAt,
  };
  return {...envelope,envelopeDigest:`sha256:${createHash("sha256").update(JSON.stringify(envelope)).digest("hex")}`};
}
