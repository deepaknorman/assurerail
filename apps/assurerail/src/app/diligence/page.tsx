import type { Metadata } from "next";
import { PublicPage, publicStyles as styles } from "@/components/PublicSite";
import { DILIGENCE_CAPABILITIES, DILIGENCE_CONTENT_OWNER, DILIGENCE_CONTENT_VERSION, DILIGENCE_DISCLOSURE, DILIGENCE_MILESTONES, DILIGENCE_NEXT_REVIEW_AT, DILIGENCE_REVIEWED_AT, DILIGENCE_SECURITY } from "@/lib/diligence-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Investor diligence",
  description: "Controlled AssureRail investor diligence material.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function DiligencePage() {
  return (
    <PublicPage eyebrow={`Controlled access · ${DILIGENCE_CONTENT_VERSION}`} title="AssureRail investor diligence" lead="Detailed product, readiness and open-gate information for an authorised evaluation audience.">
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.boundary}><strong>Restricted material.</strong> Access is purpose-limited. It is not a representation that any route is live, licensed, customer-accepted or production-ready.<br />Reviewed {DILIGENCE_REVIEWED_AT} · next review due {DILIGENCE_NEXT_REVIEW_AT} · owner {DILIGENCE_CONTENT_OWNER}.</div>
          <div className={styles.tableScroll} tabIndex={0} aria-label="Scrollable diligence capability register">
            <table className={styles.statusTable}>
              <thead><tr><th>Capability</th><th>Internal state</th><th>Implemented scope</th><th>Open evidence</th></tr></thead>
              <tbody>{DILIGENCE_CAPABILITIES.map((item) => <tr key={item.id}><td><strong>{item.label}</strong><br /><small>{item.evidenceRef}</small></td><td><span className={styles.statusPill}>{item.state.replaceAll("_", " ")}</span></td><td>{item.detail}</td><td>{item.open}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>
      <section className={styles.sectionAlt}><div className={styles.container}><h2>Stakeholder evidence milestones</h2><div className={styles.tableScroll} tabIndex={0} aria-label="Scrollable stakeholder milestone register"><table className={styles.statusTable}><thead><tr><th>Milestone</th><th>State and owner</th><th>Next evidence</th><th>Publication rule</th></tr></thead><tbody>{DILIGENCE_MILESTONES.map((item) => <tr key={item.id}><td>{item.label}</td><td><span className={styles.statusPill}>{item.state}</span><br /><small>{item.owner}<br />checked {item.lastCheckedAt}</small></td><td>{item.nextEvidence}</td><td>{item.promotion}</td></tr>)}</tbody></table></div></div></section>
      <section className={styles.section}><div className={styles.container}><h2>Security and infrastructure gates</h2><ul className={styles.checklist}>{DILIGENCE_SECURITY.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
      <section className={styles.sectionAlt}><div className={styles.container}><h2>Disclosure boundary</h2><ul className={styles.checklist}>{DILIGENCE_DISCLOSURE.map((item) => <li key={item}>{item}</li>)}</ul></div></section>
    </PublicPage>
  );
}
