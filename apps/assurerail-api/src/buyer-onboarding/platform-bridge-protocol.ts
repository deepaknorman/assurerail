// Wire protocol ASSURE-BRIDGE-1. Kept local to each independently deployed product. Contract tests check parity.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type BridgePurpose = "ISSUE" | "REDEEM";
export const BRIDGE_PATHS = {ISSUE:"/v1/assurepool/platform-bridge/issue",REDEEM:"/v1/assurepool/platform-bridge/redeem"} as const;
export const bridgeHash=(value:string)=>createHash("sha256").update(value).digest("hex");
export function bridgeBody(value:unknown, keys:string[]):Record<string,string> {
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Invalid bridge request");
  const b=value as Record<string,unknown>;
  if(Object.keys(b).sort().join(",")!==[...keys].sort().join(",")||keys.some(k=>typeof b[k]!=="string"||!/^[a-zA-Z0-9_.:@-]{1,160}$/.test(b[k] as string)))throw new Error("Invalid bridge request");
  return Object.fromEntries([...keys].sort().map(k=>[k,b[k] as string]));
}
export function bridgeSecret(value:unknown):Buffer {
  if(typeof value!=="string"||!/^[a-f0-9]{64,128}$/.test(value)||value.length%2)throw new Error("A 32–64 byte hex bridge key is required");
  return Buffer.from(value,"hex");
}
export function bridgeOrigin(value:unknown):string {
  if(typeof value!=="string")throw new Error("Bridge origin unavailable");
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.pathname!=="/"||u.search||u.hash)throw new Error("Dedicated HTTPS bridge origin required");
  return u.origin;
}
export function bridgeSignature(secret:Buffer,audience:string,purpose:BridgePurpose,timestamp:string,nonce:string,body:Record<string,string>):string {
  const canonical=JSON.stringify(Object.fromEntries(Object.entries(body).sort(([a],[b])=>a.localeCompare(b))));
  return createHmac("sha256",secret).update(["ASSURE-BRIDGE-1",audience,"POST",BRIDGE_PATHS[purpose],timestamp,nonce,bridgeHash(canonical)].join("\n")).digest("hex");
}
export function verifyBridgeSignature(secret:Buffer,audience:string,purpose:BridgePurpose,headers:Record<string,unknown>,body:Record<string,string>,now=Date.now()) {
  const timestamp=headers["x-bridge-time"],nonce=headers["x-bridge-nonce"],signature=headers["x-bridge-signature"];
  if(typeof timestamp!=="string"||!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>30_000||typeof nonce!=="string"||!/^[a-f0-9]{64}$/.test(nonce)||typeof signature!=="string"||!/^[a-f0-9]{64}$/.test(signature))throw new Error("Invalid bridge authentication");
  const expected=bridgeSignature(secret,audience,purpose,timestamp,nonce,body);
  if(!timingSafeEqual(Buffer.from(signature,"hex"),Buffer.from(expected,"hex")))throw new Error("Invalid bridge authentication");
  return nonce;
}
