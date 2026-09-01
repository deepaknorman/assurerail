"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { customerOperationsEnabled } from "@/lib/customer-workspace";
import { requestTotpStepUp } from "@/lib/institutions";
import { vget, vpost } from "@/lib/venue";

type FeeRule = { id: string; transactionRoute: string; representation: string; lifecycleLeg: string; metric: string; feeBasis: string; rateValue: string; minimumFeeMinor: string | null; maximumFeeMinor: string | null };
type RateCard = { id: string; version: number; status: string; effectiveAt: string; expiresAt: string; feeRules: FeeRule[] };
type Invoice = { id: string; statementRef: string; periodStart: string; periodEnd: string; currency: string; currencyScale: number; grossFeeMinor: string; creditMinor: string; netFeeMinor: string; status: string; statementDigest: string };
type Contract = { id: string; contractRef: string; version: number; status: string; currency: string; currencyScale: number; effectiveAt: string; expiresAt: string; renewalReviewAt: string; termsDigest: string; rateCards: RateCard[]; invoiceStatements: Invoice[] };
type Cohort = { id: string; cohortRef: string; operatingMode: string; status: string; startsAt: string; endsAt: string; routes: unknown; gateRefs: unknown };
type Message = { id: string; authorType: string; body: string; createdAt: string };
type ServiceRequest = { id: string; requestRef: string; transactionCaseId: string | null; requestType: string; priority: string; subject: string; description: string; status: string; slaDueAt: string; escalationLevel: number; messages: Message[] };
type Review = { id: string; periodStart: string; periodEnd: string; serviceMetrics: unknown; openItems: unknown; status: string };
type Overview = { institutionId: string; pricingChangesAuthority: false; transactionAuthorityAffected: false; contracts: Contract[]; cohorts: Cohort[]; serviceRequests: ServiceRequest[]; operationalReviews: Review[]; exitExports: Array<{ id: string; highWaterAt: string; manifestDigest: string }> };

const dateLabel = (value: string) => new Date(value).toLocaleString("en-IN");
function money(minor: string, scale: number, currency: string): string {
  const padded = minor.padStart(scale + 1, "0");
  const whole = scale ? padded.slice(0, -scale) : padded;
  const fraction = scale ? `.${padded.slice(-scale)}` : "";
  return `${currency} ${BigInt(whole).toLocaleString("en-IN")}${fraction}`;
}
function rateLabel(rule: FeeRule): string {
  if (rule.feeBasis === "NOTIONAL_BASIS_POINTS") return `${rule.rateValue} bps (${(Number(rule.rateValue) / 100).toFixed(2)}%) of notional`;
  if (rule.feeBasis === "FIXED_MINOR") return `${rule.rateValue} minor units fixed`;
  return `${rule.rateValue} minor units per unit`;
}

