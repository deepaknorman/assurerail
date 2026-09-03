import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/routes/", "/for/", "/trust", "/status", "/resources", "/resources/", "/replay"],
        disallow: "/",
      },
    ],
    sitemap: "https://assurerail.com/sitemap.xml",
    host: "https://assurerail.com",
  };
}
