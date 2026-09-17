import type { Metadata } from "next";
import { AssessmentAction, JsonLd, PublicPage, publicStyles as styles } from "@/components/PublicSite";
import { PUBLIC_CAPABILITIES, PUBLIC_CAPABILITY_REVIEWED_AT } from "@/lib/public-capability";
import { ASSURERAIL_WEBSITE_ID } from "@/lib/public-structured-data";

export const metadata: Metadata = {
  title: "Services and engagement path",
  description: "The AssureRail journey from paid Initial Assessment to Portfolio Preparation and direct-assignment execution.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return (
    <PublicPage
      eyebrow={`Services · updated ${PUBLIC_CAPABILITY_REVIEWED_AT}`}
      title="A clear path from loan tape to transaction-ready portfolio."
      lead="Initial Assessment applications are open for approved NBFC portfolios. Start with an automated portfolio view, progress to expert-reviewed preparation and activate execution under an accepted mandate."
      actions={<AssessmentAction />}
    >
      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AssureRail services and engagement path",
        description: "The AssureRail journey from paid Initial Assessment to Portfolio Preparation and direct-assignment execution.",
        dateModified: PUBLIC_CAPABILITY_REVIEWED_AT,
        url: "https://assurerail.com/status",
        isPartOf: { "@id": ASSURERAIL_WEBSITE_ID },
      }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.grid3}>{PUBLIC_CAPABILITIES.map((item) => <article className={styles.card} key={item.id}><span className={styles.statusPill}>{item.publicLabel}</span><h3>{item.label}</h3><p>{item.summary}</p></article>)}</div>
          <div className={styles.boundary}>
            Execution is activated under an accepted seller mandate with the buyer and appointed providers. The buyer retains its purchase decision, while regulated banks and providers hold and move funds under the approved closing instructions. AssureRail coordinates the case, evidence and settlement workflow.
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
