"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { tokenisedProductEnabled } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";

type Row = { id: string; caseReference: string; transactionRoute: "DA" | "PTC"; assetClass: string;
  operatingMode: string; status: string; updatedAt: string; representationRecord: null | { id: string;
    network: string; tokenId: string; authorityMode: string; status: string; classReference?: string;
    _count: Record<string, number> } };

export default function TokenisedRouteRegisterPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]); const [route, setRoute] = useState("ALL"); const [error, setError] = useState("");
  const enabled = tokenisedProductEnabled();
  const load = useCallback(async () => {
    if (!enabled || !activeInstitutionId) return;
    try { setRows(await vget<Row[]>("/v1/rail/tokenised-routes")); setError(""); }
    catch (cause) { setError((cause as Error).message); }
  }, [activeInstitutionId, enabled]);
  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); else if (!loading && needsOnboarding) router.replace("/onboard"); }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (firebaseUser && activeInstitutionId && enabled) void load(); }, [firebaseUser, activeInstitutionId, enabled, load]);
  const visible = useMemo(() => rows.filter((item) => route === "ALL" || item.transactionRoute === route), [rows, route]);
  return <><VenueHeader/><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href="/workspace">← Institution workspace</Link>
    <div className="console-head"><p className="eyebrow">AR-28 · tokenised routes</p><h1>Tokenised DA and PTC register</h1><p>Two separately governed mirror journeys over the common case, evidence, lifecycle and reconciliation rails.</p></div>
    <div className="boundary-note">Shadow product only. A token is not presumed legal title. This surface cannot dispatch mint, transfer, payment, distribution or burn instructions.</div>
    {!enabled && <div className="msg err">The tokenised route product is disabled.</div>}{error && <div className="msg err" role="alert">{error}</div>}
    {enabled && <section className="workspace-grid">
      <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">01</span><h2>Visible tokenised cases</h2></div><select className="field" aria-label="Route filter" value={route} onChange={(event) => setRoute(event.target.value)}><option>ALL</option><option>DA</option><option>PTC</option></select></div><div className="record-list">{visible.map((item) => <Link className="workspace-row" href={`/workspace/cases/${encodeURIComponent(item.id)}/tokenised`} key={item.id}><span><strong>{item.caseReference}</strong><small>{item.transactionRoute} · {item.assetClass} · {item.operatingMode}{item.representationRecord ? ` · ${item.representationRecord.network}/${item.representationRecord.tokenId}` : " · mirror not linked"}</small></span><span><span className="pill">{item.representationRecord?.status ?? "NOT_STARTED"}</span><small>{item.representationRecord?.authorityMode ?? "MIRROR REQUIRED"}</small></span></Link>)}{!visible.length && <p className="meta">No tokenised DA or PTC case is visible to the active institution.</p>}</div></article>
      <article className="panel workspace-module"><h2>Tokenised DA</h2><p>Links the existing Note adapter as a mirror, records observe-only actions and reconciles supply, holdings, economic interests and the declared authoritative record.</p></article>
      <article className="panel workspace-module"><h2>Tokenised PTC</h2><p>Separately binds programme, trust, class, trustee, assurance and recordkeeper evidence before dormant issue and lifecycle plans become shadow-ready.</p></article>
      <article className="panel workspace-module workspace-wide"><h2>Gates that this product cannot close</h2><ul className="workspace-list"><li><span>Token legal finality and route permissions</span><strong>OPEN</strong></li><li><span>Connector, custody and external operating acceptance</span><strong>OPEN</strong></li><li><span>PR-12 controlled-live production acceptance</span><strong>OPEN</strong></li></ul></article>
    </section>}
  </main></>;
}
