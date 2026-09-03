import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, PublicPage, ReplayAction, publicStyles as styles } from "@/components/PublicSite";
import { RESOURCE_ARTICLES } from "@/lib/public-content";

export const metadata: Metadata = {
  title: "Resources",
  description: "Effective-dated practical notes on DA, PTC, replay, authoritative records and institutional transaction controls.",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return (
    <PublicPage eyebrow="Resources · effective-dated" title="Practical notes for institutional transaction teams." lead="These materials explain the control model and proof method. They are not legal opinions, regulatory approvals or claims that a route is live." actions={<ReplayAction />}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "AssureRail resources", url: "https://assurerail.com/resources", hasPart: RESOURCE_ARTICLES.map((item) => ({ "@type": "Article", headline: item.title, url: `https://assurerail.com/resources/${item.slug}`, dateModified: item.reviewedAt })) }} />
      <section className={styles.section}><div className={styles.container}><div className={styles.grid3}>{RESOURCE_ARTICLES.map((item) => <Link className={`${styles.card} ${styles.resourceLink}`} href={`/resources/${item.slug}`} key={item.slug}><h3>{item.title}</h3><p>{item.description}</p><small>{item.readingMinutes} min · reviewed {item.reviewedAt}</small></Link>)}</div></div></section>
    </PublicPage>
  );
}
