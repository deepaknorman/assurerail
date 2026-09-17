import type { Metadata } from "next";
import { JsonLd, PublicPage, ReplayAction, StatusStamp, publicStyles as styles } from "@/components/PublicSite";
import { ASSURERAIL_WEBSITE_ID } from "@/lib/public-structured-data";

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

const PLATFORM_CONTROLS = [
  ["Scoped identity and access", "Institution, workspace, portfolio, document and action scopes are checked by the API; a visible screen does not grant transaction authority."],
  ["Versioned evidence", "Documents, extractions, findings, decisions and delivery records retain versions and integrity references so later review can identify what changed."],
  ["Separation of duties", "Seller, buyer, AssureRail and provider actions remain attributable. Sensitive steps can require a different maker and checker or fresh step-up evidence."],
  ["Provider-neutral integration", "Secure file delivery is the low-friction default where accepted. APIs and provider adapters use bounded contracts and do not make receipt equal buyer acceptance or settlement."],
  ["Automated security evidence", "Offline security checks cover repository secrets, dependency integrity, security invariants and document-input abuse. Controlled-live provider and independent testing remain separate release evidence."],
  ["Portable records", "Approved exports are designed to preserve institution-scoped evidence and exclude secret material, reducing dependence on a single interface."],
] as const;

export default function TrustPage() {
  return (
    <PublicPage eyebrow="Institutional principles" title="Coordinate the transaction without displacing institutional responsibility." lead="AssureRail is designed to work across existing participants and systems while keeping decisions, records and accountability with the appropriate parties." actions={<><ReplayAction /><StatusStamp /></>}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "WebPage", name: "How AssureRail works", url: "https://assurerail.com/trust", dateModified: "2026-09-17", isPartOf: { "@id": ASSURERAIL_WEBSITE_ID } }} />
      <section className={styles.section}><div className={styles.container}><h2>Principles for institutional use.</h2><div className={styles.grid3}>{BOUNDARIES.map(([title, body]) => <article className={styles.card} key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
      <section className={styles.sectionAlt}><div className={styles.container}><h2>Controls built into the operating model.</h2><p className={styles.intro}>These controls describe the platform design. Their production use still depends on the activated service, counterparty configuration and current release evidence.</p><div className={styles.grid3}>{PLATFORM_CONTROLS.map(([title, body]) => <article className={styles.card} key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
      <section className={styles.section}><div className={styles.container}><h2>Security information is shared through controlled diligence.</h2><p className={styles.intro}>Authorised counterparties can review the relevant architecture, security testing, resilience and operating evidence under the appropriate confidentiality and access arrangements.</p><div className={styles.boundary}>Public descriptions are intentionally high-level. They should not be used as a security certification or production-readiness statement.</div></div></section>
    </PublicPage>
  );
}
