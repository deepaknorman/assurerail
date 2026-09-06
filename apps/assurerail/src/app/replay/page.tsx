import type { Metadata } from "next";
import { JsonLd, PublicPage, StatusStamp, publicStyles as styles } from "@/components/PublicSite";
import { ReplayInquiryForm } from "./ReplayInquiryForm";

export const metadata: Metadata = {
  title: "Completed-deal replay",
  description: "Nominate a completed institutional DA or PTC transaction for an observe-only evidence replay.",
  alternates: { canonical: "/replay" },
};

export const dynamic = "force-dynamic";

export default function ReplayPage() {
  const inboundEnabled = process.env.ASSURERAIL_INBOUND_ENABLED === "yes";
  const contactEmail = process.env.ASSURERAIL_CONTACT_EMAIL?.trim();
  return (
    <PublicPage eyebrow="Lowest-risk first proof" title="Start with a transaction you have already completed." lead="Under an agreed NDA and data scope, reconstruct the evidence, authority, hand-offs and completion record without changing money, title, issuance or the authoritative process." actions={<StatusStamp>Observe-only · no files through this form</StatusStamp>}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "Service", name: "AssureRail completed-deal replay", serviceType: "Institutional transaction evidence replay", areaServed: { "@type": "Country", name: "India" }, provider: { "@type": "Organization", name: "AssureRail" }, url: "https://assurerail.com/replay" }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <h2>First qualify the transaction—not the data upload.</h2>
          <p className={styles.intro}>This form records business contact and fixed qualification choices only. Do not send borrower information, account numbers, pool tapes, transaction documents or credentials. If the replay is suitable, a separately approved NDA, data scope and secure transfer channel come next.</p>
          {inboundEnabled ? <ReplayInquiryForm /> : (
            <div className={styles.boundary}>
              Online replay intake is not enabled yet. {contactEmail ? <>To register interest, email{" "}
              <a href={`mailto:${contactEmail}?subject=AssureRail%20completed-deal%20replay`}>{contactEmail}</a>{" "}
              with your organisation, role and preferred route only.</> : <>Use the contact channel in your private evaluation pack to register interest.</>} Do not attach transaction data or documents.
            </div>
          )}
        </div>
      </section>
      <section className={styles.sectionAlt}><div className={styles.container}><h2>What happens next</h2><div className={styles.grid3}><article className={styles.card}><h3>1 · Qualification</h3><p>Confirm the route, repeat use case, accountable data owner and intended proof.</p></article><article className={styles.card}><h3>2 · Scope and authority</h3><p>Agree NDA/DPA where applicable, purpose, minimised fields, owners, systems and secure transfer.</p></article><article className={styles.card}><h3>3 · Replay output</h3><p>Return an evidence map, timeline, open gaps, reconciliation breaks and a proposal for the next proof rung.</p></article></div><div className={styles.boundary}>A replay is diagnostic. It is not a legal opinion, transaction assurance, customer testimonial, production trial or retrospective certification.</div></div></section>
    </PublicPage>
  );
}
