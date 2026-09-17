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
      eyebrow={`${page.shortLabel} · conventional first`}
      title={page.title}
      lead={page.summary}
      actions={isDirectAssignment
        ? <><Link className={styles.primaryAction} href="/login">Apply for Initial Assessment</Link><StatusStamp>Applications open</StatusStamp></>
        : <><ReplayAction /><StatusStamp /></>}
    >
      <JsonLd value={{
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "Service",
          "@id": `${canonical}/#service`,
          name: `AssureRail ${page.shortLabel} transaction infrastructure`,
          description: page.summary,
          url: canonical,
          areaServed: { "@type": "Country", name: "India" },
          audience: { "@type": "BusinessAudience", audienceType: "Institutional counterparties" },
          provider: { "@id": ASSURERAIL_ORGANIZATION_ID },
        }, publicBreadcrumbs([
          { name: "Home", path: "/" },
          { name: page.shortLabel, path: `/routes/${page.slug}` },
        ])],
      }} />
      <section className={styles.section}>
        <div className={styles.container}>
          <h2>Authority stays explicit.</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>Who decides</h3><p>{page.whoDecides}</p></article>
            <article className={styles.card}><h3>What remains authoritative</h3><p>{page.authoritativeRecord}</p></article>
          </div>
        </div>
      </section>
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <h2>{isDirectAssignment ? "Begin with a declared portfolio and accepted quote." : "Begin with a completed transaction."}</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>What is needed</h3><ul>{page.replayInputs.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article className={styles.card}><h3>What the review provides</h3><ul>{page.railCoordinates.map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
          <div className={styles.boundary}><strong>Current availability.</strong> {isDirectAssignment ? "Paid Initial Assessment applications are open for approved NBFC portfolios. Portfolio Preparation is available under an accepted scope. Live execution and settlement require separate institutional activation." : "Private evaluation is available by arrangement. PTC production onboarding and live transaction services are not currently offered."}</div>
        </div>
      </section>
      {isDirectAssignment ? <>
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>The seller journey</p>
            <h2>Three stages, with a clear decision between them.</h2>
            <div className={styles.grid3}>
              <article className={styles.card}>
                <h3>1. Initial Assessment</h3>
                <p>Automated and unsigned. The seller uploads its tape and evidence; AssureRail returns evidence-linked findings, full-population reconciliation, risks, indicative economics and a remediation plan.</p>
              </article>
              <article className={styles.card}>
                <h3>2. Portfolio Preparation</h3>
                <p>Qualified reviewers examine the accepted legal, financial and technical scope, close or qualify exceptions, align the portfolio to structured buyer requirements and approve the prepared output.</p>
              </article>
              <article className={styles.card}>
                <h3>3. Execution</h3>
                <p>After a separate mandate and institutional activation, the parties manage buyer diligence, conditions, documents, interfaces, closing evidence and seller-authorised settlement instructions.</p>
              </article>
            </div>
          </div>
        </section>
        <section className={styles.sectionAlt}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Document and loan review</p>
            <h2>Use automation for the population; reserve judgement for accountable reviewers.</h2>
            <div className={styles.grid2}>
              <article className={styles.card}>
                <h3>Evidence processing</h3>
                <ul>
                  <li>Supported files are parsed with bounded document libraries before AI is used.</li>
                  <li>AI-assisted fields and findings remain tied to a document version and source locator.</li>
                  <li>Observed, inferred, absent, unreadable and contradictory states remain distinct.</li>
                  <li>AI output cannot approve eligibility, certify completeness or sign off a portfolio.</li>
                </ul>
              </article>
              <article className={styles.card}>
                <h3>Population controls</h3>
                <ul>
                  <li>Every admitted unique loan–borrower unit is evaluated against the accepted scope.</li>
                  <li>Loan files are matched to the tape and principal differences are reconciled deterministically.</li>
                  <li>Missing families, unmatched files and contradictions become assigned remediation tasks.</li>
                  <li>Pilot terms ordinarily allow three automated reassessments within 30 days.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>Commercial and delivery model</p>
            <h2>Quote the work that the particular seller and portfolio require.</h2>
            <div className={styles.grid3}>
              <article className={styles.card}><h3>Fixed preparation quote</h3><p>The quote reflects declared corpus, unique loan–borrower units, linked parties, evidence condition, asset type and selected work. Initial Assessment starts after its stated upfront payment; the preparation balance is paid before expert work begins.</p></article>
              <article className={styles.card}><h3>Seller-specific success fee</h3><p>Execution is priced to the seller's share of actual purchase consideration successfully settled, subject to the accepted mandate. Fees may be deducted only through a seller-authorised closing schedule accepted by the appointed bank or provider.</p></article>
              <article className={styles.card}><h3>Selectable additional services</h3><p>Buyer arrangement, secure file integration, escrow coordination, counsel, registry actions, field work and monitoring are scoped separately. External and statutory charges remain visible rather than being disguised as platform fees.</p></article>
            </div>
            <div className={styles.boundary}><strong>Integration boundary.</strong> A low-friction point-to-point secure file route is the default where accepted. APIs are scoped when a counterparty needs them. AssureRail does not hold gross sale proceeds or replace the buyer's LMS, seller's source ledger, bank or appointed recordkeeper.</div>
          </div>
        </section>
      </> : null}
      <section className={styles.sectionDark}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>Institutional responsibility remains</p>
          <h2>Technology does not replace the decisions assigned to each institution.</h2>
          <div className={styles.grid3}>{page.unavailable.map((item) => <article className={styles.card} key={item}><p>{item}</p></article>)}</div>
        </div>
      </section>
    </PublicPage>
  );
}
