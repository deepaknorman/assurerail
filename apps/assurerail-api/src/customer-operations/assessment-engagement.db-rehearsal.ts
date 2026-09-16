/** Runs only against the disposable fixture created by scripts/assurerail-billing-db-rehearsal.sh.
 * Uses real PostgreSQL and application services; identity/MFA and provider HTTP are explicit stubs.
 */
import assert from "node:assert/strict";
import {createHash,createHmac} from "node:crypto";
import {Readable} from "node:stream";
import {AssessmentProcessingService} from "./assessment-processing.service";
import {PrismaService} from "../store/prisma.service";
import {AssessmentEngagementService} from "./assessment-engagement.service";
import {CustomerOperationsService} from "./customer-operations.service";
import {EngagementCheckoutService} from "./engagement-checkout.service";
async function main(){
 if(process.env.ASSURERAIL_DISPOSABLE_ENGAGEMENT_REHEARSAL!=="true"||!process.env.DATABASE_URL?.includes("127.0.0.1"))throw new Error("disposable local rehearsal required");
 const db=new PrismaService();await db.$connect();const originalFetch=globalThis.fetch;
 Object.assign(process.env,{ARAIL_CUSTOMER_OPERATIONS_V1:"shadow",ASSURERAIL_ENGAGEMENT_BILLING_MODE:"shadow",ASSURERAIL_CHECKOUT_MODE:"razorpay_test",ASSURERAIL_RAZORPAY_ACCOUNT_ID:"acc_Synthetic",ASSURERAIL_RAZORPAY_KEY_ID:"rzp_test_Synthetic",ASSURERAIL_RAZORPAY_KEY_SECRET:"k".repeat(32),ASSURERAIL_RAZORPAY_WEBHOOK_SECRET:"w".repeat(32)});
 try{
 const actor={actorUserId:"user-customer",actorSessionId:"session",actingInstitutionId:"inst-pr20"},maker={actorUserId:"user-maker",actorSessionId:"maker-session"},checker={actorUserId:"user-checker",actorSessionId:"checker-session"};
 const access={requireHuman:async()=>({mandateId:"mandate"})},staff={require:async()=>({})},step={consume:async()=>({})};
 const engagements=new AssessmentEngagementService(db,access as never,staff as never,step as never),billing=new CustomerOperationsService(db,access as never,staff as never,step as never),checkout=new EngagementCheckoutService(db,engagements);
 for(const [metric,basis,rate] of [["ENGAGEMENT_STAGE_FEE","PER_UNIT_MINOR","1"],["ENGAGEMENT_TAX","NOTIONAL_BASIS_POINTS","1800"]])await db.customerFeeRule.create({data:{id:`rule-${metric}`,customerRateCardId:"rate-pr20",transactionRoute:"DA",representation:"CONVENTIONAL",lifecycleLeg:"INITIAL_TRANSFER_OR_ISSUE",metric,feeBasis:basis,rateValue:rate,roundingMode:"HALF_UP"}});
 const body={contractId:"contract-pr20",requestRef:"synthetic-offer",primaryPairCount:1,linkedPartyCount:0,sellerProposedConsiderationMinor:"10000000000",aggregateProgrammeConsiderationMinor:"10000000000",bookRef:"SYNTHETIC-EV",assetFamily:"VEHICLE_EV",asOfDate:"2026-01-01",billingProfile:{legalName:"Synthetic NBFC",billingEmail:"billing@example.test",address:"Synthetic address",stateCode:"27",postalCode:"400001",gstRegistration:"UNREGISTERED"}};
 const offer=await engagements.offer(actor,body);assert.equal((await engagements.offer(actor,body)).id,offer.id);await assert.rejects(()=>engagements.offer(actor,{...body,primaryPairCount:2}),/different content/);
 await assert.rejects(()=>engagements.accept(actor,offer.id,{quoteDigest:"wrong",termsAccepted:true,dataAuthorityConfirmed:true,stepUpEvidenceId:"step"}),/matching digest/);
 await engagements.accept(actor,offer.id,{quoteDigest:offer.quoteDigest,termsAccepted:true,dataAuthorityConfirmed:true,stepUpEvidenceId:"step"});
 await assert.rejects(()=>db.assessmentEngagement.update({where:{id:offer.id},data:{quote:{tampered:true}}}),/immutable/);
 assert.equal((await engagements.readiness(actor,offer.id,"INITIAL")).readyForShadowProcessing,false);
 await assert.rejects(()=>engagements.readiness({...actor,actingInstitutionId:"other"},offer.id,"INITIAL"),/not found/);
 const coupon=await engagements.proposeDesignPartner(maker,actor.actingInstitutionId,{evidenceRef:"founder-decision.synthetic",signedScopeAt:"2026-01-01T00:00:00Z",stepUpEvidenceId:"coupon-propose"});
 await assert.rejects(()=>engagements.reviewDesignPartner(maker,actor.actingInstitutionId,coupon.id,{decision:"APPROVE",reason:"self review",stepUpEvidenceId:"coupon-self"}),/cannot review/);
 await engagements.reviewDesignPartner(checker,actor.actingInstitutionId,coupon.id,{decision:"APPROVE",reason:"Synthetic independent approval",stepUpEvidenceId:"coupon-review"});
 for(const id of ["inst-design-partner-2","inst-design-partner-3"])await db.institution.create({data:{id,legalName:id,institutionKind:"NBFC",jurisdiction:"IND",legalIdentifiers:{},status:"ACTIVE",applicantUserId:"synthetic"}});
 const coupon2=await engagements.proposeDesignPartner(maker,"inst-design-partner-2",{evidenceRef:"founder-decision.synthetic",signedScopeAt:"2026-01-02T00:00:00Z",stepUpEvidenceId:"coupon-propose-2"});await engagements.reviewDesignPartner(checker,"inst-design-partner-2",coupon2.id,{decision:"APPROVE",reason:"Synthetic second approval",stepUpEvidenceId:"coupon-review-2"});
 const coupon3=await engagements.proposeDesignPartner(maker,"inst-design-partner-3",{evidenceRef:"founder-decision.synthetic",signedScopeAt:"2026-01-03T00:00:00Z",stepUpEvidenceId:"coupon-propose-3"});await assert.rejects(()=>engagements.reviewDesignPartner(checker,"inst-design-partner-3",coupon3.id,{decision:"APPROVE",reason:"Synthetic third approval",stepUpEvidenceId:"coupon-review-3"}),/first two|both lifetime/);
 await assert.rejects(()=>db.customerDesignPartnerCoupon.update({where:{id:coupon.id},data:{discountBps:1}}),/immutable|constraint/);
 const invoice=await engagements.prepareInvoice(maker,actor.actingInstitutionId,offer.id,"INITIAL",{stepUpEvidenceId:"invoice-step"});assert.equal(invoice.grossFeeMinor,"36816000");assert.equal(invoice.creditMinor,"11044800");assert.equal(invoice.netFeeMinor,"25771200");assert.equal(invoice.designPartnerDiscount?.discountedBaseMinor,"21840000");assert.equal((await engagements.prepareInvoice(maker,actor.actingInstitutionId,offer.id,"INITIAL",{stepUpEvidenceId:"unused"})).id,invoice.id);
 await assert.rejects(()=>billing.issueInvoice(maker,actor.actingInstitutionId,invoice.id,{reason:"Synthetic",stepUpEvidenceId:"step"}),/preparer cannot/);
 await billing.issueInvoice(checker,actor.actingInstitutionId,invoice.id,{reason:"Synthetic independent check",stepUpEvidenceId:"review-step"});
 let creates=0,paid=false,reference="";
 globalThis.fetch=(async(url:unknown,init?:RequestInit)=>{
  const path=String(url);
  if(path.includes("api.openai.com"))return new Response(JSON.stringify({status:"completed",output:[{type:"message",content:[{type:"output_text",text:'{"findings":[]}'}]}],usage:{input_tokens:10,output_tokens:5}}));
  if(init?.method==="POST"){creates++;reference=JSON.parse(init.body as string).reference_id;}
  const link={id:"plink_Synthetic",reference_id:reference,amount:Number(invoice.netFeeMinor),amount_paid:paid?Number(invoice.netFeeMinor):0,currency:"INR",status:paid?"paid":"created",short_url:"https://rzp.io/i/synthetic",payments:paid?[{payment_id:"pay_Synthetic",amount:Number(invoice.netFeeMinor),status:"captured"}]:[]};
  return new Response(JSON.stringify(path.includes("/payments/")?{id:"pay_Synthetic",amount:Number(invoice.netFeeMinor),currency:"INR",status:"captured",captured:true,amount_refunded:0,refund_status:null}:link));
 }) as typeof fetch;
 const created=await checkout.create(actor,offer.id,"INITIAL");assert.equal(created.status,"OPEN");await checkout.create(actor,offer.id,"INITIAL");assert.equal(creates,1);
 paid=true;await checkout.refresh(actor,offer.id,"INITIAL");assert.equal((await engagements.readiness(actor,offer.id,"INITIAL")).readyForShadowProcessing,true);
 const bytes=Buffer.from("loan_id,party_id,party_role,principal_minor\nSYNTHETIC001,BORROWER001,BORROWER,100000\n"),digest=`sha256:${createHash("sha256").update(bytes).digest("hex")}`;
 const evidence=await db.evidenceObject.create({data:{id:"synthetic-evidence",institutionId:actor.actingInstitutionId,evidenceType:"LOAN_TAPE",classification:"RESTRICTED",purpose:`ASSESSMENT:${offer.id}`,status:"AVAILABLE",currentVersion:1,retentionUntilAt:new Date(Date.now()+86400000),createdByUserId:actor.actorUserId}});
 const version=await db.evidenceVersion.create({data:{id:"synthetic-version",evidenceObjectId:evidence.id,version:1,schemaId:"synthetic-csv",schemaVersion:"1",payloadDigest:digest,signatureStatus:"NOT_PROVIDED",result:"REVIEW_REQUIRED",sourceAsOfAt:new Date(),qualifications:{},validationStatus:"VALID",validationDetail:{},createdByUserId:actor.actorUserId}});
 await db.railDocumentFamily.create({data:{id:"synthetic-family",evidenceObjectId:evidence.id,institutionId:actor.actingInstitutionId,title:"Synthetic tape",documentType:"LOAN_TAPE",currentVersion:1}});
 await db.railDocumentVersion.create({data:{id:"synthetic-document",documentFamilyId:"synthetic-family",evidenceVersionId:version.id,version:1,filename:"synthetic.csv",claimedContentType:"text/csv",detectedContentType:"text/csv",sizeBytes:bytes.length,storageRef:"s3://synthetic/tape",malwareStatus:"CLEAN",encryptionClass:"SSE_KMS"}});
 const processing=new AssessmentProcessingService(db,engagements,{get:async()=>({body:Readable.from([bytes])})} as never,staff as never,step as never,{} as never);
 process.env.ASSURERAIL_DOCUMENT_PROCESSING_MODE="shadow";process.env.ASSURERAIL_AI_ENABLED="true";process.env.ASSURERAIL_OPENAI_DATA_PROCESSING_APPROVED="true";process.env.ASSURERAIL_OPENAI_API_KEY="synthetic-key-"+"x".repeat(32);
 const queued=await processing.request(actor,offer.id,{stage:"INITIAL",requestRef:"synthetic-run-0",evidenceVersionIds:[version.id],stepUpEvidenceId:"synthetic-step"});
 await processing.runNext();const report=await db.assessmentProcessingJob.findUniqueOrThrow({where:{id:queued.id}});assert.equal(report.status,"AUTO_RELEASED");
 assert.equal((report.automatedReleaseSnapshot as any).engine,"ASSURERAIL_INITIAL_AUTOMATION");
 assert.equal(report.reviewedByUserId,null);assert.equal(report.reviewEvidenceRef,null);
 assert.equal((await processing.list(actor,offer.id)).find(r=>r.id===queued.id)?.status,"AUTO_RELEASED");
 assert.equal((await processing.policy(actor,offer.id)).remainingIncludedReassessments,3);
 await assert.rejects(()=>processing.review(checker,actor.actingInstitutionId,offer.id,report.id,{decision:"RELEASE",resultDigest:report.resultDigest,reviewEvidenceRef:"unused",stepUpEvidenceId:"unused"}),/automatically released/);
 await engagements.choosePreparation(actor,offer.id,{route:"COMMITTED",quoteDigest:offer.quoteDigest,mandateAndTopUpAccepted:true,stepUpEvidenceId:"prep-step"});
 await assert.rejects(()=>engagements.requirePaid(db,actor.actingInstitutionId,offer.id,"PREPARATION"),/invoiced stage/);
 console.log("[ENGAGEMENT-DB] PASS clean versioned evidence -> local CSV extraction -> unsigned automated Initial Assessment release; three reassessments remain; preparation requires another paid invoice (scanner and identity are synthetic fixtures)");
 const raw=Buffer.from(JSON.stringify({account_id:"acc_Synthetic",event:"payment_link.paid",payload:{payment_link:{entity:{id:"plink_Synthetic"}},payment:{entity:{id:"pay_Synthetic"}}}})),sig=createHmac("sha256","w".repeat(32)).update(raw).digest("hex");
 assert.equal((await checkout.webhook(raw,sig,"synthetic-event")).replay,false);assert.equal((await checkout.webhook(raw,sig,"synthetic-event")).replay,true);
 await assert.rejects(()=>checkout.webhook(raw,"a".repeat(64),"bad-signature"),/signature/);
 const refund=Buffer.from(JSON.stringify({account_id:"acc_Synthetic",event:"refund.processed",payload:{refund:{entity:{payment_id:"pay_Synthetic"}}}}));await checkout.webhook(refund,createHmac("sha256","w".repeat(32)).update(refund).digest("hex"),"synthetic-refund");
 assert.equal((await engagements.readiness(actor,offer.id,"INITIAL")).readyForShadowProcessing,false);
 await checkout.refresh(actor,offer.id,"INITIAL");assert.equal((await db.engagementCheckout.findUniqueOrThrow({where:{invoiceId:invoice.id}})).status,"HOLD");
 await assert.rejects(()=>engagements.requirePaid(db,actor.actingInstitutionId,offer.id,"INITIAL"),/PAYMENT_ADJUSTMENT_PENDING/);
 console.log("[ENGAGEMENT-DB] PASS entity-bound maker/checker design-partner coupon, pre-tax discount, accepted quote freeze, idempotent invoice/checkout, exact tax, captured payment, signed webhook replay, refund hold and paid-stage revocation; synthetic identity and provider stubs");
 }finally{globalThis.fetch=originalFetch;await db.$disconnect();}
}
void main().catch(e=>{console.error("[ENGAGEMENT-DB] FAILED",e.message);process.exitCode=1;});
