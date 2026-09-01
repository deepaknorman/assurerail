"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { availability, customerWorkspaceEnabled, evidenceDisplayState, qualificationText, stateTone, type Availability } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";

type CaseDetail = { id: string; caseReference: string; ownerInstitutionId: string; transactionRoute: string; representation: string; assetClass: string; lifecycleLeg: string; operatingMode: string; status: string; routeState: string; routePackRef: string; routePackVersion: string; aggregateVersion: number; evidenceLockedAt: string | null; parties: Array<{ id: string; institutionId: string; partyRole: string; status: string; appointmentId: string | null }>; functionAssignments: Array<{ id: string; materialFunction: string; performer: string; performerInstitutionId: string | null; status: string }>; conditions: Array<{ id: string; code: string; conditionType: string; status: string; ownerInstitutionId: string; dueAt: string | null; evidenceObjectId: string | null }>; decisions: Array<{ id: string; decisionType: string; status: string; reason: string; createdAt: string; approvals: Array<{ id: string; decision: string; createdAt: string }> }>; transitions: Array<{ id: string; command: string; fromStatus: string; toStatus: string; resultingVersion: number; createdAt: string }> };
type Evidence = { id: string; transactionCaseId: string | null; evidenceType: string; purpose: string; status: string; sourceAsOfAt: string; expiresAt: string | null; qualifications: unknown; versions: Array<{ result: string; validationStatus: string; createdAt: string }> };
type Room = { id: string; purpose: string; status: string; policyVersion: string; legacyImport: { status: string } | null };
type Completion = { id: string; state: string; completionKind: string; finalAcknowledgement: { status: string; finalityClass: string } | null; createdAt: string };
type Saga = { id: string; state: string; routePackRef: string; routePackVersion: string; legs?: Array<{ id: string; legType: string; status: string }> };
type BreakItem = { id: string; code: string; severity: string; status: string };

function Unavailable({ label, value }: { label: string; value: Availability<unknown> }) {
  return value.status === "UNAVAILABLE" ? <div className="capability-unavailable"><strong>{label} unavailable</strong><span>{value.reason}</span></div> : null;
}

