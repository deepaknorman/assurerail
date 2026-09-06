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

export const metadata: Metadata = {
  metadataBase: new URL("https://assurerail.com"),
  title: {
    default: "AssureRail | Institutional infrastructure for DA and PTC",
    template: "%s | AssureRail",
  },
  description:
    "Provider-neutral transaction infrastructure for direct assignment and PTC securitisation, designed to work beside existing lender, trustee, recordkeeper and payment systems.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://assurerail.com",
    siteName: "AssureRail",
    title: "One governed rail for loan transfers and securitisation",
    description:
      "Direct assignment and PTC transaction infrastructure—conventional first, with tokenised representations only where separately approved.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apply the persisted theme before paint (no flash); "system" leaves data-theme unset. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('arail-theme');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "AssureRail",
          url: "https://assurerail.com",
          logo: "https://assurerail.com/logo.svg",
          description: "Provider-neutral institutional transaction infrastructure for direct assignment and PTC transactions.",
          areaServed: { "@type": "Country", name: "India" },
        }).replace(/</g, "\\u003c") }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
