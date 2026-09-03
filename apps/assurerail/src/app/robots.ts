import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/routes/", "/for/", "/trust", "/status", "/resources/", "/replay", "/sandbox"],
        disallow: ["/admin/", "/internal/", "/workspace/", "/institutions/", "/cases/", "/console", "/settings", "/activity", "/onboard", "/login", "/api/"],
      },
    ],
    sitemap: "https://assurerail.com/sitemap.xml",
    host: "https://assurerail.com",
  };
}
