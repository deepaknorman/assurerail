import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage, publicStyles } from "@/components/PublicSite";
import { DOWNLOAD_CATALOG } from "@/generated/download-artifacts";
import { sharedDownloadsConfigured } from "@/lib/download-access";
import styles from "./downloads.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Downloads",
  description: "Current AssureRail conventional direct-assignment guides and controlled customer materials.",
  alternates: { canonical: "/downloads" },
};

const descriptions: Record<string, string> = {
  "DA-CUSTOMER-GUIDE": "The current public guide to Initial Assessment, Portfolio Preparation, execution and itemised service choices.",
  "DA-COMMERCIAL-TERMS": "Controlled commercial terms for quote validity, exact scope reconciliation, customer credit and eligible refunds.",
  "DA-INTEGRATION-PLAN": "Reusable buyer, seller and provider plan for discovery, interfaces, security, testing, acceptance, cutover and Razorpay test activation.",
  "DA-SELLER-SUITE": "Seller MSA, Initial Assessment order, preparation SOW, execution mandate and settlement-schedule structure.",
  "DA-BUYER-ONBOARDING": "Post-MSA buyer onboarding, structured requirement settings and case-scoped RBAC.",
  "DA-REFERRAL": "Counterparty-specific referral controls and commercial terms.",
};

export default async function DownloadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const accessState = Array.isArray(query.access) ? query.access[0] : query.access;
  const publicArtifacts = DOWNLOAD_CATALOG.filter((item) => item.classification === "PUBLIC");
  const sharedArtifacts = DOWNLOAD_CATALOG.filter((item) => item.classification === "SHARED_PASSWORD");
  const sharedEnabled = sharedDownloadsConfigured(
    process.env.ASSURERAIL_DOWNLOADS_SHARED_ENABLED,
    process.env.ASSURERAIL_DOWNLOADS_SHARED_PASSWORD,
    process.env.ASSURERAIL_DOWNLOADS_SESSION_SECRET,
  );

  return (
    <PublicPage eyebrow="Controlled library · Phase 1 conventional DA" title="Current AssureRail materials, with the right access boundary." lead="Public guides open directly. Commercial schedules use one controlled download password. Counterparty and internal packs remain inside their approved workspace.">
      <section className={publicStyles.section}>
        <div className={publicStyles.container}>
          <h2>Public guides</h2>
          <p className={publicStyles.intro}>These materials may be read without an account. Check the version and availability statement before relying on them.</p>
          <div className={styles.catalog}>
            {publicArtifacts.map((item) => <article className={styles.artifact} key={item.id}>
              <span className={styles.classification}>Public</span>
              <h3>{item.title}</h3>
              <p>{descriptions[item.id] ?? "Current public AssureRail material."}</p>
              {item.route ? <Link className={styles.artifactAction} href={item.route}>Open HTML guide</Link> : null}
            </article>)}
          </div>
        </div>
      </section>

      <section className={publicStyles.sectionAlt} id="shared-password">
        <div className={publicStyles.container}>
          <h2>Controlled commercial downloads</h2>
          <p className={publicStyles.intro}>Use the shared password supplied for the approved evaluation. Access lasts 30 minutes in this browser and does not unlock a seller, buyer or internal workspace.</p>
          {sharedArtifacts.map((item) => <div className={styles.gate} key={item.id}>
            <span className={`${styles.classification} ${styles.classificationRestricted}`}>Shared password</span>
            <h3>{item.title}</h3>
            <p>{descriptions[item.id] ?? "Controlled commercial material."}</p>
            {accessState === "denied" ? <p className={styles.message} role="status">The password was not accepted. Check the current access message and try again.</p> : null}
            {accessState === "required" ? <p className={styles.message} role="status">Enter the current shared password to open this material.</p> : null}
            {sharedEnabled ? <form className={styles.form} action="/downloads/access" method="post">
                <input type="hidden" name="artifactId" value={item.id} />
                <div className={styles.honeypot} aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
                <div className={styles.field}><label htmlFor={`password-${item.id}`}>Download password</label><input id={`password-${item.id}`} name="password" type="password" minLength={20} maxLength={256} required autoComplete="current-password" /></div>
                <button className={styles.submit} type="submit">Unlock and open</button>
              </form>
              : <p className={styles.message} role="status">Controlled download access is being activated. Approved recipients will receive the current access message when it is ready.</p>}
            <p className={styles.fine}>The password is purpose-limited. Do not forward the document or password outside the approved group.</p>
          </div>)}
        </div>
      </section>

      <section className={publicStyles.section}>
        <div className={publicStyles.container}>
          <h2>Engagement workspace</h2>
          <p className={publicStyles.intro}>Seller, buyer, diligence and operating materials appear only inside the approved workspace for that institution and engagement. Access follows the user’s role and assigned portfolio scope.</p>
          <Link className={styles.artifactAction} href="/login">Sign in to your workspace</Link>
        </div>
      </section>
    </PublicPage>
  );
}
