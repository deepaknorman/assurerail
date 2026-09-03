import type { Metadata } from "next";
import { JsonLd, PublicPage, ReplayAction, publicStyles as styles } from "@/components/PublicSite";
import { PUBLIC_CAPABILITIES, PUBLIC_CAPABILITY_REVIEWED_AT } from "@/lib/public-capability";

export const metadata: Metadata = {
  title: "Capability status",
  description: "Effective-dated AssureRail software, evidence and activation status.",
  alternates: { canonical: "/status" },
};

export default function StatusPage() {
  return (
    <PublicPage
      eyebrow={`Capability register · reviewed ${PUBLIC_CAPABILITY_REVIEWED_AT}`}
      title="Built, evidenced and activated are different states."
      lead="This register is deliberately conservative. A deployed screen or disabled feature does not become a customer, legal, security or production claim."
      actions={<ReplayAction label="Discuss the first evidence gate" />}
    >
      <JsonLd value={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "AssureRail capability status",
        description: "Effective-dated AssureRail software, evidence and activation status.",
        dateModified: PUBLIC_CAPABILITY_REVIEWED_AT,
        url: "https://assurerail.com/status",
      }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.tableScroll} tabIndex={0} aria-label="Scrollable capability status table">
            <table className={styles.statusTable}>
              <thead><tr><th>Capability</th><th>Publication state</th><th>What exists</th><th>Open boundary</th></tr></thead>
              <tbody>{PUBLIC_CAPABILITIES.map((item) => <tr key={item.id}><td><strong>{item.label}</strong><br /><small>{item.evidenceRef}</small></td><td><span className={styles.statusPill}>{item.publicLabel}</span></td><td>{item.summary}</td><td>{item.boundary}</td></tr>)}</tbody>
            </table>
          </div>
          <div className={styles.boundary}>No row is promoted automatically from a runtime flag, deployment report, simulation or internal test. Promotion requires the evidence owner, review date and exact route/function scope.</div>
        </div>
      </section>
    </PublicPage>
  );
}
