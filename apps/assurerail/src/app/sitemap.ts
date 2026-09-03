import type { MetadataRoute } from "next";
import { PERSONA_PAGES, PUBLIC_ROUTE_PAGES, RESOURCE_ARTICLES } from "@/lib/public-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://assurerail.com";
  const reviewedAt = new Date("2026-09-03T00:00:00+05:30");
  return [
    { url: base, lastModified: reviewedAt, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/status`, lastModified: reviewedAt, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/replay`, lastModified: reviewedAt, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/trust`, lastModified: reviewedAt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/resources`, lastModified: reviewedAt, changeFrequency: "weekly", priority: 0.8 },
    ...PUBLIC_ROUTE_PAGES.map((item) => ({ url: `${base}/routes/${item.slug}`, lastModified: reviewedAt, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...PERSONA_PAGES.map((item) => ({ url: `${base}/for/${item.slug}`, lastModified: reviewedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...RESOURCE_ARTICLES.map((item) => ({ url: `${base}/resources/${item.slug}`, lastModified: new Date(`${item.reviewedAt}T00:00:00+05:30`), changeFrequency: "monthly" as const, priority: 0.65 })),
  ];
}
