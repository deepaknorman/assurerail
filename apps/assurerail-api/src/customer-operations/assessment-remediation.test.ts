import test from "node:test";
import assert from "node:assert/strict";
import {deriveRemediationGaps,initialReassessmentAllowance,isOwnerRole,remediationChangeSummary} from "./assessment-remediation";

test("remediation plan binds record gaps to unique seller-loan-party pairs",()=>{
  const gaps=deriveRemediationGaps({sellerInstitutionId:"seller-1",dataQuality:{status:"RECORD_EXCEPTIONS",recordIssues:[
    {code:"DUPLICATE_PAIR",rowNumber:2,loanId:"L1",partyId:"B1",partyRole:"BORROWER"},
    {code:"DUPLICATE_PAIR",rowNumber:3,loanId:"L1",partyId:"B1",partyRole:"BORROWER"},
    {code:"INVALID_RECORD",rowNumber:4,loanId:null,partyId:null,partyRole:null},
  ]},extraction:{exceptions:[]},analysis:{findings:[]},manifest:[]});
  const duplicate=gaps.find(g=>g.summary.includes("duplicate"))!;
  assert.deepEqual(duplicate.affectedPairs,[{sellerInstitutionId:"seller-1",loanId:"L1",partyId:"B1",partyRole:"BORROWER"}]);
  assert.equal(duplicate.defaultOwnerRole,"SELLER_DATA");
  assert.equal(gaps.find(g=>g.summary.includes("invalid"))?.affectedScope,"PORTFOLIO");
});

test("document and AI gaps remain honest when no affected pair is established",()=>{
  const gaps=deriveRemediationGaps({sellerInstitutionId:"seller",dataQuality:{status:"MATCHED"},manifest:[{versionId:"v1",evidenceType:"SECURITY_DOCUMENT"}],extraction:{exceptions:[{evidenceVersionId:"v1",locator:"page:2",code:"OCR_UNCERTAIN_REVIEW_REQUIRED"}]},analysis:{findings:[{category:"LEGAL",severity:"CRITICAL",description:"Charge evidence is missing",evidenceVersionId:"v1",locator:"page:2"}]}});
  assert.equal(gaps.length,2);assert(gaps.every(g=>g.affectedScope==="PORTFOLIO"&&g.affectedPairs.length===0));
  assert.deepEqual(gaps.find(g=>g.summary.includes("ocr uncertain"))?.requiredEvidenceTypes,["SECURITY_DOCUMENT"]);
  assert.equal(gaps.find(g=>g.summary==="Charge evidence is missing")?.defaultOwnerRole,"SELLER_LEGAL");
});

test("semantic finding keys remain comparable across corrected evidence versions and duplicate citations consolidate",()=>{
  const finding={category:"LEGAL",severity:"HIGH",description:"Charge evidence is missing",evidenceVersionId:"v1",locator:"page:1"};
  const before=deriveRemediationGaps({sellerInstitutionId:"seller",dataQuality:{status:"MATCHED"},manifest:[],extraction:{exceptions:[]},analysis:{findings:[finding,{...finding,locator:"page:2"}]}});
  const after=deriveRemediationGaps({sellerInstitutionId:"seller",dataQuality:{status:"MATCHED"},manifest:[],extraction:{exceptions:[]},analysis:{findings:[{...finding,evidenceVersionId:"v2",locator:"page:7"}]}});
  assert.equal(before.length,1);assert.equal(before[0].gapKey,after[0].gapKey);
  assert.deepEqual(remediationChangeSummary(before,after).continuingGapKeys,[before[0].gapKey]);
});

test("reassessment comparison is stable and reports resolved, continuing and new gaps",()=>{
  const base={sellerInstitutionId:"s",dataQuality:{status:"LOAN_TAPE_MISSING"},extraction:{exceptions:[]},analysis:{findings:[]},manifest:[]};
  const previous=deriveRemediationGaps(base),continuing=deriveRemediationGaps({...base,analysis:{findings:[{category:"CREDIT",severity:"MEDIUM",description:"Arrears history gap",evidenceVersionId:"v2",locator:"row:1"}]}});
  const summary=remediationChangeSummary(previous,continuing,base.dataQuality,base.dataQuality);
  assert.equal(summary.continuingGapKeys.length,1);assert.equal(summary.newGapKeys.length,1);assert.equal(summary.resolvedGapKeys.length,0);
  assert.equal(isOwnerRole("SELLER_COMPLIANCE"),true);assert.equal(isOwnerRole("ASSURERAIL_REVIEWER"),false);
});

test("three reassessments are included only within thirty days while the workspace remains a separate concern",()=>{
  const first=new Date("2026-09-01T00:00:00.000Z");
  const available=initialReassessmentAllowance([first,new Date("2026-09-02T00:00:00.000Z")],new Date("2026-09-30T23:59:59.999Z"));
  assert.equal(available.completedReassessments,1);assert.equal(available.remainingIncludedReassessments,2);assert.equal(available.canRequestIncluded,true);
  const boundary=initialReassessmentAllowance([first],new Date("2026-10-01T00:00:00.000Z"));assert.equal(boundary.withinIncludedWindow,false);assert.equal(boundary.canRequestIncluded,false);
  const exhausted=initialReassessmentAllowance([first,first,first,first],new Date("2026-09-10T00:00:00.000Z"));assert.equal(exhausted.remainingIncludedReassessments,0);assert.equal(exhausted.canRequestIncluded,false);
});
