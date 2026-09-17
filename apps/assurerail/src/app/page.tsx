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
import { Logo, LogoMark } from "@/components/Logo";
import {
  PUBLIC_CAPABILITIES,
  PUBLIC_CAPABILITY_REVIEWED_AT,
  PUBLIC_PROOF_LADDER,
  PUBLIC_ROUTE_MODES,
} from "@/lib/public-capability";
import styles from "./page.module.css";

const PROBLEMS = [
  {
    Icon: FileCheck2,
    title: "Repeated diligence",
    body: "The same pool, documents and exceptions are rebuilt for each accountable participant.",
  },
  {
    Icon: ShieldCheck,
    title: "Completion ambiguity",
    body: "Signed, funded, transferred, allotted and registered are different events with different owners.",
  },
  {
    Icon: Database,
    title: "Reconciliation debt",
    body: "Tape, documents, cash and holding records can drift as a transaction crosses systems.",
  },
  {
    Icon: Network,
    title: "Lifecycle fragmentation",
    body: "Servicing, notices, waterfalls, triggers and reporting remain split across files and inboxes.",
  },
] as const;

const SYSTEMS = ["Originator systems", "Investor systems", "Trustee and service providers", "Payment and record systems"];

const DELIVERY_CONTROLS = [
  {
    title: "Automated evidence review",
    body: "Native document libraries read supported files first. AI is used only where extraction or validation needs it, and every finding retains a source locator and evidence version.",
  },
  {
    title: "Every admitted loan accounted for",
    body: "Loan-tape records, loan documents and principal are reconciled across the full admitted population. Missing, contradictory and unmatched evidence becomes a remediation task.",
  },
  {
    title: "Correct and reassess",
    body: "The seller can repair source data and evidence, then run the automated assessment again within the allowance stated in its accepted quote.",
  },
  {
    title: "Human judgement at the right stage",
    body: "Initial Assessment is automated and unsigned. Qualified legal, financial or technical reviewers enter during Portfolio Preparation for the scope they are appointed to review.",
  },
] as const;

export default function Home() {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link href="/" aria-label="AssureRail home" className={styles.brand}>
            <Logo />
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <Link href="/routes/direct-assignment">DA</Link>
            <Link href="/routes/ptc">PTC</Link>
            <a href="#proof">How it works</a>
            <Link href="/trust">How we work</Link>
            <Link href="/resources">Resources</Link>
            <Link href="/downloads">Downloads</Link>
            <Link href="/status">Availability</Link>
            <Link href="/login" className={styles.signIn}>Institution sign in</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Institutional transaction infrastructure · Domestic India first</p>
              <h1>Prepare loan portfolios for a governed direct assignment.</h1>
              <p className={styles.lede}>
                Apply for an automated Initial Assessment, fix evidence gaps and progress to expert-reviewed
                Portfolio Preparation. Conventional direct assignment is Phase 1; PTC follows later.
              </p>
              <div className={styles.actions}>
                <Link
                  className={styles.primaryAction}
                  href="/login"
                >
                  Apply for Initial Assessment <ArrowRight size={17} />
                </Link>
                <a className={styles.secondaryAction} href="#status">Current availability</a>
              </div>
              <div className={styles.statusLine} aria-label="Current product status">
                <span><i className={styles.statusDot} /> Applications open for approved NBFC portfolios</span>
                <span>Conventional DA · Phase 1</span>
                <span>Live settlement separately activated</span>
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
              <p>Existing institutions and systems keep the roles assigned to them.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.problemSection}`}>
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>The coordination gap</p>
              <h2>One transaction lives across many partial systems of truth.</h2>
              <p>AssureRail is designed to govern the hand-offs without pretending every record belongs on one platform.</p>
            </div>
            <div className={styles.problemGrid}>
              {PROBLEMS.map(({ Icon, title, body }) => (
                <article key={title} className={styles.problemCard}>
                  <Icon size={22} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="routes">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Phased route delivery</p>
              <h2>Conventional direct assignment comes first.</h2>
              <p>PTC remains a separate later-phase route. Any future digital representation is evaluated separately.</p>
            </div>
            <div className={styles.modeMatrix} role="table" aria-label="AssureRail transaction routes and representations">
              <div className={`${styles.modeCell} ${styles.modeCorner}`} role="columnheader">Route</div>
              <div className={`${styles.modeCell} ${styles.modeHeader}`} role="columnheader">Conventional</div>
              <div className={`${styles.modeCell} ${styles.modeHeader}`} role="columnheader">Authorised tokenised</div>
              {PUBLIC_ROUTE_MODES.map((mode) => (
                <div className={styles.modeRow} role="row" key={mode.route}>
                  <div className={`${styles.modeCell} ${styles.routeLabel}`} role="rowheader">{mode.route}</div>
                  <div className={styles.modeCell} role="cell">{mode.conventional}</div>
                  <div className={styles.modeCell} role="cell">{mode.tokenised}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.proofSection}`} id="proof">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>One gated seller journey</p>
              <h2>Assess, repair, prepare and then execute.</h2>
              <p>Each paid stage has its own outcome and gate. Work progresses only after the seller accepts the scope and the responsible institutions are ready.</p>
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
              <p className={styles.eyebrow}>What the assessment actually does</p>
              <h2>Convert a loan book into traceable findings and a repair plan.</h2>
              <p>The workflow separates machine extraction, deterministic reconciliation and professional judgement so that an AI response is never treated as a transaction decision.</p>
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
              <p className={styles.eyebrow}>Current availability · updated {PUBLIC_CAPABILITY_REVIEWED_AT}</p>
              <h2>Initial Assessment applications are open for approved NBFC portfolios.</h2>
              <p>Detailed product, security and readiness information is shared with authorised parties through controlled diligence.</p>
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
              <p className={styles.eyebrow}>Designed to coexist</p>
              <h2>Keep the institutions and systems already responsible for the transaction.</h2>
            </div>
            <ul>
              <li><CheckCircle2 size={18} /> Each institution retains its own decision and accountability.</li>
              <li><CheckCircle2 size={18} /> Trustees and appointed providers retain their established roles.</li>
              <li><CheckCircle2 size={18} /> Existing systems can remain in place during evaluation.</li>
              <li><CheckCircle2 size={18} /> Any progression is separately agreed and appropriately governed.</li>
            </ul>
          </div>
        </section>

        <section className={styles.closing}>
          <div className={styles.container}>
            <Building2 size={26} aria-hidden="true" />
            <h2>Start with a bounded, paid Initial Assessment.</h2>
            <p>Use an approved account to declare the portfolio, accept the quote and upload evidence for automated assessment.</p>
            <Link href="/login">
              Apply for Initial Assessment <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <Logo />
          <p>
            Initial Assessment applications are open for approved NBFC portfolios. Live transfer,
            funds movement and settlement services remain subject to separate institutional activation. Institutional counterparties
            only; not investment, legal, tax or financial advice.
          </p>
          <div className={styles.footerLinks}>
            <Link href="/login">Institution sign in</Link>
            <Link href="/resources">Resources</Link>
            <Link href="/trust">How we work</Link>
            <Link href="/replay">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
