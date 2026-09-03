import type { Metadata } from "next";
import { JsonLd, PublicPage, ReplayAction, StatusStamp, publicStyles as styles } from "@/components/PublicSite";

export const metadata: Metadata = {
  title: "Trust and operating boundaries",
  description: "AssureRail authority, data, security, assurance-provider and authoritative-record boundaries.",
  alternates: { canonical: "/trust" },
};

const BOUNDARIES = [
  ["Transaction authority", "Membership, mandate, appointment and function entitlement are separate. Identity verification alone grants no transaction power."],
  ["Independent decisions", "The transferee or investor keeps its credit or investment decision. The trustee keeps PTC transaction-control authority."],
  ["Authoritative records", "The route declares the legally operative RTA, depository, register or source acknowledgement. Rail records and reconciles; it does not silently replace it."],
  ["Provider neutrality", "Identity, evidence, assurance, payment and recordkeeping services connect through governed contracts. AssureLocker and AssurePlane are optional providers, not compulsory dependencies."],
  ["Internal operations", "Internal roles have bounded workspaces and no default customer transaction authority. Sensitive changes require independent review and step-up evidence."],
  ["Data minimisation", "Public enquiry accepts no files or borrower/transaction records. Replay data is separately contracted, scoped and transferred through an approved channel."],
] as const;

const OPEN_SECURITY = [
  "Azure India resources, policies, private networking and logging are not yet evidenced as configured",
  "Authenticated two-tenant E2E and DAST require the dedicated synthetic pre-production environment",
  "Independent VAPT and clean retest will be performed by an external firm",
  "Backup restoration and Hyderabad-to-Pune regional recovery require timed exercises",
] as const;

export default function TrustPage() {
  return (
    <PublicPage eyebrow="Trust centre · evidence before adjectives" title="Know who can decide, what remains authoritative and which gates are still open." lead="AssureRail’s control model separates platform coordination from participant decisions, trustee authority, external records and independent assurance." actions={<><ReplayAction /><StatusStamp>Security and external acceptance open</StatusStamp></>}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "WebPage", name: "AssureRail trust and operating boundaries", url: "https://assurerail.com/trust", dateModified: "2026-09-03" }} />
      <section className={styles.section}><div className={styles.container}><h2>Six boundaries we preserve.</h2><div className={styles.grid3}>{BOUNDARIES.map(([title, body]) => <article className={styles.card} key={title}><h3>{title}</h3><p>{body}</p></article>)}</div></div></section>
      <section className={styles.sectionAlt}><div className={styles.container}><p className={styles.eyebrow}>Security posture</p><h2>SEC-01 built the internal harness. Environment evidence and independent VAPT remain open.</h2><ul className={styles.checklist}>{OPEN_SECURITY.map((item) => <li key={item}>{item}</li>)}</ul><div className={styles.boundary}>Target architecture: Azure India, Hyderabad primary and Pune recovery. This is not a claim that those resources are provisioned, tested or a symmetric Azure-managed pair. A future multi-node token network is outside this topology.</div></div></section>
    </PublicPage>
  );
}
