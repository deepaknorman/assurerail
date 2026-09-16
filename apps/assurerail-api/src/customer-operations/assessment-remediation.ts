import { createHash } from "node:crypto";

export const REMEDIATION_OWNER_ROLES=["SELLER_DATA","SELLER_OPERATIONS","SELLER_CREDIT","SELLER_LEGAL","SELLER_COMPLIANCE"] as const;
export type RemediationOwnerRole=typeof REMEDIATION_OWNER_ROLES[number];
export type AffectedPair={sellerInstitutionId:string;loanId:string;partyId:string;partyRole:string};
export type RemediationGap={gapKey:string;category:string;severity:string;summary:string;affectedScope:"PAIRS"|"PORTFOLIO";affectedPairs:AffectedPair[];unresolvedRecordCount:number;defaultOwnerRole:RemediationOwnerRole;requiredEvidenceTypes:string[]};

type DataQuality={
  status:string;
  parsedPrimaryPairCount?:number;
  expectedPrimaryPairCount?:number;
  parsedLinkedPartyCount?:number;
  expectedLinkedPartyCount?:number;
  invalidRecords?:number;
  duplicateRecords?:number;
  recordIssues?:{code:string;rowNumber:number;loanId:string|null;partyId:string|null;partyRole:string|null}[];
};
type ExtractionException={evidenceVersionId:string;locator:string;code:string};
type Finding={category:string;severity:string;description:string;evidenceVersionId:string;locator:string};
type ManifestEntry={versionId:string;evidenceObjectId?:string;evidenceType?:string};

const evidenceForCategory:Record<string,string[]>={
  DOCUMENTATION:["OTHER_EVIDENCE"],DATA_QUALITY:["LOAN_TAPE"],CREDIT:["REPAYMENT_HISTORY"],LEGAL:["LOAN_AGREEMENT","SECURITY_DOCUMENT"],OPERATIONS:["REPAYMENT_HISTORY","OTHER_EVIDENCE"],
};
const ownerForCategory:Record<string,RemediationOwnerRole>={
  DOCUMENTATION:"SELLER_OPERATIONS",DATA_QUALITY:"SELLER_DATA",CREDIT:"SELLER_CREDIT",LEGAL:"SELLER_LEGAL",OPERATIONS:"SELLER_OPERATIONS",
};

function key(parts:unknown[]) { return `gap_${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0,32)}`; }
function affectedPairs(sellerInstitutionId:string,issues:DataQuality["recordIssues"]):AffectedPair[] {
  const pairs=new Map<string,AffectedPair>();
  for(const issue of issues??[])if(issue.loanId&&issue.partyId&&issue.partyRole){
    const pair={sellerInstitutionId,loanId:issue.loanId,partyId:issue.partyId,partyRole:issue.partyRole};
    pairs.set(`${pair.sellerInstitutionId}\u0000${pair.loanId}\u0000${pair.partyId}`,pair);
  }
  return [...pairs.values()].sort((a,b)=>`${a.loanId}\u0000${a.partyId}`.localeCompare(`${b.loanId}\u0000${b.partyId}`));
}

