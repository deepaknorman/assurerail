"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import {
  readableJson,
  requestTotpStepUp,
  type InstitutionWorkspace,
  type Mandate,
  type StatusChangeProposal,
} from "@/lib/institutions";
import { vget, vpost } from "@/lib/venue";

const initialInvite = { email: "", membershipRole: "MEMBER", expiresAt: "" };
const initialMandate = {
  memberId: "", action: "VIEW_INSTITUTION", scopeType: "INSTITUTION", scopeRef: "",
  delegationBasis: "", authorityEvidenceRef: "", expiresAt: "",
};
const initialAppointment = {
  appointmentRole: "TRUSTEE", appointeeInstitutionId: "", scope: "{}", conflictDisclosure: "{}", expiresAt: "",
};
const initialEntitlement = {
  transactionRoute: "DA", representation: "CONVENTIONAL", assetClass: "TRADE_RECEIVABLE",
  lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE", materialFunction: "TRANSFER_ORCHESTRATION",
  functionPerformer: "PARTICIPANT_OWNED", operatingMode: "SHADOW", routePackRef: "", permissionEvidenceRef: "",
};

function parseObject(value: string, name: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${name} must be valid JSON.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${name} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

function dateLabel(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString("en-IN") : "—";
}

function optionalIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export default function InstitutionWorkspacePage() {
  const params = useParams<{ institutionId: string }>();
  const router = useRouter();
  const institutionId = decodeURIComponent(params.institutionId);
  const { loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId, selectInstitution } = useAuth();
  const [workspace, setWorkspace] = useState<InstitutionWorkspace | null>(null);
  const [totp, setTotp] = useState("");
  const [invite, setInvite] = useState(initialInvite);
  const [mandate, setMandate] = useState(initialMandate);
  const [appointment, setAppointment] = useState(initialAppointment);
  const [entitlement, setEntitlement] = useState(initialEntitlement);
  const [statusChange, setStatusChange] = useState({ targetType: "MEMBER", targetId: "", changeType: "SUSPEND", reason: "" });
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;
  const participantOptions = useMemo(
    () => ({ institutionId: activeInstitutionId === institutionId ? institutionId : null }),
    [activeInstitutionId, institutionId],
  );
  const governanceTargets = useMemo(() => {
    if (!workspace) return [] as { id: string; type: string; label: string }[];
    return [
      ...workspace.institution.members.map((item) => ({ id: item.id, type: "MEMBER", label: `${item.invitedEmail} · ${item.status}` })),
      ...workspace.institution.members.flatMap((member) => (member.mandates ?? []).map((item) => ({ id: item.id, type: "MANDATE", label: `${item.action} · ${member.invitedEmail} · ${item.status}` }))),
      ...workspace.institution.appointments.filter((item) => item.direction !== "INCOMING").map((item) => ({ id: item.id, type: "APPOINTMENT", label: `${item.appointmentRole} · ${item.status}` })),
      ...workspace.institution.routeEntitlements.map((item) => ({ id: item.id, type: "ROUTE_ENTITLEMENT", label: `${item.transactionRoute}/${item.materialFunction} · ${item.status}` })),
    ];
  }, [workspace]);
  const load = useCallback(async () => {
    setError("");
    try {
      setWorkspace(await vget<InstitutionWorkspace>(`/v1/rail/institutions/${encodeURIComponent(institutionId)}`, participantOptions));
    } catch (cause) { setError((cause as Error).message); }
  }, [institutionId, participantOptions]);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (ready) void load(); }, [ready, load]);

  async function act(key: string, purpose: string, path: string, payload: Record<string, unknown>) {
    setBusy(key); setError(""); setMessage("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose, institutionId });
      await vpost(path, { ...payload, stepUpEvidenceId }, { institutionId });
      await load();
      setMessage("Governed action recorded. Its effective status is shown below.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function selectActive() {
    setBusy("select"); setError("");
    try {
      await selectInstitution(institutionId);
      setWorkspace(await vget<InstitutionWorkspace>(`/v1/rail/institutions/${encodeURIComponent(institutionId)}`, { institutionId }));
    }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function reviewMandate(item: Mandate, approve: boolean) {
    await act(`mandate:${item.id}`, "MANDATE_REVIEW", `/v1/rail/institutions/mandates/${encodeURIComponent(item.id)}/review`, {
      approve, reason: reviewReason[item.id] || (approve ? "Approved after institutional review" : "Rejected after institutional review"),
    });
  }

  async function reviewStatus(item: StatusChangeProposal, approve: boolean) {
    const purpose = item.targetType === "MEMBER" ? "MEMBERSHIP_STATUS_CHANGE"
      : item.targetType === "MANDATE" ? "MANDATE_STATUS_CHANGE"
        : item.targetType === "APPOINTMENT" ? "APPOINTMENT_STATUS_CHANGE"
          : item.targetType === "SERVICE_PRINCIPAL" ? "SERVICE_PRINCIPAL_STATUS_CHANGE" : "ROUTE_ENTITLEMENT_STATUS_CHANGE";
    await act(`change:${item.id}`, purpose, `/v1/rail/institutions/status-changes/${encodeURIComponent(item.id)}/review`, {
      approve, reviewNote: reviewReason[item.id] || (approve ? "Approved after institutional review" : "Rejected after institutional review"),
    });
  }

  if (!ready || !workspace) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">{error || "Loading institution workspace…"}</p></main>;
  const inst = workspace.institution;
  const contextActive = activeInstitutionId === institutionId;

  return (
    <>
      <VenueHeader />
      <main className="wrap institutional-page">
        <div className="console-head institution-title-row">
          <div>
            <Link href="/institutions" className="back-link">← Institutions</Link>
            <h1>{inst.legalName}</h1>
            <p>{inst.institutionKind} · {inst.jurisdiction} · access view {workspace.accessLevel}</p>
          </div>
          <div className="button-row">
            <span className={`pill ${inst.status === "ACTIVE" ? "pill-ok" : "pill-warn"}`}>{inst.status}</span>
            {!contextActive && inst.admission?.status === "ADMITTED" && (
              <button className="btn btn-primary" disabled={!!busy} onClick={() => void selectActive()}>{busy === "select" ? "Selecting…" : "Select institution"}</button>
            )}
          </div>
        </div>

        <div aria-live="polite">
          {error && <div className="msg err" role="alert">{error}</div>}
          {message && <div className="msg ok">{message}</div>}
        </div>

        <section className="institution-summary-grid" aria-label="Admission and authority summary">
          <article className="panel"><h2 className="section-title">Participant admission</h2><dl className="institution-facts">
            <div><dt>Status</dt><dd>{inst.admission?.status ?? "NOT_RECORDED"}</dd></div>
            <div><dt>Terms</dt><dd>{inst.admission?.termsVersion ?? "—"}</dd></div>
            <div><dt>Rulebook</dt><dd>{inst.admission?.rulebookVersion ?? "—"}</dd></div>
            <div><dt>Effective</dt><dd>{dateLabel(inst.admission?.effectiveAt)}</dd></div>
            <div><dt>Review due</dt><dd>{dateLabel(inst.admission?.reviewDueAt)}</dd></div>
          </dl></article>
          <article className="panel"><h2 className="section-title">Evidence gaps</h2>
            {workspace.evidenceGaps.length ? <ul className="compact-list">{workspace.evidenceGaps.map((gap) => <li key={gap.code}><strong>{gap.code}</strong><span>{gap.message}</span></li>)}</ul> : <p className="msg ok">No current evidence-policy gap is reported.</p>}
          </article>
          <article className="panel"><h2 className="section-title">Connector readiness</h2>
            <span className="pill pill-warn">{workspace.connectorReadiness.status}</span>
            <p className="tier-note">{workspace.connectorReadiness.message}</p>
            <p className="boundary-note">Connector certification is limited to replay/shadow intake and grants no institutional, route or transaction authority.</p>
            {contextActive && <Link className="btn btn-secondary" href={`/institutions/${encodeURIComponent(institutionId)}/evidence`}>Open connectors and evidence</Link>}
          </article>
        </section>

        <section className="panel" aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className="section-title">Institution evidence</h2>
          <p className="tier-note">Source metadata, as-of date, expiry, signature status, result and qualifications are shown separately. Expected cross-checks are never presented as achieved.</p>
          <div className="record-list">
            {inst.evidenceSnapshots.map((item) => <article className="record-card" key={item.id}>
              <div className="record-head"><strong>{item.evidenceType}</strong><span className={`pill ${item.result === "VERIFIED" ? "pill-ok" : "pill-warn"}`}>{item.result}</span></div>
              <dl className="institution-facts">
                <div><dt>Provider subject</dt><dd>{item.providerInstitutionRef}</dd></div><div><dt>Provider record</dt><dd>{item.providerReferenceId ?? "direct record"}</dd></div>
                <div><dt>Source as of</dt><dd>{dateLabel(item.sourceAsOfAt)}</dd></div><div><dt>Expires</dt><dd>{dateLabel(item.expiresAt)}</dd></div>
                <div><dt>Signature</dt><dd>{item.signatureStatus}</dd></div><div><dt>Independence</dt><dd>{item.independenceClass}</dd></div>
                <div><dt>Expected cross-check</dt><dd>{readableJson(item.crossCheckExpected)}</dd></div><div><dt>Achieved cross-check</dt><dd>{readableJson(item.crossCheckAchieved)}</dd></div>
                <div className="fact-span"><dt>Qualifications</dt><dd>{readableJson(item.qualifications)}</dd></div>
                <div className="fact-span"><dt>Digest</dt><dd className="mono breakable">{item.payloadDigest}</dd></div>
              </dl>
            </article>)}
            {!inst.evidenceSnapshots.length && <p className="meta">No retained evidence snapshot is visible.</p>}
          </div>
        </section>

        {workspace.accessLevel === "GOVERNANCE" && <section className="panel governance-ceremony" aria-labelledby="step-up-heading">
          <h2 id="step-up-heading" className="section-title">Governed action ceremony</h2>
          <p className="tier-note">Every action below consumes a purpose-bound, institution-bound authenticator proof. Makers cannot approve their own proposal.</p>
          <label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value)} /></label>
        </section>}

        <section className="panel" aria-labelledby="members-heading">
          <h2 id="members-heading" className="section-title">Members and mandates</h2>
          <div className="record-list">{inst.members.map((member) => <article className="record-card" key={member.id}>
            <div className="record-head"><strong>{member.invitedEmail}</strong><span className="pill">{member.membershipRole} · {member.status}</span></div>
            <p className="meta mono">{member.id}</p>
            {(member.mandates ?? []).map((item) => <div className="subrecord" key={item.id}>
              <div><strong>{item.action}</strong> · {item.scopeType}{item.scopeRef ? ` / ${item.scopeRef}` : ""} <span className="pill">{item.status}</span></div>
              <p className="meta">Basis: {item.delegationBasis} · Evidence: {item.authorityEvidenceRef}</p>
              {item.status === "PROPOSED" && workspace.capabilities.approveAuthority && item.proposedByUserId !== venueUser.id && <GovernanceReview id={item.id} busy={busy} reason={reviewReason[item.id] ?? ""} setReason={(value) => setReviewReason({ ...reviewReason, [item.id]: value })} onReview={(approve) => void reviewMandate(item, approve)} />}
            </div>)}
          </article>)}</div>
          {workspace.capabilities.administerMembers && <details className="governance-form"><summary>Invite a member</summary><div className="form-grid">
            <label className="lbl">Email<input className="field" type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} /></label>
            <label className="lbl">Role<select className="field" value={invite.membershipRole} onChange={(event) => setInvite({ ...invite, membershipRole: event.target.value })}><option>ADMIN</option><option>MEMBER</option><option>AUDITOR</option><option>INTEGRATION_OPERATOR</option></select></label>
            <label className="lbl">Expires at <span className="opt">optional</span><input className="field" type="datetime-local" value={invite.expiresAt} onChange={(event) => setInvite({ ...invite, expiresAt: event.target.value })} /></label>
          </div><button className="btn btn-primary" disabled={!!busy || !totp || !invite.email} onClick={() => void act("invite", "MEMBER_INVITE", `/v1/rail/institutions/${encodeURIComponent(institutionId)}/members/invitations`, { ...invite, expiresAt: optionalIso(invite.expiresAt) })}>{busy === "invite" ? "Recording…" : "Record invitation"}</button></details>}
          {workspace.capabilities.proposeAuthority && <details className="governance-form"><summary>Propose a mandate</summary><div className="form-grid">
            <label className="lbl">Member<select className="field" value={mandate.memberId} onChange={(event) => setMandate({ ...mandate, memberId: event.target.value })}><option value="">Select…</option>{inst.members.filter((m) => m.status === "ACTIVE").map((m) => <option value={m.id} key={m.id}>{m.invitedEmail}</option>)}</select></label>
            <label className="lbl">Action<select className="field" value={mandate.action} onChange={(event) => setMandate({ ...mandate, action: event.target.value })}>{["VIEW_INSTITUTION","ADMINISTER_MEMBERS","PROPOSE_AUTHORITY","APPROVE_AUTHORITY","MANAGE_APPOINTMENTS","OPERATE_CONNECTORS","VIEW_EVIDENCE","MANAGE_EVIDENCE","VIEW_CASE","OPERATE_CASE","OPERATE_ROUTE"].map((v) => <option key={v}>{v}</option>)}</select></label>
            <label className="lbl">Scope type<input className="field" value={mandate.scopeType} onChange={(event) => setMandate({ ...mandate, scopeType: event.target.value })} /></label>
            <label className="lbl">Scope reference <span className="opt">optional</span><input className="field" value={mandate.scopeRef} onChange={(event) => setMandate({ ...mandate, scopeRef: event.target.value })} /></label>
            <label className="lbl">Delegation basis<input className="field" value={mandate.delegationBasis} onChange={(event) => setMandate({ ...mandate, delegationBasis: event.target.value })} /></label>
            <label className="lbl">Authority evidence reference<input className="field" value={mandate.authorityEvidenceRef} onChange={(event) => setMandate({ ...mandate, authorityEvidenceRef: event.target.value })} /></label>
            <label className="lbl">Expires at <span className="opt">optional</span><input className="field" type="datetime-local" value={mandate.expiresAt} onChange={(event) => setMandate({ ...mandate, expiresAt: event.target.value })} /></label>
          </div><button className="btn btn-primary" disabled={!!busy || !totp || !mandate.memberId || !mandate.delegationBasis || !mandate.authorityEvidenceRef} onClick={() => void act("mandate", "MANDATE_PROPOSE", `/v1/rail/institutions/${encodeURIComponent(institutionId)}/mandates`, { ...mandate, scopeRef: mandate.scopeRef || null, expiresAt: optionalIso(mandate.expiresAt), limits: {}, conditions: {} })}>{busy === "mandate" ? "Recording…" : "Record mandate proposal"}</button></details>}
        </section>

        <section className="panel" aria-labelledby="appointments-heading"><h2 id="appointments-heading" className="section-title">Appointments</h2>
          <div className="record-list">{inst.appointments.map((item) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.appointmentRole}</strong><span className="pill">{item.direction ?? "OUTGOING"} · {item.status}</span></div><p className="meta">Appointing institution: {item.institutionId ?? institutionId} · appointee: {item.appointeeInstitutionId ?? "provider adapter"} · scope {readableJson(item.scope)}</p>{item.direction === "INCOMING" && item.status === "PROPOSED" && item.proposedByUserId !== venueUser.id && <button className="btn btn-primary" disabled={!!busy || !totp} onClick={() => void act(`appointment-accept:${item.id}`, "APPOINTMENT_ACCEPT", `/v1/rail/institutions/appointments/${encodeURIComponent(item.id)}/accept`, {})}>Accept appointment</button>}</article>)}</div>
          {workspace.capabilities.manageAppointments && <details className="governance-form"><summary>Propose an institutional appointment</summary><div className="form-grid">
            <label className="lbl">Appointment role<input className="field" value={appointment.appointmentRole} onChange={(event) => setAppointment({ ...appointment, appointmentRole: event.target.value })} /></label>
            <label className="lbl">Appointee institution ID<input className="field" value={appointment.appointeeInstitutionId} onChange={(event) => setAppointment({ ...appointment, appointeeInstitutionId: event.target.value })} /></label>
            <label className="lbl">Scope JSON<textarea className="field" value={appointment.scope} onChange={(event) => setAppointment({ ...appointment, scope: event.target.value })} /></label>
            <label className="lbl">Conflict disclosure JSON<textarea className="field" value={appointment.conflictDisclosure} onChange={(event) => setAppointment({ ...appointment, conflictDisclosure: event.target.value })} /></label>
            <label className="lbl">Expires at <span className="opt">optional</span><input className="field" type="datetime-local" value={appointment.expiresAt} onChange={(event) => setAppointment({ ...appointment, expiresAt: event.target.value })} /></label>
          </div><button className="btn btn-primary" disabled={!!busy || !totp || !appointment.appointeeInstitutionId} onClick={() => {
            try { void act("appointment", "APPOINTMENT_PROPOSE", `/v1/rail/institutions/${encodeURIComponent(institutionId)}/appointments`, { appointmentRole: appointment.appointmentRole, appointeeInstitutionId: appointment.appointeeInstitutionId, scope: parseObject(appointment.scope, "Scope"), conflictDisclosure: parseObject(appointment.conflictDisclosure, "Conflict disclosure"), expiresAt: optionalIso(appointment.expiresAt) }); }
            catch (cause) { setError((cause as Error).message); }
          }}>{busy === "appointment" ? "Recording…" : "Record appointment proposal"}</button></details>}
        </section>

        <section className="panel" aria-labelledby="routes-heading"><h2 id="routes-heading" className="section-title">Route entitlements</h2><p className="tier-note">PR-04 records only REPLAY or SHADOW proposals. A displayed proposal never implies a live or production permission.</p>
          <div className="record-list">{inst.routeEntitlements.map((item) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.transactionRoute} · {item.representation}</strong><span className="pill">{item.status}</span></div><p className="meta">{item.assetClass} · {item.lifecycleLeg} · {item.materialFunction} · {item.functionPerformer}</p><p className="meta">Modes: {readableJson(item.operatingModes)} · route pack {item.routePackRef}</p></article>)}</div>
          {workspace.capabilities.proposeRouteEntitlement && <details className="governance-form"><summary>Propose replay/shadow route entitlement</summary><div className="form-grid">
            {(["transactionRoute","representation","assetClass","lifecycleLeg","materialFunction","functionPerformer","operatingMode"] as const).map((key) => <label className="lbl" key={key}>{key}<input className="field" value={entitlement[key]} onChange={(event) => setEntitlement({ ...entitlement, [key]: event.target.value })} /></label>)}
            <label className="lbl">Route pack reference<input className="field" value={entitlement.routePackRef} onChange={(event) => setEntitlement({ ...entitlement, routePackRef: event.target.value })} /></label><label className="lbl">Permission evidence reference<input className="field" value={entitlement.permissionEvidenceRef} onChange={(event) => setEntitlement({ ...entitlement, permissionEvidenceRef: event.target.value })} /></label>
          </div><button className="btn btn-primary" disabled={!!busy || !totp || !entitlement.routePackRef || !entitlement.permissionEvidenceRef} onClick={() => void act("entitlement", "ROUTE_ENTITLEMENT_PROPOSE", `/v1/rail/institutions/${encodeURIComponent(institutionId)}/route-entitlements`, { ...entitlement, operatingModes: [entitlement.operatingMode], limits: {}, conditions: {} })}>{busy === "entitlement" ? "Recording…" : "Record entitlement proposal"}</button></details>}
        </section>

        {workspace.accessLevel === "GOVERNANCE" && <section className="panel" aria-labelledby="status-proposal-heading"><h2 id="status-proposal-heading" className="section-title">Suspension, revocation and reinstatement</h2><p className="tier-note">A proposal records the target's current state and reason. A different authorised participant must review it before it can take effect.</p><div className="form-grid"><label className="lbl">Target type<select className="field" value={statusChange.targetType} onChange={(event) => setStatusChange({ ...statusChange, targetType: event.target.value, targetId: "" })}>{["MEMBER","MANDATE","APPOINTMENT","ROUTE_ENTITLEMENT"].map((v) => <option key={v}>{v}</option>)}</select></label><label className="lbl">Target<select className="field" value={statusChange.targetId} onChange={(event) => setStatusChange({ ...statusChange, targetId: event.target.value })}><option value="">Select…</option>{governanceTargets.filter((item) => item.type === statusChange.targetType).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label><label className="lbl">Change<select className="field" value={statusChange.changeType} onChange={(event) => setStatusChange({ ...statusChange, changeType: event.target.value })}>{["SUSPEND","REVOKE","REINSTATE"].map((v) => <option key={v}>{v}</option>)}</select></label><label className="lbl">Reason<input className="field" value={statusChange.reason} onChange={(event) => setStatusChange({ ...statusChange, reason: event.target.value })} /></label></div><button className="btn btn-primary" disabled={!!busy || !totp || !statusChange.targetId || !statusChange.reason} onClick={() => {
          const purpose = statusChange.targetType === "MEMBER" ? "MEMBERSHIP_STATUS_CHANGE" : statusChange.targetType === "MANDATE" ? "MANDATE_STATUS_CHANGE" : statusChange.targetType === "APPOINTMENT" ? "APPOINTMENT_STATUS_CHANGE" : "ROUTE_ENTITLEMENT_STATUS_CHANGE";
          void act("status-propose", purpose, `/v1/rail/institutions/${encodeURIComponent(institutionId)}/status-changes`, statusChange);
        }}>{busy === "status-propose" ? "Recording…" : "Record status-change proposal"}</button></section>}

        {!!inst.changeProposals.length && <section className="panel" aria-labelledby="changes-heading"><h2 id="changes-heading" className="section-title">Pending status-change approvals</h2>{inst.changeProposals.map((item) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.changeType} {item.targetType}</strong><span className="pill">{item.status}</span></div><p className="meta">{item.reason}</p>{item.proposedByUserId !== venueUser.id && <GovernanceReview id={item.id} busy={busy} reason={reviewReason[item.id] ?? ""} setReason={(value) => setReviewReason({ ...reviewReason, [item.id]: value })} onReview={(approve) => void reviewStatus(item, approve)} />}</article>)}</section>}
      </main>
    </>
  );
}

function GovernanceReview(props: { id: string; busy: string; reason: string; setReason: (value: string) => void; onReview: (approve: boolean) => void }) {
  return <div className="review-row"><label className="lbl">Independent review reason<input className="field" value={props.reason} onChange={(event) => props.setReason(event.target.value)} /></label><div className="button-row"><button className="btn btn-primary" disabled={!!props.busy} onClick={() => props.onReview(true)}>Approve</button><button className="btn btn-danger" disabled={!!props.busy} onClick={() => props.onReview(false)}>Reject</button></div></div>;
}
