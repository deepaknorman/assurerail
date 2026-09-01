"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vget } from "@/lib/venue";

type CaseRow = {
  id: string; caseReference: string; transactionRoute: string; representation: string; assetClass: string;
  operatingMode: string; status: string; aggregateVersion: number; createdAt: string;
};

export default function CasesPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try { setRows(await vget<CaseRow[]>("/v1/rail/cases")); }
    catch (cause) { setError((cause as Error).message); }
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (!loading && firebaseUser && activeInstitutionId) void load(); }, [loading, firebaseUser, activeInstitutionId, load]);

  return <><VenueHeader /><main className="wrap institutional-page">
    <div className="console-head"><h1>Transaction cases</h1><p>Neutral DA/PTC cases in replay or shadow. A case, room or adapter record is not a claim that a route is live, licensed or legally complete.</p></div>
    {error && <div className="msg err" role="alert">{error}</div>}
    {!activeInstitutionId && <div className="msg err">Select an admitted institution before viewing its cases.</div>}
    <section className="panel"><h2 className="section-title">Case register</h2><div className="record-list">
      {rows.map((item) => <article className="record-card" key={item.id}><div className="record-head"><div><strong>{item.caseReference}</strong><p className="meta">{item.transactionRoute} · {item.representation} · {item.assetClass}</p></div><span className="pill">{item.status}</span></div><p className="meta">{item.operatingMode} evidence · aggregate v{item.aggregateVersion} · {new Date(item.createdAt).toLocaleString("en-IN")}</p><div className="button-row"><Link className="btn btn-primary" href={`/workspace/cases/${encodeURIComponent(item.id)}`}>Open customer case</Link><Link className="btn" href={`/cases/${encodeURIComponent(item.id)}/rooms`}>Room migration</Link></div></article>)}
      {!rows.length && <p className="meta">No case is visible in this institution context.</p>}
    </div></section>
  </main></>;
}
