"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { daProductEnabled } from "@/lib/customer-workspace";
import { requestTotpStepUp } from "@/lib/institutions";
import { vdownload, vget, vpost } from "@/lib/venue";

type Stage = { code: string; state: string; summary: string };
type Evidence = { id: string; institutionId: string; evidenceType: string; status: string; versions: Array<{ payloadDigest: string; result: string; validationStatus: string; signatureStatus: string }> };
type Observation = { id: string; version: number; externalReference: string; finalityClass: string; signatureStatus: string; observedAt: string; comparisonResult: string };
type Leg = { id: string; legKey: string; legType: string; sequence: number; required: boolean; participantOwnerInstitutionId: string; performerClass: string; expectedDigest: string; state: string; observations: Observation[] };
type Saga = { id: string; sagaVersion: number; state: string; executionMode: "OBSERVE_ONLY"; legalMechanism: string; considerationCurrency: string; considerationMinorUnits: string; considerationScale: number; historicOutcomeRef: string; planDigest: string; legs: Leg[] };
type Repair = { id: string; status: string; actionType: string; reason: string; proposedByUserId: string; reviewedByUserId: string | null };
type BreakItem = { id: string; settlementSagaId: string; settlementLegId: string | null; breakCode: string; severity: string; status: string; ownerInstitutionId: string; dueAt: string; repairActions: Repair[] };
type Overview = {
  operatingBoundary: "OBSERVE_ONLY"; authorityNotice: string;
  case: { id: string; caseReference: string; ownerInstitutionId: string; status: string; routeState: string; aggregateVersion: number; operatingMode: string; parties: Array<{ institutionId: string; partyRole: string; status: string }>; functionAssignments: Array<{ materialFunction: string; performer: string; performerInstitutionId: string | null; status: string }>; conditions: Array<{ id: string; code: string; status: string }>; decisions: Array<{ id: string; decisionType: string; status: string }> };
  capabilities: { canOperateCase: boolean; canOperateRoute: boolean; canViewEvidence: boolean; canViewRooms: boolean; canGovernReplay: boolean };
  stages: Stage[]; openExternalGates: Array<{ code: string; owner: string; state: string }>;
  authorisation: null | { id: string; status: string; authorityEvidenceRef: string; reason: string; proposedByUserId: string; reviewedByUserId: string | null; reviewReason: string | null };
  evidence: { availability: "AVAILABLE" | "UNAVAILABLE"; items: Evidence[] };
  rooms: { availability: "AVAILABLE" | "UNAVAILABLE"; items: Array<{ id: string; purpose: string; status: string; policyVersion: string }> };
  sources: { availability: "AVAILABLE" | "UNAVAILABLE"; items: Array<{ id: string; sourceSystem: string; sourceObjectType: string; sourceObjectId: string; sourceVersion: string; authoritativeStatus: string }> };
  sagas: Saga[]; breaks: BreakItem[];
};

const EMPTY_PLAN = JSON.stringify({
  legalMechanism: "",
  consideration: { currency: "INR", units: "", scale: 2 },
  transfereeCreditDecisionEvidenceObjectId: "",
  executedTransferDocumentEvidenceObjectId: "",
  historicOutcomeEvidenceObjectId: "",
  historicOutcomeRef: "",
  historicOutcomeDigest: "",
  expectedOutcome: { transferredAssetDigest: "", considerationReference: "", transferorSourceAfterDigest: "", transfereeSourceAfterDigest: "", authoritativeRecordAfterDigest: "" },
  authoritativeRecord: { recordType: "", recordkeeperInstitutionId: "", sourceReferenceId: null, declarationEvidenceRef: "", declarationEvidenceDigest: "", declarationEvidenceObjectId: "", beforeSnapshot: { recordReference: "", payloadDigest: "", sourceAsOfAt: "", evidenceObjectId: "" } },
  notices: [],
  reason: "Historic DA completion plan assembled from retained evidence",
}, null, 2);

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

