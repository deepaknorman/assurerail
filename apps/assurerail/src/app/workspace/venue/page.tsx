"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { primaryVenueProductEnabled } from "@/lib/customer-workspace";
import { requestTotpStepUp } from "@/lib/institutions";
import { vget, vpost } from "@/lib/venue";

type CaseRow = { id: string; caseReference: string; ownerInstitutionId: string; transactionRoute: string; representation: string; lifecycleLeg: string; assetClass: string; operatingMode: string; status: string };
type Opportunity = { id: string; transactionCaseId: string; ownerInstitutionId: string; opportunityReference: string; status: string; currentTermVersion: number | null; opensAt: string | null; closesAt: string | null; transactionCase: CaseRow; terms: Array<{ currency: string; amountUnits: string; amountScale: number; pricingType: string; pricingValue: string }> };

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 16);

export default function PrimaryVenuePage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [caseId, setCaseId] = useState("");
  const [reference, setReference] = useState("");
  const [opensAt, setOpensAt] = useState(future(1));
  const [closesAt, setClosesAt] = useState(future(30));
  const [totp, setTotp] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef("");
  const enabled = primaryVenueProductEnabled();

  const load = useCallback(async () => {
    if (!enabled || !activeInstitutionId) return;
    try {
      const [caseRows, opportunityRows] = await Promise.all([
        vget<CaseRow[]>("/v1/rail/cases"),
        vget<Opportunity[]>("/v1/rail/commercial/opportunities"),
      ]);
      setCases(caseRows);
      setOpportunities(opportunityRows);
      setCaseId((current) => current || caseRows.find((item) => item.ownerInstitutionId === activeInstitutionId && ["DRAFT", "INTAKE_OPEN"].includes(item.status))?.id || "");
      setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [activeInstitutionId, enabled]);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
    else if (!loading && needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (firebaseUser && activeInstitutionId && enabled) void load(); }, [firebaseUser, activeInstitutionId, enabled, load]);

  const eligibleCases = useMemo(() => cases.filter((item) => item.ownerInstitutionId === activeInstitutionId && item.lifecycleLeg === "INITIAL_TRANSFER_OR_ISSUE" && ["DRAFT", "INTAKE_OPEN", "EVIDENCE_LOCKED", "REVIEW_PENDING", "APPROVED_FOR_EXECUTION"].includes(item.status)), [cases, activeInstitutionId]);
  const visible = useMemo(() => opportunities.filter((item) => filter === "ALL" || item.status === filter), [opportunities, filter]);

  async function createOpportunity() {
    if (!caseId || !reference.trim()) return setError("Select a case and provide an opportunity reference.");
    setBusy(true); setError("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose: "COMMERCIAL_OPPORTUNITY_CREATE", institutionId: activeInstitutionId! });
      key.current ||= `ar26-opportunity:${crypto.randomUUID()}`;
      const created = await vpost<{ id: string }>(`/v1/rail/cases/${encodeURIComponent(caseId)}/commercial/opportunities`, { idempotencyKey: key.current, opportunityReference: reference.trim(), opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString(), stepUpEvidenceId });
      key.current = "";
      router.push(`/workspace/opportunities/${encodeURIComponent(created.id)}?caseId=${encodeURIComponent(caseId)}`);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  return <><VenueHeader/><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href="/workspace">← Institution workspace</Link>
    <div className="console-head"><p className="eyebrow">AR-26 · permissioned primary venue</p><h1>Named opportunities and bilateral RFQs</h1><p>Discover only opportunities addressed to your institution, exchange versioned terms, negotiate privately and bind an accepted allocation to its governed transaction case.</p></div>
    <div className="boundary-note">No public order book, automatic match, trade execution, funds movement, custody or legal completion. Each commercial function remains subject to its assigned performer, route entitlement, conduct controls and external legal approval.</div>
    {!enabled && <div className="msg err">The primary venue product is disabled.</div>}
    {error && <div className="msg err" role="alert">{error}</div>}
    {enabled && <section className="workspace-grid">
      <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">01</span><h2>Visible opportunities</h2></div><select className="field" value={filter} onChange={(event) => setFilter(event.target.value)}><option>ALL</option>{["DRAFT", "PUBLISHED", "PAUSED", "WITHDRAWN", "CLOSED"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="record-list">{visible.map((item) => <Link className="workspace-row" href={`/workspace/opportunities/${encodeURIComponent(item.id)}?caseId=${encodeURIComponent(item.transactionCaseId)}`} key={item.id}><span><strong>{item.opportunityReference}</strong><small>{item.ownerInstitutionId === activeInstitutionId ? "Owner" : "Named counterparty"} · {item.transactionCase.transactionRoute} · {item.transactionCase.assetClass}{item.terms[0] ? ` · ${item.terms[0].currency} ${item.terms[0].amountUnits} @ ${item.terms[0].pricingValue} ${item.terms[0].pricingType}` : " · terms pending"}</small></span><span className="pill">{item.status}</span></Link>)}{visible.length === 0 && <p className="meta">No opportunity in this filter is visible to the active institution.</p>}</div></article>
      <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">02</span><h2>Create an owner opportunity</h2></div></div><p>An opportunity is anchored to an existing primary DA or PTC case. AR-26 never creates a second transaction case during commercial handoff.</p><div className="governance-form"><label className="lbl">Transaction case<select className="field" value={caseId} onChange={(event) => setCaseId(event.target.value)}><option value="">Select case</option>{eligibleCases.map((item) => <option value={item.id} key={item.id}>{item.caseReference} · {item.transactionRoute} · {item.status}</option>)}</select></label><label className="lbl">Opportunity reference<input className="field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. DA-2026-0042-RFQ"/></label><label className="lbl">Opens at<input className="field" type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)}/></label><label className="lbl">Closes at<input className="field" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)}/></label><label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 8))}/></label><button className="btn btn-primary" disabled={busy || totp.length < 6 || !eligibleCases.length} onClick={() => void createOpportunity()}>{busy ? "Creating…" : "Create draft opportunity"}</button></div></article>
      <article className="panel workspace-module"><h2>Activation gates</h2><ul className="workspace-list"><li><span>Function-by-function counsel decision</span><strong>OPEN EXTERNAL</strong></li><li><span>Named performer and participant acceptance</span><strong>OPEN EXTERNAL</strong></li><li><span>Conduct, VAPT and controlled-live acceptance</span><strong>OPEN EXTERNAL</strong></li></ul></article>
    </section>}
  </main></>;
}
