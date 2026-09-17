import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentAction, JsonLd, PublicPage, publicStyles as styles } from "@/components/PublicSite";
import { RESOURCE_ARTICLES } from "@/lib/public-content";
import { ASSURERAIL_WEBSITE_ID } from "@/lib/public-structured-data";

export const metadata: Metadata = {
  title: "Resources",
  description: "Practical, effective-dated guidance for assessing and preparing loan portfolios for institutional direct assignment.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <PublicPage eyebrow="Resources · effective-dated" title="Practical guidance for loan-book sellers and buyers." lead="Use these field notes to understand portfolio readiness, evidence controls, transaction economics and the path from assessment to a controlled direct-assignment close." actions={<AssessmentAction />}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "AssureRail resources", url: "https://assurerail.com/resources", isPartOf: { "@id": ASSURERAIL_WEBSITE_ID }, hasPart: RESOURCE_ARTICLES.map((item) => ({ "@type": "Article", headline: item.title, url: `https://assurerail.com/resources/${item.slug}`, datePublished: item.publishedAt, dateModified: item.reviewedAt })) }} />
      <section className={styles.section}><div className={styles.container}><div className={styles.grid3}>{RESOURCE_ARTICLES.map((item) => <Link className={`${styles.card} ${styles.resourceLink}`} href={`/resources/${item.slug}`} key={item.slug}><h3>{item.title}</h3><p>{item.description}</p><small>{item.readingMinutes} min · reviewed {item.reviewedAt}</small></Link>)}</div></div></section>
    </PublicPage>
  );
}
