import { NextRequest, NextResponse } from "next/server";
import { diligenceCredentialsConfigured, verifyDiligenceAuthorization } from "@/lib/diligence-access";
import { isPrivateUiPath, privateUiEnabled } from "@/lib/private-ui-access";

function protectedResponse(status: 401 | 404) {
  const headers = new Headers({
    "Cache-Control": "no-store, private",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  if (status === 401) headers.set("WWW-Authenticate", 'Basic realm="AssureRail diligence", charset="UTF-8"');
  return new NextResponse(status === 404 ? "Not found" : "Authentication required", { status, headers });
}

export function proxy(request: NextRequest) {
  if (isPrivateUiPath(request.nextUrl.pathname)) {
    if (!privateUiEnabled(process.env.ASSURERAIL_PRIVATE_UI_ENABLED)) return protectedResponse(404);
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, private");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const username = process.env.ASSURERAIL_DILIGENCE_USERNAME;
  const password = process.env.ASSURERAIL_DILIGENCE_PASSWORD;
  if (process.env.ASSURERAIL_DILIGENCE_ENABLED !== "yes" || !diligenceCredentialsConfigured(username, password)) return protectedResponse(404);
  if (!verifyDiligenceAuthorization(request.headers.get("authorization"), username, password)) return protectedResponse(401);
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: [
    "/diligence/:path*",
    "/activity/:path*",
    "/admin/:path*",
    "/cases/:path*",
    "/console/:path*",
    "/institutions/:path*",
    "/internal/:path*",
    "/onboard/:path*",
    "/settings/:path*",
    "/workspace/:path*",
  ],
};
