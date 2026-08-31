"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vget, vpost } from "@/lib/venue";

type StaffUser = { id: string; email: string; displayName: string | null; status: string };
type Assignment = {
  id: string; role: string; scopeType: string; scopeRef: string | null; status: string; reason: string;
  expiresAt: string | null; proposedByUserId: string; approvedByUserId: string | null;
  user: StaffUser;
};
type Vocabulary = { roles: string[]; permissions: string[]; scopeTypes: string[] };

function defaultExpiry() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

function labelDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN") : "—";
}

async function internalStepUp(code: string, purpose: string): Promise<string> {
  const result = await vpost<{ stepUp?: { id?: string } }>("/venue/auth/mfa/verify/totp", {
    code, purpose, institutionId: null,
  }, { institutionId: null });
  const id = result.stepUp?.id;
  if (!id) throw new Error("A fresh authenticator step-up receipt was not issued.");
  return id;
}

export default function InternalAccessPage() {
  const { loading, firebaseUser, venueUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [totp, setTotp] = useState("");
  const [form, setForm] = useState({ userId: "", role: "", scopeType: "GLOBAL", scopeRef: "", reason: "", evidenceRef: "", expiresAt: defaultExpiry() });
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isSuperadmin = venueUser?.platformRole === "SUPERADMIN";

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [roleAssignments, staff, terms] = await Promise.all([
        vget<Assignment[]>("/v1/rail/admin/internal-access/assignments", { institutionId: null }),
        vget<StaffUser[]>("/venue/admin/users", { institutionId: null }),
        vget<Vocabulary>("/v1/rail/internal-access/vocabulary", { institutionId: null }),
      ]);
      setAssignments(roleAssignments); setUsers(staff); setVocabulary(terms);
      setForm((current) => ({ ...current, userId: current.userId || staff[0]?.id || "", role: current.role || terms.roles[0] || "" }));
    } catch (cause) { setError((cause as Error).message); }
  }, []);

  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); }, [loading, firebaseUser, router]);
  useEffect(() => { if (!loading && isSuperadmin) void refresh(); }, [loading, isSuperadmin, refresh]);

  const active = useMemo(() => assignments.filter((row) => row.status === "ACTIVE"), [assignments]);
  async function run(key: string, work: () => Promise<void>, success: string) {
    setBusy(key); setError(""); setMessage("");
    try { await work(); await refresh(); setMessage(success); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function propose() {
    await run("propose", async () => {
      const stepUpEvidenceId = await internalStepUp(totp, "INTERNAL_ROLE_PROPOSE");
      await vpost("/v1/rail/admin/internal-access/assignments", {
        ...form,
        scopeRef: form.scopeType === "GLOBAL" ? null : form.scopeRef,
        evidenceRef: form.evidenceRef || null,
        expiresAt: new Date(form.expiresAt).toISOString(),
        stepUpEvidenceId,
      }, { institutionId: null });
      setForm((current) => ({ ...current, reason: "", evidenceRef: "", expiresAt: defaultExpiry() }));
    }, "Role proposal recorded for independent review. It grants nothing until approved.");
  }

  async function review(item: Assignment, approve: boolean) {
    await run(`review:${item.id}`, async () => {
      const stepUpEvidenceId = await internalStepUp(totp, "INTERNAL_ROLE_REVIEW");
      await vpost(`/v1/rail/admin/internal-access/assignments/${encodeURIComponent(item.id)}/review`, {
        approve, reason: reviewReason[item.id] || (approve ? "Approved after independent internal-control review" : "Rejected after independent internal-control review"), stepUpEvidenceId,
      }, { institutionId: null });
    }, approve ? "Assignment activated. Its scope and expiry remain enforced." : "Assignment proposal rejected.");
  }

  if (loading) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading internal control plane…</p></main>;
  if (!isSuperadmin) return <><VenueHeader /><main className="wrap institutional-page"><div className="msg err" role="alert">This bootstrap governance workspace is restricted to a legacy superadmin while internal RBAC is in shadow.</div></main></>;

  return <>
    <VenueHeader />
    <main className="wrap institutional-page">
      <div className="console-head"><h1>Internal access control</h1><p>Bootstrap governance workspace for bounded staff assignments. It is separate from participant mandates, case parties, trustee appointments and customer data access.</p></div>
      <div aria-live="polite">{error && <div className="msg err" role="alert">{error}</div>}{message && <div className="msg ok">{message}</div>}</div>
      <section className="ops-grid" aria-label="Internal access counts"><div className="ops-stat"><span className="ops-n">{active.length}</span><span className="ops-l">active assignments</span></div><div className="ops-stat"><span className="ops-n">{assignments.filter((row) => row.status === "PROPOSED").length}</span><span className="ops-l">awaiting review</span></div><div className="ops-stat"><span className="ops-n">{users.length}</span><span className="ops-l">known staff accounts</span></div></section>
      <section className="panel governance-ceremony"><h2 className="section-title">Step-up ceremony</h2><p className="tier-note">Use a fresh six-digit authenticator code for every proposal or review. Internal ceremonies require an identity-bound session with no active participant institution.</p><label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totp} onChange={(event) => setTotp(event.target.value.replace(/[^\d]/g, ""))} /></label></section>
      <section className="panel"><h2 className="section-title">Propose a bounded staff assignment</h2><p className="tier-note">A proposal does not give access. The target cannot review their own assignment, and an active assignment is still bound to role, scope and expiry.</p><div className="form-grid">
        <label className="lbl">Staff account<select className="field" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })}>{users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email} · {user.status}</option>)}</select></label>
        <label className="lbl">Internal role<select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{vocabulary?.roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        <label className="lbl">Scope<select className="field" value={form.scopeType} onChange={(event) => setForm({ ...form, scopeType: event.target.value, scopeRef: event.target.value === "GLOBAL" ? "" : form.scopeRef })}>{vocabulary?.scopeTypes.map((scope) => <option key={scope}>{scope}</option>)}</select></label>
        {form.scopeType !== "GLOBAL" && <label className="lbl">Scope reference<input className="field" value={form.scopeRef} onChange={(event) => setForm({ ...form, scopeRef: event.target.value })} placeholder="e.g. prod-in, ops-india or a ticket ID" /></label>}
        <label className="lbl">Expires at<input className="field" type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
        <label className="lbl">Evidence / ticket reference (optional)<input className="field" value={form.evidenceRef} onChange={(event) => setForm({ ...form, evidenceRef: event.target.value })} /></label>
        <label className="lbl form-span">Reason<input className="field" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
      </div><button className="btn btn-primary" disabled={!!busy || totp.length !== 6 || !form.userId || !form.role || !form.reason || (form.scopeType !== "GLOBAL" && !form.scopeRef)} onClick={() => void propose()}>{busy === "propose" ? "Recording…" : "Record proposal"}</button>
      </section>
      <section className="panel"><h2 className="section-title">Assignment register</h2><div className="record-list">{assignments.map((item) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.user.displayName || item.user.email} · {item.role}</strong><span className={`pill ${item.status === "ACTIVE" ? "pill-ok" : item.status === "PROPOSED" ? "pill-warn" : ""}`}>{item.status}</span></div><p className="meta">{item.scopeType}{item.scopeRef ? ` · ${item.scopeRef}` : ""} · expires {labelDate(item.expiresAt)}</p><p className="meta">{item.reason}</p>{item.status === "PROPOSED" && <><label className="lbl">Independent review reason<input className="field" value={reviewReason[item.id] || ""} onChange={(event) => setReviewReason({ ...reviewReason, [item.id]: event.target.value })} /></label><div className="button-row"><button className="btn btn-primary" disabled={!!busy || totp.length !== 6} onClick={() => void review(item, true)}>Approve</button><button className="btn btn-danger" disabled={!!busy || totp.length !== 6} onClick={() => void review(item, false)}>Reject</button></div></>}</article>)}{assignments.length === 0 && <p className="meta">No internal staff assignments have been recorded.</p>}</div></section>
    </main>
  </>;
}
