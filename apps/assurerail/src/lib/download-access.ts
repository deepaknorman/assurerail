import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DOWNLOAD_COOKIE_NAME = "assurerail_shared_download";
export const DOWNLOAD_SESSION_TTL_SECONDS = 30 * 60;
const TOKEN_VERSION = "v1";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function equal(left: string, right: string) {
  return timingSafeEqual(digest(left), digest(right));
}

function clientDigest(userAgent: string) {
  return createHash("sha256").update(userAgent.slice(0, 512), "utf8").digest("base64url");
}

function signature(secret: string, expiresAt: number, nonce: string, userAgent: string) {
  return createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}.${expiresAt}.${nonce}.${clientDigest(userAgent)}`, "utf8")
    .digest("base64url");
}

export function sharedDownloadsConfigured(enabled?: string, password?: string, sessionSecret?: string) {
  return enabled === "yes" && Boolean(password && password.length >= 20 && sessionSecret && sessionSecret.length >= 32);
}

export function verifySharedDownloadPassword(candidate: string, expected?: string) {
  return Boolean(expected && expected.length >= 20 && equal(candidate, expected));
}

export function createSharedDownloadSession(sessionSecret: string, userAgent: string, nowMs = Date.now()) {
  if (sessionSecret.length < 32) throw new Error("Shared-download session secret is not configured");
  const expiresAt = Math.floor(nowMs / 1000) + DOWNLOAD_SESSION_TTL_SECONDS;
  const nonce = randomBytes(18).toString("base64url");
  return `${TOKEN_VERSION}.${expiresAt}.${nonce}.${signature(sessionSecret, expiresAt, nonce, userAgent)}`;
}

export function verifySharedDownloadSession(token: string | undefined, sessionSecret: string | undefined, userAgent: string, nowMs = Date.now()) {
  if (!token || !sessionSecret || sessionSecret.length < 32) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt)) return false;
  const now = Math.floor(nowMs / 1000);
  if (expiresAt <= now || expiresAt > now + DOWNLOAD_SESSION_TTL_SECONDS + 60) return false;
  return equal(parts[3], signature(sessionSecret, expiresAt, parts[2], userAgent));
}

export type AttemptLimiter = ReturnType<typeof createAttemptLimiter>;

export function createAttemptLimiter(windowMs = 15 * 60_000, maximum = 5, maximumBuckets = 10_000) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key: string, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || current.resetAt <= now) {
        if (buckets.size >= maximumBuckets) {
          for (const [candidate, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(candidate);
          if (buckets.size >= maximumBuckets) return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
        }
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }
      if (current.count >= maximum) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
