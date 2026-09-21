import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../store/prisma.service";
import { EvidenceObjectStore } from "../evidence/object-store.service";
import { EvidenceIntakeService } from "../evidence/evidence-intake.service";
import { Readable } from "node:stream";
import { InternalAccessService } from "../internal-access/internal-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { sha256Digest } from "../contracts/v1";
import { AssessmentEngagementService, asJson, bounded, engagementEnabled } from "./assessment-engagement.service";
import { analyseSources, extractDocument, type SourceSegment } from "./document-analysis";
import type { InternalOpsActor, ParticipantOpsActor } from "./customer-operations.service";
import { extractAndValidateOcr, type AiDocument } from "./ocr.adapter";
import { loanTapeMetrics } from "./loan-tape-metrics";
import { createInitialAssessmentReceipt } from "../ai-assurance/assessment-ai-receipt";
import { deriveRemediationGaps, initialReassessmentAllowance, isOwnerRole, remediationChangeSummary, type RemediationGap } from "./assessment-remediation";
import { documentEvidenceEnvelope, documentInventory, mergeHybridSegments, reconcileLoanDocuments, routeDocument, SUPPORTED_ASSESSMENT_DOCUMENT_TYPES } from "./document-review";
type Manifest = {versionId:string;evidenceObjectId:string;digest:string;contentType:string;sizeBytes:number;evidenceType:string}[];
export function automatedInitialOutcome(input:{assetFamily:string;dataQuality:{status:string};exceptions:{code:string}[];analysis:{provider:string;findings?:{severity:string}[]};documentInventory?:{status:string};loanReconciliation?:{status:string}}) {
  if(input.assetFamily==="OTHER")return "OUTSIDE_CURRENT_SCOPE" as const;
  if(!["openai","gemini"].includes(input.analysis.provider))return "AUTOMATED_ANALYSIS_INCOMPLETE" as const;
  if(input.dataQuality.status!=="MATCHED"||input.exceptions.length||input.documentInventory&&input.documentInventory.status!=="COMPLETE"||input.loanReconciliation&&input.loanReconciliation.status!=="RECONCILED"||input.analysis.findings?.some(f=>f.severity==="CRITICAL"))return "FIX_AND_REASSESS" as const;
  return "READY_FOR_PORTFOLIO_PREPARATION" as const;
}

