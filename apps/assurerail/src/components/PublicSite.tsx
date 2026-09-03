import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import styles from "@/app/public-site.module.css";

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" aria-label="AssureRail home" className={styles.brand}><Logo /></Link>
        <nav className={styles.nav} aria-label="Public navigation">
          <Link href="/routes/direct-assignment">Direct assignment</Link>
          <Link href="/routes/ptc">PTC</Link>
          <Link href="/trust">How we work</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/status">Availability</Link>
          <Link href="/replay" className={styles.navCta}>Propose a replay</Link>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div><Logo /><p className={styles.small}>Institutional transaction infrastructure for DA and PTC.</p></div>
        <div>
          <strong>Routes</strong>
          <Link href="/routes/direct-assignment">Direct assignment</Link>
          <Link href="/routes/ptc">PTC</Link>
          <Link href="/status">Current availability</Link>
        </div>
        <div>
          <strong>Participants</strong>
          <Link href="/for/originators">Originators</Link>
          <Link href="/for/transferees-investors">Transferees and investors</Link>
          <Link href="/for/trustees">Trustees</Link>
        </div>
        <div>
          <strong>Explore</strong>
          <Link href="/resources">Resources</Link>
          <Link href="/replay">Completed-deal replay</Link>
        </div>
      </div>
      <div className={styles.disclaimer}>
        AssureRail is available for private institutional evaluation. Live transaction services,
        custody, funds handling and settlement are not currently offered. Institutional counterparties
        only; not investment, legal, tax or financial advice.
      </div>
    </footer>
  );
}

export function PublicPage(props: { children: ReactNode; eyebrow: string; title: string; lead: string; actions?: ReactNode }) {
  return (
    <div className={styles.site}>
      <PublicHeader />
      <main>
        <section className={styles.hero}>
          <div className={styles.container}>
            <p className={styles.eyebrow}>{props.eyebrow}</p>
            <h1>{props.title}</h1>
            <p className={styles.lead}>{props.lead}</p>
            {props.actions ? <div className={styles.actions}>{props.actions}</div> : null}
          </div>
        </section>
        {props.children}
      </main>
      <PublicFooter />
    </div>
  );
}

export function ReplayAction({ label = "Propose a completed-deal replay" }: { label?: string }) {
  return <Link href="/replay" className={styles.primaryAction}>{label}<ArrowRight size={17} /></Link>;
}

export function StatusStamp({ children = "Private institutional evaluation" }: { children?: ReactNode }) {
  return <span className={styles.statusStamp}>{children}</span>;
}

export function JsonLd({ value }: { value: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }} />;
}

export { styles as publicStyles };
