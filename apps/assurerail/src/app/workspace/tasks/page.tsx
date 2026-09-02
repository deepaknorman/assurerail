"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import {
  hostedAlphaEnabled,
  hostedAlphaTaskTone,
  type HostedAlphaTaskCategory,
  type HostedAlphaTaskResponse,
} from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";

const CATEGORIES: Array<{ value: "ALL" | HostedAlphaTaskCategory; label: string }> = [
  { value: "ALL", label: "All actions" },
  { value: "GOVERNANCE", label: "Governance" },
  { value: "CASE", label: "Cases" },
  { value: "EVIDENCE", label: "Evidence" },
  { value: "RECONCILIATION", label: "Reconciliation" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "SERVICE", label: "Service" },
];

function dueLabel(value: string | null): string {
  return value ? new Date(value).toLocaleString("en-IN") : "No source deadline";
}

export default function HostedAlphaTasksPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [response, setResponse] = useState<HostedAlphaTaskResponse | null>(null);
  const [category, setCategory] = useState<"ALL" | HostedAlphaTaskCategory>("ALL");
  const [error, setError] = useState("");
  const enabled = hostedAlphaEnabled();

  const load = useCallback(async () => {
    if (!activeInstitutionId || !enabled) return;
    try {
      setResponse(await vget<HostedAlphaTaskResponse>(`/v1/rail/institutions/${encodeURIComponent(activeInstitutionId)}/hosted-alpha/tasks`));
      setError("");
    } catch (cause) {
      setResponse(null);
      setError((cause as Error).message);
    }
  }, [activeInstitutionId, enabled]);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/login");
    else if (!loading && needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (firebaseUser && activeInstitutionId && enabled) void load(); }, [firebaseUser, activeInstitutionId, enabled, load]);

  const tasks = useMemo(() => response?.tasks.filter((item) => category === "ALL" || item.category === category) ?? [], [response, category]);

  return <><VenueHeader/><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href="/workspace">← Institution workspace</Link>
    <div className="console-head"><p className="eyebrow">Hosted alpha · shadow</p><h1>Action centre</h1><p>One institution-scoped queue assembled from retained governance, case, evidence, reconciliation, commercial and service records.</p></div>
    <div className="boundary-note">{response?.authorityNotice ?? "Task visibility is not command authority. Every destination independently checks the active institution, membership, mandate, appointment, case role and route entitlement."}</div>
    {!enabled && <div className="msg err" role="alert">Hosted alpha is disabled. Both hosted-alpha flags must be explicitly set to shadow in an approved replay/shadow environment.</div>}
    {!activeInstitutionId && <div className="msg err">Select an admitted institution before opening its action centre.</div>}
    {error && <div className="msg err" role="alert">{error}</div>}
    {enabled && response && <>
      <section className="workspace-hero" aria-label="Action summary">
        <div><span className="workspace-label">Action required</span><strong>{response.counts.actionRequired}</strong><small>{response.counts.watch} additional watch item(s)</small></div>
        <div><span className="workspace-label">Critical</span><strong>{response.counts.critical}</strong><small>Source-record priority</small></div>
        <div><span className="workspace-label">Overdue</span><strong>{response.counts.overdue}</strong><small>Deadline elapsed</small></div>
        <div><span className="workspace-label">Due soon</span><strong>{response.counts.dueSoon}</strong><small>Within 72 hours</small></div>
      </section>
      <section className="panel hosted-alpha-filter" aria-label="Filter actions">
        {CATEGORIES.map((item) => <button key={item.value} type="button" className={`btn ${category === item.value ? "btn-primary" : ""}`} onClick={() => setCategory(item.value)}>{item.label}{item.value !== "ALL" ? ` · ${response.counts.byCategory[item.value]}` : ""}</button>)}
        <button className="btn" type="button" onClick={() => void load()}>Refresh</button>
      </section>
      <section className="panel hosted-alpha-list" aria-live="polite">
        <div className="record-head"><h2>Required attention</h2><span className="meta">Generated {new Date(response.generatedAt).toLocaleString("en-IN")}</span></div>
        {tasks.map((task) => <Link className={`hosted-alpha-task ${hostedAlphaTaskTone(task)}`} href={task.href} key={task.id}>
          <div className="task-marker" aria-hidden="true" />
          <div className="task-copy"><div className="task-title-row"><strong>{task.title}</strong><span className="pill">{task.category}</span></div><p>{task.summary}</p><small>{task.requiredAction} · {task.sourceType} · {dueLabel(task.dueAt)}</small></div>
          <div className="task-state"><span className="pill">{task.priority}</span><span className="pill">{task.dueState}</span><span aria-hidden="true">→</span></div>
        </Link>)}
        {!tasks.length && <div className="n-empty">No visible action in this category. This is not evidence that every transaction or external gate is complete.</div>}
      </section>
    </>}
  </main></>;
}
