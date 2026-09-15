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
type Manifest = {versionId:string;evidenceObjectId:string;digest:string;contentType:string;sizeBytes:number}[];
const releasedStatus = (stage:string) => stage === "INITIAL" ? "AUTO_RELEASED" : "RELEASED";
export function automatedInitialOutcome(input:{assetFamily:string;dataQuality:{status:string};exceptions:{code:string}[];analysis:{provider:string;findings?:{severity:string}[]}}) {
  if(input.assetFamily==="OTHER")return "OUTSIDE_CURRENT_SCOPE" as const;
  if(!["openai","gemini"].includes(input.analysis.provider))return "AUTOMATED_ANALYSIS_INCOMPLETE" as const;
  if(input.dataQuality.status!=="MATCHED"||input.exceptions.length||input.analysis.findings?.some(f=>f.severity==="CRITICAL"))return "FIX_AND_REASSESS" as const;
  return "READY_FOR_PORTFOLIO_PREPARATION" as const;
}

@Injectable()
export class AssessmentProcessingService {
  constructor(private readonly db:PrismaService,private readonly engagements:AssessmentEngagementService,private readonly store:EvidenceObjectStore,private readonly staff:InternalAccessService,private readonly stepUp:StepUpService,private readonly intake:EvidenceIntakeService) {}
  async upload(actor:ParticipantOpsActor,id:string,stage:string,stream:Readable,metadata:{filename?:unknown;contentType?:unknown;documentType?:unknown;evidenceObjectId?:unknown;requestRef?:unknown}) {
    await this.engagements.participant(actor,true);
    await this.engagements.evidenceAuthority(actor,true);
    const {engagement}=await this.engagements.requirePaid(this.db,actor.actingInstitutionId,id,stage);
    const documentType=bounded(metadata.documentType,"documentType");
    if(!["LOAN_TAPE","LOAN_AGREEMENT","SECURITY_DOCUMENT","REPAYMENT_HISTORY","OTHER_EVIDENCE"].includes(documentType))throw new ConflictException("supported document category required");
    const profiles=JSON.parse(process.env.ASSURERAIL_ASSESSMENT_UPLOAD_PROFILES_JSON??"{}") as Record<string,{connectorRegistrationId:string;schemaId:string;schemaVersion:string;retentionDays:number}>;
    const profile=profiles[actor.actingInstitutionId];
    if(!profile||!Number.isInteger(profile.retentionDays)||profile.retentionDays<1||profile.retentionDays>3650)throw new ConflictException("approved document intake profile and retention period must be configured for this institution");
    if(metadata.evidenceObjectId){const prior=await this.db.evidenceObject.findUnique({where:{id:bounded(metadata.evidenceObjectId,"evidenceObjectId")}});if(!prior||prior.institutionId!==actor.actingInstitutionId||prior.purpose!==`ASSESSMENT:${id}`)throw new NotFoundException("document not found in this engagement");}
    return this.intake.ingestDocument(actor.actorUserId,actor.actingInstitutionId,stream,{...profile,profileRef:"assurerail.neutral-intake.v1",filename:bounded(metadata.filename,"filename",240),contentType:bounded(metadata.contentType,"contentType"),title:documentType,documentType,evidenceType:documentType,classification:"RESTRICTED",purpose:`ASSESSMENT:${id}`,retentionUntilAt:new Date(Date.now()+profile.retentionDays*86400000).toISOString(),sourceAsOfAt:new Date((engagement.scope as {asOfDate:string}).asOfDate).toISOString(),idempotencyKey:bounded(metadata.requestRef,"requestRef"),evidenceObjectId:metadata.evidenceObjectId?bounded(metadata.evidenceObjectId,"evidenceObjectId"):null});
  }
  async request(actor:ParticipantOpsActor,id:string,body:{stage?:unknown;requestRef?:unknown;evidenceVersionIds?:unknown;stepUpEvidenceId?:unknown}) {
    await this.engagements.participant(actor,true);
    await this.engagements.evidenceAuthority(actor,true);
    const stage=bounded(body.stage,"stage"),requestRef=bounded(body.requestRef,"requestRef");
    const ids=body.evidenceVersionIds;
    if(!["INITIAL","PREPARATION"].includes(stage)||!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(v=>typeof v!=="string"||v.length>160))throw new ConflictException("stage and 1–100 unique evidence versions required");
    return this.engagements.transaction(async tx=>{
      await this.engagements.requirePaid(tx,actor.actingInstitutionId,id,stage);
      const versions=await tx.evidenceVersion.findMany({where:{id:{in:ids}},include:{evidenceObject:true,documentVersion:true}});
      if(versions.length!==ids.length)throw new NotFoundException("evidence version not found");
      for(const v of versions) this.validateSource(v,actor.actingInstitutionId,id);
      if(versions.reduce((sum,v)=>sum+v.documentVersion!.sizeBytes,0)>40*1024*1024)throw new ConflictException("per-run document budget exceeded; split the approved scope");
      const manifest:Manifest=versions.map(v=>({versionId:v.id,evidenceObjectId:v.evidenceObjectId,digest:v.payloadDigest,contentType:v.documentVersion!.detectedContentType,sizeBytes:v.documentVersion!.sizeBytes})).sort((a,b)=>a.versionId.localeCompare(b.versionId));
      const requestDigest=sha256Digest({id,stage,manifest});
      const prior=await tx.assessmentProcessingJob.findUnique({where:{engagementId_requestRef:{engagementId:id,requestRef}}});
      if(prior){if(prior.requestDigest!==requestDigest)throw new ConflictException("run reference has different evidence");return this.publicJob(prior);}
      const jobs=await tx.assessmentProcessingJob.findMany({where:{engagementId:id,stage},orderBy:{createdAt:"asc"}});
      if(jobs.some(j=>["QUEUED","RUNNING","REVIEW_REQUIRED"].includes(j.status)))throw new ConflictException("complete the current run before requesting another");
      const terminalRelease=releasedStatus(stage);
      if(jobs.filter(j=>j.status===terminalRelease).length>=4 || jobs.length>=8)throw new ConflictException("included runs or processing retry allowance exhausted; scope review required");
      const first=jobs.find(j=>j.status===terminalRelease);
      if(first?.releasedAt&&first.releasedAt.getTime()+30*86400000<=Date.now())throw new ConflictException("included reassessment window has ended");
      const step=bounded(body.stepUpEvidenceId,"stepUpEvidenceId");
      await this.stepUp.consume({evidenceId:step,userId:actor.actorUserId,sessionId:actor.actorSessionId,institutionId:actor.actingInstitutionId,purpose:"ENGAGEMENT_PROCESSING_REQUEST"},tx);
      return this.publicJob(await tx.assessmentProcessingJob.create({data:{id:`aprocess_${randomUUID()}`,engagementId:id,requestRef,requestDigest,stage,evidenceVersionIds:asJson(ids),sourceManifest:asJson(manifest),requestedByUserId:actor.actorUserId}}));
    });
  }
  private validateSource(v:any,institutionId:string,engagementId:string) {
    if(v.evidenceObject.institutionId!==institutionId || v.evidenceObject.purpose!==`ASSESSMENT:${engagementId}` || v.evidenceObject.status!=="AVAILABLE" || v.evidenceObject.currentVersion!==v.version || v.validationStatus!=="VALID" || (v.expiresAt&&v.expiresAt<=new Date()) || !v.documentVersion || v.documentVersion.malwareStatus!=="CLEAN")throw new ForbiddenException("current clean evidence scoped to this engagement required");
  }
  private publicJob(job:any) { return {id:job.id,stage:job.stage,status:job.status,createdAt:job.createdAt,releasedAt:job.releasedAt,reviewedAt:job.reviewedAt,errorCode:job.errorCode,...(["AUTO_RELEASED","RELEASED"].includes(job.status)?{result:job.result,resultDigest:job.resultDigest}:{}),liveDecisionAuthority:false}; }
  async list(actor:ParticipantOpsActor,id:string) {await this.engagements.participant(actor);await this.engagements.evidenceAuthority(actor);await this.engagements.scoped(this.db,actor.actingInstitutionId,id);return (await this.db.assessmentProcessingJob.findMany({where:{engagementId:id},orderBy:{createdAt:"desc"}})).map(j=>this.publicJob(j));}
  async internalReport(actor:InternalOpsActor,institutionId:string,id:string,jobId:string) {
    engagementEnabled();await this.staff.require({userId:actor.actorUserId,permission:"CASE_TASK_PREPARE",scopeType:"INSTITUTION",scopeRef:institutionId});
    await this.engagements.scoped(this.db,institutionId,id);const job=await this.db.assessmentProcessingJob.findUnique({where:{id:jobId}});if(!job||job.engagementId!==id)throw new NotFoundException("run not found");return job;
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
      const sources:SourceSegment[]=[],exceptions:{evidenceVersionId:string;locator:string;code:string}[]=[],ocrProvenance:unknown[]=[];
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
        if(extracted.exceptions.some(x=>x.code==="OCR_REQUIRED")&&process.env.ASSURERAIL_AI_ENABLED==="true"){
          const ocr=await extractAndValidateOcr({bytes,contentType:entry.contentType as AiDocument["contentType"]},extracted.segments.length);
          ocrProvenance.push({evidenceVersionId:entry.versionId,...ocr});
          extracted={...extracted,segments:ocr.pages.map(p=>({locator:`page:${p.page}`,text:p.text})),exceptions:ocr.pages.filter(p=>p.uncertain||!p.text.trim()).map(p=>({locator:`page:${p.page}`,code:"OCR_UNCERTAIN_REVIEW_REQUIRED"}))};
        }
        extractedCharacters+=extracted.segments.reduce((sum,s)=>sum+s.text.length,0);
        if(extractedCharacters>4000000)throw new Error("EXTRACTION_RUN_BUDGET_EXCEEDED");
        if(v.evidenceObject.evidenceType==="LOAN_TAPE")tapes.push({contentType:entry.contentType,segments:extracted.segments});
        for(const s of extracted.segments)sources.push({...s,evidenceVersionId:entry.versionId,digest:entry.digest});
        exceptions.push(...extracted.exceptions.map(x=>({...x,evidenceVersionId:entry.versionId})));
      }
      // Bounded AI input; extraction covers all supplied files. A budget skip is explicit in the report.
      const analysis=JSON.stringify(sources).length<=120000?await analyseSources(sources):{provider:"NOT_RUN",model:null,findings:[],qualification:"AI_INPUT_BUDGET_EXCEEDED"};
      const dataQuality=loanTapeMetrics(tapes,(job.engagement.scope as {uniqueLoanCount:number}).uniqueLoanCount);
      const extraction={segmentCount:sources.length,sourceCount:manifest.length,exceptions,ocrProvenance};
      const outcome=job.stage==="INITIAL"?automatedInitialOutcome({assetFamily:(job.engagement.scope as {assetFamily:string}).assetFamily,dataQuality,exceptions,analysis}):null;
      const release=job.stage==="INITIAL"?{method:"AUTOMATED_UNSIGNED",outcome,expertReviewed:false,professionalSignoff:false}:{method:"QUALIFIED_EXPERT_REVIEW_REQUIRED",outcome:null,expertReviewed:false,professionalSignoff:false};
      const result={manifest,dataQuality,extraction,analysis,release,qualifications:["PRELIMINARY_PREPARATION_INSIGHTS_ONLY","NOT_BUYER_APPROVAL","NOT_AN_ASSURANCE_OR_PROFESSIONAL_OPINION","NO_AUTOMATIC_LEGAL_OR_CREDIT_OPINION"],sources};
      const resultDigest=sha256Digest(result),completedAt=new Date();
      if(job.stage==="INITIAL"){
        await this.db.assessmentProcessingJob.updateMany({where:{id:job.id,status:"RUNNING",stage:"INITIAL"},data:{status:"AUTO_RELEASED",result:asJson(result),resultDigest,automatedReleaseSnapshot:asJson({engine:"ASSURERAIL_INITIAL_AUTOMATION",engineVersion:"1",resultDigest,analysisProvider:analysis.provider,analysisModel:"model" in analysis?analysis.model:null,outcome}),completedAt,releasedAt:completedAt}});
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
