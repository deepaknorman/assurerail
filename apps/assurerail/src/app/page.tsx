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
              <h1>One governed rail for loan transfers and securitisation.</h1>
              <p className={styles.lede}>
                AssureRail coordinates direct assignment and PTC transactions across the institutions,
                evidence and systems already carrying authority—conventional first, with tokenised
                representations only where separately approved.
              </p>
              <div className={styles.actions}>
                <Link
                  className={styles.primaryAction}
                  href="/replay"
                >
                  Propose a completed-deal replay <ArrowRight size={17} />
                </Link>
                <a className={styles.secondaryAction} href="#status">Current availability</a>
              </div>
              <div className={styles.statusLine} aria-label="Current product status">
                <span><i className={styles.statusDot} /> Private institutional evaluation</span>
                <span>DA and PTC</span>
                <span>Live services not currently offered</span>
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
              <p className={styles.eyebrow}>Two transaction routes</p>
              <h2>Direct assignment and PTC each retain their own institutional structure.</h2>
              <p>AssureRail is designed for conventional transactions first. Any future digital representation is evaluated separately.</p>
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
              <p className={styles.eyebrow}>Evaluate before changing systems</p>
              <h2>Start small and progress by agreement.</h2>
              <p>Begin with a completed transaction and decide together whether a further evaluation is worthwhile.</p>
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

        <section className={styles.section} id="status">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Current availability · updated {PUBLIC_CAPABILITY_REVIEWED_AT}</p>
              <h2>Private evaluation now. Live transaction services are not currently offered.</h2>
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
            <h2>Start with a transaction you have already completed.</h2>
            <p>Under an agreed NDA and data scope, replay the evidence and hand-offs without changing the authoritative process.</p>
            <Link href="/replay">
              Discuss a replay <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <Logo />
          <p>
            AssureRail is available for private institutional evaluation. Live transaction services,
            custody, funds handling and settlement are not currently offered. Institutional counterparties
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