export default function ConventionalDaJourneyPage() {
  const { caseId: raw } = useParams<{ caseId: string }>(); const caseId = decodeURIComponent(raw);
  const router = useRouter(); const { loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [data, setData] = useState<Overview | null>(null); const [totp, setTotp] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState("");
  const [authorityRef, setAuthorityRef] = useState(""); const [plan, setPlan] = useState(EMPTY_PLAN);
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({});
  const [observationEvidence, setObservationEvidence] = useState<Record<string, string>>({});
  const [observationRefs, setObservationRefs] = useState<Record<string, string>>({});
  const [repairDrafts, setRepairDrafts] = useState<Record<string, string>>({});
  const [repairEvidence, setRepairEvidence] = useState<Record<string, string>>({});
  const keys = useRef<Record<string, string>>({});
  const root = `/v1/rail/cases/${encodeURIComponent(caseId)}/da-replay`;
  const enabled = daProductEnabled();
  const load = useCallback(async () => {
    if (!activeInstitutionId || !enabled) return;
    try { setData(await vget<Overview>(`${root}/product-overview`)); setError(""); }
    catch (cause) { setError((cause as Error).message); }
  }, [activeInstitutionId, enabled, root]);
  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); else if (!loading && needsOnboarding) router.replace("/onboard"); }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (firebaseUser && activeInstitutionId && enabled) void load(); }, [firebaseUser, activeInstitutionId, enabled, load]);

  function keyFor(scope: string) { return keys.current[scope] ??= `${scope}:${crypto.randomUUID()}`; }
  async function governed(scope: string, purpose: string, path: string, body: Record<string, unknown>) {
    if (!activeInstitutionId) return;
    setBusy(scope); setError(""); setNotice("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose, institutionId: activeInstitutionId });
      await vpost(path, { ...body, idempotencyKey: keyFor(scope), stepUpEvidenceId });
      delete keys.current[scope];
      setNotice("Governed DA replay record saved. No funds, title, notice or register action was dispatched.");
      await load();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(""); }
  }
  async function proposeAuthorisation() {
    await governed("authorisation-propose", "DA_REPLAY_AUTHORISATION_PROPOSE", `${root}/authorisation`, { authorityEvidenceRef: authorityRef, reason: "Authorise an observe-only historic/shadow DA replay" });
  }
  async function reviewAuthorisation(approve: boolean) {
    if (!data?.authorisation) return;
    await governed("authorisation-review", "DA_REPLAY_AUTHORISATION_REVIEW", `${root}/authorisation/${encodeURIComponent(data.authorisation.id)}/review`, { approve, reason: approve ? "Independently approved for observe-only replay" : "Replay authorisation rejected" });
  }
  async function createSaga() {
    try { await governed("saga-create", "DA_REPLAY_SAGA_CREATE", `${root}/sagas`, { ...parseObject(plan, "Completion plan"), expectedCaseAggregateVersion: data?.case.aggregateVersion }); }
    catch (cause) { setError((cause as Error).message); }
  }
  async function recordObservation(saga: Saga, leg: Leg) {
    try {
      const observed = parseObject(observationDrafts[leg.id] ?? "{}", "Observed fact");
      await governed(`observe:${leg.id}`, "DA_REPLAY_OBSERVATION_RECORD", `${root}/sagas/${encodeURIComponent(saga.id)}/legs/${encodeURIComponent(leg.id)}/observations`, { observed, externalReference: observationRefs[leg.id], finalityClass: "FINAL", signatureStatus: "VERIFIED", evidenceObjectId: observationEvidence[leg.id], observedAt: new Date().toISOString(), reason: "Partner-performed DA leg observed from retained evidence" });
    } catch (cause) { setError((cause as Error).message); }
  }
  async function reconcile(saga: Saga, leg: Leg) {
    await governed(`reconcile:${leg.id}`, "DA_REPLAY_LEG_RECONCILE", `${root}/sagas/${encodeURIComponent(saga.id)}/legs/${encodeURIComponent(leg.id)}/reconcile`, { reason: "Current final signed observation independently reconciled to the retained expectation" });
  }
  async function proposeRepair(item: BreakItem) {
    try {
      const replacementObservation = parseObject(repairDrafts[item.id] ?? "{}", "Replacement observation");
      await governed(`repair:${item.id}`, "DA_REPLAY_REPAIR_PROPOSE", `${root}/breaks/${encodeURIComponent(item.id)}/repairs`, { replacementObservation, authorityEvidenceRef: repairEvidence[item.id], reason: "Append corrected external observation without rewriting history" });
    } catch (cause) { setError((cause as Error).message); }
  }
  async function reviewRepair(item: BreakItem, repair: Repair, approve: boolean) {
    await governed(`repair-review:${repair.id}`, "DA_REPLAY_REPAIR_REVIEW", `${root}/breaks/${encodeURIComponent(item.id)}/repairs/${encodeURIComponent(repair.id)}/review`, { approve, reason: approve ? "Corrected evidence independently matched" : "Repair evidence rejected" });
  }
  async function evidencePack(saga: Saga) {
    setBusy(`pack:${saga.id}`); setError("");
    try {
      const result = await vget<unknown>(`${root}/sagas/${encodeURIComponent(saga.id)}/evidence-pack`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `assurerail-da-${caseId}-evidence-pack.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(""); }
  }

  return <><VenueHeader/><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href={`/workspace/cases/${encodeURIComponent(caseId)}`}>← Case cockpit</Link>
    <div className="console-head"><p className="eyebrow">Conventional DA · {data?.case.operatingMode ?? "shadow"}</p><h1>{data?.case.caseReference ?? "DA transaction journey"}</h1><p>Intake, diligence, participant decisions, documents, partner-executed completion, reconciliation and dossier.</p></div>
    <div className="boundary-note">{data?.authorityNotice ?? "This journey is observe-only. It cannot move funds, title, notices or an authoritative register."}</div>
    {!enabled && <div className="msg err">The conventional DA product journey is disabled.</div>}{error && <div className="msg err" role="alert">{error}</div>}{notice && <div className="msg ok" aria-live="polite">{notice}</div>}
    {data && <>
      <section className="onboarding-stage-grid" aria-label="Conventional DA journey">{data.stages.map((stage, index) => <article className="onboarding-stage" key={stage.code}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{stage.code.replaceAll("_", " ")}</strong><p>{stage.summary}</p></div><em className="pill">{stage.state}</em></article>)}</section>
      <section className="panel governance-ceremony"><h2 className="section-title">Governed action ceremony</h2><label className="lbl">Authenticator code<input className="field governance-code" inputMode="numeric" autoComplete="one-time-code" value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 8))}/></label><p className="meta">Every mutation consumes a purpose-bound step-up. Idempotency keys remain stable across an ambiguous retry.</p></section>
      <section className="workspace-grid">
        <article className="panel workspace-module"><h2>External gates</h2><div className="workspace-list">{data.openExternalGates.map((gate) => <div className="workspace-row" key={gate.code}><span><strong>{gate.code.replaceAll("_", " ")}</strong><small>Owner: {gate.owner}</small></span><span className="pill">{gate.state}</span></div>)}</div></article>
        <article className="panel workspace-module"><h2>Parties & functions</h2><div className="workspace-list">{data.case.parties.map((party) => <div className="workspace-row" key={`${party.partyRole}:${party.institutionId}`}><span><strong>{party.partyRole}</strong><small>{party.institutionId}</small></span><span className="pill">{party.status}</span></div>)}{data.case.functionAssignments.map((fn) => <div className="workspace-row" key={fn.materialFunction}><span><strong>{fn.materialFunction}</strong><small>{fn.performer} · {fn.performerInstitutionId ?? "no performer"}</small></span><span className="pill">{fn.status}</span></div>)}</div></article>
        <article className="panel workspace-module"><h2>Intake & diligence</h2><p>{data.sources.items.length} visible source reference(s) · {data.evidence.items.length} visible evidence object(s) · {data.rooms.items.length} visible room(s).</p><div className="button-row"><Link className="btn" href={`/institutions/${encodeURIComponent(activeInstitutionId!)}/evidence`}>Evidence register</Link><Link className="btn" href={`/cases/${encodeURIComponent(caseId)}/rooms`}>Diligence rooms</Link></div>{data.evidence.availability === "UNAVAILABLE" && <div className="capability-unavailable"><strong>Evidence unavailable</strong><span>VIEW_EVIDENCE authority is required; unavailable is not zero.</span></div>}</article>
        <article className="panel workspace-module"><h2>Replay authorisation</h2>{data.authorisation ? <div className="record-card"><div className="record-head"><strong>{data.authorisation.authorityEvidenceRef}</strong><span className="pill">{data.authorisation.status}</span></div><p className="meta">{data.authorisation.reason}</p>{data.authorisation.status === "PROPOSED" && data.authorisation.proposedByUserId !== venueUser?.id && data.capabilities.canGovernReplay && <div className="button-row"><button className="btn btn-primary" disabled={!!busy || totp.length < 6} onClick={() => void reviewAuthorisation(true)}>Approve replay</button><button className="btn btn-danger" disabled={!!busy || totp.length < 6} onClick={() => void reviewAuthorisation(false)}>Reject</button></div>}</div> : data.capabilities.canGovernReplay && <div className="governance-form"><label className="lbl">Authority evidence reference<input className="field" value={authorityRef} onChange={(event) => setAuthorityRef(event.target.value)}/></label><button className="btn btn-primary" disabled={!!busy || totp.length < 6 || !authorityRef.trim()} onClick={() => void proposeAuthorisation()}>Propose observe-only replay</button></div>}</article>
        <article className="panel workspace-module workspace-wide"><h2>Immutable completion plan</h2><p>Use retained, real historic or shadow evidence identifiers and digests. Do not copy an expected value into an observation or use a fixture to close an external gate.</p><textarea className="field mono-json" rows={20} value={plan} onChange={(event) => setPlan(event.target.value)}/><button className="btn btn-primary" disabled={!!busy || totp.length < 6 || data.authorisation?.status !== "APPROVED" || !data.capabilities.canGovernReplay} onClick={() => void createSaga()}>Create observe-only completion plan</button></article>
        {data.sagas.map((saga) => <article className="panel workspace-module workspace-wide" key={saga.id}><div className="workspace-module-head"><div><h2>Completion saga v{saga.sagaVersion}</h2><p>{saga.executionMode} · {saga.state} · {saga.considerationCurrency} {saga.considerationMinorUnits} at scale {saga.considerationScale}</p></div><div className="button-row"><button className="btn" disabled={!!busy} onClick={() => void vdownload(`${root}/sagas/${encodeURIComponent(saga.id)}/comparison.csv`, `assurerail-da-${caseId}-comparison.csv`)}>Comparison CSV</button><button className="btn" disabled={!!busy} onClick={() => void evidencePack(saga)}>Evidence pack</button></div></div><div className="record-list">{saga.legs.map((leg) => <div className="record-card" key={leg.id}><div className="record-head"><strong>{leg.sequence}. {leg.legType.replaceAll("_", " ")}</strong><span className="pill">{leg.state}</span></div><p className="meta">Owner {leg.participantOwnerInstitutionId} · {leg.performerClass} · expected digest {leg.expectedDigest}</p>{leg.observations.map((obs) => <p className="meta" key={obs.id}>Observation v{obs.version}: {obs.comparisonResult} · {obs.externalReference} · {obs.finalityClass}/{obs.signatureStatus}</p>)}{leg.state === "PLANNED" && leg.participantOwnerInstitutionId === activeInstitutionId && data.capabilities.canOperateRoute && <details className="governance-form"><summary>Record partner observation</summary><label className="lbl">Observed fact JSON<textarea className="field mono-json" rows={6} value={observationDrafts[leg.id] ?? "{}"} onChange={(event) => setObservationDrafts({ ...observationDrafts, [leg.id]: event.target.value })}/></label><label className="lbl">External reference<input className="field" value={observationRefs[leg.id] ?? ""} onChange={(event) => setObservationRefs({ ...observationRefs, [leg.id]: event.target.value })}/></label><label className="lbl">Evidence object ID<input className="field" value={observationEvidence[leg.id] ?? ""} onChange={(event) => setObservationEvidence({ ...observationEvidence, [leg.id]: event.target.value })}/></label><button className="btn btn-primary" disabled={!!busy || totp.length < 6} onClick={() => void recordObservation(saga, leg)}>Record actual observation</button></details>}{leg.state === "OBSERVED" && leg.participantOwnerInstitutionId === activeInstitutionId && data.capabilities.canOperateRoute && <button className="btn btn-primary" disabled={!!busy || totp.length < 6 || leg.observations.at(-1)?.comparisonResult !== "MATCHED"} onClick={() => void reconcile(saga, leg)}>Independently reconcile matched observation</button>}</div>)}</div></article>)}
        {!!data.breaks.length && <article className="panel workspace-module workspace-wide"><h2>Break repair queue</h2><p>Repairs append corrected evidence; they never rewrite the original observation.</p>{data.breaks.map((item) => <div className="record-card" key={item.id}><div className="record-head"><strong>{item.breakCode}</strong><span className="pill pill-warn">{item.severity} · {item.status}</span></div><p className="meta">Owner {item.ownerInstitutionId} · due {new Date(item.dueAt).toLocaleString("en-IN")}</p>{item.repairActions.map((repair) => <div className="workspace-row" key={repair.id}><span><strong>{repair.actionType}</strong><small>{repair.reason}</small></span><span><span className="pill">{repair.status}</span>{repair.status === "PROPOSED" && repair.proposedByUserId !== venueUser?.id && item.ownerInstitutionId === activeInstitutionId && <span className="button-row"><button className="btn btn-primary" disabled={!!busy || totp.length < 6} onClick={() => void reviewRepair(item, repair, true)}>Approve repair</button><button className="btn btn-danger" disabled={!!busy || totp.length < 6} onClick={() => void reviewRepair(item, repair, false)}>Reject</button></span>}</span></div>)}{item.status === "OPEN" && item.ownerInstitutionId === activeInstitutionId && <details className="governance-form"><summary>Propose corrected observation</summary><label className="lbl">Replacement observation body JSON<textarea className="field mono-json" rows={8} value={repairDrafts[item.id] ?? "{}"} onChange={(event) => setRepairDrafts({ ...repairDrafts, [item.id]: event.target.value })}/></label><label className="lbl">Repair authority evidence reference<input className="field" value={repairEvidence[item.id] ?? ""} onChange={(event) => setRepairEvidence({ ...repairEvidence, [item.id]: event.target.value })}/></label><button className="btn btn-primary" disabled={!!busy || totp.length < 6} onClick={() => void proposeRepair(item)}>Propose append-only repair</button></details>}</div>)}</article>}
      </section>
    </>}
  </main></>;
}
