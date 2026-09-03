import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, PublicPage, ReplayAction, publicStyles as styles } from "@/components/PublicSite";
import { RESOURCE_ARTICLES, findResourceArticle } from "@/lib/public-content";

export function generateStaticParams() { return RESOURCE_ARTICLES.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = findResourceArticle((await params).slug);
  if (!article) return {};
  return { title: article.title, description: article.description, alternates: { canonical: `/resources/${article.slug}` }, openGraph: { type: "article", title: article.title, description: article.description, modifiedTime: article.reviewedAt } };
}

export default async function ResourceArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = findResourceArticle((await params).slug);
  if (!article) notFound();
  const url = `https://assurerail.com/resources/${article.slug}`;
  return (
    <PublicPage eyebrow="AssureRail field note" title={article.title} lead={article.description} actions={<ReplayAction />}>
      <JsonLd value={{ "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.description, datePublished: article.reviewedAt, dateModified: article.reviewedAt, mainEntityOfPage: url, author: { "@type": "Organization", name: "AssureRail" }, publisher: { "@type": "Organization", name: "AssureRail", url: "https://assurerail.com" } }} />
      <section className={styles.section}><article className={`${styles.container} ${styles.article}`}><div className={styles.articleMeta}><span>Reviewed {article.reviewedAt}</span><span>{article.readingMinutes} minute read</span><span>Educational · not legal advice</span></div>{article.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>)}</article></section>
    </PublicPage>
  );
}
