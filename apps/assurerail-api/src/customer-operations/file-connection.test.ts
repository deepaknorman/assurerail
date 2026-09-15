import test from "node:test";
import assert from "node:assert/strict";
import { validateFileConnectionScope, fileConnectionAcceptance, FILE_ACCEPTANCE_CHECKS, type FileConnectionScope } from "./file-connection";
import { sha256Digest } from "../contracts/v1";
const scope:FileConnectionScope={connectionRef:"bank-a-v1",buyerInstitutionId:"buyer-a",environment:"SANDBOX",protocol:"SFTP",direction:"PUSH",format:"CSV",schemaVersion:"v1",credentialSecretRef:"vault:rail/connection-a",authentication:"SSH_KEY",serverIdentityDigest:`sha256:${"a".repeat(64)}`,maximumPersonDays:2};
test("50K scope rejects plaintext transport and unpinned hosts",()=>{
  assert.equal(validateFileConnectionScope(scope).fixedSetupFeeMinor,"5000000");
  assert.throws(()=>validateFileConnectionScope({...scope,protocol:"FTP" as "SFTP"}));
  assert.throws(()=>validateFileConnectionScope({...scope,serverIdentityDigest:""}));
  assert.throws(()=>validateFileConnectionScope({...scope,maximumPersonDays:0}));
});
test("acceptance needs all failure-mode tests, independent reviewer and buyer evidence",()=>{
  const input={testedScopeDigest:sha256Digest(scope),currentScopeDigest:sha256Digest(scope),setupBy:"engineer",validatedBy:"qa",buyerAcceptedBy:"buyer-ops",buyerAcceptanceEvidenceRef:"acceptance-v1",results:FILE_ACCEPTANCE_CHECKS.map(check=>({check,passed:true,evidenceRef:`test-${check}`}))};
  assert.equal(fileConnectionAcceptance(scope,input).accepted,true);
  assert.equal(fileConnectionAcceptance(scope,{...input,buyerAcceptedBy:null}).accepted,false);
  assert.equal(fileConnectionAcceptance(scope,{...input,results:input.results.map(r=>({...r,passed:r.check!=="PARTIAL_REJECTION"}))}).accepted,false);
  assert.throws(()=>fileConnectionAcceptance(scope,{...input,validatedBy:"engineer"}));
  assert.throws(()=>fileConnectionAcceptance(scope,{...input,currentScopeDigest:`sha256:${"b".repeat(64)}`}));
  assert.throws(()=>fileConnectionAcceptance(scope,{...input,results:input.results.slice(1)}));
});
