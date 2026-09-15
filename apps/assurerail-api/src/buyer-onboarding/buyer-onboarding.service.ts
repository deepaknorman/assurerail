import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { InternalAccessService } from "../internal-access/internal-access.service";
import { StepUpService } from "../institutions/step-up.service";
import type { InstitutionAction, StepUpPurpose } from "../institutions/institution-policy";
import { issueAssessmentHandoff } from "./platform-bridge.client";
import { BUYER_CHOICES, buyerProfileDigest, approvedBuyerProfile, validateBuyerCriteria, type BuyerCriteria } from "./buyer-criteria";

type Actor = { actorUserId: string; actorSessionId: string; actingInstitutionId: string };
type Staff = Omit<Actor,"actingInstitutionId">;
type Tx = Prisma.TransactionClient;
type Approval = { actor: string; digest: string; at: string };
function ref(v: unknown, label: string): string {
  if(typeof v!=="string"||!v.trim()||v.length>300) throw new BadRequestException(`${label}: bounded reference required`);
  return v.trim();
}
function criteria(v: unknown, complete=false) { try{return validateBuyerCriteria(v,complete);}catch(e){throw new BadRequestException((e as Error).message);} }
function revision(v: unknown): number { if(!Number.isSafeInteger(v)||Number(v)<0)throw new BadRequestException("expectedRevision required");return Number(v); }

