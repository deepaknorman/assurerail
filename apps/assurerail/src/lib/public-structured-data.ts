export const PUBLIC_SITE_URL = "https://assurerail.com" as const;
export const ASSURERAIL_ORGANIZATION_ID = `${PUBLIC_SITE_URL}/#organization` as const;
export const ASSURERAIL_WEBSITE_ID = `${PUBLIC_SITE_URL}/#website` as const;

// AssureRail is used here as the product/brand publisher. Do not add legalName, registration,
// address or corporate identifiers until incorporation evidence has been accepted.
export const ASSURERAIL_ORGANIZATION_JSON_LD = {
  "@type": "Organization",
  "@id": ASSURERAIL_ORGANIZATION_ID,
  name: "AssureRail",
  url: PUBLIC_SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${PUBLIC_SITE_URL}/logo.svg`,
  },
  description:
    "Provider-neutral institutional transaction infrastructure for direct assignment and PTC transactions.",
  areaServed: { "@type": "Country", name: "India" },
} as const;

export const ASSURERAIL_WEBSITE_JSON_LD = {
  "@type": "WebSite",
  "@id": ASSURERAIL_WEBSITE_ID,
  url: PUBLIC_SITE_URL,
  name: "AssureRail",
  publisher: { "@id": ASSURERAIL_ORGANIZATION_ID },
  inLanguage: "en-IN",
} as const;

export function publicBreadcrumbs(items: readonly { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${PUBLIC_SITE_URL}${item.path}`,
    })),
  };
}
