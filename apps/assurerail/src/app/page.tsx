import Link from "next/link";
import { ShieldCheck, Layers, Activity, Scale, ArrowRight } from "lucide-react";

const PILLARS = [
  { Icon: ShieldCheck, h: "Verified pools", p: "Every pool arrives as a cryptographically-verified tape — the diligence is carried, not re-run. Nothing issues on an unverified pool." },
  { Icon: Scale, h: "Compliance-gated issuance", p: "Concentration, seasoning and size floors are enforced before anything is issued; an already-sold or encumbered loan can never enter a pool." },
  { Icon: Layers, h: "Atomic settlement", p: "Delivery and payment move as one — settlement risk eliminated by construction. The settlement instrument is a parameter (domestic e₹ first)." },
  { Icon: Activity, h: "Continuous surveillance", p: "Post-close performance is mirrored and anchored to a tamper-evident record — investors, trustees and the regulator see one truth." },
];

export default function Home() {
  return (
    <>
      <header className="topbar">
        <div className="wrap row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="AssureRail" className="brand-logo" />
          <nav>
            <Link href="/console">Console</Link>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <div>
            <p className="eyebrow">Securitisation &amp; tokenisation venue</p>
            <h1>Balance-sheet power,<br />settled atomically.</h1>
            <p className="sub">
              AssureRail turns a bank&rsquo;s or NBFC&rsquo;s verified loan pool into a compliance-gated, tokenised
              Note that settles delivery-versus-payment and stays under continuous, tamper-evident surveillance.
            </p>
            <div className="cta">
              <Link href="/console" className="btn btn-primary">Open the console <ArrowRight size={16} /></Link>
            </div>
          </div>
          <div className="hero-mark" aria-label="The Interlock">
            <svg viewBox="0 0 64 64" role="img" aria-labelledby="hm">
              <title id="hm">The Interlock</title>
              <path className="mk-a-anim" fill="var(--arail-logo-ink)" d="M22 56 H8 V8 H38 V24 H30 V36 H22 Z" />
              <path className="mk-b-anim" fill="var(--arail-logo-accent)" d="M42 8 H56 V56 H26 V40 H34 V28 H42 Z" />
            </svg>
          </div>
        </section>

        <section className="pillars">
          {PILLARS.map((p) => (
            <div className="pillar" key={p.h}>
              <p.Icon size={24} />
              <h3>{p.h}</h3>
              <p>{p.p}</p>
            </div>
          ))}
        </section>

        <section className="disclaimer">
          AssureRail is at a regulatory-sandbox / design stage and is not yet operational. Securitisation,
          tokenisation, fund-management, settlement and market-infrastructure activities are subject to
          authorisation by the relevant regulators (including, as applicable, RBI, SEBI and IFSCA) and will be
          undertaken only by the appropriately authorised entity once such authorisations are in place. Nothing
          here is an offer, solicitation or recommendation to buy, sell or subscribe for any security, instrument
          or financial product, and it is not investment, legal, tax or financial advice. Directed at institutional
          and professional counterparties only.
        </section>
      </main>

      <footer className="foot">
        <div className="wrap row" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <span>AssureRail</span>
          <span className="mono">The Interlock · sandbox</span>
        </div>
      </footer>
    </>
  );
}