@Injectable()
export class BuyerOnboardingService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly staff: InternalAccessService, private readonly stepUp: StepUpService) {}
  private async transaction<T>(fn:(tx:Tx)=>Promise<T>):Promise<T> {
    try{return await this.db.$transaction(fn,{isolationLevel:"Serializable"});}
    catch(e){if(["P2034","P2002"].includes((e as {code?:string}).code??""))throw new ConflictException("concurrent change or existing workspace; refresh before retrying");throw e;}
  }
  private async authority(a: Actor, action: InstitutionAction) { await this.access.requireHuman({userId:a.actorUserId,institutionId:a.actingInstitutionId,action}); }
  private async proof(tx:Tx,a:Staff,purpose:StepUpPurpose,evidenceId:unknown,institutionId:string|null) {
    await this.stepUp.consume({evidenceId:ref(evidenceId,"stepUpEvidenceId"),userId:a.actorUserId,sessionId:a.actorSessionId,purpose,institutionId},tx);
  }
  private async signedEvidence(tx:Tx,institutionId:string,evidenceRef:string,digest:string) {
    const e=await tx.evidenceObject.findUnique({where:{id:evidenceRef},include:{versions:true}});
    const v=e?.versions.find(x=>x.version===e.currentVersion), now=new Date();
    if(!e||e.institutionId!==institutionId||e.status!=="AVAILABLE"||e.evidenceType!=="SIGNED_MSA"||e.purpose!=="BUYER_ONBOARDING"||!["T0","T1"].includes(e.classification)||!v||v.validationStatus!=="VALID"||v.payloadDigest!==digest||(v.expiresAt&&v.expiresAt<=now))throw new ForbiddenException("current validated signed-MSA evidence required in this institution");
  }
  private async workspace(tx:Tx,institutionId:string,active=true) {
    const w=await tx.buyerWorkspace.findUnique({where:{institutionId},include:{customerContract:true}});
    if(!w)throw new NotFoundException("buyer workspace has not been provisioned");
    const c=w.customerContract, now=new Date();
    if(active&&(w.status!=="ACTIVE"||!w.verifiedAt||!w.verifiedByUserId||w.verifiedByUserId===w.proposedByUserId||w.expiresAt<=now||c.status!=="ACTIVE_SHADOW"||!c.participantAcceptedAt||c.effectiveAt>now||c.expiresAt<=now))throw new ForbiddenException("current independently verified MSA required");
    if(active)await this.signedEvidence(tx,institutionId,w.signedEvidenceRef,w.signedMsaDigest);
    return w;
  }
  private event(tx:Tx,workspaceId:string,actor:string,event:string,detail:Prisma.InputJsonObject) {
    return tx.buyerOnboardingEvent.create({data:{id:`boe_${randomUUID()}`,workspaceId,actorUserId:actor,event,detail}});
  }
  async proposeWorkspace(a:Staff,institutionId:string,b:{contractId:unknown;signedEvidenceRef:unknown;signedMsaDigest:unknown;expiresAt:unknown;stepUpEvidenceId:unknown}) {
    await this.staff.require({userId:a.actorUserId,permission:"COMMERCIAL_CONTRACT_PROPOSE",scopeType:"GLOBAL",scopeRef:null});
    const contractId=ref(b.contractId,"contractId"),evidenceRef=ref(b.signedEvidenceRef,"signedEvidenceRef"),digest=ref(b.signedMsaDigest,"signedMsaDigest"),expiresAt=new Date(ref(b.expiresAt,"expiresAt"));
    if(!/^sha256:[a-f0-9]{64}$/.test(digest)||!Number.isFinite(expiresAt.getTime())||expiresAt<=new Date())throw new BadRequestException("valid digest and future expiry required");
    return this.transaction(async tx=>{
      const c=await tx.customerContract.findUnique({where:{id:contractId}});
      if(!c||c.institutionId!==institutionId||c.status!=="ACTIVE_SHADOW"||!c.participantAcceptedAt||c.effectiveAt>new Date()||expiresAt>c.expiresAt)throw new ForbiddenException("accepted current contract and bounded term required; shadow acceptance alone is not signature verification");
      await this.signedEvidence(tx,institutionId,evidenceRef,digest);
      await this.proof(tx,a,"INTERNAL_BUYER_MSA_PROPOSE",b.stepUpEvidenceId,null);
      const w=await tx.buyerWorkspace.create({data:{id:`bw_${randomUUID()}`,institutionId,customerContractId:contractId,signedEvidenceRef:evidenceRef,signedMsaDigest:digest,expiresAt,proposedByUserId:a.actorUserId}});
      await this.event(tx,w.id,a.actorUserId,"MSA_PROPOSED",{contractId,evidenceRef,digest});return w;
    });
  }
  async verifyWorkspace(a:Staff,institutionId:string,b:{signatureReviewRef:unknown;stepUpEvidenceId:unknown;signedMsaDigest:unknown}) {
    await this.staff.require({userId:a.actorUserId,permission:"COMMERCIAL_CONTRACT_REVIEW",scopeType:"GLOBAL",scopeRef:null});
    return this.transaction(async tx=>{
      const w=await this.workspace(tx,institutionId,false),now=new Date();
      if(w.status!=="PENDING_MSA"||w.proposedByUserId===a.actorUserId||w.signedMsaDigest!==b.signedMsaDigest||w.expiresAt<=now||w.customerContract.status!=="ACTIVE_SHADOW"||!w.customerContract.participantAcceptedAt||w.customerContract.expiresAt<=now)throw new ForbiddenException("independent reviewer and exact current MSA required");
      await this.signedEvidence(tx,institutionId,w.signedEvidenceRef,w.signedMsaDigest);
      const signatureReviewRef=ref(b.signatureReviewRef,"signatureReviewRef");
      await this.proof(tx,a,"INTERNAL_BUYER_MSA_VERIFY",b.stepUpEvidenceId,null);
      const saved=await tx.buyerWorkspace.update({where:{id:w.id},data:{status:"ACTIVE",signatureReviewRef,verifiedByUserId:a.actorUserId,verifiedAt:now}});
      await this.event(tx,w.id,a.actorUserId,"MSA_VERIFIED",{digest:w.signedMsaDigest,signatureReviewRef});return saved;
    });
  }
  async overview(a:Actor) {
    await this.authority(a,"VIEW_BUYER_PROFILE");
    const actions:InstitutionAction[]=["EDIT_BUYER_PROFILE","APPROVE_BUYER_CREDIT","APPROVE_BUYER_LEGAL","APPROVE_BUYER_OPERATIONS"];
    const capabilities=Object.fromEntries(await Promise.all(actions.map(async action=>[action,(await this.access.evaluateHuman({userId:a.actorUserId,institutionId:a.actingInstitutionId,action})).allowed])));
    return this.transaction(async tx=>{
      const w=await this.workspace(tx,a.actingInstitutionId),profiles=await tx.buyerRequirementsProfile.findMany({where:{workspaceId:w.id},orderBy:{version:"desc"}});
      const latestApproved=profiles.find(p=>p.status==="APPROVED");
      const active=latestApproved&&latestApproved.digest===buyerProfileDigest(w.id,latestApproved.version,w.signedMsaDigest,latestApproved.criteria as BuyerCriteria)&&approvedBuyerProfile({status:latestApproved.status,criteria:latestApproved.criteria as BuyerCriteria,approvals:latestApproved.approvals as Record<string,Approval>,digest:latestApproved.digest??""})?latestApproved:undefined;
      return {capabilities,workspace:{id:w.id,status:w.status,expiresAt:w.expiresAt,msaDigest:w.signedMsaDigest},choices:BUYER_CHOICES,profiles,activeProfileId:active?.id??null};
    });
  }
  async providerLaunch(a:Actor,b:{stepUpEvidenceId:unknown}){
    await this.authority(a,"VIEW_BUYER_PROFILE");
    await this.transaction(async tx=>{
      const w=await this.workspace(tx,a.actingInstitutionId);
      await this.proof(tx,a,"ASSESSMENT_PROVIDER_LAUNCH",b?.stepUpEvidenceId,a.actingInstitutionId);
      await this.event(tx,w.id,a.actorUserId,"PROVIDER_HANDOFF_REQUESTED",{});
    });
    try{return await issueAssessmentHandoff(a);}
    catch{throw new BadRequestException("Secure provider handoff unavailable. Check configuration and approved account mapping, then retry with a fresh authenticator code.");}
  }
  async createProfile(a:Actor,b:{stepUpEvidenceId:unknown}) {
    await this.authority(a,"EDIT_BUYER_PROFILE");
    return this.transaction(async tx=>{
      const w=await this.workspace(tx,a.actingInstitutionId),last=await tx.buyerRequirementsProfile.findFirst({where:{workspaceId:w.id},orderBy:{version:"desc"}});
      if(last&&["DRAFT","SUBMITTED"].includes(last.status))throw new ConflictException("finish the current profile before creating another version");
      await this.proof(tx,a,"BUYER_PROFILE_SAVE",b.stepUpEvidenceId,a.actingInstitutionId);
      const p=await tx.buyerRequirementsProfile.create({data:{id:`bp_${randomUUID()}`,workspaceId:w.id,version:(last?.version??0)+1,criteria:(last?.criteria??{}) as Prisma.InputJsonObject,approvals:{},createdBy:a.actorUserId}});
      await this.event(tx,w.id,a.actorUserId,"PROFILE_CREATED",{profileId:p.id,version:p.version});return p;
    });
  }
  async changeProfile(a:Actor,profileId:string,b:{action:unknown;expectedRevision:unknown;criteria?:unknown;reviewRole?:unknown;digest?:unknown;stepUpEvidenceId:unknown}) {
    const action=ref(b.action,"action"),roles=["CREDIT","LEGAL","OPERATIONS"],role=String(b.reviewRole??"");
    if(!["SAVE","SUBMIT","APPROVE","REJECT"].includes(action)||(["APPROVE","REJECT"].includes(action)&&!roles.includes(role)))throw new BadRequestException("valid action and review role required");
    await this.authority(a,(["SAVE","SUBMIT"].includes(action)?"EDIT_BUYER_PROFILE":`APPROVE_BUYER_${role}`) as InstitutionAction);
    const expectedRevision=revision(b.expectedRevision);
    return this.transaction(async tx=>{
      const w=await this.workspace(tx,a.actingInstitutionId),p=await tx.buyerRequirementsProfile.findFirst({where:{id:profileId,workspaceId:w.id}});
      if(!p)throw new NotFoundException("profile not found in this workspace");
      if(p.revision!==expectedRevision)throw new ConflictException("profile changed; reload before retrying");
      let data:Prisma.BuyerRequirementsProfileUpdateManyMutationInput;
      if(action==="SAVE"){
        if(p.status!=="DRAFT")throw new ConflictException("submitted profiles are immutable; create a new version after review");
        data={criteria:criteria(b.criteria),digest:null,approvals:{}};
      }else if(action==="SUBMIT"){
        if(p.status!=="DRAFT")throw new ConflictException("only a draft may be submitted");
        const c=criteria(p.criteria,true);
        if(Date.parse(`${c.validTo}T23:59:59.999Z`)>w.expiresAt.getTime()||Date.parse(`${c.validTo}T23:59:59.999Z`)<Date.now())throw new BadRequestException("profile validity must be current and within MSA term");
        data={status:"SUBMITTED",digest:buyerProfileDigest(w.id,p.version,w.signedMsaDigest,c),submittedBy:a.actorUserId,submittedAt:new Date()};
      }else{
        if(p.status!=="SUBMITTED"||!p.digest||p.digest!==b.digest||p.createdBy===a.actorUserId||p.submittedBy===a.actorUserId)throw new ForbiddenException("independent approval of the exact submitted profile required");
        const approvals=p.approvals as Record<string,Approval>;
        if(approvals[role]||Object.values(approvals).some(x=>x.actor===a.actorUserId))throw new ForbiddenException("each review needs a distinct authorised reviewer");
        approvals[role]={actor:a.actorUserId,digest:p.digest,at:new Date().toISOString()};
        data={approvals,status:action==="REJECT"?"REJECTED":roles.every(r=>approvals[r])?"APPROVED":"SUBMITTED"};
      }
      await this.proof(tx,a,action==="SAVE"?"BUYER_PROFILE_SAVE":action==="SUBMIT"?"BUYER_PROFILE_SUBMIT":"BUYER_PROFILE_REVIEW",b.stepUpEvidenceId,a.actingInstitutionId);
      const updated=await tx.buyerRequirementsProfile.updateMany({where:{id:p.id,revision:expectedRevision},data:{...data,revision:{increment:1}}});
      if(updated.count!==1)throw new ConflictException("concurrent profile change");
      await this.event(tx,w.id,a.actorUserId,`PROFILE_${action}`,{profileId:p.id,revision:expectedRevision+1,role:role||null,digest:typeof data.digest==="string"?data.digest:action==="SAVE"?buyerProfileDigest(w.id,p.version,w.signedMsaDigest,criteria(b.criteria)):p.digest});
      return tx.buyerRequirementsProfile.findUniqueOrThrow({where:{id:p.id}});
    });
  }
}
