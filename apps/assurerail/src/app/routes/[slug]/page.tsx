import type { Metadata } from "next";
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
  return (
    <PublicPage
      eyebrow={`${page.shortLabel} · conventional first`}
      title={page.title}
      lead={page.summary}
      actions={<><ReplayAction /><StatusStamp /></>}
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
          <h2>Begin with a completed transaction.</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>What is needed</h3><ul>{page.replayInputs.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article className={styles.card}><h3>What the review provides</h3><ul>{page.railCoordinates.map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
          <div className={styles.boundary}><strong>Current availability.</strong> Private evaluation is available by arrangement. Live transaction services are not currently offered.</div>
        </div>
      </section>
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
