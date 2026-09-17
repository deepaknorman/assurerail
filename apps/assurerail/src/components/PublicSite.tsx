import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import styles from "@/app/public-site.module.css";

export function PublicHeader() {
  const links = () => <>
    <Link href="/for/originators">For sellers</Link>
    <Link href="/for/transferees-investors">For buyers</Link>
    <Link href="/#journey">How it works</Link>
    <Link href="/resources">Resources</Link>
    <Link href="/login?mode=register" className={styles.navCta}>Start assessment</Link>
    <Link href="/login" className={styles.signIn}>Sign in</Link>
  </>;
  return (
    <><a className={styles.skipLink} href="#main-content">Skip to main content</a><header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" aria-label="AssureRail home" className={styles.brand}><Logo /></Link>
        <nav className={styles.nav} aria-label="Public navigation">{links()}</nav>
        <details className={styles.mobileNav}>
          <summary>Menu</summary>
          <nav aria-label="Mobile navigation">{links()}</nav>
        </details>
      </div>
    </header></>
  );
}

export function PublicFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div><Logo /><p className={styles.small}>Loan portfolio assessment, preparation and execution for institutional direct assignment.</p></div>
        <div>
          <strong>Services</strong>
          <Link href="/status">Initial Assessment</Link>
          <Link href="/status">Portfolio Preparation</Link>
          <Link href="/routes/direct-assignment">Direct assignment</Link>
        </div>
        <div>
          <strong>Participants</strong>
          <Link href="/for/originators">Originators</Link>
          <Link href="/for/transferees-investors">Transferees and investors</Link>
          <Link href="/for/trustees">Trustees</Link>
        </div>
        <div>
          <strong>Explore</strong>
          <Link href="/trust">How we work</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/downloads">Downloads</Link>
          <Link href="/replay">Completed-deal replay</Link>
        </div>
      </div>
      <div className={styles.disclaimer}>
        The buyer makes the acquisition decision. Execution starts under an accepted seller mandate and counterparty activation.
        AssureRail coordinates the workflow and exact fee instruction; it does not hold client money or act as custodian.
        Institutional counterparties only.
      </div>
    </footer>
  );
}

export function PublicPage(props: { children: ReactNode; eyebrow: string; title: string; lead: string; actions?: ReactNode }) {
  return (
    <div className={styles.site}>
      <PublicHeader />
      <main id="main-content">
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

export function AssessmentAction({ label = "Start Initial Assessment" }: { label?: string }) {
  return <Link href="/login?mode=register" className={styles.primaryAction}>{label}<ArrowRight size={17} /></Link>;
}

export function StatusStamp({ children = "Private institutional evaluation" }: { children?: ReactNode }) {
  return <span className={styles.statusStamp}>{children}</span>;
}

export function JsonLd({ value }: { value: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }} />;
}

export { styles as publicStyles };
