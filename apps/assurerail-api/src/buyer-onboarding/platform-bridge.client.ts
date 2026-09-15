import { randomBytes } from "node:crypto";
import { bridgeOrigin, bridgeSecret, bridgeSignature, BRIDGE_PATHS } from "./platform-bridge-protocol";

/** Fixed provider origins and server-only credentials; never follows a redirect with credentials. */
export async function issueAssessmentHandoff(actor:{actorUserId:string;actorSessionId:string;actingInstitutionId:string}) {
  if(process.env.ASSURERAIL_PLATFORM_BRIDGE_ENABLED!=="true")throw new Error("Platform bridge is not enabled");
  const origin=bridgeOrigin(process.env.ASSURERAIL_PLATFORM_BRIDGE_API_ORIGIN);
  const webOrigin=bridgeOrigin(process.env.ASSURERAIL_ASSESSMENT_PROVIDER_WEB_ORIGIN);
  const keyId=process.env.ASSURERAIL_PLATFORM_BRIDGE_KEY_ID??"";
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(keyId))throw new Error("Bridge credential is not configured");
  const secret=bridgeSecret(process.env.ASSURERAIL_PLATFORM_BRIDGE_KEY_HEX);
  const body={sourceUserId:actor.actorUserId,sourceInstitutionId:actor.actingInstitutionId,sourceSessionId:actor.actorSessionId};
  const timestamp=String(Date.now()),nonce=randomBytes(32).toString("hex");
  const response=await fetch(origin+BRIDGE_PATHS.ISSUE,{method:"POST",redirect:"error",signal:AbortSignal.timeout(8000),headers:{"Content-Type":"application/json","x-bridge-key-id":keyId,"x-bridge-time":timestamp,"x-bridge-nonce":nonce,"x-bridge-signature":bridgeSignature(secret,origin,"ISSUE",timestamp,nonce,body)},body:JSON.stringify(body)});
  if(!response.ok)throw new Error("The provider could not authorise this handoff. Check the approved account mapping and access.");
  const text=await response.text();if(text.length>4096)throw new Error("Invalid provider response");
  const r=JSON.parse(text),expiry=Date.parse(r.expiresAt);
  if(!/^[a-f0-9]{64}$/.test(r.ticket)||r.postUrl!==webOrigin+"/platform-bridge/start"||!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+95_000)throw new Error("Invalid provider handoff");
  return {ticket:r.ticket as string,postUrl:r.postUrl as string,expiresAt:r.expiresAt as string};
}
