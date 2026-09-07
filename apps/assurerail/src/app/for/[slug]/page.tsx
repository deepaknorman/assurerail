import type { Metadata } from "next";
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
  return (
    <PublicPage eyebrow={page.label} title={page.title} lead={page.lead} actions={<><ReplayAction /><StatusStamp /></>}>
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
          <h2>Preserve responsibility; improve reproducibility.</h2>
          <div className={styles.grid2}>
            <article className={styles.card}><h3>Your institution retains</h3><ul>{page.retains.map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article className={styles.card}><h3>The governed case adds</h3><ul>{page.gains.map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
        </div>
      </section>
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>First useful proof</p>
          <h2>{page.firstProof}</h2>
          <p className={styles.intro}>The replay is observe-only. It returns a scoped evidence and gap record; it does not change the completed transaction or certify it.</p>
        </div>
      </section>
    </PublicPage>
  );
}