export function deriveRemediationGaps(input:{sellerInstitutionId:string;dataQuality:DataQuality;extraction:{exceptions:ExtractionException[]};analysis:{findings?:Finding[]};manifest:ManifestEntry[]}):RemediationGap[] {
  const gaps:RemediationGap[]=[];
  const grouped=new Map<string,NonNullable<DataQuality["recordIssues"]>>();
  for(const issue of input.dataQuality.recordIssues??[]){const list=grouped.get(issue.code)??[];list.push(issue);grouped.set(issue.code,list);}
  for(const [code,issues] of grouped){
    const pairs=affectedPairs(input.sellerInstitutionId,issues);
    gaps.push({gapKey:key(["DATA_QUALITY",code]),category:"DATA_QUALITY",severity:"HIGH",summary:dataSummary(code),affectedScope:pairs.length?"PAIRS":"PORTFOLIO",affectedPairs:pairs,unresolvedRecordCount:issues.length-pairs.length,defaultOwnerRole:"SELLER_DATA",requiredEvidenceTypes:["LOAN_TAPE"]});
  }
  if(input.dataQuality.status!=="MATCHED"&&!grouped.size){
    gaps.push({gapKey:key(["DATA_QUALITY",input.dataQuality.status]),category:"DATA_QUALITY",severity:input.dataQuality.status==="LOAN_TAPE_MISSING"?"CRITICAL":"HIGH",summary:dataSummary(input.dataQuality.status),affectedScope:"PORTFOLIO",affectedPairs:[],unresolvedRecordCount:0,defaultOwnerRole:"SELLER_DATA",requiredEvidenceTypes:["LOAN_TAPE"]});
  }
  const manifest=new Map(input.manifest.map(entry=>[entry.versionId,entry]));
  const extractionGroups=new Map<string,ExtractionException[]>();
  for(const exception of input.extraction.exceptions){const groupKey=`${exception.code}\u0000${exception.evidenceVersionId}`;const list=extractionGroups.get(groupKey)??[];list.push(exception);extractionGroups.set(groupKey,list);}
  for(const [groupKey,exceptions] of extractionGroups){
    const [code,versionId]=groupKey.split("\u0000");
    const source=manifest.get(versionId);
    gaps.push({gapKey:key(["EXTRACTION",code,source?.evidenceObjectId??versionId]),category:"DOCUMENTATION",severity:"HIGH",summary:`Correct ${code.replaceAll("_"," ").toLowerCase()} in the referenced document.`,affectedScope:"PORTFOLIO",affectedPairs:[],unresolvedRecordCount:exceptions.length,defaultOwnerRole:"SELLER_OPERATIONS",requiredEvidenceTypes:[source?.evidenceType??"OTHER_EVIDENCE"]});
  }
  for(const finding of input.analysis.findings??[]){
    const category=evidenceForCategory[finding.category]?finding.category:"DOCUMENTATION";
    gaps.push({gapKey:key(["FINDING",category,finding.description.trim().toLowerCase()]),category,severity:finding.severity,summary:finding.description.trim(),affectedScope:"PORTFOLIO",affectedPairs:[],unresolvedRecordCount:0,defaultOwnerRole:ownerForCategory[category],requiredEvidenceTypes:evidenceForCategory[category]});
  }
  const consolidated=new Map<string,RemediationGap>();
  const rank:Record<string,number>={CRITICAL:4,HIGH:3,MEDIUM:2,LOW:1};
  for(const gap of gaps){
    const prior=consolidated.get(gap.gapKey);
    if(!prior){consolidated.set(gap.gapKey,gap);continue;}
    const pairs=new Map([...prior.affectedPairs,...gap.affectedPairs].map(pair=>[`${pair.sellerInstitutionId}\u0000${pair.loanId}\u0000${pair.partyId}`,pair]));
    consolidated.set(gap.gapKey,{...prior,severity:(rank[gap.severity]??0)>(rank[prior.severity]??0)?gap.severity:prior.severity,affectedScope:pairs.size?"PAIRS":"PORTFOLIO",affectedPairs:[...pairs.values()],unresolvedRecordCount:prior.unresolvedRecordCount+gap.unresolvedRecordCount,requiredEvidenceTypes:[...new Set([...prior.requiredEvidenceTypes,...gap.requiredEvidenceTypes])].sort()});
  }
  return [...consolidated.values()].sort((a,b)=>a.gapKey.localeCompare(b.gapKey));
}

function dataSummary(code:string) {
  const summaries:Record<string,string>={INVALID_RECORD:"Correct invalid or incomplete loan-tape rows.",DUPLICATE_PAIR:"Remove duplicate seller–loan–party pairs.",INCONSISTENT_LOAN_BALANCE:"Reconcile inconsistent balances reported for the same loan.",LOAN_TAPE_MISSING:"Upload the complete current loan tape.",TAPE_MAPPING_REQUIRED:"Map the supplied loan tape to the AssureRail admission schema.",QUOTED_COUNT_MISMATCH:"Reconcile the admitted seller–loan–borrower and linked-party counts with the accepted quote.",RECORD_EXCEPTIONS:"Correct the identified loan-tape record exceptions."};
  return summaries[code]??`Resolve the ${code.replaceAll("_"," ").toLowerCase()} exception.`;
}

export function remediationChangeSummary(previous:RemediationGap[],current:RemediationGap[],before?:DataQuality,after?:DataQuality) {
  const oldKeys=new Set(previous.map(g=>g.gapKey)),newKeys=new Set(current.map(g=>g.gapKey));
  return {
    previousGapCount:previous.length,currentGapCount:current.length,
    resolvedGapKeys:[...oldKeys].filter(k=>!newKeys.has(k)).sort(),
    newGapKeys:[...newKeys].filter(k=>!oldKeys.has(k)).sort(),
    continuingGapKeys:[...newKeys].filter(k=>oldKeys.has(k)).sort(),
    dataQualityBefore:before?summaryQuality(before):null,dataQualityAfter:after?summaryQuality(after):null,
  };
}
function summaryQuality(value:DataQuality){return {status:value.status,parsedPrimaryPairCount:value.parsedPrimaryPairCount??null,expectedPrimaryPairCount:value.expectedPrimaryPairCount??null,parsedLinkedPartyCount:value.parsedLinkedPartyCount??null,expectedLinkedPartyCount:value.expectedLinkedPartyCount??null,invalidRecords:value.invalidRecords??0,duplicateRecords:value.duplicateRecords??0};}

export function isOwnerRole(value:unknown):value is RemediationOwnerRole {return typeof value==="string"&&(REMEDIATION_OWNER_ROLES as readonly string[]).includes(value);}

export function initialReassessmentAllowance(releasedAt:(Date|null)[],now=new Date()) {
  const released=releasedAt.filter((value):value is Date=>Boolean(value)).sort((a,b)=>a.getTime()-b.getTime());
  const firstReleasedAt=released[0]??null,includedUntil=firstReleasedAt?new Date(firstReleasedAt.getTime()+30*86400000):null;
  const completedReassessments=Math.max(0,released.length-1),remainingIncludedReassessments=Math.max(0,3-completedReassessments);
  return {firstReleasedAt,includedUntil,completedReassessments,remainingIncludedReassessments,withinIncludedWindow:!includedUntil||includedUntil>now,canRequestIncluded:released.length===0||(remainingIncludedReassessments>0&&Boolean(includedUntil&&includedUntil>now))};
}
