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

const SYSTEMS = ["Lender / LMS", "Trustee", "RTA / depository", "Bank / payment", "Servicer / rating"];

export default function Home() {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={styles.container}>
          <Link href="/" aria-label="AssureRail home" className={styles.brand}>
            <Logo />
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <a href="#routes">DA + PTC</a>
            <a href="#proof">Proof path</a>
            <a href="#status">Scope &amp; status</a>
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
                <a
                  className={styles.primaryAction}
                  href="mailto:contact@assurelocker.com?subject=AssureRail%20completed-deal%20replay"
                >
                  Propose a completed-deal replay <ArrowRight size={17} />
                </a>
                <a className={styles.secondaryAction} href="#status">View scope and status</a>
              </div>
              <div className={styles.statusLine} aria-label="Current product status">
                <span><i className={styles.statusDot} /> Design-partner stage</span>
                <span>DA + PTC replay prepared</span>
                <span>No controlled-live claim</span>
              </div>
            </div>

            <div className={styles.systemMap} aria-label="AssureRail coordinates a governed case across existing institutional systems">
              <div className={styles.mapHeader}>
                <span>Existing systems retain their role</span>
                <span className={styles.mapMode}>REPLAY / SHADOW</span>
              </div>
              <div className={styles.systemList}>
                {SYSTEMS.map((system) => <span key={system}>{system}</span>)}
              </div>
              <div className={styles.railCase}>
                <LogoMark />
                <div>
                  <strong>Governed transaction case</strong>
                  <small>authority · evidence · decisions · reconciliation · lifecycle</small>
                </div>
              </div>
              <div className={styles.ackRow}>
                <span>Expected</span><ArrowRight size={14} /><span>Received</span><ArrowRight size={14} />
                <span>Verified</span><ArrowRight size={14} /><span>Reconciled</span>
              </div>
              <p>AssureRail does not become the legal record merely because it coordinates the workflow.</p>
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
              <p className={styles.eyebrow}>Two routes · two representations</p>
              <h2>The legal route and its digital representation are separate choices.</h2>
              <p>Conventional DA and PTC are first-class journeys. Tokenisation is an adapter—not the entry ticket.</p>
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
              <p className={styles.eyebrow}>Adopt without replacing first</p>
              <h2>Prove the rail one controlled rung at a time.</h2>
              <p>Each stage produces evidence for the next. Nothing live is inferred from a demonstration or software test.</p>
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
              <p className={styles.eyebrow}>Capability register · reviewed {PUBLIC_CAPABILITY_REVIEWED_AT}</p>
              <h2>Built, evidenced and activated are different states.</h2>
              <p>The software is deployed behind fail-closed controls. External evidence and exact activation remain controlling.</p>
            </div>
            <div className={styles.capabilityList}>
              {PUBLIC_CAPABILITIES.map((capability) => (
                <article key={capability.id} className={styles.capability}>
                  <div className={styles.capabilityTitle}>
                    <span className={`${styles.capabilityState} ${styles[capability.state.toLowerCase()]}`}>{capability.publicLabel}</span>
                    <span className={styles.evidenceRef}>{capability.evidenceRef}</span>
                  </div>
                  <h3>{capability.label}</h3>
                  <p>{capability.summary}</p>
                  <small>{capability.boundary}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.boundarySection}>
          <div className={`${styles.container} ${styles.boundaryGrid}`}>
            <div>
              <p className={styles.eyebrow}>Provider-neutral by design</p>
              <h2>Keep the systems and accountable institutions that already carry authority.</h2>
            </div>
            <ul>
              <li><CheckCircle2 size={18} /> The transferee or investor retains its credit and investment decision.</li>
              <li><CheckCircle2 size={18} /> The trustee controls the PTC workflow; the route-defined register retains its legal role.</li>
              <li><CheckCircle2 size={18} /> The accountable party may appoint AssurePlane, another assurer or its own permitted process.</li>
              <li><CheckCircle2 size={18} /> AssurePool may supply a DA tape, but it is not mandatory and never becomes the PTC route.</li>
            </ul>
          </div>
        </section>

        <section className={styles.closing}>
          <div className={styles.container}>
            <Building2 size={26} aria-hidden="true" />
            <h2>Start with a transaction you have already completed.</h2>
            <p>Under an agreed NDA and data scope, replay the evidence and hand-offs without changing the authoritative process.</p>
            <a href="mailto:contact@assurelocker.com?subject=AssureRail%20completed-deal%20replay">
              Discuss a replay <ArrowRight size={17} />
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <Logo />
          <p>
            AssureRail is at design-partner and replay/shadow preparation stage. No live matching,
            issuance, secondary execution, token-title, custody or production-settlement availability
            is claimed. Any regulated or externally operative function requires the approved performer,
            route and activation. Institutional counterparties only; not investment, legal, tax or financial advice.
          </p>
          <div className={styles.footerLinks}>
            <Link href="/login">Institution sign in</Link>
            <a href="mailto:contact@assurelocker.com">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
