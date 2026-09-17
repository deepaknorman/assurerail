import type { Metadata } from "next";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import {
  ASSURERAIL_ORGANIZATION_JSON_LD,
  ASSURERAIL_WEBSITE_JSON_LD,
} from "@/lib/public-structured-data";

export const metadata: Metadata = {
  metadataBase: new URL("https://assurerail.com"),
  title: {
    default: "AssureRail | Prepare and execute institutional loan-book sales",
    template: "%s | AssureRail",
  },
  description:
    "Assess, prepare and execute institutional direct-assignment loan-book sales with full-population review, traceable evidence and coordinated closing.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "64x64" },
    ],
    shortcut: "/favicon.png",
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://assurerail.com",
    siteName: "AssureRail",
    title: "Prepare a loan book for a controlled direct-assignment sale",
    description:
      "Full-population Initial Assessment, expert-reviewed Portfolio Preparation and coordinated direct-assignment execution for institutional sellers and buyers.",
    // WhatsApp/LinkedIn/Slack render a preview image ONLY from an explicit og:image (no favicon
    // fallback). FIRST image is a deliberately small square tile (<300px): WhatsApp's layout rule
    // renders sub-300px images as the compact logo-icon card rather than the big banner (founder's
    // preference, 8 Sep 2026). The 1200×630 banner rides second for platforms that pick the
    // largest suitable image.
    images: [
      {
        url: "/og-tile.png",
        width: 292,
        height: 292,
        alt: "AssureRail",
      },
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AssureRail — assess, prepare and execute institutional loan-book sales",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prepare a loan book for a controlled direct-assignment sale",
    description:
      "Full-population Initial Assessment, expert-reviewed Portfolio Preparation and coordinated direct-assignment execution.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        {/* Apply the persisted theme before paint (no flash); "system" leaves data-theme unset. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('arail-theme');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [ASSURERAIL_ORGANIZATION_JSON_LD, ASSURERAIL_WEBSITE_JSON_LD],
        }).replace(/</g, "\\u003c") }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
