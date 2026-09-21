import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  FileCheck2,
  Network,
  ShieldCheck,
} from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { PublicFooter, PublicHeader } from "@/components/PublicSite";
import {
  PUBLIC_CAPABILITIES,
  PUBLIC_CAPABILITY_REVIEWED_AT,
  PUBLIC_PROOF_LADDER,
} from "@/lib/public-capability";
import styles from "./page.module.css";

const CFO_OUTCOMES = [
  {
    Icon: FileCheck2,
    title: "Define the transferable pool",
    body: "See which loans are ready, which can be remediated and which should stay outside the proposed sale.",
  },
  {
    Icon: ShieldCheck,
    title: "Protect value before diligence",
    body: "Resolve material data, document and eligibility gaps before they become buyer objections or price pressure.",
  },
  {
    Icon: Database,
    title: "Model decision-ready economics",
    body: "Compare indicative consideration, debt release, fees and deductions in a traceable seller cash view.",
  },
  {
    Icon: Network,
    title: "Run one controlled close",
    body: "Coordinate diligence, conditions, approvals and the closing waterfall from a shared transaction record.",
  },
] as const;

const SYSTEMS = ["Originator systems", "Investor systems", "Trustee and service providers", "Payment and record systems"];

const DELIVERY_CONTROLS = [
  {
    title: "Review every admitted loan",
    body: "The assessment applies recorded data and evidence checks across the full admitted population, rather than relying on a sample alone.",
  },
  {
    title: "Trace every material finding",
    body: "Each finding keeps its source, evidence version and status so finance, operations and reviewers can resolve the same issue set.",
  },
  {
    title: "Correct and reassess",
    body: "Upload corrected data or evidence and measure what changed through the reassessments included in the accepted quote.",
  },
  {
    title: "Add qualified review before market",
    body: "Portfolio Preparation brings in the legal, financial and technical professionals required for the accepted scope and buyer route.",
  },
] as const;

export default function Home() {
  return (
    <div className={styles.site}>
      <PublicHeader />

      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Transfer Venue Rail · India</p>
              <h1>Loan portfolio assessment and execution</h1>
              <p className={styles.lede}>
                AssureRail gives NBFC finance teams a paid, full-population Initial Assessment, expert-reviewed
                Portfolio Preparation and coordinated conventional direct-assignment execution.
              </p>
              <div className={styles.actions}>
                <Link
                  className={styles.primaryAction}
                  href="/login?mode=register"
                >
                  Start Initial Assessment <ArrowRight size={17} />
                </Link>
                <a className={styles.secondaryAction} href="#journey">See the three-stage journey</a>
              </div>
              <div className={styles.statusLine} aria-label="Current product status">
                <span><i className={styles.statusDot} /> Applications open for approved NBFC portfolios</span>
                <span>Conventional DA · Phase 1</span>
                <span>Execution by accepted mandate</span>
              </div>
            </div>

            <div className={styles.systemMap} aria-label="AssureRail coordinates a governed case across existing institutional systems">
              <div className={styles.mapHeader}>
                <span>Existing systems retain their role</span>
                <span className={styles.mapMode}>COORDINATED REVIEW</span>
              </div>
              <div className={styles.systemList}>
                {SYSTEMS.map((system) => <span key={system}>{system}</span>)}
              </div>
              <div className={styles.railCase}>
                <LogoMark />
                <div>
                  <strong>One coordinated transaction view</strong>
                  <small>participants · evidence · progress · exceptions</small>
                </div>
              </div>
              <p>A controlled record from seller preparation through buyer diligence and closing.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.problemSection}`}>
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>CFO outcomes</p>
              <h2>Prepare the book, defend its value and control the path to cash.</h2>
              <p>Start with an evidence-backed view of the portfolio and commit further cost only when the case is worth progressing.</p>
            </div>
            <div className={styles.problemGrid}>
              {CFO_OUTCOMES.map(({ Icon, title, body }) => (
                <article key={title} className={styles.problemCard}>
                  <Icon size={22} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.proofSection}`} id="journey">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>One commercial journey</p>
              <h2>Initial Assessment → Portfolio Preparation → Execution.</h2>
              <p>Each paid stage produces a clear outcome. The seller chooses whether to progress under the next accepted scope.</p>
            </div>
            <ol className={styles.proofGrid}>
              {PUBLIC_PROOF_LADDER.map((item) => (
                <li key={item.step}>
                  <span className={styles.step}>{item.step}</span>
                  <h3>{item.label}</h3>
                  <p>{item.summary}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${styles.section} ${styles.problemSection}`} id="document-review">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Portfolio intelligence</p>
              <h2>Turn the loan book into traceable findings, actions and buyer-ready evidence.</h2>
              <p>Automation handles population-scale processing. Qualified professionals review the sections appointed during Portfolio Preparation.</p>
            </div>
            <div className={styles.problemGrid}>
              {DELIVERY_CONTROLS.map(({ title, body }) => <article className={styles.problemCard} key={title}><h3>{title}</h3><p>{body}</p></article>)}
            </div>
            <div className={styles.actions}>
              <Link className={styles.secondaryAction} href="/routes/direct-assignment">See the full DA workflow</Link>
              <Link className={styles.secondaryAction} href="/downloads">Open customer guides</Link>
            </div>
          </div>
        </section>

        <section className={styles.section} id="status">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Services · updated {PUBLIC_CAPABILITY_REVIEWED_AT}</p>
              <h2>Start with the right level of commitment for the portfolio.</h2>
              <p>Initial Assessment applications are open. Preparation and execution are scoped from the portfolio, buyer route and selected services.</p>
            </div>
            <div className={styles.capabilityList}>
              {PUBLIC_CAPABILITIES.map((capability) => (
                <article key={capability.id} className={styles.capability}>
                  <div className={styles.capabilityTitle}>
                    <span className={`${styles.capabilityState} ${styles[capability.state.toLowerCase()]}`}>{capability.publicLabel}</span>
                  </div>
                  <h3>{capability.label}</h3>
                  <p>{capability.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.boundarySection}>
          <div className={`${styles.container} ${styles.boundaryGrid}`}>
            <div>
              <p className={styles.eyebrow}>Clear institutional roles</p>
              <h2>Give every participant one controlled process and a defined decision boundary.</h2>
            </div>
            <ul>
              <li><CheckCircle2 size={18} /> The seller confirms its data, evidence, authority and instructions.</li>
              <li><CheckCircle2 size={18} /> Qualified reviewers stand behind their appointed sections.</li>
              <li><CheckCircle2 size={18} /> The buyer retains its credit, legal, pricing and purchase decision.</li>
              <li><CheckCircle2 size={18} /> Appointed banks and providers hold and move funds; AssureRail coordinates the accepted closing.</li>
            </ul>
          </div>
        </section>

        <section className={styles.closing}>
          <div className={styles.container}>
            <Building2 size={26} aria-hidden="true" />
            <h2>Start with a paid Initial Assessment.</h2>
            <p>Declare the portfolio, receive a case-specific quote and upload the loan tape and evidence through an approved account.</p>
            <Link href="/login?mode=register">
              Apply for Initial Assessment <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
