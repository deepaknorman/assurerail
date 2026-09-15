/** Scope and acceptance gate, independent of a bank's transport implementation. */
import { sha256Digest } from "../contracts/v1";
export type FileConnectionScope = {
  connectionRef: string; buyerInstitutionId: string; environment: "SANDBOX" | "PRODUCTION";
  protocol: "SFTP" | "FTPS"; direction: "PUSH" | "PULL";
  format: "CSV" | "XLSX"; schemaVersion: string; credentialSecretRef: string;
  authentication: "SSH_KEY" | "CLIENT_CERTIFICATE"; serverIdentityDigest: string;
  maximumPersonDays: number;
};
export function validateFileConnectionScope(s: FileConnectionScope) {
  for (const k of ["connectionRef","buyerInstitutionId","schemaVersion","credentialSecretRef"] as const) {
    if (typeof s[k] !== "string" || !/^[A-Za-z0-9_:/.-]{1,200}$/.test(s[k])) throw new Error(`${k} must be a bounded reference, never credentials`);
  }
  if (!["SFTP","FTPS"].includes(s.protocol) || !["SANDBOX","PRODUCTION"].includes(s.environment) || !["PUSH","PULL"].includes(s.direction) || !["CSV","XLSX"].includes(s.format)) throw new Error("supported secure file configuration required");
  if ((s.protocol === "SFTP" && s.authentication !== "SSH_KEY") || (s.protocol === "FTPS" && s.authentication !== "CLIENT_CERTIFICATE")) throw new Error("approved key or certificate authentication required");
  if (!/^sha256:[a-f0-9]{64}$/.test(s.serverIdentityDigest)) throw new Error("pinned server identity digest required");
  if (!Number.isInteger(s.maximumPersonDays) || s.maximumPersonDays < 1 || s.maximumPersonDays > 30) throw new Error("explicit internally approved person-day cap required");
  return { fixedSetupFeeMinor:"5000000", includes:["ONE_POINT_TO_POINT_CONNECTION","MAPPING","SETUP","TESTING","VALIDATION"], recurringChargeMinor:"0", apiScope:"REQUEST_AND_QUOTE_SEPARATELY" };
}
export const FILE_ACCEPTANCE_CHECKS = ["FIELD_MAPPING","LOAN_COUNT_AND_TOTALS","DOCUMENT_REFERENCES","DUPLICATE_REPLAY","PARTIAL_REJECTION","WRONG_WORKSPACE","STALE_SCHEMA","EXPIRED_CREDENTIAL","UNKNOWN_OUTCOME","BUYER_ACKNOWLEDGEMENT"] as const;
export function fileConnectionAcceptance(s: FileConnectionScope, input: {
  testedScopeDigest: string; currentScopeDigest: string;
  results: { check: string; passed: boolean; evidenceRef: string }[];
  setupBy: string; validatedBy: string; buyerAcceptedBy: string | null; buyerAcceptanceEvidenceRef: string | null;
}) {
  validateFileConnectionScope(s);
  if (!/^sha256:[a-f0-9]{64}$/.test(input.currentScopeDigest) || input.currentScopeDigest !== sha256Digest(s) || input.testedScopeDigest !== input.currentScopeDigest) throw new Error("tests must bind the current scope");
  if (!input.setupBy || !input.validatedBy || input.setupBy === input.validatedBy) throw new Error("independent validation required");
  if (!Array.isArray(input.results) || input.results.length !== FILE_ACCEPTANCE_CHECKS.length || new Set(input.results.map(x=>x.check)).size !== FILE_ACCEPTANCE_CHECKS.length) throw new Error("one result per acceptance check required");
  const missing = FILE_ACCEPTANCE_CHECKS.filter(check => !input.results.some(r=>r.check===check && r.passed===true && typeof r.evidenceRef==="string" && r.evidenceRef.trim().length>0));
  return { readyForBuyerAcceptance: missing.length === 0, missing,
    accepted: missing.length === 0 && Boolean(input.buyerAcceptedBy?.trim() && input.buyerAcceptanceEvidenceRef?.trim()),
    enablesLiveTransport: false, establishesBankSettlement: false };
}
