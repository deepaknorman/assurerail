"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vget } from "@/lib/venue";
import { useScopedResource } from "@/lib/use-scoped-resource";

type CaseRow = {
  id: string; caseReference: string; transactionRoute: string; representation: string; assetClass: string;
  operatingMode: string; status: string; aggregateVersion: number; createdAt: string;
};

export default function CasesPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const load = useCallback(async () => {
    if (!activeInstitutionId) throw new Error("Institution context is required");
    return vget<CaseRow[]>("/v1/rail/cases");
  }, [activeInstitutionId]);
  const resource = useScopedResource({
    scopeKey: activeInstitutionId,
    enabled: !loading && !!firebaseUser,
    loader: load,
    errorFallback: "We couldn’t load the case register. Refresh the page or try again.",
  });
  const rows = resource.data ?? [];
  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);

  return <><VenueHeader /><main className="wrap institutional-page">
    <div className="console-head"><h1>Transaction cases</h1><p>Neutral DA/PTC cases in replay or shadow. A case, room or adapter record is not a claim that a route is live, licensed or legally complete.</p></div>
    {resource.status === "loading" && activeInstitutionId && <div className="msg" role="status">Loading this institution’s cases…</div>}
    {resource.error && <div className="msg err" role="alert">{resource.error}</div>}
    {!activeInstitutionId && <div className="msg err">Select an admitted institution before viewing its cases.</div>}
    <section className="panel"><h2 className="section-title">Case register</h2><div className="record-list">
      {rows.map((item) => <article className="record-card" key={item.id}><div className="record-head"><div><strong>{item.caseReference}</strong><p className="meta">{item.transactionRoute} · {item.representation} · {item.assetClass}</p></div><span className="pill">{item.status}</span></div><p className="meta">{item.operatingMode} evidence · aggregate v{item.aggregateVersion} · {new Date(item.createdAt).toLocaleString("en-IN")}</p><div className="button-row"><Link className="btn btn-primary" href={`/workspace/cases/${encodeURIComponent(item.id)}`}>Open customer case</Link><Link className="btn" href={`/cases/${encodeURIComponent(item.id)}/rooms`}>Room migration</Link></div></article>)}
      {resource.status === "empty" && <p className="meta">No case is visible in this institution context.</p>}
    </div></section>
  </main></>;
}
