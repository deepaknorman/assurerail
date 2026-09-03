import { createHash, timingSafeEqual } from "node:crypto";

function equal(left: string, right: string) {
  const leftDigest = createHash("sha256").update(left, "utf8").digest();
  const rightDigest = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function diligenceCredentialsConfigured(username?: string, password?: string) {
  return Boolean(username && password && username.length >= 4 && password.length >= 16);
}

export function verifyDiligenceAuthorization(
  authorization: string | null,
  expectedUsername?: string,
  expectedPassword?: string,
) {
  if (!diligenceCredentialsConfigured(expectedUsername, expectedPassword) || !authorization?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  return equal(decoded.slice(0, separator), expectedUsername!)
    && equal(decoded.slice(separator + 1), expectedPassword!);
}
