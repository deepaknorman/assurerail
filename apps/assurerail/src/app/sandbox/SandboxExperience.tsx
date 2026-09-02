"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { scenarioFor, type SandboxResult, type SandboxRoute } from "@/lib/sandbox-scenarios";
import styles from "./page.module.css";

const RESULT_ICON: Record<SandboxResult, typeof CheckCircle2> = {
  MATCHED: CheckCircle2,
  REVIEW_REQUIRED: AlertTriangle,
  BLOCKED: ShieldAlert,
};

export function SandboxExperience() {
  const [route, setRoute] = useState<SandboxRoute>("DA");
  const [revealed, setRevealed] = useState(1);
  const scenario = useMemo(() => scenarioFor(route), [route]);
  const visible = scenario.stages.slice(0, revealed);
  const complete = revealed === scenario.stages.length;

  function choose(next: SandboxRoute) {
    setRoute(next);
    setRevealed(1);
  }

  return <main className={styles.shell}>
    <header className={styles.header}><Link href="/"><Logo /></Link><span>Synthetic customer sandbox</span></header>
    <section className={styles.hero}>
      <div><p className={styles.eyebrow}>SIM-01 · deterministic · no external effects</p><h1>See how AssureRail refuses an incomplete completion story.</h1><p>Walk a synthetic DA or PTC record through evidence, authority and reconciliation. No API write, money, title, issuance, register or token action occurs.</p></div>
      <div className={styles.fixture}><strong>SYNTHETIC ONLY</strong><span>{scenario.fixtureNotice}</span></div>
    </section>
    <section className={styles.controls} aria-label="Sandbox scenario controls">
      <button className={route === "DA" ? styles.active : ""} onClick={() => choose("DA")}>Direct Assignment</button>
      <button className={route === "PTC" ? styles.active : ""} onClick={() => choose("PTC")}>PTC issuance</button>
      <span>{scenario.reference}</span>
    </section>
    <section className={styles.summary}>
      <div><p className={styles.eyebrow}>{scenario.route} · conventional · replay</p><h2>{scenario.title}</h2><p>{scenario.premise}</p></div>
      <div><small>Fixture dossier digest</small><code>{scenario.dossierDigest}</code><small>Expected terminal result</small><strong className={styles[scenario.expectedOutcome.toLowerCase()]}>{scenario.expectedOutcome.replace("_", " ")}</strong></div>
    </section>
    <ol className={styles.timeline}>
      {scenario.stages.map((stage, index) => {
        const shown = index < revealed;
        const Icon = shown ? RESULT_ICON[stage.result] : CircleDot;
        return <li key={stage.id} className={shown ? styles.shown : styles.pending}>
          <div className={styles.stageIcon}><Icon aria-hidden="true" /></div>
          <div className={styles.stageBody}><div className={styles.stageHead}><div><span>Stage {index + 1} · {stage.owner}</span><h3>{stage.label}</h3></div>{shown && <strong className={styles[stage.result.toLowerCase()]}>{stage.result.replace("_", " ")}</strong>}</div>{shown ? <div className={styles.comparison}><div><small>Expected</small><p>{stage.expected}</p></div><ArrowRight aria-hidden="true" /><div><small>Observed</small><p>{stage.observed}</p></div><div className={styles.consequence}><small>Control consequence</small><p>{stage.consequence}</p></div></div> : <p>Run the next comparison to reveal this stage.</p>}</div>
        </li>;
      })}
    </ol>
    <section className={styles.actions}>
      {!complete ? <button onClick={() => setRevealed((value) => Math.min(value + 1, scenario.stages.length))}>Run next comparison <ArrowRight aria-hidden="true" /></button> : <><div><strong>Replay complete: {scenario.expectedOutcome.replace("_", " ")}</strong><p>The fixture cannot close any external evidence gate. It shows the expected control behaviour only.</p></div><button onClick={() => setRevealed(1)}>Reset fixture</button></>}
    </section>
    <footer className={styles.footer}><p>Training and product-evaluation surface only. Synthetic results are never accepted as customer, trustee, recordkeeper, security, legal or production evidence.</p><Link href="/">Return to AssureRail</Link></footer>
  </main>;
}
