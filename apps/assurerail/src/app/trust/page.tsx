import type { Metadata } from "next";
import { JsonLd, PublicPage, ReplayAction, StatusStamp, publicStyles as styles } from "@/components/PublicSite";

export const metadata: Metadata = {
  title: "How AssureRail works",
  description: "High-level AssureRail institutional responsibility, data and security principles.",
  alternates: { canonical: "/trust" },
};

const BOUNDARIES = [
  ["Institutional responsibility", "Each participant keeps the decisions and responsibilities assigned to it."],
  ["Existing records", "AssureRail coordinates information without claiming to replace the records that remain operative for the transaction."],
  ["Provider choice", "Institutions can continue to use their appointed technology and professional service providers."],
  ["Controlled access", "Access is limited to the relevant institution, purpose and transaction context."],
  ["Independent review", "Sensitive actions and exceptions are intended to remain attributable and reviewable."],
  ["Data minimisation", "The public enquiry accepts no transaction files or borrower information."],
] as const;

export default function TrustPage() {
  return (
    <PublicPage eyebrow="Institutional principles" title="Coordinate the transaction without displacing institutional responsibility." lead="AssureRail is designed to work across existing participants and systems while keeping decisions, records and accountability with the appropriate parties." actions={<><ReplayAction /><StatusStamp /></>}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "WebPage", name: "How AssureRail works", url: "https://assurerail.com/trust", dateModified: "2026-09-03" }} />
      <section className={styles.section}><div className={styles.container}><h2>Principles for institutional use.</h2><div className={styles.grid3}>{BOUNDARIES.map(([title, body]) => <article className={styles.card} key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
      <section className={styles.sectionAlt}><div className={styles.container}><h2>Security information is shared through controlled diligence.</h2><p className={styles.intro}>Authorised counterparties can review the relevant architecture, security testing, resilience and operating evidence under the appropriate confidentiality and access arrangements.</p><div className={styles.boundary}>Public descriptions are intentionally high-level. They should not be used as a security certification or production-readiness statement.</div></div></section>
    </PublicPage>
  );
}
