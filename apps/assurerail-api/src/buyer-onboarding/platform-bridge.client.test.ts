import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { issueAssessmentHandoff } from "./platform-bridge.client";
import { verifyBridgeSignature } from "./platform-bridge-protocol";

test("provider client is fail-closed, signs the authenticated actor and rejects changed destination",async()=>{
  const names=["ASSURERAIL_PLATFORM_BRIDGE_ENABLED","ASSURERAIL_PLATFORM_BRIDGE_API_ORIGIN","ASSURERAIL_ASSESSMENT_PROVIDER_WEB_ORIGIN","ASSURERAIL_PLATFORM_BRIDGE_KEY_ID","ASSURERAIL_PLATFORM_BRIDGE_KEY_HEX"];
  const old=Object.fromEntries(names.map(k=>[k,process.env[k]])),nativeFetch=globalThis.fetch;
  const actor={actorUserId:"human",actorSessionId:"session",actingInstitutionId:"bank"},key=randomBytes(32),ticket=randomBytes(32).toString("hex");
  let wrongDestination=false,calls=0;
  try{
    process.env.ASSURERAIL_PLATFORM_BRIDGE_ENABLED="false";
    await assert.rejects(()=>issueAssessmentHandoff(actor),/not enabled/);
    Object.assign(process.env,{ASSURERAIL_PLATFORM_BRIDGE_ENABLED:"true",ASSURERAIL_PLATFORM_BRIDGE_API_ORIGIN:"https://pool-api.example.test",ASSURERAIL_ASSESSMENT_PROVIDER_WEB_ORIGIN:"https://pool.example.test",ASSURERAIL_PLATFORM_BRIDGE_KEY_ID:"test-issue",ASSURERAIL_PLATFORM_BRIDGE_KEY_HEX:key.toString("hex")});
    globalThis.fetch=async(url,options)=>{
      calls++;assert.equal(url,"https://pool-api.example.test/v1/assurepool/platform-bridge/issue");assert.equal(options?.redirect,"error");assert.ok(options?.signal);
      const body=JSON.parse(String(options?.body));
      assert.deepEqual(body,{sourceUserId:"human",sourceInstitutionId:"bank",sourceSessionId:"session"});
      verifyBridgeSignature(key,"https://pool-api.example.test","ISSUE",options?.headers as Record<string,string>,body);
      return new Response(JSON.stringify({ticket,postUrl:wrongDestination?"https://evil.example.test/platform-bridge/start":"https://pool.example.test/platform-bridge/start",expiresAt:new Date(Date.now()+60000).toISOString()}));
    };
    const result=await issueAssessmentHandoff(actor);assert.equal(result.ticket,ticket);assert(!result.postUrl.includes(ticket));
    wrongDestination=true;await assert.rejects(()=>issueAssessmentHandoff(actor),/Invalid provider handoff/);
    process.env.ASSURERAIL_PLATFORM_BRIDGE_API_ORIGIN="http://pool-api.example.test";
    await assert.rejects(()=>issueAssessmentHandoff(actor),/HTTPS/);assert.equal(calls,2);
  }finally{globalThis.fetch=nativeFetch;for(const name of names)if(old[name]===undefined)delete process.env[name];else process.env[name]=old[name];}
});
