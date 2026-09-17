import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, PublicPage, ReplayAction, StatusStamp, publicStyles as styles } from "@/components/PublicSite";
import { PERSONA_PAGES, findPersonaPage } from "@/lib/public-content";
import { ASSURERAIL_WEBSITE_ID, publicBreadcrumbs } from "@/lib/public-structured-data";

export function generateStaticParams() {
  return PERSONA_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = findPersonaPage((await params).slug);
  if (!page) return {};
  return { title: page.label, description: page.lead, alternates: { canonical: `/for/${page.slug}` } };
}

export default async function PersonaPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = findPersonaPage((await params).slug);
  if (!page) notFound();
  const isOriginator = page.slug === "originators";
  const isBuyer = page.slug === "transferees-investors";
  const actions = isOriginator
    ? <><Link className={styles.primaryAction} href="/login">Apply for Initial Assessment</Link><StatusStamp>Applications open</StatusStamp></>
    : <><ReplayAction label={isBuyer ? "Discuss buyer alignment" : "Explore a PTC evaluation"} /><StatusStamp>{isBuyer ? "Private buyer workspace" : "Private institutional evaluation"}</StatusStamp></>;
  return (
    <PublicPage eyebrow={page.label} title={page.title} lead={page.lead} actions={actions}>
      <JsonLd value={{
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "WebPage",
          name: `${page.label} | AssureRail`,
          description: page.lead,
          url: `https://assurerail.com/for/${page.slug}`,
          audience: { "@type": "BusinessAudience", audienceType: page.label },
          isPartOf: { "@id": ASSURERAIL_WEBSITE_ID },
        }, publicBreadcrumbs([
          { name: "Home", path: "/" },
          { name: page.label, path: `/for/${page.slug}` },
        ])],
      }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>{isOriginator ? "A clearer path to market" : isBuyer ? "A repeatable intake model" : "A reproducible transaction record"}</p>
          <h2>{isOriginator ? "Know what can proceed, what needs repair and what the deal may deliver." : isBuyer ? "Express requirements once and review each case against the accepted version." : "Connect each material decision to its evidence and accountable owner."}</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>Your institution controls</h3><ul>{page.retains.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article className={styles.card}><h3>AssureRail adds</h3><ul>{page.gains.map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
        </div>
      </section>
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>First useful proof</p>
          <h2>{page.firstProof}</h2>
          {isOriginator ? (
            <div className={styles.grid3}>
              <article className={styles.card}><h3>Assess</h3><p>Upload the declared tape and evidence for an automated review of every loan in scope.</p></article>
              <article className={styles.card}><h3>Repair</h3><p>Assign gaps, add corrected evidence and compare same-scope reassessment results.</p></article>
              <article className={styles.card}><h3>Prepare</h3><p>Move a suitable portfolio into qualified expert review before buyer diligence.</p></article>
            </div>
          ) : isBuyer ? (
            <div className={styles.grid3}>
              <article className={styles.card}><h3>Onboard</h3><p>Complete the MSA, create the buyer workspace and invite authorised users.</p></article>
              <article className={styles.card}><h3>Configure</h3><p>Select eligibility, evidence, diligence and delivery requirements through structured controls.</p></article>
              <article className={styles.card}><h3>Review</h3><p>Receive prepared cases with traceable evidence status, exceptions and seller responses.</p></article>
            </div>
          ) : (
            <p className={styles.intro}>A completed-deal replay provides a scoped evidence and gap record from which the institutions can design a controlled future workflow.</p>
          )}
          <div className={styles.boundary}>
            <strong>Important context.</strong>{" "}
            {isOriginator
              ? "Initial Assessment is automated, unsigned and has no human content review. Preparation improves readiness but does not guarantee a buyer, price or closing date; each buyer completes its own diligence and purchase decision."
              : isBuyer
                ? "The requirement profile and prepared case support the buyer's process. The buyer retains its credit, pricing, eligibility and purchase decisions, and live delivery or settlement is separately activated."
                : "PTC is a later production phase. Any live workflow will require separate institutional approval and preserve the responsibilities of the trustee and other appointed parties."}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
