import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd, PublicPage, ReplayAction, StatusStamp, publicStyles as styles } from "@/components/PublicSite";
import { PUBLIC_ROUTE_PAGES, findRoutePage } from "@/lib/public-content";
import { ASSURERAIL_ORGANIZATION_ID, publicBreadcrumbs } from "@/lib/public-structured-data";

export function generateStaticParams() {
  return PUBLIC_ROUTE_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = findRoutePage((await params).slug);
  if (!page) return {};
  return {
    title: page.shortLabel,
    description: page.summary,
    alternates: { canonical: `/routes/${page.slug}` },
  };
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const page = findRoutePage((await params).slug);
  if (!page) notFound();
  const canonical = `https://assurerail.com/routes/${page.slug}`;
  const isDirectAssignment = page.slug === "direct-assignment";
  return (
    <PublicPage
      eyebrow={isDirectAssignment ? "Direct assignment · seller to buyer" : "PTC · planned route"}
      title={page.title}
      lead={page.summary}
      actions={isDirectAssignment
        ? <><Link className={styles.primaryAction} href="/login?mode=register">Apply for Initial Assessment</Link><StatusStamp>Applications open</StatusStamp></>
        : <><ReplayAction /><StatusStamp /></>}
    >
      <JsonLd value={{
        "@context": "https://schema.org",
        "@graph": [{
          "@type": isDirectAssignment ? "Service" : "WebPage",
          "@id": `${canonical}/#${isDirectAssignment ? "service" : "page"}`,
          name: isDirectAssignment ? `AssureRail ${page.shortLabel} services` : `AssureRail ${page.shortLabel} programme information`,
          description: page.summary,
          url: canonical,
          areaServed: { "@type": "Country", name: "India" },
          audience: { "@type": "BusinessAudience", audienceType: "Institutional counterparties" },
          ...(isDirectAssignment ? { provider: { "@id": ASSURERAIL_ORGANIZATION_ID } } : {}),
        }, publicBreadcrumbs([
          { name: "Home", path: "/" },
          { name: page.shortLabel, path: `/routes/${page.slug}` },
        ])],
      }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <h2>Clear roles from first review to closing.</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>Decision ownership</h3><p>{page.whoDecides}</p></article>
            <article className={styles.card}><h3>Transaction record</h3><p>{page.authoritativeRecord}</p></article>
          </div>
        </div>
      </section>
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>{isDirectAssignment ? "The starting point" : "A practical first proof"}</p>
          <h2>{isDirectAssignment ? "Begin with a declared portfolio and a case-specific quote." : "Begin with one representative completed transaction."}</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>Provide</h3><ul>{page.replayInputs.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article className={styles.card}><h3>Receive</h3><ul>{page.railCoordinates.map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
        </div>
      </section>
      {isDirectAssignment ? <>
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>The seller journey</p>
            <h2>Progress only when the portfolio is ready.</h2>
            <div className={styles.grid3}>
              <article className={styles.card}>
                <h3>1. Initial Assessment</h3>
                <p>Upload the tape and evidence. Receive full-population reconciliation, evidence-linked findings, indicative economics and a prioritised remediation plan.</p>
              </article>
              <article className={styles.card}>
                <h3>2. Portfolio Preparation</h3>
                <p>Qualified reviewers examine the agreed legal, financial and technical scope, resolve or qualify exceptions and approve the prepared output for buyer diligence.</p>
              </article>
              <article className={styles.card}>
                <h3>3. Execution</h3>
                <p>Coordinate buyer diligence, conditions, documents, secure delivery, closing evidence and seller-authorised settlement instructions under an accepted mandate.</p>
              </article>
            </div>
          </div>
        </section>
        <section className={styles.sectionAlt}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Document and loan review</p>
            <h2>Review every admitted loan without making diligence wait on manual sorting.</h2>
            <div className={styles.grid2}>
              <article className={styles.card}>
                <h3>Traceable evidence processing</h3>
                <ul>
                  <li>Automation extracts and validates supported files at population scale.</li>
                  <li>Each assisted field and finding stays tied to its document version and source location.</li>
                  <li>Observed, inferred, missing, unreadable and contradictory evidence remains distinct.</li>
                  <li>Qualified judgement is introduced during Portfolio Preparation.</li>
                </ul>
              </article>
              <article className={styles.card}>
                <h3>Correct, compare and reassess</h3>
                <ul>
                  <li>Every unique loan–borrower unit in the accepted scope is checked.</li>
                  <li>Files are matched to the tape and principal differences are reconciled.</li>
                  <li>Material gaps become tasks with an owner and required evidence.</li>
                  <li>Corrected evidence can be reassessed and compared with the previous result.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Commercial and delivery model</p>
            <h2>Pricing follows the portfolio, selected work and successful outcome.</h2>
            <div className={styles.grid3}>
              <article className={styles.card}><h3>Fixed assessment and preparation</h3><p>The upfront quote reflects corpus, unique loan–borrower units, linked parties, evidence condition, asset type and selected services. Initial Assessment begins after 30% is paid; the balance is due before Portfolio Preparation.</p></article>
              <article className={styles.card}><h3>Success-based execution</h3><p>The seller's execution fee is based on its share of actual purchase consideration successfully settled, under the accepted mandate.</p></article>
              <article className={styles.card}><h3>Services selected as needed</h3><p>Arrangement, secure file integration, escrow coordination, counsel, registry actions, field work and monitoring are scoped transparently for the case.</p></article>
            </div>
          </div>
        </section>
      </> : null}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.boundary}>
            <strong>{isDirectAssignment ? "Important transaction context." : "PTC programme context."}</strong>
            <ul>{page.unavailable.map((item) => <li key={item}>{item}</li>)}</ul>
            {isDirectAssignment ? <p>Initial Assessment is automated and unsigned, includes three automated reassessments of the same portfolio scope within 30 days, and has no human content review. The workspace remains available afterward; a changed scope is requoted. Portfolio Preparation brings in the qualified reviewers required for the accepted work.</p> : <p>Private completed-deal evaluation is available by arrangement while the production route is developed with participating institutions.</p>}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
