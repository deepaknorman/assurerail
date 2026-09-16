import { findPackagedDownloadArtifact } from "@/generated/download-artifacts";

export const runtime = "nodejs";
export const dynamic = "force-static";

const artifact = findPackagedDownloadArtifact("DA-CUSTOMER-GUIDE");

export async function GET() {
  if (!artifact || artifact.classification !== "PUBLIC") return new Response("Not found", { status: 404 });
  return new Response(artifact.html, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Disposition": "inline; filename=AssureRail_Phase1_DA_Customer_Service_Guide.html",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "index, follow",
    },
  });
}
