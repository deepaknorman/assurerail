"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { requestTotpStepUp } from "@/lib/institutions";
import { vget, vpost } from "@/lib/venue";

type Room = {
  id: string; purpose: string; status: string; policyVersion: string; legacyRoomId: string | null;
  legacyPoolId: string | null; legacyPurpose: string | null; sourceManifestDigest: string | null;
  legacyImport: null | { status: string; exportDigest: string; parityRuns: Array<{ id: string; result: string; mismatchCount: number; runAt: string }> };
};
type ParityBreak = { id: string; dimension: string; severity: string; status: string; createdAt: string };

const emptyImport = { batchId: "", sourceReferenceId: "", participantMappings: "[]", bundle: "", code: "" };

function parseJson(value: string, name: string): unknown {
  try { return JSON.parse(value); } catch { throw new Error(`${name} must be valid JSON.`); }
}

export default function CaseRoomsPage() {
  const { caseId: rawCaseId } = useParams<{ caseId: string }>();
  const caseId = decodeURIComponent(rawCaseId);
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [breaks, setBreaks] = useState<ParityBreak[]>([]);
  const [form, setForm] = useState(emptyImport);
  const [parity, setParity] = useState<Record<string, { bundle: string; code: string }>>({});
  const [repair, setRepair] = useState<Record<string, { ownerReference: string; evidence: string; code: string }>>({});
  const [source, setSource] = useState<unknown>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [roomRows, openBreaks] = await Promise.all([
        vget<Room[]>(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms`),
        vget<ParityBreak[]>(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms/parity-breaks`),
      ]);
      setRooms(roomRows); setBreaks(openBreaks);
    } catch (cause) { setError((cause as Error).message); }
  }, [caseId]);
  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (!loading && firebaseUser && activeInstitutionId) void load(); }, [loading, firebaseUser, activeInstitutionId, load]);

  async function importRoom() {
    if (!activeInstitutionId) return;
    setBusy("import"); setError(""); setMessage("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: form.code, purpose: "ROOM_LEGACY_IMPORT", institutionId: activeInstitutionId });
      await vpost(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms/legacy-imports`, {
        batchId: form.batchId, sourceReferenceId: form.sourceReferenceId,
        participantMappings: parseJson(form.participantMappings, "Participant mappings"),
        bundle: parseJson(form.bundle, "Legacy export bundle"), stepUpEvidenceId,
      });
      setForm(emptyImport); await load(); setMessage("Legacy room imported as dark evidence. Legacy remains the only write authority.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function runParity(roomId: string) {
    if (!activeInstitutionId) return;
    const values = parity[roomId] ?? { bundle: "", code: "" };
    setBusy(`parity:${roomId}`); setError(""); setMessage("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: values.code, purpose: "ROOM_PARITY_REVIEW", institutionId: activeInstitutionId });
      await vpost(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms/${encodeURIComponent(roomId)}/parity-runs`, {
        currentBundle: parseJson(values.bundle, "Current legacy export bundle"), stepUpEvidenceId,
      });
      await load(); setMessage("Parity result recorded. A mismatch remains a blocking repair item; a match does not switch read or write authority.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function viewSource(roomId: string, view: string) {
    setBusy(`source:${roomId}:${view}`); setError("");
    try { setSource(await vget(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms/${encodeURIComponent(roomId)}/source-views/${view}`)); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function resolveBreak(breakId: string) {
    if (!activeInstitutionId) return;
    const values = repair[breakId] ?? { ownerReference: "", evidence: "{}", code: "" };
    setBusy(`repair:${breakId}`); setError(""); setMessage("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: values.code, purpose: "ROOM_PARITY_REVIEW", institutionId: activeInstitutionId });
      await vpost(`/v1/rail/cases/${encodeURIComponent(caseId)}/rooms/parity-breaks/${encodeURIComponent(breakId)}/resolve`, {
        ownerReference: values.ownerReference, resolutionEvidence: parseJson(values.evidence, "Resolution evidence"), stepUpEvidenceId,
      });
      await load(); setMessage("Independent repair closure recorded. The room remains dark and requires a clean latest parity run before any later cutover decision.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  return <><VenueHeader /><main className="wrap institutional-page">
    <div className="console-head"><h1>Case room migration</h1><p>Compare-only workspace. Imports retain the original chain and remain dark; no new invitation, message, room close or participant read is enabled in PR-07.</p></div>
    <div aria-live="polite">{error && <div className="msg err" role="alert">{error}</div>}{message && <div className="msg ok">{message}</div>}</div>
    <section className="panel"><h2 className="section-title">Imported rooms</h2><div className="record-list">{rooms.map((room) => <article className="record-card" key={room.id}>
      <div className="record-head"><div><strong>{room.legacyRoomId ?? room.id}</strong><p className="meta">{room.purpose} · legacy {room.legacyPurpose ?? "—"} · pool {room.legacyPoolId ?? "—"}</p></div><span className="pill pill-warn">{room.status}</span></div>
      <p className="meta">Import {room.legacyImport?.status ?? "NONE"} · policy {room.policyVersion} · manifest {room.sourceManifestDigest ?? "—"}</p>
      <div className="button-row">{["SUMMARY", "TAPE", "FINDINGS", "DOSSIER_METADATA"].map((view) => <button className="btn" key={view} disabled={!!busy} onClick={() => void viewSource(room.id, view)}>{view}</button>)}</div>
      <details className="governance-form"><summary>Run dual-read parity</summary><label className="lbl">Fresh signed/digested legacy export bundle<textarea className="field" rows={8} value={parity[room.id]?.bundle ?? ""} onChange={(event) => setParity({ ...parity, [room.id]: { bundle: event.target.value, code: parity[room.id]?.code ?? "" } })} /></label><label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" value={parity[room.id]?.code ?? ""} onChange={(event) => setParity({ ...parity, [room.id]: { bundle: parity[room.id]?.bundle ?? "", code: event.target.value } })} /></label><button className="btn btn-primary" disabled={!!busy || !parity[room.id]?.bundle || !parity[room.id]?.code} onClick={() => void runParity(room.id)}>{busy === `parity:${room.id}` ? "Comparing…" : "Record parity run"}</button></details>
    </article>)}{!rooms.length && <p className="meta">No Rail-owned dark import exists for this case.</p>}</div></section>
    {source !== null && <section className="panel"><h2 className="section-title">Least-disclosure source view</h2><pre className="code-block" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(source, null, 2)}</pre></section>}
    <section className="panel"><h2 className="section-title">Open parity repair queue</h2>{breaks.length ? <div className="record-list">{breaks.map((item) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.severity} · {item.dimension}</strong><span className="pill pill-warn">{item.status}</span></div><p className="meta">Opened {new Date(item.createdAt).toLocaleString("en-IN")}</p><details className="governance-form"><summary>Record independent repair closure</summary><label className="lbl">Accountable owner/reference<input className="field" value={repair[item.id]?.ownerReference ?? ""} onChange={(event) => setRepair({ ...repair, [item.id]: { ownerReference: event.target.value, evidence: repair[item.id]?.evidence ?? "{}", code: repair[item.id]?.code ?? "" } })} /></label><label className="lbl">Resolution evidence JSON<textarea className="field" rows={5} value={repair[item.id]?.evidence ?? "{}"} onChange={(event) => setRepair({ ...repair, [item.id]: { ownerReference: repair[item.id]?.ownerReference ?? "", evidence: event.target.value, code: repair[item.id]?.code ?? "" } })} /></label><label className="lbl">Independent checker authenticator code<input className="field governance-code" inputMode="numeric" value={repair[item.id]?.code ?? ""} onChange={(event) => setRepair({ ...repair, [item.id]: { ownerReference: repair[item.id]?.ownerReference ?? "", evidence: repair[item.id]?.evidence ?? "{}", code: event.target.value } })} /></label><button className="btn btn-primary" disabled={!!busy || !repair[item.id]?.ownerReference || !repair[item.id]?.code} onClick={() => void resolveBreak(item.id)}>{busy === `repair:${item.id}` ? "Recording…" : "Resolve with retained evidence"}</button></details></article>)}</div> : <p className="meta">No open parity break is recorded.</p>}</section>
    <section className="panel"><h2 className="section-title">Import a sealed legacy room</h2><p className="tier-note">The export must exclude invitation tokens and include an exact verified access chain. Every transferor/transferee DID needs an explicit one-to-one mapping to an active case party.</p><div className="form-grid"><label className="lbl">Migration batch ID<input className="field" value={form.batchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} /></label><label className="lbl">Case-owned source reference ID<input className="field" value={form.sourceReferenceId} onChange={(event) => setForm({ ...form, sourceReferenceId: event.target.value })} /></label><label className="lbl form-span">Participant mappings JSON<textarea className="field" rows={5} value={form.participantMappings} onChange={(event) => setForm({ ...form, participantMappings: event.target.value })} /></label><label className="lbl form-span">Legacy export bundle JSON<textarea className="field" rows={12} value={form.bundle} onChange={(event) => setForm({ ...form, bundle: event.target.value })} /></label><label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label></div><button className="btn btn-primary" disabled={!!busy || !form.batchId || !form.sourceReferenceId || !form.bundle || !form.code} onClick={() => void importRoom()}>{busy === "import" ? "Importing…" : "Verify and import dark copy"}</button></section>
  </main></>;
}
