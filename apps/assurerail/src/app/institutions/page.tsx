"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { requestTotpStepUp, type InstitutionListItem } from "@/lib/institutions";
import { vget, vpost } from "@/lib/venue";

const initialApplication = {
  legalName: "",
  institutionKind: "",
  jurisdiction: "IND",
  identifierType: "",
  identifierValue: "",
  termsVersion: "",
  rulebookVersion: "",
  initialAdminEmails: "",
};

export default function InstitutionsPage() {
  const router = useRouter();
  const { loading, firebaseUser, venueUser, needsOnboarding, activeInstitutionId, selectInstitution } = useAuth();
  const [rows, setRows] = useState<InstitutionListItem[]>([]);
  const [application, setApplication] = useState(initialApplication);
  const [accept, setAccept] = useState<Record<string, { token: string; code: string }>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;
  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await vget<InstitutionListItem[]>("/v1/rail/institutions", { institutionId: null }));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function apply() {
    setBusy("apply");
    setError("");
    setMessage("");
    try {
      await vpost("/v1/rail/institutions", {
        legalName: application.legalName,
        institutionKind: application.institutionKind,
        jurisdiction: application.jurisdiction,
        legalIdentifiers: { [application.identifierType]: application.identifierValue },
        termsVersion: application.termsVersion,
        rulebookVersion: application.rulebookVersion,
        initialAdminEmails: application.initialAdminEmails.split(",").map((value) => value.trim()).filter(Boolean),
      }, { institutionId: null });
      setApplication(initialApplication);
      await load();
      setMessage("Application recorded. Identity binding did not admit the institution; platform evidence review and two-person approval are still required.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function openInstitution(institutionId: string) {
    setBusy(institutionId);
    setError("");
    try {
      await selectInstitution(institutionId);
      router.push(`/institutions/${encodeURIComponent(institutionId)}`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function acceptMembership(row: InstitutionListItem) {
    const values = accept[row.id] ?? { token: "", code: "" };
    setBusy(row.id);
    setError("");
    setMessage("");
    try {
      const stepUpEvidenceId = await requestTotpStepUp({
        code: values.code,
        purpose: "MEMBERSHIP_ACCEPT",
        institutionId: row.institution.id,
        withoutInstitutionHeader: true,
      });
      await vpost(`/v1/rail/institutions/memberships/${encodeURIComponent(row.id)}/accept`, {
        invitationToken: values.token || undefined,
        stepUpEvidenceId,
      }, { institutionId: null });
      await load();
      setMessage(`Membership accepted for ${row.institution.legalName}. Select it to establish the institution-bound session.`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (!ready) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading institutional access…</p></main>;

  return (
    <>
      <VenueHeader />
      <main className="wrap institutional-page">
        <div className="console-head">
          <h1>Institutions</h1>
          <p>Identity, participant admission, membership, mandates and route permission are separate. Selecting an admitted institution binds it to this session; it does not create a transaction or legal authority.</p>
        </div>

        <div aria-live="polite">
          {error && <div className="msg err" role="alert">{error}</div>}
          {message && <div className="msg ok">{message}</div>}
        </div>

        <section className="panel" aria-labelledby="my-institutions-heading">
          <h2 id="my-institutions-heading" className="section-title">My institutional relationships</h2>
          <p className="tier-note">Active session context: <span className="mono">{activeInstitutionId ?? "none"}</span></p>
          <div className="institution-grid">
            {rows.map((row) => {
              const canSelect = row.status === "ACTIVE" && row.institution.status === "ACTIVE" && row.institution.admission?.status === "ADMITTED";
              const awaitingAcceptance = ["INVITED", "PENDING_ADMISSION"].includes(row.status) && row.membershipRole !== "APPLICANT";
              return (
                <article className="institution-card" key={row.id}>
                  <div className="institution-card-head">
                    <div>
                      <h3>{row.institution.legalName}</h3>
                      <p className="meta">{row.institution.institutionKind} · {row.institution.jurisdiction}</p>
                    </div>
                    <span className={`pill ${canSelect ? "pill-ok" : "pill-warn"}`}>{row.institution.admission?.status ?? "NO_ADMISSION"}</span>
                  </div>
                  <dl className="institution-facts">
                    <div><dt>Membership</dt><dd>{row.membershipRole} · {row.status}</dd></div>
                    <div><dt>Mandates</dt><dd>{row.mandates.length}</dd></div>
                    <div><dt>Review due</dt><dd>{row.institution.admission?.reviewDueAt ? new Date(row.institution.admission.reviewDueAt).toLocaleDateString("en-IN") : "—"}</dd></div>
                  </dl>
                  <div className="button-row">
                    {canSelect ? (
                      <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void openInstitution(row.institution.id)}>
                        {busy === row.institution.id ? "Selecting…" : activeInstitutionId === row.institution.id ? "Open active workspace" : "Select & open"}
                      </button>
                    ) : (
                      <Link className="btn" href={`/institutions/${encodeURIComponent(row.institution.id)}`}>View application status</Link>
                    )}
                  </div>
                  {awaitingAcceptance && (
                    <div className="inline-governance-form">
                      <h4>Accept membership</h4>
                      <label className="lbl">Invitation token <span className="opt">(not needed for admission-approved initial admins)</span>
                        <input className="field" value={accept[row.id]?.token ?? ""} onChange={(event) => setAccept({ ...accept, [row.id]: { token: event.target.value, code: accept[row.id]?.code ?? "" } })} />
                      </label>
                      <label className="lbl">Authenticator code
                        <input className="field" inputMode="numeric" autoComplete="one-time-code" value={accept[row.id]?.code ?? ""} onChange={(event) => setAccept({ ...accept, [row.id]: { token: accept[row.id]?.token ?? "", code: event.target.value } })} />
                      </label>
                      <button className="btn" disabled={busy !== "" || !(accept[row.id]?.code)} onClick={() => void acceptMembership(row)}>Accept</button>
                    </div>
                  )}
                </article>
              );
            })}
            {rows.length === 0 && <p className="meta">No institutional application or membership is recorded for this identity.</p>}
          </div>
        </section>

        <section className="panel" aria-labelledby="application-heading">
          <h2 id="application-heading" className="section-title">Apply for institutional admission</h2>
          <p className="tier-note">At least two initial administrators are required. This records an application only; evidence and two separate platform decisions follow.</p>
          <div className="form-grid">
            <label className="lbl">Legal name<input className="field" value={application.legalName} onChange={(event) => setApplication({ ...application, legalName: event.target.value })} /></label>
            <label className="lbl">Institution type<input className="field" placeholder="BANK / NBFC / TRUSTEE / …" value={application.institutionKind} onChange={(event) => setApplication({ ...application, institutionKind: event.target.value })} /></label>
            <label className="lbl">Jurisdiction<input className="field" value={application.jurisdiction} onChange={(event) => setApplication({ ...application, jurisdiction: event.target.value })} /></label>
            <label className="lbl">Identifier type<input className="field" placeholder="CIN / RBI_REGISTRATION / …" value={application.identifierType} onChange={(event) => setApplication({ ...application, identifierType: event.target.value })} /></label>
            <label className="lbl">Identifier value<input className="field" value={application.identifierValue} onChange={(event) => setApplication({ ...application, identifierValue: event.target.value })} /></label>
            <label className="lbl">Terms version<input className="field" value={application.termsVersion} onChange={(event) => setApplication({ ...application, termsVersion: event.target.value })} /></label>
            <label className="lbl">Rulebook version<input className="field" value={application.rulebookVersion} onChange={(event) => setApplication({ ...application, rulebookVersion: event.target.value })} /></label>
            <label className="lbl form-span">Additional initial administrator emails <span className="opt">comma separated</span>
              <input className="field" type="text" value={application.initialAdminEmails} onChange={(event) => setApplication({ ...application, initialAdminEmails: event.target.value })} />
            </label>
          </div>
          <button className="btn btn-primary" disabled={busy !== "" || Object.values(application).some((value) => !value.trim())} onClick={() => void apply()}>
            {busy === "apply" ? "Recording…" : "Record application"}
          </button>
        </section>
      </main>
    </>
  );
}
