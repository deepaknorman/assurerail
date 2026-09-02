"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { secondaryProductEnabled } from "@/lib/customer-workspace";
import { vget } from "@/lib/venue";

type SecondaryRow = {
  id: string; transactionCaseId: string; transactionRoute: string; transferReference: string;
  instrumentReference: string; considerationCurrency: string; considerationMinorUnits: string;
  considerationScale: number; status: string; aggregateVersion: number; updatedAt: string;
  transactionCase: { caseReference: string; operatingMode: string; lifecycleLeg: string; representation: string };
  _count: { evidence: number; legs: number; breaks: number };
};
type CaseRow = { id: string; caseReference: string; transactionRoute: string; representation: string; lifecycleLeg: string; operatingMode: string; status: string };

function exact(units: string, scale: number): string {
  const negative = units.startsWith("-"); const digits = negative ? units.slice(1) : units;
  const padded = digits.padStart(scale + 1, "0");
  return `${negative ? "-" : ""}${scale ? `${padded.slice(0, -scale)}.${padded.slice(-scale)}` : padded}`;
}

export default function SecondaryRegisterPage() {
  const router = useRouter();
  const { loading, firebaseUser, needsOnboarding, activeInstitutionId } = useAuth();
  const [rows, setRows] = useState<SecondaryRow[]>([]); const [cases, setCases] = useState<CaseRow[]>([]);
  const [route, setRoute] = useState("ALL"); const [status, setStatus] = useState("ALL"); const [error, setError] = useState("");
  const enabled = secondaryProductEnabled();
  const load = useCallback(async () => {
    if (!enabled || !activeInstitutionId) return;
    try {
      const [secondary, caseRows] = await Promise.all([vget<SecondaryRow[]>("/v1/rail/secondary-transfers"), vget<CaseRow[]>("/v1/rail/cases")]);
      setRows(secondary); setCases(caseRows); setError("");
    } catch (cause) { setError((cause as Error).message); }
  }, [activeInstitutionId, enabled]);
  useEffect(() => { if (!loading && !firebaseUser) router.replace("/login"); else if (!loading && needsOnboarding) router.replace("/onboard"); }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (firebaseUser && activeInstitutionId && enabled) void load(); }, [firebaseUser, activeInstitutionId, enabled, load]);
  const visible = useMemo(() => rows.filter((item) => (route === "ALL" || item.transactionRoute === route) && (status === "ALL" || item.status === status)), [rows, route, status]);
  const emptyCases = cases.filter((item) => item.lifecycleLeg === "SECONDARY_TRANSFER_OR_TRADE" && item.representation === "CONVENTIONAL" && !rows.some((row) => row.transactionCaseId === item.id));
  return <><VenueHeader/><main className="wrap institutional-page customer-workspace">
    <Link className="back-link" href="/workspace">← Institution workspace</Link>
    <div className="console-head"><p className="eyebrow">AR-27 · conventional secondary</p><h1>Secondary DA and PTC register</h1><p>Institution-scoped title-chain, restriction, consent, cash-observation and authoritative-register reconciliation journeys.</p></div>
    <div className="boundary-note">Observe-only. AssureRail does not execute a trade, move funds or title, issue a token, send a legal notice, or update an RTA, depository or other authoritative register.</div>
    {!enabled && <div className="msg err">The secondary product is disabled.</div>}{error && <div className="msg err" role="alert">{error}</div>}
    {enabled && <section className="workspace-grid">
      <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">01</span><h2>Visible secondary journeys</h2></div><div className="button-row"><select className="field" aria-label="Route filter" value={route} onChange={(event) => setRoute(event.target.value)}><option>ALL</option><option>DA</option><option>PTC</option></select><select className="field" aria-label="Status filter" value={status} onChange={(event) => setStatus(event.target.value)}><option>ALL</option>{["COLLECTING", "PROPOSED", "REJECTED", "BREAK_OPEN", "RECONCILED"].map((value) => <option key={value}>{value}</option>)}</select></div></div><div className="record-list">{visible.map((item) => <Link className="workspace-row" href={`/workspace/cases/${encodeURIComponent(item.transactionCaseId)}/secondary`} key={item.id}><span><strong>{item.transferReference}</strong><small>{item.transactionCase.caseReference} · {item.transactionRoute} · {item.instrumentReference} · {item.considerationCurrency} {exact(item.considerationMinorUnits, item.considerationScale)}</small></span><span><span className="pill">{item.status}</span><small>{item._count.evidence} evidence · {item._count.legs} legs · {item._count.breaks} breaks</small></span></Link>)}{!visible.length && <p className="meta">No secondary dossier in this filter is visible to the active institution.</p>}</div></article>
      <article className="panel workspace-module workspace-wide"><div className="workspace-module-head"><div><span className="workspace-step">02</span><h2>Cases awaiting a dossier</h2></div></div><p>Create the governed case, active parties, function assignments and route entitlements first; then open its guided secondary journey.</p><div className="record-list">{emptyCases.map((item) => <Link className="workspace-row" href={`/workspace/cases/${encodeURIComponent(item.id)}/secondary`} key={item.id}><span><strong>{item.caseReference}</strong><small>{item.transactionRoute} · {item.operatingMode} · {item.status}</small></span><span className="btn">Open journey</span></Link>)}{!emptyCases.length && <p className="meta">No visible conventional secondary case is waiting for a dossier.</p>}</div></article>
      <article className="panel workspace-module"><h2>External activation gates</h2><ul className="workspace-list"><li><span>Counsel-ratified secondary route pack</span><strong>OPEN</strong></li><li><span>Participant and performer acceptance</span><strong>OPEN</strong></li><li><span>VAPT and controlled-live acceptance</span><strong>OPEN</strong></li></ul></article>
      <article className="panel workspace-module"><h2>Authority model</h2><p>The seller governs the dossier through maker-checker review. A trustee or recordkeeper owns its assigned reconciliation break and any append-only repair. Every action is re-authorised by the API.</p></article>
    </section>}
  </main></>;
}
