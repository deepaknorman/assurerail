"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { vget, vpost, inr, shortDid } from "@/lib/venue";
import { useAuth } from "@/lib/auth-context";

type Note = { id: string; poolId: string; tokenId: string; state: string; tapeHash: string; t1Aggregates: { mintableMinor?: string } };
type Holding = { holderDid: string; units: string };
type Surv = { period: string; anchorRef: string; verdict: { waterfall?: { balanced?: boolean }; problems?: string[] } };
type Dvp = { buyerDid: string; units: string; settlementMinor: string; settlementToken: string; anchorRef: string };
type Bg = { regulatorDid: string; lawfulPurpose: string; anchorRef: string };

export default function Console() {
  const { loading: authLoading, firebaseUser, venueUser, needsOnboarding, logout } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [surv, setSurv] = useState<Surv[]>([]);
  const [dvps, setDvps] = useState<Dvp[]>([]);
  const [bg, setBg] = useState<Bg[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pool, setPool] = useState("POOL-DEMO-1");
  const [dvpForm, setDvpForm] = useState({ buyerDid: "did:web:hdfc", unitsMinor: "5000000000", priceMinor: "5100000000" });
  const [bgForm, setBgForm] = useState({ regulatorDid: "did:web:sebi", lawfulPurpose: "supervisory review of pool composition" });

  const load = useCallback(async () => { try { setNotes(await vget<Note[]>("/venue/notes")); } catch (e) { setErr((e as Error).message); } }, []);

  // Auth gate: redirect unauthenticated / un-onboarded users; load venue data only once ready.
  const ready = !authLoading && !!firebaseUser && !!venueUser && !needsOnboarding;
  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [authLoading, firebaseUser, needsOnboarding, router]);
  useEffect(() => { if (ready) void load(); }, [ready, load]);

  const open = useCallback(async (id: string) => {
    setSel(id); setErr("");
    try {
      const [h, s, d, b] = await Promise.all([
        vget<Holding[]>(`/venue/notes/${id}/holdings`),
        vget<Surv[]>(`/venue/notes/${id}/surveillance`),
        vget<Dvp[]>(`/venue/notes/${id}/dvp`),
        vget<Bg[]>(`/venue/notes/${id}/break-glass`),
      ]);
      setHoldings(h); setSurv(s); setDvps(d); setBg(b);
    } catch (e) { setErr((e as Error).message); }
  }, []);

  async function act(label: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(label); setErr(""); setOk("");
    try { await fn(); if (okMsg) setOk(okMsg); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  const note = notes.find((n) => n.id === sel);

  if (!ready || !venueUser) {
    return (
      <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}>
        <p className="meta">{authLoading ? "Loading…" : "Redirecting…"}</p>
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.svg" alt="AssureRail" className="brand-logo" /></Link>
          <nav className="row" style={{ gap: 16 }}>
            <Link href="/">Home</Link>
            <span className="user-chip">{venueUser.email}{venueUser.isAdmin ? " · admin" : venueUser.role ? ` · ${venueUser.role}` : ""}</span>
            <button className="linkish" onClick={() => { void logout(); router.replace("/login"); }}>Sign out</button>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <div className="console-head">
          <h1>Venue console</h1>
          <p>Mint compliance-gated Notes from a verified pool tape, run HCS-anchored surveillance, settle atomic DvP in e₹, and record regulator break-glass. DEMO adapters; the live ledger/settlement paths are gated.</p>
        </div>

        {err && <div className="msg err">{err}</div>}
        {ok && <div className="msg ok">{ok}</div>}

        <div className="bar">
          <input className="field" value={pool} onChange={(e) => setPool(e.target.value)} placeholder="pool id" />
          <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void act("demo", async () => { await vpost(`/venue/demo/run/${encodeURIComponent(pool.trim())}`); await load(); }, "Ran mint → surveillance → DvP")}>{busy === "demo" ? "Running…" : "Run demo pool →"}</button>
          <button className="btn" disabled={busy !== ""} onClick={() => void act("mint", async () => { await vpost(`/venue/mint/${encodeURIComponent(pool.trim())}`); await load(); }, "Minted")}>Mint only</button>
        </div>

        <div className="split">
          <div>
            <p className="lbl" style={{ marginBottom: 8 }}>Notes ({notes.length})</p>
            <div className="notes">
              {notes.map((n) => (
                <button key={n.id} className={`note-card ${n.id === sel ? "sel" : ""}`} onClick={() => void open(n.id)}>
                  <div className="tid">{n.tokenId}</div>
                  <div className="meta">{n.poolId} · {inr(n.t1Aggregates?.mintableMinor)}</div>
                  <span className={`pill ${n.state === "ACTIVE" ? "active" : "issued"}`}>{n.state}</span>
                </button>
              ))}
              {notes.length === 0 && <p className="meta">No notes — run a demo pool.</p>}
            </div>
          </div>

          <div>
            {!note ? <p className="meta">Select a Note.</p> : (
              <>
                <div className="panel">
                  <h3><span className="mono">{note.tokenId}</span><span className={`pill ${note.state === "ACTIVE" ? "active" : "issued"}`}>{note.state}</span></h3>
                  <div className="anchor" style={{ wordBreak: "break-all" }}>{note.tapeHash}</div>
                </div>

                <div className="panel">
                  <h3>Holdings ({holdings.length})</h3>
                  {holdings.map((h) => <div className="kv" key={h.holderDid}><span className="k">{shortDid(h.holderDid)}</span><span className="v">{inr(h.units)}</span></div>)}
                </div>

                <div className="panel">
                  <h3>Surveillance ({surv.length} cycles, HCS-anchored)
                    <button className="btn" style={{ padding: "4px 10px", fontSize: 11 }} disabled={busy !== ""} onClick={() => void act("sync", async () => { await vpost(`/venue/notes/${note.id}/surveillance/sync`); await open(note.id); await load(); }, "Synced")}>Sync</button>
                  </h3>
                  {surv.map((s) => <div className="kv" key={s.period}><span className="k">{s.period} · {s.verdict?.waterfall?.balanced ? "waterfall ✓" : "—"}</span><span className="anchor">{s.anchorRef}</span></div>)}
                </div>

                <div className="panel">
                  <h3>DvP ({dvps.length})</h3>
                  <div className="subforms">
                    <label className="lbl">buyer DID<input className="field" value={dvpForm.buyerDid} onChange={(e) => setDvpForm({ ...dvpForm, buyerDid: e.target.value })} /></label>
                    <label className="lbl">units (minor)<input className="field" value={dvpForm.unitsMinor} onChange={(e) => setDvpForm({ ...dvpForm, unitsMinor: e.target.value })} /></label>
                    <label className="lbl">price (e₹ minor)<input className="field" value={dvpForm.priceMinor} onChange={(e) => setDvpForm({ ...dvpForm, priceMinor: e.target.value })} /></label>
                    <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void act("dvp", async () => { await vpost(`/venue/notes/${note.id}/dvp`, dvpForm); await open(note.id); }, "Atomic DvP settled")}>Sell (atomic DvP)</button>
                  </div>
                  {dvps.map((d, i) => <div className="kv" key={i}><span className="k">{shortDid(d.buyerDid)} · {inr(d.units)} @ {inr(d.settlementMinor)} {d.settlementToken}</span><span className="anchor">{d.anchorRef}</span></div>)}
                </div>

                <div className="panel">
                  <h3>Regulator break-glass ({bg.length})</h3>
                  <div className="subforms">
                    <label className="lbl">regulator DID<input className="field" value={bgForm.regulatorDid} onChange={(e) => setBgForm({ ...bgForm, regulatorDid: e.target.value })} /></label>
                    <label className="lbl" style={{ flex: 1 }}>lawful purpose<input className="field" style={{ width: "100%" }} value={bgForm.lawfulPurpose} onChange={(e) => setBgForm({ ...bgForm, lawfulPurpose: e.target.value })} /></label>
                    <button className="btn" disabled={busy !== ""} onClick={() => void act("bg", async () => { await vpost(`/venue/notes/${note.id}/break-glass`, bgForm); await open(note.id); }, "Access event anchored")}>Request T2 access</button>
                  </div>
                  {bg.map((b, i) => <div className="kv" key={i}><span className="k">{shortDid(b.regulatorDid)} — {b.lawfulPurpose}</span><span className="anchor">{b.anchorRef}</span></div>)}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
