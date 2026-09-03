import type { Metadata } from "next";
import { JsonLd, PublicPage, ReplayAction, publicStyles as styles } from "@/components/PublicSite";
import { PUBLIC_CAPABILITIES, PUBLIC_CAPABILITY_REVIEWED_AT } from "@/lib/public-capability";

export const metadata: Metadata = {
  title: "Current availability",
  description: "Current public availability of AssureRail institutional evaluation and services.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return (
    <PublicPage
      eyebrow={`Public information · updated ${PUBLIC_CAPABILITY_REVIEWED_AT}`}
      title="Current availability"
      lead="AssureRail is being evaluated with institutional stakeholders. This page states only what an external visitor can request today."
      actions={<ReplayAction label="Discuss a private evaluation" />}
    >
      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AssureRail current availability",
        description: "Current public availability of AssureRail institutional evaluation and services.",
        dateModified: PUBLIC_CAPABILITY_REVIEWED_AT,
        url: "https://assurerail.com/status",
      }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.grid3}>{PUBLIC_CAPABILITIES.map((item) => <article className={styles.card} key={item.id}><span className={styles.statusPill}>{item.publicLabel}</span><h3>{item.label}</h3><p>{item.summary}</p></article>)}</div>
          <div className={styles.boundary}>More detailed product, security and readiness information is provided only through controlled diligence to authorised parties.</div>
        </div>
      </section>
    </PublicPage>
  );
}
