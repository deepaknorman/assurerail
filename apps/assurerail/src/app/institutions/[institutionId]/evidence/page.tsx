"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { requestTotpStepUp } from "@/lib/institutions";
import { vdownload, vget, vpost, vpostRaw } from "@/lib/venue";

type Certification = { id: string; profileRef: string; schemaId: string; schemaVersion: string; operatingMode: string; status: string; expiresAt: string | null };
type Connector = { id: string; connectorKey: string; connectorType: string; displayName: string; transport: string; status: string; certifications: Certification[] };
type Evidence = {
  id: string; evidenceType: string; classification: string; purpose: string; status: string;
  currentVersion: number; retentionUntilAt: string; legalHold: boolean;
  documentFamily: { title: string; documentType: string } | null;
  versions: { id: string; result: string; validationStatus: string; sourceAsOfAt: string; expiresAt: string | null; documentVersion: { filename: string; detectedContentType: string; sizeBytes: number; malwareStatus: string } | null }[];
};

const profileRef = "assurerail.neutral-intake.v1";
const schemaId = "assurerail.neutral-intake";
const schemaVersion = "1.0.0";

export default function InstitutionEvidencePage() {
  const params = useParams<{ institutionId: string }>();
  const router = useRouter();
  const institutionId = decodeURIComponent(params.institutionId);
  const { loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [connectorName, setConnectorName] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [totp, setTotp] = useState("");
  const [conformanceDigest, setConformanceDigest] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("TRANSACTION_DILIGENCE");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const options = { institutionId };
  const active = activeInstitutionId === institutionId;

  const load = useCallback(async () => {
    setError("");
    try {
      const [connectorRows, evidenceRows] = await Promise.all([
        vget<Connector[]>(`/v1/rail/institutions/${encodeURIComponent(institutionId)}/connectors`, options),
        vget<Evidence[]>(`/v1/rail/institutions/${encodeURIComponent(institutionId)}/evidence`, options),
      ]);
      setConnectors(connectorRows); setEvidence(evidenceRows);
    } catch (cause) { setError((cause as Error).message); }
  }, [institutionId]); // active institution is fixed by this route

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
    else if (!active) router.replace(`/institutions/${encodeURIComponent(institutionId)}`);
    else void load();
  }, [loading, firebaseUser, needsOnboarding, active, institutionId, router, load]);

  async function run(key: string, action: () => Promise<unknown>, done: string) {
    setBusy(key); setError(""); setMessage("");
    try { await action(); await load(); setMessage(done); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(""); }
  }

  async function register() {
    await run("register", () => vpost(`/v1/rail/institutions/${encodeURIComponent(institutionId)}/connectors`, {
      connectorKey: providerKey, connectorType: "GENERIC_INTAKE", displayName: connectorName,
      transport: "FILE", providerKey, providerType: "PARTICIPANT_DATA_PROVIDER",
      schemaProfiles: [{ profileRef, schemaId, schemaVersion }],
    }, options), "Connector registered. It cannot submit evidence until independently certified.");
  }

  async function propose(connector: Connector) {
    await run(`cert:${connector.id}`, async () => {
      const stepUpEvidenceId = await requestTotpStepUp({ code: totp, purpose: "CONNECTOR_CERTIFICATION_PROPOSE", institutionId });
      await vpost(`/v1/rail/institutions/${encodeURIComponent(institutionId)}/connectors/${encodeURIComponent(connector.id)}/certifications`, {
        profileRef, schemaId, schemaVersion, operatingMode: "SHADOW", conformanceEvidenceDigest: conformanceDigest,
        conformanceResult: { passed: true, executedTests: 1, criticalFailures: [] },
        qualifications: { participantProposed: true }, reason: "Participant requests independent review of attached conformance evidence", stepUpEvidenceId,
      }, options);
    }, "Certification proposal recorded for independent platform review.");
  }

  async function upload(connector: Connector) {
    if (!file) return;
    const now = new Date(); const retention = new Date(now); retention.setUTCFullYear(retention.getUTCFullYear() + 7);
    await run("upload", () => vpostRaw(`/v1/rail/institutions/${encodeURIComponent(institutionId)}/evidence/documents`, file, {
      idempotencyKey: crypto.randomUUID(), connectorRegistrationId: connector.id, profileRef,
      evidenceType: "PARTICIPANT_DOCUMENT", classification: "INSTITUTION_CONFIDENTIAL", purpose,
      retentionUntilAt: retention.toISOString(), title: title || file.name, documentType: "SUPPORTING_EVIDENCE",
      filename: file.name, contentType: file.type || "application/pdf", schemaId, schemaVersion,
      sourceAsOfAt: now.toISOString(), expiresAt: null, signatureStatus: "NOT_PROVIDED", result: "REVIEW_REQUIRED",
      qualifications: { submittedByInstitution: institutionId },
    }, options), "Document received. Availability depends on type checks, malware scanning and durable storage.");
  }

  if (!venueUser || !active) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">{error || "Loading evidence workspace…"}</p></main>;
  const certified = connectors.find((item) => item.status === "CERTIFIED_SHADOW");
  return <><VenueHeader /><main className="wrap institutional-page">
    <div className="console-head"><div><Link className="back-link" href={`/institutions/${encodeURIComponent(institutionId)}`}>← Institution</Link><h1>Connectors and evidence</h1><p>Immutable replay/shadow intake. Nothing here grants route authority or a verified assurance result.</p></div></div>
    <div aria-live="polite">{error && <div className="msg err" role="alert">{error}</div>}{message && <div className="msg ok">{message}</div>}</div>
    <section className="panel"><h2 className="section-title">Connector registrations</h2>
      <div className="record-list">{connectors.map((item) => <article className="record-card" key={item.id}><div className="record-head"><strong>{item.displayName}</strong><span className="pill">{item.status}</span></div><p className="meta">{item.transport} · {item.connectorType} · <span className="mono">{item.connectorKey}</span></p>{item.certifications.map((cert) => <p className="meta" key={cert.id}>{cert.profileRef} {cert.schemaVersion} · {cert.operatingMode} · {cert.status}</p>)}{item.status === "PENDING_CERTIFICATION" && <button className="btn btn-secondary" disabled={!!busy || !totp || conformanceDigest.length !== 64} onClick={() => void propose(item)}>Propose certification</button>}</article>)}</div>
      <div className="form-grid"><label className="lbl">Connector name<input className="field" value={connectorName} onChange={(e) => setConnectorName(e.target.value)} /></label><label className="lbl">Provider key<input className="field" value={providerKey} onChange={(e) => setProviderKey(e.target.value)} /></label><label className="lbl">Authenticator code<input className="field" value={totp} onChange={(e) => setTotp(e.target.value)} /></label><label className="lbl">Conformance evidence SHA-256<input className="field mono" value={conformanceDigest} onChange={(e) => setConformanceDigest(e.target.value.toLowerCase())} /></label></div>
      <button className="btn btn-primary" disabled={!!busy || !connectorName || !providerKey} onClick={() => void register()}>Register file connector</button>
    </section>
    <section className="panel"><h2 className="section-title">Document intake</h2><p className="tier-note">Accepted files are bounded, content-sniffed, malware-scanned and stored with server-side KMS encryption. Missing or failed malware scanning quarantines the version.</p>
      <div className="form-grid"><label className="lbl">Title<input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></label><label className="lbl">Purpose<input className="field" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label><label className="lbl">File<input className="field" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></div>
      <button className="btn btn-primary" disabled={!!busy || !certified || !file || !purpose} onClick={() => void upload(certified!)}>Submit immutable version</button>{!certified && <p className="boundary-note">A current certified shadow connector is required.</p>}
    </section>
    <section className="panel"><h2 className="section-title">Evidence objects</h2><div className="record-list">{evidence.map((item) => { const latest = item.versions[0]; const document = latest?.documentVersion; return <article className="record-card" key={item.id}><div className="record-head"><strong>{item.documentFamily?.title ?? item.evidenceType}</strong><span className="pill">{item.status} · v{item.currentVersion}</span></div><p className="meta">{item.classification} · purpose {item.purpose} · retain until {new Date(item.retentionUntilAt).toLocaleDateString("en-IN")}{item.legalHold ? " · LEGAL HOLD" : ""}</p>{latest && <p className="meta">{latest.result} · {latest.validationStatus} · source as of {new Date(latest.sourceAsOfAt).toLocaleString("en-IN")}</p>}{document && latest?.validationStatus === "VALID" && <button className="btn btn-secondary" onClick={() => void vdownload(`/v1/rail/institutions/${encodeURIComponent(institutionId)}/evidence/${encodeURIComponent(item.id)}/download`, document.filename, options)}>Download with access receipt</button>}</article>; })}{!evidence.length && <p className="meta">No evidence object is visible in this institution context.</p>}</div></section>
  </main></>;
}
