import { NextRequest, NextResponse } from "next/server";
import { DOWNLOAD_CATALOG } from "@/generated/download-artifacts";
import { createAttemptLimiter, createSharedDownloadSession, DOWNLOAD_COOKIE_NAME, DOWNLOAD_SESSION_TTL_SECONDS, sharedDownloadsConfigured, verifySharedDownloadPassword } from "@/lib/download-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_024;
const limiter = createAttemptLimiter();
const responseHeaders = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function clientKey(request: NextRequest) {
  return request.headers.get("x-azure-clientip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([request.nextUrl.origin, ...(process.env.ASSURERAIL_PUBLIC_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean)]);
  return allowed.has(origin);
}

async function boundedFormBody(request: NextRequest) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function protectedResponse(status: number, message: string, extraHeaders: Record<string, string> = {}) {
  return new Response(message, { status, headers: { ...responseHeaders, ...extraHeaders } });
}

export async function POST(request: NextRequest) {
  const enabled = process.env.ASSURERAIL_DOWNLOADS_SHARED_ENABLED;
  const expectedPassword = process.env.ASSURERAIL_DOWNLOADS_SHARED_PASSWORD;
  const sessionSecret = process.env.ASSURERAIL_DOWNLOADS_SESSION_SECRET;
  if (!sharedDownloadsConfigured(enabled, expectedPassword, sessionSecret)) return protectedResponse(404, "Not found");
  if (!sameOrigin(request)) return protectedResponse(403, "Request origin rejected");
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/x-www-form-urlencoded")) return protectedResponse(415, "Form encoding required");
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BODY_BYTES) return protectedResponse(413, "Request too large");

  const attempt = limiter.take(clientKey(request));
  if (!attempt.allowed) return protectedResponse(429, "Please wait before trying again", { "Retry-After": String(attempt.retryAfterSeconds) });

  const raw = await boundedFormBody(request);
  if (raw === null) return protectedResponse(413, "Request too large");
  const form = new URLSearchParams(raw);
  const artifactId = form.get("artifactId") ?? "";
  const artifact = DOWNLOAD_CATALOG.find((item) => item.id === artifactId && item.classification === "SHARED_PASSWORD");
  if (!artifact?.route) return protectedResponse(400, "Unknown download");

  const password = form.get("password") ?? "";
  const honeypot = form.get("website") ?? "";
  if (honeypot || !verifySharedDownloadPassword(password, expectedPassword)) {
    const response = NextResponse.redirect(new URL("/downloads?access=denied#shared-password", request.url), 303);
    for (const [name, value] of Object.entries(responseHeaders)) response.headers.set(name, value);
    return response;
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const token = createSharedDownloadSession(sessionSecret!, userAgent);
  const response = NextResponse.redirect(new URL(artifact.route, request.url), 303);
  for (const [name, value] of Object.entries(responseHeaders)) response.headers.set(name, value);
  response.cookies.set({
    name: DOWNLOAD_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: DOWNLOAD_SESSION_TTL_SECONDS,
    path: "/downloads",
  });
  return response;
}