export default function CustomerCasePage() {
  const { caseId: raw } = useParams<{ caseId: string }>(); const caseId = decodeURIComponent(raw);
  const router = useRouter(); const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [item, setItem] = useState<CaseDetail | null>(null); const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<Availability<Evidence[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [rooms, setRooms] = useState<Availability<Room[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [completions, setCompletions] = useState<Availability<Completion[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [sagas, setSagas] = useState<Availability<Saga[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [breaks, setBreaks] = useState<Availability<BreakItem[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });

  const load = useCallback(async () => {
    if (!activeInstitutionId) return;
    try {
      const detail = await vget<CaseDetail>(`/v1/rail/cases/${encodeURIComponent(caseId)}`); setItem(detail);
      const prefix = detail.transactionRoute === "PTC" ? "ptc-replay" : "da-replay";
      const [e, r, c, s, b] = await Promise.allSettled([
        vget<Evidence[]>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/evidence`),
        vget<Room[]>(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms`),
        vget<Completion[]>(`/v1/rail/cases/${encodeURIComponent(caseId)}/source-completions`),
        vget<Saga[]>(`/v1/rail/cases/${encodeURIComponent(caseId)}/${prefix}/sagas`),
        vget<BreakItem[]>(`/v1/rail/cases/${encodeURIComponent(caseId)}/${prefix}/breaks`),
      ]);
      const ev = availability(e); setEvidence(ev.status === "AVAILABLE" ? { status: "AVAILABLE", data: ev.data.filter((entry) => entry.transactionCaseId === caseId) } : ev);
      setRooms(availability(r)); setCompletions(availability(c)); setSagas(availability(s)); setBreaks(availability(b));
    } catch (cause) { setError((cause as Error).message); }
  }, [activeInstitutionId, caseId]);
  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); else if (!loading && needsOnboarding) router.replace("/onboard"); }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (customerWorkspaceEnabled() && firebaseUser && activeInstitutionId) void load(); }, [firebaseUser, activeInstitutionId, load]);

  const legallyEffective = item?.status === "COMPLETED";
  return <><VenueHeader /><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href="/workspace">← Institution workspace</Link>
    {error && <div className="msg err" role="alert">{error}</div>}
    {item && <>
      <div className="institution-title-row"><div className="console-head"><p className="eyebrow">{item.transactionRoute} · {item.representation} · {item.operatingMode}</p><h1>{item.caseReference}</h1><p>{item.assetClass} · {item.lifecycleLeg} · route pack {item.routePackRef}@{item.routePackVersion}</p></div><span className={`pill ${legallyEffective ? "pill-ok" : "pill-warn"}`}>{item.status}</span></div>
      <div className="boundary-note">Case state is a Rail workflow state. Legal effectiveness requires the route-defined external authority and reconciled acknowledgements; this page cannot confer it.</div>
      <section className="evidence-ladder" aria-label="Transaction evidence states">{(["EXPECTED", "RECEIVED", "VERIFIED", "RECONCILED", "LEGALLY_EFFECTIVE"] as const).map((state) => { const current = evidenceDisplayState({ received: evidence.status === "AVAILABLE" && evidence.data.length > 0, result: evidence.status === "AVAILABLE" && evidence.data.some((entry) => entry.versions[0]?.result === "VERIFIED") ? "VERIFIED" : null, reconciled: sagas.status === "AVAILABLE" && sagas.data.some((entry) => entry.state === "RECONCILED"), legallyEffective }); return <div key={state} className={state === current ? "current" : ""}><span>{state.replaceAll("_", " ")}</span><small>{state === current ? "Current highest evidenced state" : "Not asserted"}</small></div>; })}</section>
      <section className="workspace-grid">
        <article className="panel workspace-module"><h2>Parties & authority</h2><div className="workspace-list">{item.parties.map((party) => <div className="workspace-row" key={party.id}><span><strong>{party.partyRole}</strong><small>{party.institutionId}</small></span><span className="pill">{party.status}</span></div>)}</div></article>
        <article className="panel workspace-module"><h2>Function assignments</h2><div className="workspace-list">{item.functionAssignments.map((fn) => <div className="workspace-row" key={fn.id}><span><strong>{fn.materialFunction}</strong><small>{fn.performer}{fn.performerInstitutionId ? ` · ${fn.performerInstitutionId}` : ""}</small></span><span className="pill">{fn.status}</span></div>)}</div></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><h2>Diligence rooms</h2><Link className="btn" href={`/cases/${encodeURIComponent(caseId)}/rooms`}>Open rooms</Link></div><Unavailable label="Rooms" value={rooms}/>{rooms.status === "AVAILABLE" && <div className="workspace-list">{rooms.data.map((room) => <div className="workspace-row" key={room.id}><span><strong>{room.purpose}</strong><small>Policy {room.policyVersion}</small></span><span className="pill">{room.status}</span></div>)}</div>}</article>
        <article className="panel workspace-module"><h2>Conditions & approvals</h2><div className="workspace-list">{item.conditions.map((condition) => <div className="workspace-row" key={condition.id}><span><strong>{condition.code}</strong><small>{condition.conditionType} · owner {condition.ownerInstitutionId}</small></span><span className="pill">{condition.status}</span></div>)}{item.decisions.map((decision) => <div className="workspace-row" key={decision.id}><span><strong>{decision.decisionType}</strong><small>{decision.reason} · {decision.approvals.length} approval(s)</small></span><span className="pill">{decision.status}</span></div>)}</div></article>
        <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><h2>Evidence register</h2>{activeInstitutionId && <Link className="btn" href={`/institutions/${encodeURIComponent(activeInstitutionId)}/evidence`}>Open & export</Link>}</div><Unavailable label="Evidence" value={evidence}/>{evidence.status === "AVAILABLE" && <div className="evidence-table">{evidence.data.map((entry) => { const version = entry.versions[0]; const state = evidenceDisplayState({ received: true, result: version?.result }); return <div className="evidence-row" key={entry.id}><div><strong>{entry.evidenceType}</strong><small>{entry.purpose}</small></div><div><span className={`pill ${stateTone(state)}`}>{state.replaceAll("_", " ")}</span><small>result {version?.result ?? "UNAVAILABLE"}</small></div><div><small>Source as-of</small><strong>{new Date(entry.sourceAsOfAt).toLocaleString("en-IN")}</strong></div><div><small>Expiry</small><strong>{entry.expiresAt ? new Date(entry.expiresAt).toLocaleString("en-IN") : "Not supplied"}</strong></div><div><small>Qualifications</small><strong>{qualificationText(entry.qualifications)}</strong></div></div>; })}{!evidence.data.length && <p className="meta">No case-scoped evidence is visible. This remains EXPECTED, not verified.</p>}</div>}</article>
        <article className="panel workspace-module"><h2>Completion & reconciliation</h2><Unavailable label="Source completion" value={completions}/>{completions.status === "AVAILABLE" && <div className="workspace-list">{completions.data.map((entry) => <div className="workspace-row" key={entry.id}><span><strong>{entry.completionKind}</strong><small>{entry.finalAcknowledgement ? `${entry.finalAcknowledgement.status} · ${entry.finalAcknowledgement.finalityClass}` : "Acknowledgement expected"}</small></span><span className="pill">{entry.state}</span></div>)}</div>}<Unavailable label={`${item.transactionRoute} saga`} value={sagas}/>{sagas.status === "AVAILABLE" && sagas.data.map((saga) => <div className="workspace-row" key={saga.id}><span><strong>{saga.routePackRef}</strong><small>{saga.legs?.length ?? 0} controlled leg(s)</small></span><span className="pill">{saga.state}</span></div>)}</article>
        <article className="panel workspace-module"><h2>Breaks & support</h2><Unavailable label="Break queue" value={breaks}/>{breaks.status === "AVAILABLE" && <div className="workspace-list">{breaks.data.map((entry) => <div className="workspace-row" key={entry.id}><span><strong>{entry.code}</strong><small>{entry.severity} · durable repair required</small></span><span className="pill pill-warn">{entry.status}</span></div>)}{!breaks.data.length && <p className="meta">No route-replay break is visible. This is not proof that every external system agrees.</p>}</div>}<div className="boundary-note">Escalate through the accountable case owner. Support cannot close a break without retained evidence and the required independent review.</div></article>
        <article className="panel workspace-module workspace-wide"><h2>Lifecycle timeline</h2><div className="case-timeline">{item.transitions.map((entry) => <div key={entry.id}><span>v{entry.resultingVersion}</span><div><strong>{entry.fromStatus} → {entry.toStatus}</strong><small>{entry.command} · {new Date(entry.createdAt).toLocaleString("en-IN")}</small></div></div>)}{!item.transitions.length && <p className="meta">No governed transition is recorded.</p>}</div></article>
      </section>
    </>}
  </main></>;
}
