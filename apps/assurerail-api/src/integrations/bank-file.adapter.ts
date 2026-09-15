import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type BankFileConfig = {environment:"SANDBOX";host:string;port:number;username:string;identityFile:string;knownHostsFile:string;remoteDirectory:string;connectionRef:string;buyerInstitutionId:string;schemaVersion:string};
export type BankFileManifest = {batchRef:string;connectionRef:string;buyerInstitutionId:string;sellerInstitutionId:string;engagementId:string;schemaVersion:string;recordCount:number;principalMinor:string;payloadDigest:string;filename:string};
export function validateBankFile(config:BankFileConfig,manifest:BankFileManifest,payload:Buffer){
  if(config.environment!=="SANDBOX")throw new Error("BUYER_PRODUCTION_ACCEPTANCE_REQUIRED");
  if(!/^[a-zA-Z0-9.-]{1,253}$/.test(config.host)||!Number.isInteger(config.port)||config.port<1||config.port>65535||!/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,63}$/.test(config.username))throw new Error("INVALID_BANK_ENDPOINT");
  for(const file of [config.identityFile,config.knownHostsFile])if(!file.startsWith("/run/secrets/")||file.includes("..")||!/^[a-zA-Z0-9_./-]+$/.test(file))throw new Error("MOUNTED_BANK_SECRET_REQUIRED");
  if(!/^\/[a-zA-Z0-9_/-]+$/.test(config.remoteDirectory)||config.remoteDirectory.includes("..")||config.remoteDirectory.includes("//"))throw new Error("INVALID_BANK_DIRECTORY");
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(manifest.batchRef)||manifest.filename!==`${manifest.batchRef}.csv`||manifest.connectionRef!==config.connectionRef||manifest.buyerInstitutionId!==config.buyerInstitutionId||manifest.schemaVersion!==config.schemaVersion)throw new Error("BANK_BATCH_SCOPE_MISMATCH");
  if(!manifest.sellerInstitutionId||!manifest.engagementId||!Number.isSafeInteger(manifest.recordCount)||manifest.recordCount<1||!/^[1-9][0-9]{0,29}$/.test(manifest.principalMinor)||!payload.length||payload.length>20*1024*1024)throw new Error("INVALID_BATCH_MANIFEST");
  if(`sha256:${createHash("sha256").update(payload).digest("hex")}`!==manifest.payloadDigest)throw new Error("BATCH_DIGEST_MISMATCH");
}
export function sftpArgs(config:BankFileConfig){return ["-F","/dev/null","-b","-","-o","BatchMode=yes","-o","StrictHostKeyChecking=yes","-o",`UserKnownHostsFile=${config.knownHostsFile}`,"-o","GlobalKnownHostsFile=/dev/null","-o","IdentitiesOnly=yes","-o","PasswordAuthentication=no","-o","KbdInteractiveAuthentication=no","-o","ConnectTimeout=10","-P",String(config.port),"-i",config.identityFile,`${config.username}@${config.host}`];}

/** Caller must durably record the batch digest and dispatch attempt before invoking this transport.
 * A successful upload still awaits the buyer's independent acknowledgement. No auto-retry on UNKNOWN.
 */
export async function sendBankFile(config:BankFileConfig,manifest:BankFileManifest,payload:Buffer){
  validateBankFile(config,manifest,payload);
  for(const path of [config.identityFile,config.knownHostsFile]){const stat=await fs.stat(path);if(!stat.isFile()||(stat.mode&(path===config.identityFile?0o077:0o022)))throw new Error("UNSAFE_BANK_SECRET_PERMISSIONS");}
  const dir=await fs.mkdtemp(join(tmpdir(),"rail-bank-"));
  try{
    const data=join(dir,"payload.csv"),meta=join(dir,"manifest.json");
    await fs.writeFile(data,payload,{mode:0o600});await fs.writeFile(meta,JSON.stringify(manifest),{mode:0o600});
    const remote=`${config.remoteDirectory}/${manifest.filename}`,marker=`${config.remoteDirectory}/${manifest.batchRef}.manifest.json`;
    // Manifest is published last; buyer must not consume *.part or data without its manifest.
    const batch=`put "${data}" "${remote}.part"\nrename "${remote}.part" "${remote}"\nput "${meta}" "${marker}.part"\nrename "${marker}.part" "${marker}"\n`;
    const result=await new Promise<"UPLOADED_AWAITING_ACK"|"UNKNOWN">((resolve)=>{
      const child=spawn("/usr/bin/sftp",sftpArgs(config),{shell:false,stdio:["pipe","ignore","ignore"],env:{PATH:"/usr/bin:/bin",LANG:"C"}});
      const timer=setTimeout(()=>child.kill("SIGKILL"),60000);
      child.stdin.on("error",()=>{});child.once("error",()=>{clearTimeout(timer);resolve("UNKNOWN");});child.once("close",code=>{clearTimeout(timer);resolve(code===0?"UPLOADED_AWAITING_ACK":"UNKNOWN");});child.stdin.end(batch);
    });
    return {batchRef:manifest.batchRef,payloadDigest:manifest.payloadDigest,status:result,settlementConfirmed:false};
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}

export function validateBankAcknowledgement(manifest:BankFileManifest,ack:{batchRef:string;payloadDigest:string;schemaVersion:string;acceptedCount:number;rejectedCount:number;acceptedPrincipalMinor:string;buyerInstitutionId:string;status:string}){
  if(ack.batchRef!==manifest.batchRef||ack.payloadDigest!==manifest.payloadDigest||ack.schemaVersion!==manifest.schemaVersion||ack.buyerInstitutionId!==manifest.buyerInstitutionId)throw new Error("ACK_SCOPE_MISMATCH");
  if(!Number.isSafeInteger(ack.acceptedCount)||!Number.isSafeInteger(ack.rejectedCount)||ack.acceptedCount<0||ack.rejectedCount<0||ack.acceptedCount+ack.rejectedCount!==manifest.recordCount||!/^(0|[1-9][0-9]{0,29})$/.test(ack.acceptedPrincipalMinor)||BigInt(ack.acceptedPrincipalMinor)>BigInt(manifest.principalMinor))throw new Error("ACK_TOTALS_MISMATCH");
  if(ack.status==="ACCEPTED"&&ack.rejectedCount===0&&ack.acceptedPrincipalMinor===manifest.principalMinor)return {status:"BUYER_ACCEPTED",settlementConfirmed:false};
  if(ack.status==="PARTIAL"&&ack.rejectedCount>0)return {status:"PARTIAL_REQUIRES_RECONCILIATION",settlementConfirmed:false};
  if(ack.status==="REJECTED"&&ack.acceptedCount===0&&ack.acceptedPrincipalMinor==="0")return {status:"REJECTED",settlementConfirmed:false};
  throw new Error("ACK_STATUS_MISMATCH");
}
