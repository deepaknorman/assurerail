"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { guidedJourneyEnabled, sandboxEnabled } from "@/lib/customer-workspace";
import type { InstitutionWorkspace } from "@/lib/institutions";
import { vget } from "@/lib/venue";

type Route = "DA" | "PTC";
type Mode = "REPLAY" | "SHADOW";

export default function GuidedJourneyPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId, venueUser } = useAuth();
  const [route, setRoute] = useState<Route>("DA");
  const [mode, setMode] = useState<Mode>("REPLAY");
  const [workspace, setWorkspace] = useState<InstitutionWorkspace | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [firebaseUser, loading, needsOnboarding, router]);

  useEffect(() => {
    if (!guidedJourneyEnabled() || !activeInstitutionId) return;
    vget<InstitutionWorkspace>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}`)
      .then(setWorkspace)
      .catch((cause) => setError((cause as Error).message));
  }, [activeInstitutionId]);

  const member = workspace?.institution.members.find(
    (item) => item.userId === venueUser?.id && item.status === "ACTIVE",
  );
  const entitlement = workspace?.institution.routeEntitlements.some(
    (item) =>
      item.status === "ACTIVE" &&
      item.transactionRoute === route &&
      item.representation === "CONVENTIONAL" &&
      item.operatingModes.includes(mode),
  );
  const readiness = useMemo(
    () => [
      { label: "Institution admission", ready: workspace?.institution.admission?.status === "ACTIVE", href: "/workspace/institution" },
      { label: "Active membership", ready: Boolean(member), href: "/workspace/institution" },
      { label: `${route} ${mode.toLowerCase()} entitlement`, ready: Boolean(entitlement), href: "/workspace/institution" },
      { label: "Connector acceptance", ready: workspace?.connectorReadiness.status === "READY", href: "/workspace/integrations" },
      { label: "Completed transaction evidence owner", ready: false, href: "mailto:contact@assurelocker.com?subject=AssureRail%20replay%20data%20owner" },
      { label: "Counsel / external-authority gate", ready: false, href: "/workspace/operations" },
    ],
    [entitlement, member, mode, route, workspace],
  );

  return <><VenueHeader /><main className="wrap institutional-page customer-workspace">
    <div className="console-head"><p className="eyebrow">CX-01 · guided setup</p><h1>Prepare a {route} {mode.toLowerCase()}</h1><p>This guide maps your objective to existing governed records. It does not admit an institution, grant a mandate, create a case or satisfy an external gate.</p></div>
    {!guidedJourneyEnabled() && <div className="msg err" role="alert">Guided setup is disabled. It may be enabled only in an approved shadow build.</div>}
    {!activeInstitutionId && <div className="msg err">Select an institution before using guided setup.</div>}
    {error && <div className="msg err" role="alert">{error}</div>}
    {guidedJourneyEnabled() && activeInstitutionId && <>
      <section className="panel"><div className="workspace-module-head"><div><span className="workspace-step">01</span><h2>Choose the proof</h2></div><span className="pill">NO SUBMISSION</span></div><div className="row gap"><button className={`btn ${route === "DA" ? "btn-primary" : ""}`} onClick={() => setRoute("DA")}>Direct Assignment</button><button className={`btn ${route === "PTC" ? "btn-primary" : ""}`} onClick={() => setRoute("PTC")}>PTC</button><button className={`btn ${mode === "REPLAY" ? "btn-primary" : ""}`} onClick={() => setMode("REPLAY")}>Historic replay</button><button className={`btn ${mode === "SHADOW" ? "btn-primary" : ""}`} onClick={() => setMode("SHADOW")}>Live shadow</button></div><div className="boundary-note">{mode === "REPLAY" ? "Reconstruct one completed transaction without money, title, notice, allotment, register or token mutation." : "Observe a current transaction in parallel while the participant process remains authoritative. Nothing executes through Rail."}</div></section>
      <section className="workspace-grid">
        <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">02</span><h2>Readiness path</h2></div><strong>{readiness.filter((item) => item.ready).length}/{readiness.length} evidenced</strong></div><div className="record-list">{readiness.map((item) => <Link className="workspace-row" href={item.href} key={item.label}><span><strong>{item.label}</strong><small>{item.ready ? "Evidence currently visible" : "Open or unavailable — cannot be inferred"}</small></span><span className={`pill ${item.ready ? "pill-ok" : "pill-warn"}`}>{item.ready ? "READY" : "OPEN"}</span></Link>)}</div></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">03</span><h2>Evidence to prepare</h2></div></div><ul className="workspace-list"><li><span>Named owner and authority</span><strong>REQUIRED</strong></li><li><span>Frozen tape / final pool</span><strong>REQUIRED</strong></li><li><span>Executed document set</span><strong>REQUIRED</strong></li><li><span>Cash and source/register acknowledgements</span><strong>REQUIRED</strong></li><li><span>Exceptions and later corrections</span><strong>REQUIRED</strong></li></ul></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">04</span><h2>Next controlled action</h2></div></div><p>{readiness.every((item) => item.ready) ? "Open the case register and request an authorised case setup." : "Close the open readiness items. Rail will not promote missing or UNKNOWN evidence to ready."}</p><div className="row gap"><Link className="btn btn-primary" href="/cases">Case register</Link>{sandboxEnabled() && <Link className="btn" href="/sandbox">Try synthetic sandbox</Link>}</div></article>
      </section>
    </>}
  </main></>;
}
