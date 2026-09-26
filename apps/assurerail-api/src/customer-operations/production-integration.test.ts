import test from "node:test";
import assert from "node:assert/strict";
import {createHash,createHmac} from "node:crypto";
import {acceptedPricing,billingProfile,paidStageReadiness} from "./engagement-workflow";
import {capturedPaymentAmount,RazorpayAdapter,validatePaymentLink,verifyRazorpayWebhook} from "./razorpay.adapter";
import {validateDocumentExtractions,validateFindings} from "./document-analysis";
import {extractAndValidateOcr,modelTierConfiguration,structuredDocumentCall,validateOcrPages} from "./ocr.adapter";
import {validateBankFile,validateBankAcknowledgement,sftpArgs,type BankFileConfig} from "../integrations/bank-file.adapter";
import {escrowInstruction,reconcileEscrow} from "../settlement/escrow-settlement-contract";
import {loanTapeMetrics} from "./loan-tape-metrics";
import {automatedInitialOutcome} from "./assessment-processing.service";

test("loan tape reconciles quoted scope, rejects duplicates and does not silently fill missing balances",()=>{
 const tape={contentType:"text/csv",segments:[{text:'["loan_id","party_id","party_role","principal_minor"]'},{text:'["001","B1","BORROWER","100"]'},{text:'["001","B2","CO_BORROWER","100"]'},{text:'["001","G1","LINKED_PARTY","100"]'},{text:'["002","B3","BORROWER","200"]'}]};
 const r=loanTapeMetrics([tape],3,1);assert.equal(r.status,"MATCHED");assert.equal(r.parsedPrimaryPairCount,3);assert.equal(r.parsedLinkedPartyCount,1);assert.equal(r.parsedUniqueLoanCountActual,2);assert.equal(r.parsedPrincipalMinor,"300");assert.equal(loanTapeMetrics([tape],4,1).status,"QUOTED_COUNT_MISMATCH");assert.equal(loanTapeMetrics([tape],3,0).status,"QUOTED_COUNT_MISMATCH");assert.equal(loanTapeMetrics([tape,tape],3,1).duplicateRecords,4);assert.equal(loanTapeMetrics([{...tape,segments:[...tape.segments,{text:'["003","B4","BORROWER",""]'}]}],4,1).invalidRecords,1);assert.equal(loanTapeMetrics([],0).coverageEstablished,false);assert.equal(loanTapeMetrics([{...tape,contentType:"application/pdf"}],3,1).status,"TAPE_MAPPING_REQUIRED");
});

test("Initial Assessment outcome is automated, conservative and never an expert sign-off",()=>{
 const good={assetFamily:"VEHICLE_EV",dataQuality:{status:"MATCHED"},exceptions:[],analysis:{provider:"openai",findings:[]}};
 assert.equal(automatedInitialOutcome(good),"READY_FOR_PORTFOLIO_PREPARATION");
 assert.equal(automatedInitialOutcome({...good,dataQuality:{status:"QUOTED_COUNT_MISMATCH"}}),"FIX_AND_REASSESS");
 assert.equal(automatedInitialOutcome({...good,analysis:{provider:"openai",findings:[{severity:"CRITICAL"}]}}),"FIX_AND_REASSESS");
 assert.equal(automatedInitialOutcome({...good,analysis:{provider:"DISABLED",findings:[]}}),"AUTOMATED_ANALYSIS_INCOMPLETE");
 assert.equal(automatedInitialOutcome({...good,analysis:{provider:"NOT_RUN",findings:[]}}),"AUTOMATED_ANALYSIS_INCOMPLETE");
 assert.equal(automatedInitialOutcome({...good,documentInventory:{status:"EXCEPTIONS"}}),"FIX_AND_REASSESS");
 assert.equal(automatedInitialOutcome({...good,loanReconciliation:{status:"EXCEPTIONS"}}),"FIX_AND_REASSESS");
 assert.equal(automatedInitialOutcome({...good,assetFamily:"OTHER"}),"OUTSIDE_CURRENT_SCOPE");
});

