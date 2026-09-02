"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { type InstitutionWorkspace } from "@/lib/institutions";
import { activeMandateActions, availability, customerWorkspaceEnabled, hostedAlphaEnabled, hostedAlphaTaskTone, type Availability, type HostedAlphaTaskResponse } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";

type CaseRow = { id: string; caseReference: string; transactionRoute: string; representation: string; assetClass: string; operatingMode: string; status: string; aggregateVersion: number; updatedAt: string };
type Opportunity = { id: string; transactionCaseId: string; opportunityReference: string; ownerInstitutionId: string; status: string; currentTermVersion: number; closesAt: string | null; transactionCase: { transactionRoute: string; representation: string; assetClass: string; operatingMode: string } };

export default function CustomerWorkspacePage() {
  const router = useRouter();
  const { loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [institution, setInstitution] = useState<InstitutionWorkspace | null>(null);
  const [cases, setCases] = useState<Availability<CaseRow[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [opportunities, setOpportunities] = useState<Availability<Opportunity[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [tasks, setTasks] = useState<Availability<HostedAlphaTaskResponse>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [error, setError] = useState("");
  const enabled = customerWorkspaceEnabled();

  const load = useCallback(async () => {
    if (!activeInstitutionId) return;
    setError("");
    try {
      const [workspace, caseResult, opportunityResult, taskResult] = await Promise.all([
        vget<InstitutionWorkspace>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}`),
        Promise.allSettled([vget<CaseRow[]>("/v1/rail/cases")]).then(([result]) => availability(result)),
        Promise.allSettled([vget<Opportunity[]>("/v1/rail/commercial/opportunities")]).then(([result]) => availability(result)),
        hostedAlphaEnabled()
          ? Promise.allSettled([vget<HostedAlphaTaskResponse>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/hosted-alpha/tasks`)]).then(([result]) => availability(result))
          : Promise.resolve<Availability<HostedAlphaTaskResponse>>({ status: "UNAVAILABLE", reason: "Hosted alpha disabled" }),
      ]);
      setInstitution(workspace); setCases(caseResult); setOpportunities(opportunityResult); setTasks(taskResult);
    } catch (cause) { setError((cause as Error).message); }
  }, [activeInstitutionId]);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (enabled && firebaseUser && activeInstitutionId) void load(); }, [enabled, firebaseUser, activeInstitutionId, load]);

  const currentMember = institution?.institution.members.find((item) => item.userId === venueUser?.id && item.status === "ACTIVE");
  const mandateActions = useMemo(() => activeMandateActions(currentMember?.mandates ?? []), [currentMember]);
  const openCases = cases.status === "AVAILABLE" ? cases.data.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).length : null;

  return <><VenueHeader /><main className="wrap institutional-page customer-workspace">
    <div className="console-head"><p className="eyebrow">Institution workspace · shadow</p><h1>{institution?.institution.legalName ?? "Customer workspace"}</h1><p>One institution-scoped view of onboarding, opportunities, diligence, cases and completion evidence. Visibility never grants authority; the API rechecks active membership, mandate, appointment, case role and route entitlement for every action.</p></div>
    {!enabled && <div className="msg err" role="alert">Customer workspace is disabled. Set NEXT_PUBLIC_ASSURERAIL_CUSTOMER_WORKSPACE_V1=shadow only in an approved replay/shadow build.</div>}
    {!activeInstitutionId && <div className="msg err">Select an admitted institution before opening its workspace.</div>}
    {error && <div className="msg err" role="alert">{error}</div>}
    {enabled && institution && <>
      <section className="workspace-hero" aria-label="Institution authority summary">
        <div><span className="workspace-label">Relationship</span><strong>{currentMember?.membershipRole ?? "No active membership"}</strong><small>{institution.institution.admission?.status ?? "NO_ADMISSION"} · {institution.institution.status}</small></div>
        <div><span className="workspace-label">Active mandates</span><strong>{mandateActions.size}</strong><small>Server-enforced actions</small></div>
        <div><span className="workspace-label">Route entitlements</span><strong>{institution.institution.routeEntitlements.filter((item) => item.status === "ACTIVE").length}</strong><small>Function-specific, effective-dated</small></div>
        <div><span className="workspace-label">Open cases</span><strong>{openCases ?? "—"}</strong><small>{cases.status === "AVAILABLE" ? "Visible to this institution" : "Case service unavailable"}</small></div>
      </section>
      <section className="workspace-grid">
        {hostedAlphaEnabled() && <article className="panel workspace-module workspace-wide hosted-alpha-summary"><div className="workspace-module-head"><div><span className="workspace-step">00</span><h2>Action centre</h2></div><Link className="btn btn-primary" href="/workspace/tasks">View all actions</Link></div><p>Institution-scoped actions derived from governed source records. Opening a task never bypasses authority checks at its destination.</p>{tasks.status === "UNAVAILABLE" ? <div className="capability-unavailable"><strong>Unavailable</strong><span>{tasks.reason}</span></div> : <><div className="task-summary-strip"><span><strong>{tasks.data.counts.actionRequired}</strong> action required</span><span><strong>{tasks.data.counts.watch}</strong> watch</span><span><strong>{tasks.data.counts.critical}</strong> critical</span><span><strong>{tasks.data.counts.overdue}</strong> overdue</span><span><strong>{tasks.data.counts.dueSoon}</strong> due soon</span></div><div className="record-list">{tasks.data.tasks.filter((task) => task.dueState !== "WATCH").slice(0, 4).map((task) => <Link className={`workspace-row hosted-alpha-row ${hostedAlphaTaskTone(task)}`} href={task.href} key={task.id}><span><strong>{task.title}</strong><small>{task.category} · {task.summary}</small></span><span className="pill">{task.priority} · {task.dueState}</span></Link>)}{tasks.data.counts.actionRequired === 0 && <p className="meta">No visible action is currently derived. External evidence gates remain independently controlling.</p>}</div></>}</article>}
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">01</span><h2>Institution readiness</h2></div><Link className="btn" href={`/institutions/${encodeURIComponent(activeInstitutionId!)}`}>Open governance</Link></div><p>Admission, member authority, appointments, connector readiness and evidence gaps.</p><ul className="workspace-list"><li><span>Admission</span><strong>{institution.institution.admission?.status ?? "NOT_STARTED"}</strong></li><li><span>Evidence gaps</span><strong>{institution.evidenceGaps.length}</strong></li><li><span>Connector</span><strong>{institution.connectorReadiness.status}</strong></li></ul></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">02</span><h2>Opportunities & RFQs</h2></div></div><p>Named-audience terms, interests, RFQs, negotiation and allocations. No public order book or automatic matching.</p>{opportunities.status === "UNAVAILABLE" ? <div className="capability-unavailable"><strong>Unavailable</strong><span>{opportunities.reason}</span></div> : <div className="record-list">{opportunities.data.slice(0, 4).map((item) => <Link className="workspace-row" key={item.id} href={`/workspace/opportunities/${encodeURIComponent(item.id)}?caseId=${encodeURIComponent(item.transactionCaseId)}`}><span><strong>{item.opportunityReference}</strong><small>{item.transactionCase.transactionRoute} · {item.transactionCase.representation}</small></span><span className="pill">{item.status}</span></Link>)}{!opportunities.data.length && <p className="meta">No named opportunity is visible.</p>}</div>}</article>
        <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">03</span><h2>Transaction cases</h2></div><Link className="btn" href="/cases">Case register</Link></div><p>Diligence, conditions, approvals, completion, lifecycle, breaks and evidence in one case cockpit.</p>{cases.status === "UNAVAILABLE" ? <div className="capability-unavailable"><strong>Unavailable</strong><span>{cases.reason}</span></div> : <div className="workspace-case-grid">{cases.data.map((item) => <Link className="workspace-case" href={`/workspace/cases/${encodeURIComponent(item.id)}`} key={item.id}><div><strong>{item.caseReference}</strong><small>{item.transactionRoute} · {item.representation} · {item.assetClass}</small></div><div><span className="pill">{item.status}</span><small>{item.operatingMode} · v{item.aggregateVersion}</small></div></Link>)}{!cases.data.length && <p className="meta">No case is visible in this institution context.</p>}</div>}</article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">04</span><h2>Evidence & exports</h2></div><Link className="btn" href={`/institutions/${encodeURIComponent(activeInstitutionId!)}/evidence`}>Evidence vault</Link></div><p>Provider, source, as-of, expiry, verification result and qualifications remain visible on every object.</p></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">05</span><h2>Commercial & service operations</h2></div><Link className="btn" href="/workspace/operations">Open operations</Link></div><p>Accepted contracts, effective rate cards, issued shadow statements, implementation cohorts, service requests, reviews and evidence/data exit.</p><div className="boundary-note">Commercial records never grant route authority or change evidence, ownership, reconciliation or completion state.</div></article>
        <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">06</span><h2>Developer & connector centre</h2></div><Link className="btn" href="/workspace/developer">Open integration workspace</Link></div><p>Versioned contracts, sandbox conformance fixtures, institution-owned clients and webhooks, delivery health, credential history and digest-bound exit export.</p></article>
      </section>
    </>}
  </main></>;
}
