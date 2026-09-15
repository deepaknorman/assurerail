import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd, PublicPage, ReplayAction, publicStyles as styles } from "@/components/PublicSite";
import { RESOURCE_ARTICLES, findResourceArticle } from "@/lib/public-content";
import { ASSURERAIL_ORGANIZATION_ID, publicBreadcrumbs } from "@/lib/public-structured-data";

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
      <JsonLd value={{ "@context": "https://schema.org", "@graph": [{ "@type": "Article", "@id": `${url}/#article`, headline: article.title, description: article.description, datePublished: article.publishedAt, dateModified: article.reviewedAt, mainEntityOfPage: url, inLanguage: "en-IN", author: { "@id": ASSURERAIL_ORGANIZATION_ID }, publisher: { "@id": ASSURERAIL_ORGANIZATION_ID } }, publicBreadcrumbs([{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }, { name: article.title, path: `/resources/${article.slug}` }])] }} />
      <section className={styles.section}><article className={`${styles.container} ${styles.article}`}><div className={styles.articleMeta}><span>Reviewed {article.reviewedAt}</span><span>{article.readingMinutes} minute read</span><span>Educational · not legal advice</span></div>{article.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}{section.table ? <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={section.table.caption}><table className={styles.statusTable}><caption>{section.table.caption}</caption><thead><tr>{section.table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{section.table.rows.map((row) => <tr key={row.join("|")}>{row.map((cell, index) => index === 0 ? <th key={cell} scope="row">{cell}</th> : <td key={`${cell}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div> : null}</section>)}{article.sources?.length ? <section><h2>Primary references</h2><ul>{article.sources.map((source) => <li key={source.href}><a href={source.href} rel="noreferrer">{source.label}</a></li>)}</ul></section> : null}</article></section>
    </PublicPage>
  );
}
