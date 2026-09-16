import assert from "node:assert/strict";
import test from "node:test";
import { createAttemptLimiter, createSharedDownloadSession, DOWNLOAD_SESSION_TTL_SECONDS, sharedDownloadsConfigured, verifySharedDownloadPassword, verifySharedDownloadSession } from "../src/lib/download-access.ts";

const password = "correct-horse-battery-staple";
const secret = "session-secret-with-at-least-thirty-two-characters";
const userAgent = "AssureRail test browser/1.0";

test("shared downloads fail closed without the exact activation and strong secrets", () => {
  for (const enabled of [undefined, "", "no", "true", "YES"]) assert.equal(sharedDownloadsConfigured(enabled, password, secret), false);
  assert.equal(sharedDownloadsConfigured("yes", "too-short", secret), false);
  assert.equal(sharedDownloadsConfigured("yes", password, "short"), false);
  assert.equal(sharedDownloadsConfigured("yes", password, secret), true);
});

test("password comparison accepts only the configured value", () => {
  assert.equal(verifySharedDownloadPassword(password, password), true);
  assert.equal(verifySharedDownloadPassword(`${password}!`, password), false);
  assert.equal(verifySharedDownloadPassword("", password), false);
  assert.equal(verifySharedDownloadPassword(password, undefined), false);
});

test("signed session is short-lived, user-agent-bound and tamper-evident", () => {
  const issuedAt = 1_800_000_000_000;
  const token = createSharedDownloadSession(secret, userAgent, issuedAt);
  assert.equal(verifySharedDownloadSession(token, secret, userAgent, issuedAt + 1_000), true);
  assert.equal(verifySharedDownloadSession(token, secret, "different browser", issuedAt + 1_000), false);
  assert.equal(verifySharedDownloadSession(`${token}x`, secret, userAgent, issuedAt + 1_000), false);
  assert.equal(verifySharedDownloadSession(token, `${secret}x`, userAgent, issuedAt + 1_000), false);
  assert.equal(verifySharedDownloadSession(token, secret, userAgent, issuedAt + (DOWNLOAD_SESSION_TTL_SECONDS + 1) * 1_000), false);
});

test("attempt limiter emits retry timing and resets after its window", () => {
  const limiter = createAttemptLimiter(60_000, 2, 10);
  assert.equal(limiter.take("client", 1_000).allowed, true);
  assert.equal(limiter.take("client", 2_000).allowed, true);
  const blocked = limiter.take("client", 3_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 58);
  assert.equal(limiter.take("client", 61_001).allowed, true);
});
