import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/routes/", "/for/", "/trust", "/status", "/resources", "/resources/", "/replay", "/downloads", "/downloads/assurerail/phase1-da/customer-service-guide"],
        disallow: ["/api/", "/admin/", "/console/", "/diligence/", "/internal/", "/onboard/", "/settings/", "/workspace/", "/downloads/access", "/downloads/assurerail/phase1-da/commercial-terms"],
      },
    ],
    sitemap: "https://assurerail.com/sitemap.xml",
    host: "https://assurerail.com",
  };
}