const tax={feeBasis:"NOTIONAL_BASIS_POINTS",rateValue:"1800",roundingMode:"HALF_UP"} as const;
test("accepted quote separately funds initial and preparation, with approved tax and unchanged founder pricing",()=>{
 const scope={primaryPairCount:3000,linkedPartyCount:0,sellerProposedConsiderationMinor:"10000000000",aggregateProgrammeConsiderationMinor:"10000000000"};
 const q=acceptedPricing(scope,tax);assert.deepEqual(q.initial,{baseMinor:"58500000",taxMinor:"10530000",totalMinor:"69030000"});assert.equal(q.committedPreparation.baseMinor,"91500000");assert.equal(q.standalonePreparation.baseMinor,"136500000");assert.equal(acceptedPricing({...scope,primaryPairCount:100},tax).initial.baseMinor,"31200000");assert.throws(()=>acceptedPricing(scope,{...tax,minimumFeeMinor:"100"}),/without floor/);
});
test("billing validates registration selection and GST state consistency",()=>{
 const profile={legalName:"Synthetic NBFC",billingEmail:"billing@example.test",address:"Test address",stateCode:"27",postalCode:"400001",gstRegistration:"UNREGISTERED"};assert.equal(billingProfile(profile).gstin,null);assert.throws(()=>billingProfile({...profile,gstRegistration:"REGISTERED",gstin:"29ABCDE1234F1Z5"}),/mismatch/);
});
test("paid stages reject short, excess, adjusted and corrected invoices",()=>{
 const input={invoiceStatus:"ISSUED_SHADOW",grossMinor:"100",netMinor:"100",quotedMinor:"100",payableMinor:"100",receivedMinor:"100",unresolvedAdjustment:false};assert.equal(paidStageReadiness(input).ready,true);
 for(const change of [{receivedMinor:"99"},{receivedMinor:"101"},{netMinor:"90"},{invoiceStatus:"CORRECTED"},{unresolvedAdjustment:true}])assert.equal(paidStageReadiness({...input,...change}).ready,false);
});
test("Razorpay signature checks exact raw bytes and supports controlled secret rotation",()=>{
 const raw=Buffer.from('{"a": 1}'),secret="s".repeat(32),signature=createHmac("sha256",secret).update(raw).digest("hex");assert.equal(verifyRazorpayWebhook(raw,signature,["old".repeat(16),secret]),true);assert.equal(verifyRazorpayWebhook(Buffer.from('{"a":1}'),signature,[secret]),false);assert.equal(verifyRazorpayWebhook(raw,"0",[secret]),false);assert.equal(verifyRazorpayWebhook(raw,signature,[]),false);
});
const link={id:"plink_Synthetic",reference_id:"ar_test",amount:100,amount_paid:100,currency:"INR",status:"paid",short_url:"https://rzp.io/i/test",payments:[{payment_id:"pay_Synthetic",amount:100,status:"captured"}]};
const payment={id:"pay_Synthetic",amount:100,currency:"INR",status:"captured",captured:true,amount_refunded:0,refund_status:null};
test("checkout rejects other invoices, currencies, unsafe URLs and imprecise amounts",()=>{
 assert.equal(validatePaymentLink(link,{reference:"ar_test",amountMinor:"100"}).id,link.id);
 for(const change of [{reference_id:"wrong"},{currency:"USD"},{amount:100.01},{short_url:"https://rzp.io.attacker.test/x"},{short_url:"https://u:p@rzp.io/x"}])assert.throws(()=>validatePaymentLink({...link,...change},{reference:"ar_test",amountMinor:"100"}));
});
test("payment capture must belong to the link; refunds and authorisations do not pay the stage",()=>{
 assert.equal(capturedPaymentAmount(link,payment,"100"),"100");for(const change of [{id:"pay_Other"},{amount_refunded:1},{captured:false},{status:"authorized"},{refund_status:"partial"}])assert.throws(()=>capturedPaymentAmount(link,{...payment,...change},"100"));
});
test("Razorpay API create disables notifications, partial payments and credential redirects",async()=>{
 let request:RequestInit|undefined;const http=async(url:unknown,init?:RequestInit)=>{assert.equal(url,"https://api.razorpay.com/v1/payment_links");request=init;return new Response(JSON.stringify(link));};
 await new RazorpayAdapter("rzp_test_Synthetic","s".repeat(32),http as typeof fetch).create({reference:"ar_test",amountMinor:"100"});const body=JSON.parse(request!.body as string);assert.equal(body.accept_partial,false);assert.deepEqual(body.notify,{sms:false,email:false});assert.equal(request!.redirect,"error");assert.throws(()=>new RazorpayAdapter("rzp_live_Synthetic","s".repeat(32)),/TEST/);
});
test("Razorpay cancellation is a bounded POST to the existing payment link",async()=>{
 const cancelled={...link,status:"cancelled",amount_paid:0,payments:[]};let request:RequestInit|undefined;
 const http=async(url:unknown,init?:RequestInit)=>{assert.equal(url,"https://api.razorpay.com/v1/payment_links/plink_Synthetic/cancel");request=init;return new Response(JSON.stringify(cancelled));};
 const result=await new RazorpayAdapter("rzp_test_Synthetic","s".repeat(32),http as typeof fetch).cancel("plink_Synthetic");
 assert.equal(result.status,"cancelled");assert.equal(request!.method,"POST");assert.equal(request!.body,"{}");assert.equal(request!.redirect,"error");
});
test("AI findings need exact text at the cited document and location",()=>{
 const source={evidenceVersionId:"v1",digest:"sha256:x",locator:"page:1",text:"Insurance expires on 2026-01-01."};const finding={category:"DOCUMENTATION",severity:"HIGH",description:"Check insurance renewal",evidenceVersionId:"v1",locator:"page:1",quote:"Insurance expires"};assert.equal(validateFindings({findings:[finding]},[source]).length,1);
 for(const change of [{quote:"Insurance is valid"},{evidenceVersionId:"other"},{locator:"page:2"}])assert.throws(()=>validateFindings({findings:[{...finding,...change}]},[source]),/CITATION/);
});
test("AI document fields preserve evidence states and exact same-document citations",()=>{
 const source={evidenceVersionId:"v1",evidenceType:"LOAN_AGREEMENT",digest:"sha256:x",locator:"page:2",text:"Loan amount INR 500,000 for account EV-001."};
 const field={fieldPath:"$.facility.sanctioned_amount",valueState:"observed",values:["INR 500,000"],citations:[{evidenceVersionId:"v1",locator:"page:2",quote:"INR 500,000"}]};
 const output={documents:[{evidenceVersionId:"v1",documentType:"LOAN_AGREEMENT",fields:[field]}]};assert.equal(validateDocumentExtractions(output,[source]).length,1);
 assert.throws(()=>validateDocumentExtractions({documents:[{...output.documents[0],fields:[{...field,valueState:"observed",citations:[]}]}]},[source]),/FIELD_STATE/);
 assert.throws(()=>validateDocumentExtractions({documents:[{...output.documents[0],fields:[{...field,citations:[{...field.citations[0],quote:"invented"}]}]}]},[source]),/CITATION/);
 assert.throws(()=>validateDocumentExtractions({documents:[{...output.documents[0],documentType:"SECURITY_DOCUMENT"}]},[source]),/UNSCOPED/);
});
test("OCR validates every expected page, unique page numbers and uncertainty type",()=>{
 assert.equal(validateOcrPages({pages:[{page:1,text:"Loan A",uncertain:true}]},1).length,1);assert.throws(()=>validateOcrPages({pages:[]},1),/COVERAGE/);assert.throws(()=>validateOcrPages({pages:[{page:1,text:"A",uncertain:false},{page:1,text:"B",uncertain:false}]},2),/INVALID/);
 assert.deepEqual(validateOcrPages({pages:[{page:2,text:"Loan B",uncertain:false}]},[2]).map(page=>page.page),[2]);assert.throws(()=>validateOcrPages({pages:[{page:1,text:"wrong page",uncertain:false}]},[2]),/INVALID/);
 assert.throws(()=>validateOcrPages({pages:[{page:1,text:"Loan",uncertain:false}]},1.5),/COVERAGE/);assert.throws(()=>validateOcrPages({pages:[{page:1,text:"Loan",uncertain:false}]},[1,1]),/COVERAGE/);
});
test("model ladder is configurable within fixed provider roles and fails closed",()=>{
 const configured=modelTierConfiguration({ASSURERAIL_AI_MODEL_TIERS_JSON:JSON.stringify({visual_default:{provider:"openai",model:"approved-luna-deployment"},availability_fallback:{provider:"gemini",model:"approved-flash-deployment"}})} as NodeJS.ProcessEnv);
 assert.equal(configured.visual_default.model,"approved-luna-deployment");assert.equal(configured.availability_fallback.model,"approved-flash-deployment");
 assert.throws(()=>modelTierConfiguration({ASSURERAIL_AI_MODEL_TIERS_JSON:JSON.stringify({visual_default:{provider:"gemini",model:"wrong-rung"}})} as NodeJS.ProcessEnv),/INVALID/);
 assert.throws(()=>modelTierConfiguration({ASSURERAIL_AI_MODEL_TIERS_JSON:"{"} as NodeJS.ProcessEnv),/INVALID/);
});
test("Luna OCR uses a separate validation pass and records corrections",async()=>{
 const old={...process.env};try{
 process.env.ASSURERAIL_OPENAI_DATA_PROCESSING_APPROVED="true";process.env.ASSURERAIL_OPENAI_API_KEY="test".repeat(8);let calls=0;
 const http=async(_url:unknown,init?:RequestInit)=>{const body=JSON.parse(init!.body as string);assert.equal(body.model,"gpt-5.6-luna");assert.equal(body.store,false);assert.equal(body.input[0].content[1].type,"input_file");calls++;return new Response(JSON.stringify({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({pages:[{page:1,text:calls===1?"1000":"100.0",uncertain:true}]})}]}],usage:{input_tokens:100,output_tokens:30}}));};
 const r=await extractAndValidateOcr({bytes:Buffer.from("synthetic PDF"),contentType:"application/pdf"},1,http as typeof fetch);assert.equal(calls,2);assert.equal(r.changedOnValidation,true);assert.equal(r.validation?.model,"gpt-5.6-luna");assert.equal(r.pages[0].uncertain,true);
 }finally{process.env=old;}
});
test("Gemini fallback occurs for availability failure, never for refusal or invalid output",async()=>{
 const old={...process.env};try{
 Object.assign(process.env,{ASSURERAIL_OPENAI_DATA_PROCESSING_APPROVED:"true",ASSURERAIL_GEMINI_DATA_PROCESSING_APPROVED:"true",ASSURERAIL_OPENAI_API_KEY:"o".repeat(32),ASSURERAIL_GEMINI_API_KEY:"g".repeat(32),ASSURERAIL_GEMINI_FALLBACK_ENABLED:"true"});let calls=0;
 const http=async(url:unknown)=>{calls++;return String(url).includes("openai")?new Response("",{status:503}):new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:'{"findings":[]}'}]}}]}));};
 const r=await structuredDocumentCall("test",{},"test",undefined,http as typeof fetch);assert.equal(r.model,"gemini-3-flash-preview");assert.equal(r.modelTier,"availability_fallback");assert.equal(r.fallbackUsed,true);assert.equal(calls,2);
 calls=0;await assert.rejects(()=>structuredDocumentCall("test",{},"test",undefined,(async()=>{calls++;return new Response(JSON.stringify({status:"incomplete"}));}) as typeof fetch),/INCOMPLETE/);assert.equal(calls,1);
 }finally{process.env=old;}
});
const payload=Buffer.from("loan_id,principal_minor\nA,100\n"),digest=`sha256:${createHash("sha256").update(payload).digest("hex")}`;
const config:BankFileConfig={environment:"SANDBOX",host:"buyer.example.test",port:22,username:"rail",identityFile:"/run/secrets/buyer-key",knownHostsFile:"/run/secrets/buyer-host",remoteDirectory:"/inbox",connectionRef:"c",buyerInstitutionId:"buyer",schemaVersion:"1"};
const manifest={batchRef:"batch1",connectionRef:"c",buyerInstitutionId:"buyer",sellerInstitutionId:"seller",engagementId:"eng1",schemaVersion:"1",recordCount:1,principalMinor:"100",payloadDigest:digest,filename:"batch1.csv"};
test("bank transport pins host identity, disables password fallback and rejects injection/scope drift",()=>{
 validateBankFile(config,manifest,payload);assert(sftpArgs(config).includes("StrictHostKeyChecking=yes"));assert(sftpArgs(config).includes("PasswordAuthentication=no"));for(const change of [{remoteDirectory:"/inbox/../other"},{username:"rail\nbye"},{environment:"PRODUCTION"},{identityFile:"/tmp/key"}])assert.throws(()=>validateBankFile({...config,...change} as BankFileConfig,manifest,payload));assert.throws(()=>validateBankFile(config,{...manifest,buyerInstitutionId:"other"},payload),/SCOPE/);
});
test("buyer acknowledgement is scoped and cannot establish settlement",()=>{
 const ack={batchRef:"batch1",payloadDigest:digest,schemaVersion:"1",acceptedCount:1,rejectedCount:0,acceptedPrincipalMinor:"100",buyerInstitutionId:"buyer",status:"ACCEPTED"};assert.deepEqual(validateBankAcknowledgement(manifest,ack),{status:"BUYER_ACCEPTED",settlementConfirmed:false});assert.throws(()=>validateBankAcknowledgement(manifest,{...ack,acceptedPrincipalMinor:"99"}),/STATUS/);assert.throws(()=>validateBankAcknowledgement(manifest,{...ack,batchRef:"other"}),/SCOPE/);
});
test("escrow reconciles each actual leg; balanced VAN instructions alone cannot settle",()=>{
 const instruction=escrowInstruction({programmeRef:"p",closingRef:"c",buyerInstitutionId:"b",currency:"INR",grossConsiderationMinor:"100",acceptedWaterfallDigest:`sha256:${"a".repeat(64)}`,sellerMandateEvidenceRef:"m",legs:[{legRef:"seller",sellerInstitutionId:"s",beneficiaryRef:"bank-s",purpose:"SELLER_NET",amountMinor:"90",invoiceRef:null},{legRef:"fee",sellerInstitutionId:"s",beneficiaryRef:"bank-r",purpose:"SERVICE_FEE",amountMinor:"10",invoiceRef:"invoice"}]});
 assert.equal(reconcileEscrow(instruction,[]).allLegsSettled,false);const legs=instruction.legs.map(l=>({legRef:l.legRef,providerTransferRef:`tx-${l.legRef}`,status:"SETTLED" as const,amountMinor:l.amountMinor,instructionDigest:instruction.instructionDigest}));assert.equal(reconcileEscrow(instruction,legs).allLegsSettled,true);assert.equal(reconcileEscrow(instruction,[legs[0]]).allLegsSettled,false);assert.throws(()=>reconcileEscrow(instruction,[legs[0],legs[0]]),/DUPLICATE/);assert.throws(()=>escrowInstruction({...instruction,grossConsiderationMinor:"101"}),/BALANCE/);
});
