"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { type InstitutionWorkspace } from "@/lib/institutions";
import { activeMandateActions, availability, customerWorkspaceEnabled, type Availability } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";

type CaseRow = { id: string; caseReference: string; transactionRoute: string; representation: string; assetClass: string; operatingMode: string; status: string; aggregateVersion: number; updatedAt: string };
type Opportunity = { id: string; transactionCaseId: string; opportunityReference: string; ownerInstitutionId: string; status: string; currentTermVersion: number; closesAt: string | null; transactionCase: { transactionRoute: string; representation: string; assetClass: string; operatingMode: string } };

export default function CustomerWorkspacePage() {
  const router = useRouter();
  const { loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [institution, setInstitution] = useState<InstitutionWorkspace | null>(null);
  const [cases, setCases] = useState<Availability<CaseRow[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [opportunities, setOpportunities] = useState<Availability<Opportunity[]>>({ status: "UNAVAILABLE", reason: "Not loaded" });
  const [error, setError] = useState("");
  const enabled = customerWorkspaceEnabled();

  const load = useCallback(async () => {
    if (!activeInstitutionId) return;
    setError("");
    try {
      const [workspace, caseResult, opportunityResult] = await Promise.all([
        vget<InstitutionWorkspace>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}`),
        Promise.allSettled([vget<CaseRow[]>("/v1/rail/cases")]).then(([result]) => availability(result)),
        Promise.allSettled([vget<Opportunity[]>("/v1/rail/commercial/opportunities")]).then(([result]) => availability(result)),
      ]);
      setInstitution(workspace); setCases(caseResult); setOpportunities(opportunityResult);
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
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">01</span><h2>Institution readiness</h2></div><Link className="btn" href={`/institutions/${encodeURIComponent(activeInstitutionId!)}`}>Open governance</Link></div><p>Admission, member authority, appointments, connector readiness and evidence gaps.</p><ul className="workspace-list"><li><span>Admission</span><strong>{institution.institution.admission?.status ?? "NOT_STARTED"}</strong></li><li><span>Evidence gaps</span><strong>{institution.evidenceGaps.length}</strong></li><li><span>Connector</span><strong>{institution.connectorReadiness.status}</strong></li></ul></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">02</span><h2>Opportunities & RFQs</h2></div></div><p>Named-audience terms, interests, RFQs, negotiation and allocations. No public order book or automatic matching.</p>{opportunities.status === "UNAVAILABLE" ? <div className="capability-unavailable"><strong>Unavailable</strong><span>{opportunities.reason}</span></div> : <div className="record-list">{opportunities.data.slice(0, 4).map((item) => <Link className="workspace-row" key={item.id} href={`/workspace/opportunities/${encodeURIComponent(item.id)}?caseId=${encodeURIComponent(item.transactionCaseId)}`}><span><strong>{item.opportunityReference}</strong><small>{item.transactionCase.transactionRoute} · {item.transactionCase.representation}</small></span><span className="pill">{item.status}</span></Link>)}{!opportunities.data.length && <p className="meta">No named opportunity is visible.</p>}</div>}</article>
        <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">03</span><h2>Transaction cases</h2></div><Link className="btn" href="/cases">Case register</Link></div><p>Diligence, conditions, approvals, completion, lifecycle, breaks and evidence in one case cockpit.</p>{cases.status === "UNAVAILABLE" ? <div className="capability-unavailable"><strong>Unavailable</strong><span>{cases.reason}</span></div> : <div className="workspace-case-grid">{cases.data.map((item) => <Link className="workspace-case" href={`/workspace/cases/${encodeURIComponent(item.id)}`} key={item.id}><div><strong>{item.caseReference}</strong><small>{item.transactionRoute} · {item.representation} · {item.assetClass}</small></div><div><span className="pill">{item.status}</span><small>{item.operatingMode} · v{item.aggregateVersion}</small></div></Link>)}{!cases.data.length && <p className="meta">No case is visible in this institution context.</p>}</div>}</article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">04</span><h2>Evidence & exports</h2></div><Link className="btn" href={`/institutions/${encodeURIComponent(activeInstitutionId!)}/evidence`}>Evidence vault</Link></div><p>Provider, source, as-of, expiry, verification result and qualifications remain visible on every object.</p></article>
        <article className="panel workspace-module"><div className="workspace-module-head"><div><span className="workspace-step">05</span><h2>Support & escalation</h2></div></div><p>Operational requests become durable in PR-20. Until then, use the case break queues and approved service contacts; no untracked support action can change a case.</p><div className="boundary-note">Support visibility and assistance do not permit impersonation, evidence rewriting or bypass of maker-checker.</div></article>
        <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">06</span><h2>Developer & connector centre</h2></div><Link className="btn" href="/workspace/developer">Open integration workspace</Link></div><p>Versioned contracts, sandbox conformance fixtures, institution-owned clients and webhooks, delivery health, credential history and digest-bound exit export.</p></article>
      </section>
    </>}
  </main></>;
}