@Injectable()
export class AssessmentProcessingService {
  constructor(private readonly db:PrismaService,private readonly engagements:AssessmentEngagementService,private readonly store:EvidenceObjectStore,private readonly staff:InternalAccessService,private readonly stepUp:StepUpService,private readonly intake:EvidenceIntakeService) {}
  async upload(actor:ParticipantOpsActor,id:string,stage:string,stream:Readable,metadata:{filename?:unknown;contentType?:unknown;documentType?:unknown;evidenceObjectId?:unknown;requestRef?:unknown}) {
    await this.engagements.participant(actor);
    await this.engagements.evidenceAuthority(actor,true);
    const {engagement}=await this.engagements.requirePaid(this.db,actor.actingInstitutionId,id,stage);
    const documentType=bounded(metadata.documentType,"documentType");
    if(!SUPPORTED_ASSESSMENT_DOCUMENT_TYPES.includes(documentType as never))throw new ConflictException("supported document category required");
    const profiles=JSON.parse(process.env.ASSURERAIL_ASSESSMENT_UPLOAD_PROFILES_JSON??"{}") as Record<string,{connectorRegistrationId:string;schemaId:string;schemaVersion:string;retentionDays:number}>;
    const profile=profiles[actor.actingInstitutionId];
    if(!profile||!Number.isInteger(profile.retentionDays)||profile.retentionDays<1||profile.retentionDays>3650)throw new ConflictException("approved document intake profile and retention period must be configured for this institution");
    if(metadata.evidenceObjectId){const prior=await this.db.evidenceObject.findUnique({where:{id:bounded(metadata.evidenceObjectId,"evidenceObjectId")}});if(!prior||prior.institutionId!==actor.actingInstitutionId||prior.purpose!==`ASSESSMENT:${id}`)throw new NotFoundException("document not found in this engagement");}
    return this.intake.ingestDocument(actor.actorUserId,actor.actingInstitutionId,stream,{...profile,profileRef:"assurerail.neutral-intake.v1",filename:bounded(metadata.filename,"filename",240),contentType:bounded(metadata.contentType,"contentType"),title:documentType,documentType,evidenceType:documentType,classification:"RESTRICTED",purpose:`ASSESSMENT:${id}`,retentionUntilAt:new Date(Date.now()+profile.retentionDays*86400000).toISOString(),sourceAsOfAt:new Date((engagement.scope as {asOfDate:string}).asOfDate).toISOString(),idempotencyKey:bounded(metadata.requestRef,"requestRef"),evidenceObjectId:metadata.evidenceObjectId?bounded(metadata.evidenceObjectId,"evidenceObjectId"):null});
  }
  private scopeDigest(engagement:{scope:unknown;quoteDigest:string}) { return sha256Digest({scope:engagement.scope,quoteDigest:engagement.quoteDigest}); }
  async policy(actor:ParticipantOpsActor,id:string) {
    await this.engagements.participant(actor);await this.engagements.evidenceAuthority(actor);
    const engagement=await this.engagements.scoped(this.db,actor.actingInstitutionId,id);
    const released=await this.db.assessmentProcessingJob.findMany({where:{engagementId:id,stage:"INITIAL",status:"AUTO_RELEASED"},orderBy:{releasedAt:"asc"}});
    const allowance=initialReassessmentAllowance(released.map(run=>run.releasedAt));
    return {scopeDigest:this.scopeDigest(engagement),initialAssessmentReleased:released.length>0,includedReassessmentLimit:3,...allowance,workspaceOpen:true,changedScopeRequiresRequote:true,initialAssessmentHumanContentReview:false};
  }
  async remediation(actor:ParticipantOpsActor,id:string) {
    await this.engagements.participant(actor);await this.engagements.evidenceAuthority(actor);await this.engagements.scoped(this.db,actor.actingInstitutionId,id);
    return this.db.assessmentRemediationItem.findMany({where:{engagementId:id},orderBy:[{createdAt:"desc"},{gapKey:"asc"}],take:500});
  }
  async planRemediation(actor:ParticipantOpsActor,id:string,itemId:string,body:{ownerRole?:unknown;correctionEvidenceVersionIds?:unknown;stepUpEvidenceId?:unknown}) {
    await this.engagements.participant(actor);await this.engagements.evidenceAuthority(actor,true);
    if(!isOwnerRole(body.ownerRole))throw new ConflictException("controlled seller remediation owner required");
    const ownerRole=body.ownerRole;
    const ids=body.correctionEvidenceVersionIds;
    if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(v=>typeof v!=="string"||v.length>160))throw new ConflictException("1–100 unique corrected evidence versions required");
    return this.engagements.transaction(async tx=>{
      await this.engagements.scoped(tx,actor.actingInstitutionId,id);
      const item=await tx.assessmentRemediationItem.findUnique({where:{id:itemId},include:{sourceRun:true}});
      if(!item||item.engagementId!==id)throw new NotFoundException("remediation item not found");
      const latest=await tx.assessmentProcessingJob.findFirst({where:{engagementId:id,stage:"INITIAL",status:"AUTO_RELEASED"},orderBy:{releasedAt:"desc"}});
      if(!latest||latest.id!==item.sourceRunId||!["OPEN","EVIDENCE_ATTACHED"].includes(item.status))throw new ConflictException("only a gap from the latest released Initial Assessment can be planned");
      const versions=await tx.evidenceVersion.findMany({where:{id:{in:ids}},include:{evidenceObject:true,documentVersion:true}});
      if(versions.length!==ids.length)throw new NotFoundException("corrected evidence version not found");
      for(const version of versions){this.validateSource(version,actor.actingInstitutionId,id);if(version.createdAt<=item.sourceRun.releasedAt!||(item.sourceRun.sourceManifest as unknown as Manifest).some(source=>source.versionId===version.id))throw new ConflictException("corrected or newly supplied evidence after the source assessment is required");}
      const required=item.requiredEvidenceTypes as string[];
      if(!versions.some(version=>required.includes(version.evidenceObject.evidenceType)))throw new ConflictException("corrected evidence must include a required evidence category");
      const step=bounded(body.stepUpEvidenceId,"stepUpEvidenceId");
      await this.stepUp.consume({evidenceId:step,userId:actor.actorUserId,sessionId:actor.actorSessionId,institutionId:actor.actingInstitutionId,purpose:"ENGAGEMENT_REMEDIATION_PLAN"},tx);
      return tx.assessmentRemediationItem.update({where:{id:itemId},data:{ownerRole,correctionEvidenceVersionIds:asJson([...ids].sort()),status:"EVIDENCE_ATTACHED",plannedByUserId:actor.actorUserId,planningStepUpId:step,plannedAt:new Date()}});
    });
  }
  async request(actor:ParticipantOpsActor,id:string,body:{stage?:unknown;requestRef?:unknown;evidenceVersionIds?:unknown;scopeDigest?:unknown;baselineRunId?:unknown;remediationItemIds?:unknown;stepUpEvidenceId?:unknown}) {
    await this.engagements.participant(actor);
    await this.engagements.evidenceAuthority(actor,true);
    const stage=bounded(body.stage,"stage"),requestRef=bounded(body.requestRef,"requestRef");
    const ids=body.evidenceVersionIds;
    if(!["INITIAL","PREPARATION"].includes(stage)||!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(v=>typeof v!=="string"||v.length>160))throw new ConflictException("stage and 1–100 unique evidence versions required");
    return this.engagements.transaction(async tx=>{
      const {engagement}=await this.engagements.requirePaid(tx,actor.actingInstitutionId,id,stage);
      const versions=await tx.evidenceVersion.findMany({where:{id:{in:ids}},include:{evidenceObject:true,documentVersion:true}});
      if(versions.length!==ids.length)throw new NotFoundException("evidence version not found");
      for(const v of versions) this.validateSource(v,actor.actingInstitutionId,id);
      if(versions.reduce((sum,v)=>sum+v.documentVersion!.sizeBytes,0)>40*1024*1024)throw new ConflictException("per-run document budget exceeded; split the approved scope");
      const manifest:Manifest=versions.map(v=>({versionId:v.id,evidenceObjectId:v.evidenceObjectId,digest:v.payloadDigest,contentType:v.documentVersion!.detectedContentType,sizeBytes:v.documentVersion!.sizeBytes,evidenceType:v.evidenceObject.evidenceType})).sort((a,b)=>a.versionId.localeCompare(b.versionId));
      const expectedScopeDigest=this.scopeDigest(engagement);
      const remediationItemIds=Array.isArray(body.remediationItemIds)?[...body.remediationItemIds].sort():body.remediationItemIds??[];
      const requestDigest=sha256Digest({id,stage,manifest,scopeDigest:expectedScopeDigest,baselineRunId:body.baselineRunId??null,remediationItemIds});
      const prior=await tx.assessmentProcessingJob.findUnique({where:{engagementId_requestRef:{engagementId:id,requestRef}}});
      if(prior){if(prior.requestDigest!==requestDigest)throw new ConflictException("run reference has different evidence");return this.publicJob(prior);}
      const jobs=await tx.assessmentProcessingJob.findMany({where:{engagementId:id,stage},orderBy:{createdAt:"asc"}});
      if(jobs.some(j=>["QUEUED","RUNNING","REVIEW_REQUIRED"].includes(j.status)))throw new ConflictException("complete the current run before requesting another");
      let baselineRunId:string|null=null,reassessmentOrdinal=0;
      if(stage==="INITIAL"){
        const released=jobs.filter(j=>j.status==="AUTO_RELEASED");
        if(jobs.length>=8)throw new ConflictException("processing retry allowance exhausted; workspace remains open for support and a revised order");
        if(released.length){
          const latest=released.at(-1)!;baselineRunId=bounded(body.baselineRunId,"baselineRunId");
          if(baselineRunId!==latest.id)throw new ConflictException("reassessment must compare with the latest released Initial Assessment");
          if(body.scopeDigest!==expectedScopeDigest)throw new ConflictException("accepted scope has changed or was not confirmed; obtain a new quote");
          const allowance=initialReassessmentAllowance(released.map(run=>run.releasedAt));
          if(!allowance.remainingIncludedReassessments)throw new ConflictException("three included reassessments have been used; workspace remains open for a revised order");
          if(!allowance.withinIncludedWindow)throw new ConflictException("included reassessment window has ended; workspace remains open for a revised order");
          if(!Array.isArray(remediationItemIds)||!remediationItemIds.length||remediationItemIds.length>200||new Set(remediationItemIds).size!==remediationItemIds.length||remediationItemIds.some(v=>typeof v!=="string"||v.length>160))throw new ConflictException("select the latest planned remediation items for reassessment");
          const items=await tx.assessmentRemediationItem.findMany({where:{id:{in:remediationItemIds as string[]},engagementId:id,sourceRunId:latest.id,status:"EVIDENCE_ATTACHED"}});
          if(items.length!==remediationItemIds.length)throw new ConflictException("every selected remediation item must belong to the latest run and have corrected evidence attached");
          const attached=new Set(items.flatMap(item=>item.correctionEvidenceVersionIds as string[]));
          if([...attached].some(versionId=>!ids.includes(versionId)))throw new ConflictException("the reassessment manifest must include all attached corrected evidence");
          if(sha256Digest(manifest)===sha256Digest(latest.sourceManifest))throw new ConflictException("reassessment requires changed or additional evidence");
          reassessmentOrdinal=released.length;
        }else if(body.baselineRunId||body.remediationItemIds||body.scopeDigest&&body.scopeDigest!==expectedScopeDigest)throw new ConflictException("the first Initial Assessment cannot claim reassessment lineage");
      }
      const step=bounded(body.stepUpEvidenceId,"stepUpEvidenceId");
      await this.stepUp.consume({evidenceId:step,userId:actor.actorUserId,sessionId:actor.actorSessionId,institutionId:actor.actingInstitutionId,purpose:"ENGAGEMENT_PROCESSING_REQUEST"},tx);
      return this.publicJob(await tx.assessmentProcessingJob.create({data:{id:`aprocess_${randomUUID()}`,engagementId:id,requestRef,requestDigest,scopeDigest:expectedScopeDigest,baselineRunId,reassessmentOrdinal,stage,evidenceVersionIds:asJson(ids),sourceManifest:asJson(manifest),requestedByUserId:actor.actorUserId}}));
    });
  }
  private validateSource(v:any,institutionId:string,engagementId:string) {
    if(v.evidenceObject.institutionId!==institutionId || v.evidenceObject.purpose!==`ASSESSMENT:${engagementId}` || v.evidenceObject.status!=="AVAILABLE" || v.evidenceObject.currentVersion!==v.version || v.validationStatus!=="VALID" || (v.expiresAt&&v.expiresAt<=new Date()) || !v.documentVersion || v.documentVersion.malwareStatus!=="CLEAN")throw new ForbiddenException("current clean evidence scoped to this engagement required");
  }
  private publicJob(job:any) { return {id:job.id,stage:job.stage,status:job.status,createdAt:job.createdAt,releasedAt:job.releasedAt,reviewedAt:job.reviewedAt,errorCode:job.errorCode,...(["AUTO_RELEASED","RELEASED"].includes(job.status)?{result:job.result,resultDigest:job.resultDigest}:{}),liveDecisionAuthority:false}; }
  async list(actor:ParticipantOpsActor,id:string) {await this.engagements.participant(actor);await this.engagements.evidenceAuthority(actor);await this.engagements.scoped(this.db,actor.actingInstitutionId,id);return (await this.db.assessmentProcessingJob.findMany({where:{engagementId:id},orderBy:{createdAt:"desc"}})).map(j=>this.publicJob(j));}
  async internalReport(actor:InternalOpsActor,institutionId:string,id:string,jobId:string) {
    engagementEnabled();await this.staff.require({userId:actor.actorUserId,permission:"CASE_TASK_PREPARE",scopeType:"INSTITUTION",scopeRef:institutionId});
    await this.engagements.scoped(this.db,institutionId,id);const job=await this.db.assessmentProcessingJob.findUnique({where:{id:jobId},include:{documentReviews:{include:{attempts:{orderBy:{ordinal:"asc"}}}}}});if(!job||job.engagementId!==id)throw new NotFoundException("run not found");return job;
  }
  async runNext() {
    if(process.env.ASSURERAIL_DOCUMENT_PROCESSING_MODE!=="shadow")return;
    engagementEnabled();
    // An abandoned run is never reported as successful or retried invisibly against an AI budget.
    await this.db.assessmentProcessingJob.updateMany({where:{status:"RUNNING",startedAt:{lt:new Date(Date.now()-10*60000)}},data:{status:"FAILED",errorCode:"WORKER_INTERRUPTED_REVIEW_REQUIRED"}});
    const job=await this.db.assessmentProcessingJob.findFirst({where:{status:"QUEUED"},orderBy:{createdAt:"asc"},include:{engagement:{include:{customerContract:true}}}});
    if(!job)return;
    const claimed=await this.db.assessmentProcessingJob.updateMany({where:{id:job.id,status:"QUEUED"},data:{status:"RUNNING",startedAt:new Date()}});if(claimed.count!==1)return;
    try{
      await this.engagements.requirePaid(this.db,job.engagement.customerContract.institutionId,job.engagementId,job.stage);
      const sources:SourceSegment[]=[],exceptions:{evidenceVersionId:string;locator:string;code:string}[]=[],ocrProvenance:unknown[]=[],documentEnvelopes:unknown[]=[];
      let extractedCharacters=0;
      const tapes:{contentType:string;segments:{text:string}[]}[]=[];
      const manifest=job.sourceManifest as unknown as Manifest;
      for(const entry of manifest){
        const v=await this.db.evidenceVersion.findUniqueOrThrow({where:{id:entry.versionId},include:{evidenceObject:true,documentVersion:true}});
        this.validateSource(v,job.engagement.customerContract.institutionId,job.engagementId);
        const object=await this.store.get(v.documentVersion!.storageRef),chunks:Buffer[]=[];let size=0;
        const timer=setTimeout(()=>object.body.destroy(new Error("DOCUMENT_READ_TIMEOUT")),30000);
        try{for await(const chunk of object.body){const b=Buffer.from(chunk);size+=b.length;if(size>20*1024*1024)throw new Error("DOCUMENT_SIZE_LIMIT");chunks.push(b);}}finally{clearTimeout(timer);object.body.destroy();}
        const bytes=Buffer.concat(chunks);
        if(size!==entry.sizeBytes||`sha256:${createHash("sha256").update(bytes).digest("hex")}`!==entry.digest)throw new Error("DOCUMENT_DIGEST_MISMATCH");
        let extracted=["image/png","image/jpeg"].includes(entry.contentType)?{segments:[{locator:"page:1",text:""}],exceptions:[{locator:"page:1",code:"OCR_REQUIRED"}],extractorVersion:"image-ocr"}:await extractDocument(bytes,entry.contentType);
        const attemptRows:{method:string;status:string;provider?:string;model?:string;modelTier?:string;extractorVersion?:string;promptVersion?:string;requestedLocators:string[];usage?:unknown;failureCode?:string;resultDigest?:string}[]=[{method:"NATIVE_LIBRARY",status:"COMPLETED",extractorVersion:extracted.extractorVersion,requestedLocators:extracted.segments.map(segment=>segment.locator),resultDigest:sha256Digest(extracted.segments.map(segment=>({locator:segment.locator,textDigest:sha256Digest(segment.text)})))}];
        const routing=routeDocument({contentType:entry.contentType,evidenceType:entry.evidenceType,segments:extracted.segments,exceptions:extracted.exceptions});
        let visualProvenance:unknown=null;
        if(routing.visualRequiredLocators.length&&process.env.ASSURERAIL_AI_ENABLED==="true"){
          const pageNumbers=routing.visualRequiredLocators.map(locator=>Number(locator.split(":")[1]));
          const ocr=await extractAndValidateOcr({bytes,contentType:entry.contentType as AiDocument["contentType"]},pageNumbers);
          const visualSegments=ocr.pages.map(page=>({locator:`page:${page.page}`,text:page.text}));
          const unresolved=ocr.pages.filter(page=>page.uncertain||!page.text.trim()).map(page=>({locator:`page:${page.page}`,code:"OCR_UNCERTAIN_REVIEW_REQUIRED"}));
          extracted={...extracted,segments:mergeHybridSegments(extracted.segments,visualSegments,routing.visualRequiredLocators),exceptions:[...extracted.exceptions.filter(exception=>!routing.visualRequiredLocators.includes(exception.locator)),...unresolved]};
          const provenance={extraction:ocr.extraction,validation:ocr.validation,qualification:ocr.qualification,changedOnValidation:ocr.changedOnValidation,pageNumbers};
          visualProvenance=provenance;
          ocrProvenance.push({evidenceVersionId:entry.versionId,...provenance});
          for(const [method,pass] of [["VISUAL_MODEL",ocr.extraction],["VISUAL_VALIDATION",ocr.validation]] as const){
            // The validation pass is skipped when its input cannot fit the model input budget;
            // the skip is recorded on the review provenance rather than as a completed attempt.
            if(!pass)continue;
            if(pass.fallbackUsed)attemptRows.push({method,status:"FAILED_AVAILABILITY",provider:"openai",model:pass.primaryModel,modelTier:pass.primaryTier,promptVersion:"rail-ocr-1",requestedLocators:routing.visualRequiredLocators,failureCode:pass.primaryFailure});
            attemptRows.push({method,status:"COMPLETED",provider:pass.provider,model:pass.model,modelTier:pass.modelTier,promptVersion:"rail-ocr-1",requestedLocators:routing.visualRequiredLocators,usage:pass.usage,resultDigest:method==="VISUAL_VALIDATION"?sha256Digest(ocr.pages):undefined});
          }
        }else if(routing.visualRequiredLocators.length){
          const existing=new Set(extracted.exceptions.map(exception=>`${exception.locator}:${exception.code}`));
          extracted={...extracted,exceptions:[...extracted.exceptions,...routing.visualRequiredLocators.filter(locator=>!existing.has(`${locator}:OCR_REQUIRED`)).map(locator=>({locator,code:"VISUAL_EXTRACTION_REQUIRED_AI_DISABLED"}))]};
        }
        const envelope=documentEvidenceEnvelope({evidenceVersionId:entry.versionId,evidenceObjectId:entry.evidenceObjectId,documentType:entry.evidenceType,sourceDigest:entry.digest,contentType:entry.contentType,routing,extractorVersion:extracted.extractorVersion,segments:extracted.segments,exceptions:extracted.exceptions,visualProvenance});
        documentEnvelopes.push(envelope);
        const reviewId=`adreview_${randomUUID()}`;
        await this.db.assessmentDocumentReview.create({data:{id:reviewId,processingJobId:job.id,evidenceVersionId:entry.versionId,evidenceObjectId:entry.evidenceObjectId,documentType:entry.evidenceType,sourceDigest:entry.digest,policyVersion:routing.policyVersion,schemaVersion:envelope.schemaVersion,route:routing.route,routingReasons:asJson(routing.reasons),status:envelope.status==="accepted"?"ACCEPTED":"EXCEPTION",envelope:asJson(envelope),envelopeDigest:envelope.envelopeDigest,attempts:{create:attemptRows.map((attempt,index)=>({id:`adattempt_${randomUUID()}`,ordinal:index+1,method:attempt.method,status:attempt.status,provider:attempt.provider,model:attempt.model,modelTier:attempt.modelTier,extractorVersion:attempt.extractorVersion,promptVersion:attempt.promptVersion,preprocessingVersion:"rail-preprocess-1",requestedLocators:asJson(attempt.requestedLocators),usage:attempt.usage===undefined?undefined:asJson(attempt.usage),failureCode:attempt.failureCode,resultDigest:attempt.resultDigest}))}}});
        extractedCharacters+=extracted.segments.reduce((sum,s)=>sum+s.text.length,0);
        if(extractedCharacters>4000000)throw new Error("EXTRACTION_RUN_BUDGET_EXCEEDED");
        if(v.evidenceObject.evidenceType==="LOAN_TAPE")tapes.push({contentType:entry.contentType,segments:extracted.segments});
        for(const s of extracted.segments)sources.push({...s,evidenceVersionId:entry.versionId,digest:entry.digest,evidenceType:entry.evidenceType});
        exceptions.push(...extracted.exceptions.map(x=>({...x,evidenceVersionId:entry.versionId})));
      }
      // Bounded AI input; extraction covers all supplied files. A budget skip is explicit in the report.
      const analysis=JSON.stringify(sources).length<=120000?await analyseSources(sources):{provider:"NOT_RUN",model:null,findings:[],documentExtractions:[],qualification:"AI_INPUT_BUDGET_EXCEEDED"};
      const scope=job.engagement.scope as {primaryPairCount?:number;linkedPartyCount?:number;uniqueLoanCount?:number};
      const quotedPrimaryPairs=scope.primaryPairCount ?? scope.uniqueLoanCount;
      if (!quotedPrimaryPairs) throw new Error("ENGAGEMENT_PRIMARY_PAIR_COUNT_MISSING");
      const dataQuality=loanTapeMetrics(tapes,quotedPrimaryPairs,scope.linkedPartyCount ?? 0);
      const extraction={segmentCount:sources.length,sourceCount:manifest.length,exceptions,ocrProvenance};
      const inventory=documentInventory((job.engagement.scope as {assetFamily:string}).assetFamily,manifest.map(entry=>entry.evidenceType));
      const loanReconciliation=reconcileLoanDocuments(dataQuality.loanRecords,analysis.documentExtractions);
      const documentReview={policyVersion:inventory.policyVersion,routingOrder:["BOUNDED_NATIVE_LIBRARY","OPENAI_CONFIGURED_MODEL_TIER","GEMINI_AVAILABILITY_FALLBACK"],inventory,documents:documentEnvelopes,documentExtractions:analysis.documentExtractions,loanReconciliation,outputLevels:{document:"TRACEABLE_FIELDS_AND_EXCEPTIONS",loan:"TAPE_RECONCILIATION",pool:"COVERAGE_AND_UNRESOLVED_PRINCIPAL"},decisionBoundary:"EVIDENCE_QUALITY_AND_RECONCILIATION_ONLY"};
      const outcome=job.stage==="INITIAL"?automatedInitialOutcome({assetFamily:(job.engagement.scope as {assetFamily:string}).assetFamily,dataQuality,exceptions,analysis,documentInventory:inventory,loanReconciliation}):null;
      const release=job.stage==="INITIAL"?{method:"AUTOMATED_UNSIGNED",outcome,expertReviewed:false,professionalSignoff:false}:{method:"QUALIFIED_EXPERT_REVIEW_REQUIRED",outcome:null,expertReviewed:false,professionalSignoff:false};
      const completedAt=new Date();
      const aiRunReceipt=job.stage==="INITIAL"?createInitialAssessmentReceipt({runId:job.id,completedAt,sources,analysis,exceptions,ocrProvenance,dataQuality}):null;
      const previousItems=job.stage==="INITIAL"&&job.baselineRunId?await this.db.assessmentRemediationItem.findMany({where:{sourceRunId:job.baselineRunId}}):[];
      const previousGaps:RemediationGap[]=previousItems.map(item=>({gapKey:item.gapKey,category:item.category,severity:item.severity,summary:item.summary,affectedScope:item.affectedScope as "PAIRS"|"PORTFOLIO",affectedPairs:item.affectedPairs as never,unresolvedRecordCount:item.unresolvedRecordCount,defaultOwnerRole:item.defaultOwnerRole as RemediationGap["defaultOwnerRole"],requiredEvidenceTypes:item.requiredEvidenceTypes as string[]}));
      const remediationGaps=job.stage==="INITIAL"?deriveRemediationGaps({sellerInstitutionId:job.engagement.customerContract.institutionId,dataQuality,extraction,analysis,manifest,documentReview:{inventory,loanReconciliation}}):[];
      const baseline=job.baselineRunId?await this.db.assessmentProcessingJob.findUnique({where:{id:job.baselineRunId}}):null;
      const previousDataQuality=(baseline?.result as {dataQuality?:Parameters<typeof remediationChangeSummary>[2]}|null)?.dataQuality;
      const changeSummary=job.stage==="INITIAL"?remediationChangeSummary(previousGaps,remediationGaps,previousDataQuality,dataQuality):null;
      const remediation=job.stage==="INITIAL"?{scopeDigest:job.scopeDigest,reassessmentOrdinal:job.reassessmentOrdinal,gaps:remediationGaps,changeSummary}:null;
      const result={manifest,dataQuality,documentReview,extraction,analysis,release,aiRunReceipt,remediation,qualifications:["PRELIMINARY_PREPARATION_INSIGHTS_ONLY","NOT_BUYER_APPROVAL","NOT_AN_ASSURANCE_OR_PROFESSIONAL_OPINION","NO_AUTOMATIC_LEGAL_OR_CREDIT_OPINION"],sources};
      const resultDigest=sha256Digest(result);
      if(job.stage==="INITIAL"){
        await this.db.$transaction(async tx=>{
          const changed=await tx.assessmentProcessingJob.updateMany({where:{id:job.id,status:"RUNNING",stage:"INITIAL"},data:{status:"AUTO_RELEASED",result:asJson(result),resultDigest,automatedReleaseSnapshot:asJson({engine:"ASSURERAIL_INITIAL_AUTOMATION",engineVersion:"1",resultDigest,aiRunReceiptId:aiRunReceipt?.receiptId,aiRunReceiptDigest:aiRunReceipt?.integrity.payloadDigest,analysisProvider:analysis.provider,analysisModel:"model" in analysis?analysis.model:null,outcome}),completedAt,releasedAt:completedAt}});
          if(changed.count!==1)throw new Error("PROCESSING_JOB_STATE_CHANGED");
          const currentKeys=new Set(remediationGaps.map(gap=>gap.gapKey));
          for(const prior of previousItems)await tx.assessmentRemediationItem.update({where:{id:prior.id},data:currentKeys.has(prior.gapKey)?{status:"CARRIED_FORWARD"}:{status:"RESOLVED_BY_RERUN",resolvedByRunId:job.id}});
          for(const gap of remediationGaps)await tx.assessmentRemediationItem.create({data:{id:`arem_${randomUUID()}`,engagementId:job.engagementId,sourceRunId:job.id,gapKey:gap.gapKey,category:gap.category,severity:gap.severity,summary:gap.summary,affectedScope:gap.affectedScope,affectedPairs:asJson(gap.affectedPairs),affectedPairCount:gap.affectedPairs.length,unresolvedRecordCount:gap.unresolvedRecordCount,defaultOwnerRole:gap.defaultOwnerRole,requiredEvidenceTypes:asJson(gap.requiredEvidenceTypes),correctionEvidenceVersionIds:asJson([])}});
        });
      }else{
        await this.db.assessmentProcessingJob.updateMany({where:{id:job.id,status:"RUNNING",stage:"PREPARATION"},data:{status:"REVIEW_REQUIRED",result:asJson(result),resultDigest,completedAt}});
      }
    }catch{await this.db.assessmentProcessingJob.updateMany({where:{id:job.id,status:"RUNNING"},data:{status:"FAILED",errorCode:"PROCESSING_FAILED_REVIEW_REQUIRED",completedAt:new Date()}});}
  }
  async review(actor:InternalOpsActor,institutionId:string,id:string,jobId:string,body:{decision?:unknown;resultDigest?:unknown;reviewEvidenceRef?:unknown;stepUpEvidenceId?:unknown}) {
    engagementEnabled();await this.staff.require({userId:actor.actorUserId,permission:"RISK_EXCEPTION_REVIEW",scopeType:"INSTITUTION",scopeRef:institutionId});
    if(body.decision!=="RELEASE"&&body.decision!=="REJECT")throw new ConflictException("RELEASE or REJECT required");
    const decision=body.decision;
    return this.engagements.transaction(async tx=>{
      const e=await this.engagements.scoped(tx,institutionId,id),job=await tx.assessmentProcessingJob.findUnique({where:{id:jobId}});
      if(!job||job.engagementId!==id)throw new NotFoundException("run not found");
      if(job.stage!=="PREPARATION")throw new ConflictException("Initial Assessment is automatically released without expert review; only Portfolio Preparation accepts a qualified sign-off");
      if(job.status!=="REVIEW_REQUIRED"||job.resultDigest!==body.resultDigest)throw new ConflictException("matching pending preparation report required");
      if(job.requestedByUserId===actor.actorUserId)throw new ForbiddenException("independent reviewer required");
      const credentials=JSON.parse(process.env.ASSURERAIL_QUALIFIED_REVIEWERS_JSON??"[]") as {userId:string;expiresAt:string;assetFamilies:string[];qualificationRef:string}[];
      const credential=credentials.find(c=>c.userId===actor.actorUserId&&new Date(c.expiresAt)>new Date()&&c.assetFamilies.includes((e.scope as {assetFamily:string}).assetFamily)&&c.qualificationRef);
      if(!credential)throw new ForbiddenException("current platform-approved reviewer qualification for this asset family required");
      if(decision==="RELEASE"){
        await this.engagements.requirePaid(tx,institutionId,id,job.stage);
        for(const source of job.sourceManifest as unknown as Manifest){const v=await tx.evidenceVersion.findUniqueOrThrow({where:{id:source.versionId},include:{evidenceObject:true,documentVersion:true}});this.validateSource(v,institutionId,id);}
      }
      const reviewEvidenceRef=bounded(body.reviewEvidenceRef,"reviewEvidenceRef");
      const evidence=await tx.evidenceObject.findUnique({where:{id:reviewEvidenceRef},include:{versions:true}});
      const current=evidence?.versions.find(v=>v.version===evidence.currentVersion);
      if(!evidence||evidence.institutionId!==institutionId||evidence.purpose!==`ASSESSMENT_REVIEW:${jobId}:${job.resultDigest}`||evidence.status!=="AVAILABLE"||!current||current.validationStatus!=="VALID"||(current.expiresAt&&current.expiresAt<=new Date()))throw new ForbiddenException("validated sign-off evidence bound to this report required");
      const step=bounded(body.stepUpEvidenceId,"stepUpEvidenceId");await this.stepUp.consume({evidenceId:step,userId:actor.actorUserId,sessionId:actor.actorSessionId,institutionId:null,purpose:"ENGAGEMENT_REPORT_REVIEW"},tx);
      const releasedAt=new Date();
      const changed=await tx.assessmentProcessingJob.updateMany({where:{id:jobId,status:"REVIEW_REQUIRED",stage:"PREPARATION"},data:{status:decision==="RELEASE"?"RELEASED":"REJECTED",reviewedByUserId:actor.actorUserId,reviewEvidenceRef,reviewSnapshot:asJson({qualification:credential,evidenceVersionId:current.id,evidenceDigest:current.payloadDigest,resultDigest:job.resultDigest}),reviewStepUpId:step,reviewedAt:releasedAt,releasedAt}});
      if(changed.count!==1)throw new ConflictException("report already decided");
      return {jobId,status:decision==="RELEASE"?"RELEASED":"REJECTED",qualificationRef:credential.qualificationRef,liveDecisionAuthority:false};
    });
  }
}
