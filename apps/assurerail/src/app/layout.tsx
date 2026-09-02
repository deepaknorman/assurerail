import type { Metadata } from "next";
import { Archivo, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

// Wire the self-hosted brand faces to the CSS variables tokens.css already references
// (var(--font-archivo) / var(--font-inter) / var(--font-plex-mono)).
const archivo = Archivo({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-archivo", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

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
    <html lang="en" className={`${archivo.variable} ${inter.variable} ${plex.variable}`}>
      <head>
        {/* Apply the persisted theme before paint (no flash); "system" leaves data-theme unset. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('arail-theme');if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t);}catch(e){}" }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
