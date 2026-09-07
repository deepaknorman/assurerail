"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Download,
  Eye,
  FileCheck2,
  LockKeyhole,
  RotateCcw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  DEMO_PERSONAS,
  FULL_SYSTEM_DEMO,
  FULL_SYSTEM_STAGES,
  demoExport,
  type DemoControlState,
  type DemoPersonaId,
} from "@/lib/full-system-demo";
import { scenarioFor, type SandboxResult, type SandboxRoute } from "@/lib/sandbox-scenarios";
import styles from "./page.module.css";

const STATUS: Record<DemoControlState, { label: string; icon: typeof CheckCircle2 }> = {
  MATCHED: { label: "Matched", icon: CheckCircle2 },
  REVIEW_REQUIRED: { label: "Review required", icon: AlertTriangle },
  BLOCKED: { label: "Blocked", icon: ShieldAlert },
  NOT_ACTIVATED: { label: "Not activated", icon: LockKeyhole },
};

const RESULT_ICON: Record<SandboxResult, typeof CheckCircle2> = {
  MATCHED: CheckCircle2,
  REVIEW_REQUIRED: AlertTriangle,
  BLOCKED: ShieldAlert,
};

function saveJson(filename: string, value: unknown) {
  const href = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function FullSystemTour() {
  const [stageIndex, setStageIndex] = useState(0);
  const [personaId, setPersonaId] = useState<DemoPersonaId>("TRANSFEREE");
  const stage = FULL_SYSTEM_STAGES[stageIndex];
  const persona = DEMO_PERSONAS.find((candidate) => candidate.id === personaId)!;
  const StageIcon = STATUS[stage.state].icon;
  const progress = Math.round(((stageIndex + 1) / FULL_SYSTEM_STAGES.length) * 100);

  function move(delta: number) {
    setStageIndex((current) => Math.max(0, Math.min(FULL_SYSTEM_STAGES.length - 1, current + delta)));
  }

  return <>
    <section className={styles.tourHero}>
      <div>
        <p className={styles.eyebrow}>AR-DEMO-01 · full-system walkthrough</p>
        <h1>{FULL_SYSTEM_DEMO.title}</h1>
        <p>{FULL_SYSTEM_DEMO.subtitle}</p>
      </div>
      <aside className={styles.fixture} aria-label="Synthetic demonstration boundary">
        <strong>SYNTHETIC · NON-EVIDENCE</strong>
        <span>{FULL_SYSTEM_DEMO.evidenceNotice}</span>
      </aside>
    </section>

    <section className={styles.metrics} aria-label="Demonstration scope">
      {FULL_SYSTEM_DEMO.metrics.map((metric) => <div key={metric.label}>
        <strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.detail}</small>
      </div>)}
    </section>

    <section className={styles.personaBar} aria-labelledby="persona-title">
      <div className={styles.personaIntro}>
        <Users aria-hidden="true" />
        <div><strong id="persona-title">Change institutional viewpoint</strong><span>Authority and evidence change with the role—not the underlying record.</span></div>
      </div>
      <div className={styles.personaTabs} role="tablist" aria-label="Institutional persona">
        {DEMO_PERSONAS.map((candidate) => <button
          aria-selected={candidate.id === personaId}
          className={candidate.id === personaId ? styles.activePersona : ""}
          key={candidate.id}
          onClick={() => setPersonaId(candidate.id)}
          role="tab"
          type="button"
        ><span>{candidate.initials}</span>{candidate.label}</button>)}
      </div>
    </section>

    <section className={styles.tourShell}>
      <nav className={styles.stageNav} aria-label="Full-system demonstration stages">
        <div className={styles.progressHead}><span>Journey progress</span><strong>{progress}%</strong></div>
        <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
        <ol>
          {FULL_SYSTEM_STAGES.map((candidate, index) => {
            const status = STATUS[candidate.state];
            const Icon = status.icon;
            return <li key={candidate.id}>
              <button
                aria-current={index === stageIndex ? "step" : undefined}
                className={index === stageIndex ? styles.activeStage : ""}
                onClick={() => setStageIndex(index)}
                type="button"
              >
                <span className={styles.stageNumber}>{candidate.number}</span>
                <span><small>{candidate.phase}</small><strong>{candidate.title}</strong></span>
                <Icon className={styles[candidate.state.toLowerCase()]} aria-label={status.label} />
              </button>
            </li>;
          })}
        </ol>
      </nav>

      <div className={styles.stageCanvas} aria-live="polite">
        <div className={styles.stageTitleRow}>
          <div>
            <p className={styles.eyebrow}>{stage.number} · {stage.phase} · {stage.route}</p>
            <h2>{stage.title}</h2>
            <p>{stage.summary}</p>
          </div>
          <span className={`${styles.stageStatus} ${styles[stage.state.toLowerCase()]}`}><StageIcon aria-hidden="true" />{STATUS[stage.state].label}</span>
        </div>

        <article className={styles.perspectiveCard}>
          <div className={styles.avatar}>{persona.initials}</div>
          <div><small>{persona.label} view · {persona.organisation}</small><strong>{stage.perspectives[personaId]}</strong><p>{persona.responsibility}</p></div>
          <Eye aria-hidden="true" />
        </article>

        <div className={styles.factGrid}>
          {stage.facts.map((fact) => <div className={fact.tone ? styles[fact.tone] : ""} key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}
        </div>

        <div className={styles.outcomeGrid}>
          <article><small>Expected control outcome</small><p>{stage.expectedOutcome}</p></article>
          <ChevronRight aria-hidden="true" />
          <article><small>Observed in this fixture</small><p>{stage.observedOutcome}</p></article>
        </div>

        <article className={styles.consequenceCard}>
          <FileCheck2 aria-hidden="true" />
          <div><small>System consequence</small><strong>{stage.consequence}</strong></div>
        </article>

        <section className={styles.artefacts}>
          <div className={styles.sectionHead}><div><small>Evidence register</small><h3>Inputs and receipts at this stage</h3></div><span>{stage.artefacts.length} objects</span></div>
          <div className={styles.artefactList}>
            {stage.artefacts.map((artefact) => {
              const itemStatus = STATUS[artefact.state];
              const Icon = itemStatus.icon;
              return <div key={artefact.reference}><Icon className={styles[artefact.state.toLowerCase()]} aria-hidden="true" /><span><strong>{artefact.label}</strong><code>{artefact.reference}</code></span><small>{itemStatus.label}</small></div>;
            })}
          </div>
        </section>

        <div className={styles.boundary}><LockKeyhole aria-hidden="true" /><div><strong>Control boundary</strong><span>{stage.boundary}</span></div></div>

        <div className={styles.stageActions}>
          <button disabled={stageIndex === 0} onClick={() => move(-1)} type="button"><ArrowLeft aria-hidden="true" /> Previous</button>
          <button onClick={() => saveJson(`assurerail-${FULL_SYSTEM_DEMO.fixtureId.toLowerCase()}-${personaId.toLowerCase()}.json`, demoExport(personaId))} type="button"><Download aria-hidden="true" /> Download synthetic dossier</button>
          {stageIndex < FULL_SYSTEM_STAGES.length - 1
            ? <button className={styles.primaryButton} onClick={() => move(1)} type="button">Next stage <ArrowRight aria-hidden="true" /></button>
            : <button className={styles.primaryButton} onClick={() => setStageIndex(0)} type="button"><RotateCcw aria-hidden="true" /> Restart tour</button>}
        </div>
      </div>
    </section>
  </>;
}

function RouteLab() {
  const [route, setRoute] = useState<SandboxRoute>("DA");
  const [revealed, setRevealed] = useState(1);
  const scenario = useMemo(() => scenarioFor(route), [route]);
  const complete = revealed === scenario.stages.length;

  function choose(next: SandboxRoute) {
    setRoute(next);
    setRevealed(1);
  }

  return <section className={styles.routeLab}>
    <div className={styles.labHero}><div><p className={styles.eyebrow}>Focused control lab</p><h1>Inspect one conventional route, leg by leg.</h1><p>Use this shorter view when the audience wants to focus on DA completion or PTC issuance rather than the whole institutional journey.</p></div><div className={styles.fixture}><strong>SYNTHETIC ONLY</strong><span>{scenario.fixtureNotice}</span></div></div>
    <div className={styles.controls} role="tablist" aria-label="Route lab scenario">
      <button aria-selected={route === "DA"} className={route === "DA" ? styles.active : ""} onClick={() => choose("DA")} role="tab">Direct Assignment</button>
      <button aria-selected={route === "PTC"} className={route === "PTC" ? styles.active : ""} onClick={() => choose("PTC")} role="tab">PTC issuance</button>
      <span>{scenario.reference}</span>
    </div>
    <div className={styles.summary}>
      <div><p className={styles.eyebrow}>{scenario.route} · conventional · replay</p><h2>{scenario.title}</h2><p>{scenario.premise}</p></div>
      <div><small>Fixture dossier digest</small><code>{scenario.dossierDigest}</code><small>Expected terminal result</small><strong className={styles[scenario.expectedOutcome.toLowerCase()]}>{scenario.expectedOutcome.replace("_", " ")}</strong></div>
    </div>
    <ol className={styles.timeline}>
      {scenario.stages.map((item, index) => {
        const shown = index < revealed;
        const Icon = shown ? RESULT_ICON[item.result] : CircleDot;
        return <li key={item.id} className={shown ? styles.shown : styles.pending}>
          <div className={styles.stageIcon}><Icon aria-hidden="true" /></div>
          <div className={styles.stageBody}><div className={styles.stageHead}><div><span>Stage {index + 1} · {item.owner}</span><h3>{item.label}</h3></div>{shown && <strong className={styles[item.result.toLowerCase()]}>{item.result.replace("_", " ")}</strong>}</div>{shown ? <div className={styles.comparison}><div><small>Expected</small><p>{item.expected}</p></div><ArrowRight aria-hidden="true" /><div><small>Observed</small><p>{item.observed}</p></div><div className={styles.consequence}><small>Control consequence</small><p>{item.consequence}</p></div></div> : <p>Run the next comparison to reveal this stage.</p>}</div>
        </li>;
      })}
    </ol>
    <div className={styles.actions}>
      {!complete ? <button onClick={() => setRevealed((value) => Math.min(value + 1, scenario.stages.length))}>Run next comparison <ArrowRight aria-hidden="true" /></button> : <><div><strong>Replay complete: {scenario.expectedOutcome.replace("_", " ")}</strong><p>The fixture cannot close any external evidence gate. It shows the expected control behaviour only.</p></div><button onClick={() => setRevealed(1)}>Reset fixture</button></>}
    </div>
  </section>;
}

export function SandboxExperience() {
  const [view, setView] = useState<"SYSTEM" | "ROUTE">("SYSTEM");

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" aria-label="AssureRail home"><Logo /></Link>
      <div className={styles.viewSwitch} role="tablist" aria-label="Demonstration view">
        <button aria-selected={view === "SYSTEM"} className={view === "SYSTEM" ? styles.activeView : ""} onClick={() => setView("SYSTEM")} role="tab">Full system</button>
        <button aria-selected={view === "ROUTE"} className={view === "ROUTE" ? styles.activeView : ""} onClick={() => setView("ROUTE")} role="tab">DA / PTC control lab</button>
      </div>
      <span>Private synthetic showcase</span>
    </header>
    {view === "SYSTEM" ? <FullSystemTour /> : <RouteLab />}
    <footer className={styles.footer}><p>No API write, money, title, issuance, register or token action occurs. Synthetic results are never accepted as customer, trustee, recordkeeper, security, legal, replay or production evidence.</p><Link href="/">Return to AssureRail</Link></footer>
  </main>;
}
