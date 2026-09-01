"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vget } from "@/lib/venue";

type Source = {
  source: "ASSIGNMENT" | "ELEVATION";
  sourceId: string;
  role: string | null;
  scopeType: string;
  scopeRef: string | null;
  expiresAt: string | null;
};

type Workspace = {
  id: string;
  title: string;
  summary: string;
  href: string;
  permissions: string[];
  escalation: string[];
  boundary: string;
  sources: Source[];
};

type WorkspaceResponse = {
  userId: string;
  customerAuthorityGranted: false;
  workspaces: Workspace[];
};

const humanise = (value: string) => value.toLowerCase().split("_").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" ");
const scopeLabel = (source: Source) => source.scopeType === "GLOBAL" ? "Global internal scope" : `${humanise(source.scopeType)} · ${source.scopeRef ?? "missing scope"}`;

export default function InternalWorkspacePage() {
  const { loading, firebaseUser, activeInstitutionId, selectInstitution } = useAuth();
  const router = useRouter();
  const [model, setModel] = useState<WorkspaceResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setModel(await vget<WorkspaceResponse>("/v1/rail/internal-access/workspaces", { institutionId: null }));
    } catch (cause) {
      setModel(null);
      setError((cause as Error).message);
    }
  }, []);

  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); }, [loading, firebaseUser, router]);
  useEffect(() => { if (!loading && firebaseUser && !activeInstitutionId) void load(); }, [loading, firebaseUser, activeInstitutionId, load]);

  if (loading) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading staff authority…</p></main>;

  return <>
    <VenueHeader />
    <main className="wrap institutional-page">
      <div className="console-head">
        <h1>Internal staff workspaces</h1>
        <p>Your active assignments determine the tools, scope and escalation path shown here. Every underlying command remains server-authorised against its exact permission and resource.</p>
      </div>

      {activeInstitutionId && <section className="panel">
        <h2 className="section-title">Leave participant context first</h2>
        <p className="tier-note">Internal staff authority and customer-institution authority are never combined in one active session.</p>
        <button className="btn btn-primary" onClick={() => void selectInstitution(null)}>Switch to internal context</button>
      </section>}

      {!activeInstitutionId && error && <div className="msg err" role="alert">{error}</div>}
      {!activeInstitutionId && model && <>
        <section className="panel">
          <div className="record-head"><h2 className="section-title">Authority boundary</h2><span className="pill pill-ok">CUSTOMER AUTHORITY: NONE</span></div>
          <p className="tier-note">These assignments cannot satisfy a participant mandate, trustee appointment, case function, settlement authority or authoritative-record decision.</p>
          <p className="tier-note">This view exposes only the workspaces supported by current assignments. Each domain command remains separately server-authorised; a visible workspace never grants customer authority or bypasses maker-checker.</p>
        </section>
        <div className="record-list">
          {model.workspaces.map((workspace) => <section className="record-card" id={workspace.id.toLowerCase()} key={workspace.id}>
            <div className="record-head"><div><p className="eyebrow">{workspace.id}</p><h2 className="section-title">{workspace.title}</h2></div><span className="pill pill-ok">ACTIVE</span></div>
            <p>{workspace.summary}</p>
            <h3>Assigned domain permissions</h3>
            <div className="button-row" aria-label={`${workspace.title} permissions`}>{workspace.permissions.map((permission) => <span className="pill" key={permission}>{humanise(permission)}</span>)}</div>
            <h3>Active scope</h3>
            {workspace.sources.map((source) => <p className="meta" key={source.sourceId}>{source.role ? humanise(source.role) : "Temporary elevation"} · {scopeLabel(source)} · expires {source.expiresAt ? new Date(source.expiresAt).toLocaleString("en-IN") : "according to assignment policy"}</p>)}
            <h3>Escalation path</h3>
            <p className="meta">{workspace.escalation.join(" → ")}</p>
            <div className="msg warn">{workspace.boundary}</div>
          </section>)}
          {model.workspaces.length === 0 && <section className="panel"><p className="meta">No active internal assignment or elevation grants a staff workspace.</p></section>}
        </div>
      </>}
    </main>
  </>;
}
