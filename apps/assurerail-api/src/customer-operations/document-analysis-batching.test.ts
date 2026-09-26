import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { analyseSources, planReviewBatches, type ModelReviewBatchRecord, type SourceSegment } from "./document-analysis";

function source(id:string,size=3000,locator="page:1"):SourceSegment {
  return {evidenceVersionId:id,evidenceType:"LOAN_AGREEMENT",digest:`sha256:${id.padEnd(64,"0").slice(0,64)}`,locator,text:`Loan ID ${id} ${"x".repeat(size)}`};
}

function outputFor(sources:SourceSegment[],override?:unknown) {
  const ids=[...new Set(sources.map(item=>item.evidenceVersionId))];
  const result=override??{findings:[],documents:ids.map(evidenceVersionId=>({evidenceVersionId,documentType:"LOAN_AGREEMENT",fields:[]}))};
  return new Response(JSON.stringify({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(result)}]}],usage:{input_tokens:100,output_tokens:20}}));
}

function requestSources(init?:RequestInit):SourceSegment[] {
  const body=JSON.parse(init!.body as string);
  return JSON.parse(body.input[0].content[0].text) as SourceSegment[];
}

async function withModelEnvironment(run:()=>Promise<void>) {
  const previous={...process.env};
  Object.assign(process.env,{ASSURERAIL_AI_ENABLED:"true",ASSURERAIL_OPENAI_DATA_PROCESSING_APPROVED:"true",ASSURERAIL_OPENAI_API_KEY:"o".repeat(32)});
  delete process.env.ASSURERAIL_AI_MODEL_TIERS_JSON;delete process.env.ASSURERAIL_GEMINI_FALLBACK_ENABLED;
  try{await run();}finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
}

test("input-budget packing keeps every evidence version whole",()=>{
  const sources=[source("v1",650,"page:1"),source("v1",650,"page:2"),source("v2",650),source("v3",650)];
  const batches=planReviewBatches(sources,1800);
  assert.equal(batches.length,2);
  const appearances=new Map<string,number>();
  for(const batch of batches){
    assert(batch.inputCharacters<=1800||batch.documentCount===1);
    for(const id of batch.evidenceVersionIds)appearances.set(id,(appearances.get(id)??0)+1);
  }
  assert.deepEqual([...appearances.entries()],[["v1",1],["v2",1],["v3",1]]);
  assert.equal(batches[0].sources.filter(item=>item.evidenceVersionId==="v1").length,2);
});

test("a failed middle batch stays incomplete while deterministic processing can continue",async()=>withModelEnvironment(async()=>{
  const sources=[source("v1"),source("v2"),source("v3")],persisted:ModelReviewBatchRecord[]=[];let calls=0;const pauses:number[]=[];
  const http=async(_url:unknown,init?:RequestInit)=>{calls+=1;const batch=requestSources(init);return batch[0].evidenceVersionId==="v2"?new Response("",{status:503}):outputFor(batch);};
  const result=await analyseSources(sources,http as typeof fetch,{persist:async record=>{persisted.push(record);},pause:async milliseconds=>{pauses.push(milliseconds);},random:()=>0});
  assert.equal(calls,5);assert.deepEqual(pauses,[250,500]);assert.equal(persisted.length,3);
  assert.deepEqual(persisted.map(record=>[record.status,record.requestCount]),[["COMPLETED",1],["INCOMPLETE",3],["COMPLETED",1]]);
  assert.equal(result.provider,"INCOMPLETE");assert.equal(result.qualification,"AI_ANALYSIS_INCOMPLETE");assert(result.aiCoverage);
  assert.deepEqual(result.aiCoverage,{documentsAdmitted:3,documentsReviewed:2,unreviewed:[{evidenceVersionId:"v2",reason:"MODEL_UNAVAILABLE"}]});
  assert.deepEqual(result.documentExtractions.map(document=>document.evidenceVersionId),["v1","v3"]);
}));