export default function CustomerOperationsPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [totp, setTotp] = useState("");
  const [request, setRequest] = useState({ requestRef: "", requestType: "GENERAL_OPERATIONS", priority: "NORMAL", transactionCaseId: "", subject: "", description: "" });
  const enabled = customerOperationsEnabled();
  const root = activeInstitutionId ? `/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/customer-operations` : "";

  const load = useCallback(async () => {
    if (!activeInstitutionId || !enabled) return;
    try { setOverview(await vget<Overview>(`${root}/overview`)); setError(""); }
    catch (cause) { setOverview(null); setError((cause as Error).message); }
  }, [activeInstitutionId, enabled, root]);

  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); else if (!loading && needsOnboarding) router.replace("/onboard"); }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (firebaseUser && activeInstitutionId && enabled) void load(); }, [firebaseUser, activeInstitutionId, enabled, load]);

  async function governed(key: string, purpose: string, path: string, body: Record<string, unknown>) {
    if (!activeInstitutionId) return;
    setBusy(key); setError(""); setNotice("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose, institutionId: activeInstitutionId });
      await vpost(path, { ...body, stepUpEvidenceId });
      setNotice("The governed shadow record was saved. No transaction authority, legal record or completion state changed.");
      await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function exportData() {
    if (!activeInstitutionId) return;
    setBusy("export"); setError(""); setNotice("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose: "CUSTOMER_EXIT_EXPORT", institutionId: activeInstitutionId });
      const result = await vpost<unknown>(`${root}/exit-exports`, { stepUpEvidenceId });
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `assurerail-customer-exit-${activeInstitutionId}.json`; anchor.click(); URL.revokeObjectURL(url);
      setNotice("A digest-bound customer exit package was generated. Secrets and document bytes are excluded."); await load();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  return <><VenueHeader/><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href="/workspace">← Institution workspace</Link>
    <div className="console-head"><p className="eyebrow">Customer operations · shadow</p><h1>Commercial & service operations</h1><p>Accepted commercial terms, exact metering, issued statements, implementation cohorts, service escalation, operational reviews and customer-controlled exit.</p></div>
    <div className="boundary-note">Pricing and customer-service records are operational metadata only. They cannot grant route permission, alter evidence truth, establish ownership, close a reconciliation break or complete a transaction.</div>
    {!enabled && <div className="msg err" role="alert">Customer operations are disabled in this build. The backend and UI flags must both be explicitly set to shadow.</div>}
    {!activeInstitutionId && <div className="msg err">Select an admitted institution before opening customer operations.</div>}
    {error && <div className="msg err" role="alert">{error}</div>}{notice && <div className="msg ok">{notice}</div>}
    {enabled && overview && <>
      <section className="workspace-hero"><div><span className="workspace-label">Contracts</span><strong>{overview.contracts.length}</strong><small>Versioned and effective-dated</small></div><div><span className="workspace-label">Cohorts</span><strong>{overview.cohorts.length}</strong><small>Replay/shadow only</small></div><div><span className="workspace-label">Service requests</span><strong>{overview.serviceRequests.filter((item) => item.status !== "CLOSED").length}</strong><small>Open or active</small></div><div><span className="workspace-label">Transaction authority</span><strong>None</strong><small>Commercial boundary enforced</small></div></section>
      <section className="panel"><h2 className="section-title">Governed customer action</h2><label className="lbl">Authenticator code<input className="field" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 8))}/></label><p className="meta">Every mutation consumes single-use, purpose-bound step-up evidence. The API also checks active membership and the exact mandate.</p></section>
      <section className="workspace-grid">
        <article className="panel workspace-module workspace-wide"><h2>Contracts, pricing & statements</h2>{overview.contracts.map((contract) => <div className="record-card" key={contract.id}><div className="record-head"><strong>{contract.contractRef} · v{contract.version}</strong><span className="pill">{contract.status}</span></div><p className="meta">{contract.currency} · scale {contract.currencyScale} · {dateLabel(contract.effectiveAt)} to {dateLabel(contract.expiresAt)} · review by {dateLabel(contract.renewalReviewAt)}</p><p className="meta">Terms digest {contract.termsDigest}</p>{contract.status === "APPROVED_PENDING_CUSTOMER" && <button className="btn btn-primary" disabled={!!busy || totp.length < 6} onClick={() => void governed(`accept-${contract.id}`, "CUSTOMER_CONTRACT_ACKNOWLEDGE", `${root}/contracts/${encodeURIComponent(contract.id)}/acknowledge`, {})}>{busy === `accept-${contract.id}` ? "Accepting…" : "Accept approved terms"}</button>}<div className="workspace-list">{contract.rateCards.flatMap((card) => card.feeRules.map((rule) => <div className="workspace-row" key={rule.id}><span><strong>{rule.transactionRoute} · {rule.representation}</strong><small>{rule.lifecycleLeg} · {rule.metric} · rate card v{card.version}</small></span><span className="pill">{rateLabel(rule)}</span></div>))}{contract.invoiceStatements.map((invoice) => <div className="workspace-row" key={invoice.id}><span><strong>{invoice.statementRef}</strong><small>{dateLabel(invoice.periodStart)} to {dateLabel(invoice.periodEnd)} · {invoice.statementDigest}</small></span><span><strong>{money(invoice.netFeeMinor, invoice.currencyScale, invoice.currency)}</strong><small>{invoice.status} · gross {money(invoice.grossFeeMinor, invoice.currencyScale, invoice.currency)} · credit {money(invoice.creditMinor, invoice.currencyScale, invoice.currency)}</small></span></div>)}</div></div>)}{!overview.contracts.length && <p className="meta">No contract is visible. Absence is not acceptance.</p>}</article>
        <article className="panel workspace-module"><h2>Implementation cohorts</h2>{overview.cohorts.map((item) => <div className="workspace-row" key={item.id}><span><strong>{item.cohortRef}</strong><small>{dateLabel(item.startsAt)} to {dateLabel(item.endsAt)} · gates retained</small></span><span className="pill">{item.operatingMode} · {item.status}</span></div>)}{!overview.cohorts.length && <p className="meta">No cohort is scheduled.</p>}</article>
        <article className="panel workspace-module"><h2>Operational reviews</h2>{overview.operationalReviews.map((item) => <div className="workspace-row" key={item.id}><span><strong>{dateLabel(item.periodStart)} – {dateLabel(item.periodEnd)}</strong><small>{JSON.stringify(item.openItems)}</small></span><span className="pill">{item.status}</span></div>)}{!overview.operationalReviews.length && <p className="meta">No review has been recorded.</p>}</article>
        <article className="panel workspace-module workspace-wide"><h2>Service requests & escalation</h2><div className="form-grid"><label className="lbl">Request reference<input className="field" value={request.requestRef} onChange={(event) => setRequest({ ...request, requestRef: event.target.value })}/></label><label className="lbl">Type<input className="field" value={request.requestType} onChange={(event) => setRequest({ ...request, requestType: event.target.value })}/></label><label className="lbl">Priority<select className="field" value={request.priority} onChange={(event) => setRequest({ ...request, priority: event.target.value })}>{["LOW","NORMAL","HIGH","CRITICAL"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="lbl">Case ID (optional)<input className="field" value={request.transactionCaseId} onChange={(event) => setRequest({ ...request, transactionCaseId: event.target.value })}/></label><label className="lbl">Subject<input className="field" value={request.subject} onChange={(event) => setRequest({ ...request, subject: event.target.value })}/></label><label className="lbl">Description<textarea className="field" value={request.description} onChange={(event) => setRequest({ ...request, description: event.target.value })}/></label></div><button className="btn btn-primary" disabled={!!busy || totp.length < 6 || !request.requestRef || !request.subject || !request.description} onClick={() => void governed("request", "CUSTOMER_SERVICE_REQUEST_CREATE", `${root}/service-requests`, { ...request, transactionCaseId: request.transactionCaseId || null, evidenceRefs: [] })}>{busy === "request" ? "Submitting…" : "Create governed request"}</button><div className="record-list">{overview.serviceRequests.map((item) => <div className="record-card" key={item.id}><div className="record-head"><strong>{item.requestRef} · {item.subject}</strong><span className="pill">{item.priority} · {item.status}</span></div><p>{item.description}</p><p className="meta">SLA due {dateLabel(item.slaDueAt)} · escalation level {item.escalationLevel}{item.transactionCaseId ? ` · case ${item.transactionCaseId}` : ""}</p>{item.messages.map((message) => <p className="meta" key={message.id}>{message.authorType} · {dateLabel(message.createdAt)} · {message.body}</p>)}</div>)}</div></article>
        <article className="panel workspace-module workspace-wide"><h2>Customer evidence & data exit</h2><p>Generate a high-water-marked, digest-bound inventory of the customer relationship and transaction/evidence records visible to this institution. Revoked or expired evidence grants are excluded; document bytes remain available only through receipt-logged downloads; secrets are never exported.</p><button className="btn" disabled={!!busy || totp.length < 6} onClick={() => void exportData()}>{busy === "export" ? "Generating…" : "Generate exit package"}</button><p className="meta">Prior packages: {overview.exitExports.length}</p></article>
      </section>
    </>}
  </main></>;
}
