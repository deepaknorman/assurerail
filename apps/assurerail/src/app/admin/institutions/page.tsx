"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import {
  readableJson,
  requestTotpStepUp,
  type AdminInstitutionWorkspace,
  type AdminQueue,
  type AdmissionDecision,
  type EvidenceSnapshot,
  type RouteEntitlement,
} from "@/lib/institutions";
import { vget, vpost } from "@/lib/venue";

const emptyEvidence = {
  providerReferenceId: "", providerInstitutionRef: "", evidenceType: "KYB",
  schemaId: "assurerail.institution-evidence", schemaVersion: "1.0.0", payloadDigest: "",
  signatureStatus: "VERIFIED", result: "VERIFIED", verificationMethod: "",
  independenceClass: "INDEPENDENT_PROVIDER", crossCheckExpected: "[]", crossCheckAchieved: "{}",
  qualifications: "{}", sourceAsOfAt: "", expiresAt: "",
};
const emptyDecision = { decisionType: "ADMIT", reason: "", riskClass: "", expiresAt: "", reviewDueAt: "" };

function parseJson(value: string, name: string): unknown {
  try { return JSON.parse(value); } catch { throw new Error(`${name} must be valid JSON.`); }
}

function dateLabel(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("en-IN") : "—";
}

export default function InstitutionApprovalsPage() {
  const router = useRouter();
  const { loading, firebaseUser, venueUser } = useAuth();
  const [queue, setQueue] = useState<AdminQueue | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] = useState<AdminInstitutionWorkspace | null>(null);
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [decision, setDecision] = useState(emptyDecision);
  const [totp, setTotp] = useState("");
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = venueUser?.platformRole === "ADMIN" || venueUser?.platformRole === "SUPERADMIN";
  const loadQueue = useCallback(async () => {
    setError("");
    try { setQueue(await vget<AdminQueue>("/v1/rail/admin/institutions", { institutionId: null })); }
    catch (cause) { setError((cause as Error).message); }
  }, []);
  const loadWorkspace = useCallback(async (institutionId: string) => {
    setError("");
    try { setWorkspace(await vget<AdminInstitutionWorkspace>(`/v1/rail/admin/institutions/${encodeURIComponent(institutionId)}`, { institutionId: null })); }
    catch (cause) { setError((cause as Error).message); }
  }, []);

  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); }, [loading, firebaseUser, router]);
  useEffect(() => { if (!loading && isAdmin) void loadQueue(); }, [loading, isAdmin, loadQueue]);
  useEffect(() => { if (selectedId) void loadWorkspace(selectedId); }, [selectedId, loadWorkspace]);

  const pendingDecisions = useMemo(() => workspace?.institution.admission?.decisions?.filter((item) => item.status === "PENDING") ?? [], [workspace]);
  const proposedRoutes = useMemo(() => workspace?.institution.routeEntitlements.filter((item) => item.status === "PROPOSED") ?? [], [workspace]);

  async function refresh() {
    await loadQueue();
    if (selectedId) await loadWorkspace(selectedId);
  }

  async function recordEvidence() {
    if (!selectedId) return;
    setBusy("evidence"); setError(""); setMessage("");
    try {
      await vpost(`/v1/rail/admin/institutions/${encodeURIComponent(selectedId)}/evidence`, {
        ...evidence,
        providerReferenceId: evidence.providerReferenceId || null,
        assertions: {},
        crossCheckExpected: parseJson(evidence.crossCheckExpected, "Expected cross-checks"),
        crossCheckAchieved: parseJson(evidence.crossCheckAchieved, "Achieved cross-checks"),
        qualifications: parseJson(evidence.qualifications, "Qualifications"),
        sourceAsOfAt: new Date(evidence.sourceAsOfAt).toISOString(),
        expiresAt: new Date(evidence.expiresAt).toISOString(),
      }, { institutionId: null });
      setEvidence(emptyEvidence); await refresh();
      setMessage("Immutable evidence metadata recorded. This did not admit the institution.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function governed(key: string, purpose: string, path: string, payload: Record<string, unknown>) {
    if (!selectedId) return;
    setBusy(key); setError(""); setMessage("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose, institutionId: selectedId, withoutInstitutionHeader: true });
      await vpost(path, { ...payload, stepUpEvidenceId }, { institutionId: null });
      await refresh(); setMessage("Independent platform action recorded. The participant status below is authoritative for Rail admission only.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function reviewDecisionItem(item: AdmissionDecision, approve: boolean) {
    await governed(`decision:${item.id}`, "PARTICIPANT_ADMISSION_REVIEW", `/v1/rail/admin/admission-decisions/${encodeURIComponent(item.id)}/review`, {
      approve, reviewNote: reviewNote[item.id] || (approve ? "Approved after independent platform review" : "Rejected after independent platform review"),
    });
  }

  async function reviewRoute(item: RouteEntitlement, approve: boolean) {
    await governed(`route:${item.id}`, "ROUTE_ENTITLEMENT_REVIEW", `/v1/rail/admin/route-entitlements/${encodeURIComponent(item.id)}/review`, {
      approve, reason: reviewNote[item.id] || (approve ? "Approved for the recorded non-live modes" : "Rejected after platform permission review"),
    });
  }

  if (loading) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading approval workspace…</p></main>;
  if (!isAdmin) return <><VenueHeader /><main className="wrap institutional-page"><div className="msg err" role="alert">An active platform administrator is required.</div></main></>;

  return <>
    <VenueHeader />
    <main className="wrap institutional-page">
      <div className="console-head"><h1>Participant approval workspace</h1><p>Platform operators review evidence and proposed Rail permissions. This workspace does not permit support staff to impersonate an institution or act under its mandates.</p></div>
      <div aria-live="polite">{error && <div className="msg err" role="alert">{error}</div>}{message && <div className="msg ok">{message}</div>}</div>
      {queue && <section className="ops-grid" aria-label="Approval queue counts"><div className="ops-stat"><span className="ops-n">{queue.counts.applications}</span><span className="ops-l">Applications</span></div><div className="ops-stat"><span className="ops-n">{queue.counts.admissionReviews}</span><span className="ops-l">Admission reviews</span></div><div className="ops-stat"><span className="ops-n">{queue.counts.routeReviews}</span><span className="ops-l">Route reviews</span></div></section>}
      <div className="institution-admin-layout">
        <aside className="panel" aria-labelledby="queue-heading"><h2 id="queue-heading" className="section-title">Institutions</h2><div className="institution-queue">{queue?.institutions.map((item) => <button key={item.id} className={`queue-item ${selectedId === item.id ? "selected" : ""}`} onClick={() => setSelectedId(item.id)}><strong>{item.legalName}</strong><span>{item.institutionKind} · {item.admission?.status ?? "NO_ADMISSION"}</span><small>{item.admission?.decisions.length ?? 0} admission · {item.routeEntitlements.length} route reviews</small></button>)}</div></aside>
        <div>
          {!workspace && <section className="panel"><p className="meta">Select an institution to inspect its evidence and pending approvals.</p></section>}
          {workspace && <>
            <section className="panel"><div className="record-head"><div><h2 className="section-title">{workspace.institution.legalName}</h2><p className="meta">{workspace.institution.institutionKind} · {workspace.institution.jurisdiction}</p></div><span className="pill">{workspace.institution.admission?.status ?? "NO_ADMISSION"}</span></div>
              <div className="boundary-note"><strong>Operator boundary:</strong> admission review {String(workspace.operatorBoundary.mayReviewAdmission)} · route review {String(workspace.operatorBoundary.mayReviewRouteEntitlement)} · act for institution {String(workspace.operatorBoundary.mayActForInstitution)} · impersonation {String(workspace.operatorBoundary.supportImpersonationAvailable)}</div>
              {workspace.evidenceGaps.length > 0 && <ul className="compact-list">{workspace.evidenceGaps.map((item) => <li key={item.code}><strong>{item.code}</strong><span>{item.message}</span></li>)}</ul>}
            </section>
            <section className="panel governance-ceremony"><h2 className="section-title">Independent review ceremony</h2><label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value)} /></label></section>
            <section className="panel"><h2 className="section-title">Evidence record</h2><p className="tier-note">PR-04 records verified metadata and digest references only. PR-05 adds immutable object intake, malware quarantine and provider connector certification.</p><div className="record-list">{workspace.institution.evidenceSnapshots.map((item: EvidenceSnapshot) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.evidenceType}</strong><span className="pill">{item.result}</span></div><p className="meta">Source as of {dateLabel(item.sourceAsOfAt)} · expires {dateLabel(item.expiresAt)} · signature {item.signatureStatus}</p><p className="meta">Expected {readableJson(item.crossCheckExpected)} · achieved {readableJson(item.crossCheckAchieved)} · qualifications {readableJson(item.qualifications)}</p></article>)}</div>
              <details className="governance-form"><summary>Record immutable evidence metadata</summary><div className="form-grid">
                {(["providerReferenceId","providerInstitutionRef","evidenceType","schemaId","schemaVersion","payloadDigest","verificationMethod","independenceClass"] as const).map((key) => <label className="lbl" key={key}>{key}<input className="field" value={evidence[key]} onChange={(event) => setEvidence({ ...evidence, [key]: event.target.value })} /></label>)}
                <label className="lbl">Signature status<select className="field" value={evidence.signatureStatus} onChange={(event) => setEvidence({ ...evidence, signatureStatus: event.target.value })}>{["VERIFIED","PRESENT_UNVERIFIED","NOT_PROVIDED","INVALID"].map((v) => <option key={v}>{v}</option>)}</select></label><label className="lbl">Result<select className="field" value={evidence.result} onChange={(event) => setEvidence({ ...evidence, result: event.target.value })}>{["VERIFIED","PARTIALLY_VERIFIED","UNVERIFIED","FAILED","EXPIRED","REVIEW_REQUIRED"].map((v) => <option key={v}>{v}</option>)}</select></label>
                <label className="lbl">Source as of<input className="field" type="datetime-local" value={evidence.sourceAsOfAt} onChange={(event) => setEvidence({ ...evidence, sourceAsOfAt: event.target.value })} /></label><label className="lbl">Expires at<input className="field" type="datetime-local" value={evidence.expiresAt} onChange={(event) => setEvidence({ ...evidence, expiresAt: event.target.value })} /></label>
                <label className="lbl">Expected cross-checks JSON<input className="field" value={evidence.crossCheckExpected} onChange={(event) => setEvidence({ ...evidence, crossCheckExpected: event.target.value })} /></label><label className="lbl">Achieved cross-checks JSON<input className="field" value={evidence.crossCheckAchieved} onChange={(event) => setEvidence({ ...evidence, crossCheckAchieved: event.target.value })} /></label><label className="lbl form-span">Qualifications JSON<input className="field" value={evidence.qualifications} onChange={(event) => setEvidence({ ...evidence, qualifications: event.target.value })} /></label>
              </div><button className="btn btn-primary" disabled={!!busy || !evidence.payloadDigest || !evidence.sourceAsOfAt || !evidence.expiresAt} onClick={() => void recordEvidence()}>{busy === "evidence" ? "Recording…" : "Record evidence metadata"}</button></details>
            </section>
            <section className="panel"><h2 className="section-title">Admission decisions</h2>{pendingDecisions.map((item) => <ReviewCard key={item.id} itemId={item.id} title={`${item.decisionType} proposal`} detail={item.reason} note={reviewNote[item.id] ?? ""} setNote={(value) => setReviewNote({ ...reviewNote, [item.id]: value })} disabled={!!busy || !totp} onReview={(approve) => void reviewDecisionItem(item, approve)} />)}{!pendingDecisions.length && <p className="meta">No admission decision awaits review.</p>}
              <details className="governance-form"><summary>Propose admission decision</summary><div className="form-grid"><label className="lbl">Decision<select className="field" value={decision.decisionType} onChange={(event) => setDecision({ ...decision, decisionType: event.target.value })}>{["ADMIT","REJECT","SUSPEND","REVOKE","RECERTIFY","REINSTATE"].map((v) => <option key={v}>{v}</option>)}</select></label><label className="lbl">Reason<input className="field" value={decision.reason} onChange={(event) => setDecision({ ...decision, reason: event.target.value })} /></label><label className="lbl">Risk class<input className="field" value={decision.riskClass} onChange={(event) => setDecision({ ...decision, riskClass: event.target.value })} /></label><label className="lbl">Expires at<input className="field" type="datetime-local" value={decision.expiresAt} onChange={(event) => setDecision({ ...decision, expiresAt: event.target.value })} /></label><label className="lbl">Review due<input className="field" type="datetime-local" value={decision.reviewDueAt} onChange={(event) => setDecision({ ...decision, reviewDueAt: event.target.value })} /></label></div><button className="btn btn-primary" disabled={!!busy || !totp || !decision.reason} onClick={() => void governed("decision-propose", "PARTICIPANT_ADMISSION_PROPOSE", `/v1/rail/admin/institutions/${encodeURIComponent(selectedId)}/admission-decisions`, { ...decision, riskClass: decision.riskClass || null, expiresAt: decision.expiresAt ? new Date(decision.expiresAt).toISOString() : null, reviewDueAt: decision.reviewDueAt ? new Date(decision.reviewDueAt).toISOString() : null, evidenceSnapshotIds: workspace.institution.evidenceSnapshots.map((item) => item.id) })}>{busy === "decision-propose" ? "Recording…" : "Record decision proposal"}</button></details>
            </section>
            <section className="panel"><h2 className="section-title">Route-entitlement reviews</h2><p className="tier-note">Only the proposal's explicit REPLAY/SHADOW modes may be approved in this tranche.</p>{proposedRoutes.map((item) => <ReviewCard key={item.id} itemId={item.id} title={`${item.transactionRoute} · ${item.representation} · ${item.materialFunction}`} detail={`${item.functionPerformer} · ${readableJson(item.operatingModes)}`} note={reviewNote[item.id] ?? ""} setNote={(value) => setReviewNote({ ...reviewNote, [item.id]: value })} disabled={!!busy || !totp} onReview={(approve) => void reviewRoute(item, approve)} />)}{!proposedRoutes.length && <p className="meta">No route entitlement awaits review.</p>}</section>
          </>}
        </div>
      </div>
    </main>
  </>;
}

function ReviewCard(props: { itemId: string; title: string; detail: string; note: string; setNote: (value: string) => void; disabled: boolean; onReview: (approve: boolean) => void }) {
  return <article className="record-card"><div className="record-head"><strong>{props.title}</strong><span className="pill pill-warn">PENDING</span></div><p className="meta">{props.detail}</p><label className="lbl">Independent review note<input className="field" value={props.note} onChange={(event) => props.setNote(event.target.value)} /></label><div className="button-row"><button className="btn btn-primary" disabled={props.disabled} onClick={() => props.onReview(true)}>Approve</button><button className="btn btn-danger" disabled={props.disabled} onClick={() => props.onReview(false)}>Reject</button></div></article>;
}