test("resume reuses a completed persisted batch and calls only unfinished membership",async()=>withModelEnvironment(async()=>{
  const sources=[source("v1"),source("v2")],first=planReviewBatches(sources)[0];
  const cachedResult={findings:[],documents:[{evidenceVersionId:"v1",documentType:"LOAN_AGREEMENT",fields:[]}]};
  const cached:ModelReviewBatchRecord={batchIndex:first.batchIndex,batchDigest:first.batchDigest,evidenceVersionIds:first.evidenceVersionIds,inputCharacters:first.inputCharacters,documentCount:first.documentCount,status:"COMPLETED",provider:"openai",model:"gpt-5.6-luna",modelTier:"language_default",fallbackUsed:false,requestCount:1,usage:{total_tokens:10},failureCode:null,result:cachedResult,resultDigest:`sha256:${createHash("sha256").update(JSON.stringify(cachedResult)).digest("hex")}`};
  let calls=0,persisted=0;
  const result=await analyseSources(sources,(async(_url:unknown,init?:RequestInit)=>{calls+=1;return outputFor(requestSources(init));}) as typeof fetch,{existing:[cached],persist:async()=>{persisted+=1;}});
  assert.equal(calls,1);assert.equal(persisted,1);assert(result.aiCoverage);assert.equal(result.aiCoverage.documentsReviewed,2);assert.equal(result.provider,"openai");
  await assert.rejects(()=>analyseSources(sources,(async()=>{throw new Error("unexpected egress");}) as typeof fetch,{existing:[{...cached,resultDigest:`sha256:${"0".repeat(64)}`}] }),/PERSISTED_MODEL_BATCH_MISMATCH/);
}));

test("out-of-batch and duplicate model entries close with a membership code",async()=>withModelEnvironment(async()=>{
  for(const documents of [
    [{evidenceVersionId:"v1",documentType:"LOAN_AGREEMENT",fields:[]},{evidenceVersionId:"foreign",documentType:"LOAN_AGREEMENT",fields:[]}],
    [{evidenceVersionId:"v1",documentType:"LOAN_AGREEMENT",fields:[]},{evidenceVersionId:"v1",documentType:"LOAN_AGREEMENT",fields:[]}],
  ]){
    const persisted:ModelReviewBatchRecord[]=[];
    const result=await analyseSources([source("v1")],(async()=>outputFor([], {findings:[],documents})) as typeof fetch,{persist:async record=>{persisted.push(record);}});
    assert.equal(persisted.length,1);assert.equal(persisted[0].status,"INCOMPLETE");assert.equal(persisted[0].failureCode,"BATCH_MEMBERSHIP_MISMATCH");assert.equal(persisted[0].requestCount,1);assert(result.aiCoverage);
    assert.deepEqual(result.aiCoverage.unreviewed,[{evidenceVersionId:"v1",reason:"BATCH_MEMBERSHIP_MISMATCH"}]);
  }
}));

test("rate-limit retry stops after two retries and persists one closed batch outcome",async()=>withModelEnvironment(async()=>{
  let calls=0,persisted:ModelReviewBatchRecord|undefined;
  const result=await analyseSources([source("v1")],(async()=>{calls+=1;return new Response("",{status:429});}) as typeof fetch,{persist:async record=>{persisted=record;},pause:async()=>{},random:()=>0});
  assert.equal(calls,3);assert(persisted);assert.equal(persisted.status,"INCOMPLETE");assert.equal(persisted.requestCount,3);assert.equal(persisted.failureCode,"MODEL_RATE_LIMITED");
  assert(result.aiCoverage);assert.equal(result.aiCoverage.documentsReviewed,0);
}));

test("a single document above the provider input cap is recorded as incomplete without egress",async()=>withModelEnvironment(async()=>{
  let calls=0,persisted:ModelReviewBatchRecord|undefined;
  const result=await analyseSources([source("v1",121000)],(async()=>{calls+=1;return outputFor([]);}) as typeof fetch,{persist:async record=>{persisted=record;}});
  assert.equal(calls,0);assert(persisted);assert.equal(persisted.status,"INCOMPLETE");assert.equal(persisted.failureCode,"MODEL_INPUT_BUDGET_EXCEEDED");assert(persisted.inputCharacters>120000);
  assert(result.aiCoverage);assert.equal(result.aiCoverage.documentsReviewed,0);
}));
