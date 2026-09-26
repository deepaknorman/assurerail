import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

function sourceFiles(root:string):string[] {
  return readdirSync(root).flatMap(name=>{
    const path=join(root,name);
    return statSync(path).isDirectory()?sourceFiles(path):path.endsWith(".ts")&&!path.endsWith(".test.ts")?[path]:[];
  });
}

test("[EVIDENCE][INVARIANT] payload-digest writers and readers use canonical sha256 form",()=>{
  const workspaceRoot=resolve(__dirname,"../..");
  const sourceRoot=resolve(workspaceRoot,"src");
  const violations:string[]=[];
  for(const path of sourceFiles(sourceRoot)) {
    const lines=readFileSync(path,"utf8").split("\n");
    lines.forEach((line,index)=>{
      if(/payloadDigest\s*:[^\n]*\.digest\(["']hex["']\)/.test(line))violations.push(`${path}:${index+1}: bare digest writer`);
      if(/payloadDigest/i.test(line)&&line.includes("/^[a-f0-9]{64}$/"))violations.push(`${path}:${index+1}: bare digest reader`);
    });
  }
  assert.deepEqual(violations,[]);

  const intake=readFileSync(resolve(sourceRoot,"evidence/evidence-intake.service.ts"),"utf8");
  assert.match(intake,/payloadDigest: canonicalPayloadDigest/);
  assert.match(intake,/payloadDigestHex: digest\.digest\("hex"\)/);

  const migration=readFileSync(resolve(workspaceRoot,"prisma/migrations/20260927023000_canonical_evidence_payload_digest/migration.sql"),"utf8");
  assert.match(migration,/NOT LIKE 'demo-%'/);
  assert.match(migration,/CHECK \("payloadDigest" ~ '\^sha256:\[a-f0-9\]\{64\}\$'\)/);
});
