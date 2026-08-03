// The trustee's issuance authorisation — the Model-B proof (Receivables_Pool_Tokenisation_Path.md §7.4
// step 2 / §8.5.3). A receivables-pool mint is the TRUSTEE's act: the trustee signs an authorisation over
// the exact pool + tape + mintable amount BEFORE the mint fires, and that signed authorisation is a
// distinct, inspectable record — the literal evidence that AssureRail is infrastructure executing a
// trustee's instruction, not a shadow issuer minting on its own account.
//
// Signing is an HMAC in the venue's own crypto idiom (settlement refs, webhook signatures use the same).
// The demo trustee key is a stand-in; in production the trustee signs with its OWN key/DSC.
import { createHmac } from "node:crypto";

export type TrusteeAuthorisation = {
  trusteeDid: string;
  poolId: string;
  tapeHash: string;
  mintableMinor: string;
  authorisedAt: string;
  nonce: string;
  scheme: "arail-trustee-auth:v1:hmac-sha256";
  signature: string;
};

const DEMO_TRUSTEE_KEY = process.env.ASSURERAIL_TRUSTEE_DEMO_KEY?.trim() || "arail-demo-trustee-spe-signing-key";

/** The exact bytes the trustee signs — pool identity + tape commitment + mintable amount, bound together. */
export function canonicalTrusteeAuthorisation(a: Omit<TrusteeAuthorisation, "signature" | "scheme">): string {
  return `arail-trustee-auth:v1:${[a.trusteeDid, a.poolId, a.tapeHash, a.mintableMinor, a.authorisedAt, a.nonce].join("|")}`;
}

export function signTrusteeAuthorisation(
  input: Omit<TrusteeAuthorisation, "signature" | "scheme">,
  key: string = DEMO_TRUSTEE_KEY,
): TrusteeAuthorisation {
  const signature = createHmac("sha256", key).update(canonicalTrusteeAuthorisation(input)).digest("hex");
  return { ...input, scheme: "arail-trustee-auth:v1:hmac-sha256", signature };
}

/** Verify a trustee authorisation. Constant-time compare so a demo can show a tampered authorisation failing. */
export function verifyTrusteeAuthorisation(
  auth: TrusteeAuthorisation,
  key: string = DEMO_TRUSTEE_KEY,
): { ok: boolean; reason?: string } {
  if (auth.scheme !== "arail-trustee-auth:v1:hmac-sha256") return { ok: false, reason: "unknown_scheme" };
  const expect = createHmac("sha256", key).update(canonicalTrusteeAuthorisation(auth)).digest("hex");
  const got = auth.signature ?? "";
  if (expect.length !== got.length) return { ok: false, reason: "signature_length_mismatch" };
  let diff = 0;
  for (let i = 0; i < expect.length; i++) diff |= expect.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0 ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
