import { NextRequest, NextResponse } from "next/server";
import { findPackagedDownloadArtifact } from "@/generated/download-artifacts";
import { DOWNLOAD_COOKIE_NAME, sharedDownloadsConfigured, verifySharedDownloadSession } from "@/lib/download-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const artifact = findPackagedDownloadArtifact("DA-COMMERCIAL-TERMS");
const protectedHeaders = {
  "Cache-Control": "no-store, private",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(request: NextRequest) {
  const enabled = process.env.ASSURERAIL_DOWNLOADS_SHARED_ENABLED;
  const password = process.env.ASSURERAIL_DOWNLOADS_SHARED_PASSWORD;
  const sessionSecret = process.env.ASSURERAIL_DOWNLOADS_SESSION_SECRET;
  if (!artifact || artifact.classification !== "SHARED_PASSWORD" || !sharedDownloadsConfigured(enabled, password, sessionSecret)) {
    return new Response("Not found", { status: 404, headers: protectedHeaders });
  }
  const userAgent = request.headers.get("user-agent") ?? "";
  const token = request.cookies.get(DOWNLOAD_COOKIE_NAME)?.value;
  if (!verifySharedDownloadSession(token, sessionSecret, userAgent)) {
    const response = NextResponse.redirect(new URL("/downloads?access=required#shared-password", request.url), 303);
    for (const [name, value] of Object.entries(protectedHeaders)) response.headers.set(name, value);
    return response;
  }
  return new Response(artifact.html, {
    status: 200,
    headers: {
      ...protectedHeaders,
      "Content-Disposition": "inline; filename=AssureRail_Phase1_DA_Commercial_Terms.html",
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
