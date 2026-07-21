"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { vget, vpost, inr, shortDid, grp, shortIN } from "@/lib/venue";
import { useAuth } from "@/lib/auth-context";

type Note = {
  id: string;
  poolId: string;
  tokenId: string;
  state: string;
  tapeHash: string;
  t1Aggregates: { mintableMinor?: string };
  burnTxRef?: string | null;
  closeAnchorRef?: string | null;
  closeReason?: string | null;
  redeemedAt?: string | null;
};
type Holding = { holderDid: string; units: string };
type Surv = { period: string; anchorRef: string; verdict: { waterfall?: { balanced?: boolean }; problems?: string[] } };
type Dvp = { buyerDid: string; units: string; settlementMinor: string; settlementToken: string; anchorRef: string };
type Bg = { regulatorDid: string; lawfulPurpose: string; anchorRef: string };
type StratBucket = { label: string; valueSharePct: number; count: number };
type Underlying = { tier: string; loanCount: number; note: string; tables: { name: string; buckets: StratBucket[] }[] };

type StageStatus = "done" | "current" | "pending";
const CLOSE_REASONS = [
  { v: "clean_up_call", l: "Clean-up call" },
  { v: "maturity", l: "Legal maturity" },
  { v: "call", l: "Optional / early call" },
  { v: "amortised", l: "Fully amortised" },
  { v: "manual", l: "Manual" },
];

export default function Console() {
  const { loading: authLoading, firebaseUser, venueUser, needsOnboarding, logout } = useAuth();
  const router = useRouter();

  const [notes, setNotes] = useState<Note[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [surv, setSurv] = useState<Surv[]>([]);
  const [dvps, setDvps] = useState<Dvp[]>([]);
  const [bg, setBg] = useState<Bg[]>([]);
  const [underlying, setUnderlying] = useState<Underlying | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pool, setPool] = useState("POOL-DEMO-1");
  const [dvpForm, setDvpForm] = useState({ buyerDid: "did:web:hdfc", unitsMinor: "5000000000", priceMinor: "5100000000" });
  const [closeReason, setCloseReason] = useState("clean_up_call");
  const [showBg, setShowBg] = useState(false);
  const [bgForm, setBgForm] = useState({ regulatorDid: "did:web:sebi", lawfulPurpose: "supervisory review of pool composition" });

  const load = useCallback(async () => {
    try {
      setNotes(await vget<Note[]>("/venue/notes"));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  const ready = !authLoading && !!firebaseUser && !!venueUser && !needsOnboarding;
  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [authLoading, firebaseUser, needsOnboarding, router]);
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const open = useCallback(async (id: string) => {
    setSel(id);
    setErr("");
    const n = notes.find((x) => x.id === id);
    try {
      const [h, s, d, b, u] = await Promise.all([
        vget<Holding[]>(`/venue/notes/${id}/holdings`),
        vget<Surv[]>(`/venue/notes/${id}/surveillance`),
        vget<Dvp[]>(`/venue/notes/${id}/dvp`),
        vget<Bg[]>(`/venue/notes/${id}/break-glass`),
        n ? vget<Underlying>(`/venue/tape/${encodeURIComponent(n.poolId)}/underlying`) : Promise.resolve(null),
      ]);
      setHoldings(h);
      setSurv(s);
      setDvps(d);
      setBg(b);
      setUnderlying(u);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [notes]);

  async function act(label: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(label);
    setErr("");
    setOk("");
    try {
      await fn();
      if (okMsg) setOk(okMsg);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const note = notes.find((n) => n.id === sel);

  if (!ready || !venueUser) {
    return (
      <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}>
        <p className="meta">{authLoading ? "Loading…" : "Redirecting…"}</p>
      </main>
    );
  }

  // ── lifecycle stage model (drives the pipeline stepper + which action is live) ──
  const st = note?.state ?? "";
  const isActive = st === "ACTIVE" || st === "REDEEMED";
  const isRedeemed = st === "REDEEMED";
  const stages: { key: string; label: string; status: StageStatus; hint: string }[] = note
    ? [
        { key: "tape", label: "Tape", status: "done", hint: "verified" },
        { key: "mint", label: "Mint", status: "done", hint: note.tokenId },
        { key: "surv", label: "Surveillance", status: isActive ? "done" : "current", hint: isActive ? `${surv.length} cycles` : "run sync" },
        { key: "trade", label: "Trading", status: isRedeemed ? "done" : isActive ? "current" : "pending", hint: isRedeemed ? "closed" : `${dvps.length} trades` },
        { key: "close", label: "Closure", status: isRedeemed ? "done" : "pending", hint: isRedeemed ? note.closeReason ?? "redeemed" : "redeem" },
      ]
    : [];

  return (
    <>
      <header className="topbar">
        <div className="wrap row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.svg" alt="AssureRail" className="brand-logo" /></Link>
          <nav className="row" style={{ gap: 16 }}>
            <Link href="/">Home</Link>
            {venueUser.isAdmin && <Link href="/admin">Admin</Link>}
            <span className="user-chip">{venueUser.email}{venueUser.isAdmin ? " · admin" : venueUser.role ? ` · ${venueUser.role}` : ""}</span>
            <button className="linkish" onClick={() => { void logout(); router.replace("/login"); }}>Sign out</button>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <div className="console-head">
          <h1>Venue console</h1>
          <p>Take a verified loan pool through its whole life: mint a compliance-gated Note, run tamper-evident surveillance, trade it with atomic DvP, and redeem it (burning the tokens). DEMO adapters — the flow, gates and records are real; no live ledger or money moves yet.</p>
        </div>

        {err && <div className="msg err">{err}</div>}
        {ok && <div className="msg ok">{ok}</div>}

        <div className="bar">
          <input className="field" value={pool} onChange={(e) => setPool(e.target.value)} placeholder="pool id" />
          <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void act("demo", async () => { await vpost(`/venue/demo/run/${encodeURIComponent(pool.trim())}`); await load(); }, "Simulated the full lifecycle → mint → surveillance → a sample DvP")}>{busy === "demo" ? "Running…" : "Simulate full lifecycle →"}</button>
          <button className="btn" disabled={busy !== ""} onClick={() => void act("mint", async () => { await vpost(`/venue/mint/${encodeURIComponent(pool.trim())}`); await load(); }, "Minted")}>Mint only</button>
        </div>

        <div className="split">
          <div>
            <p className="lbl" style={{ marginBottom: 8 }}>Portfolio ({notes.length})</p>
            <div className="notes">
              {notes.map((n) => (
                <button key={n.id} className={`note-card ${n.id === sel ? "sel" : ""}`} onClick={() => void open(n.id)}>
                  <div className="tid">{n.tokenId}</div>
                  <div className="meta">{n.poolId} · {inr(n.t1Aggregates?.mintableMinor)}</div>
                  <span className={`pill ${n.state === "ACTIVE" ? "active" : n.state === "REDEEMED" ? "redeemed" : "issued"}`}>{n.state}</span>
                </button>
              ))}
              {notes.length === 0 && <p className="meta">No notes yet — enter a pool id and “Simulate full lifecycle”.</p>}
            </div>
          </div>

          <div>
            {!note ? (
              <p className="meta">Select a Note to walk its lifecycle.</p>
            ) : (
              <>
                {/* ── pipeline stepper ── */}
                <div className="pipeline">
                  {stages.map((s, i) => (
                    <div className={`stage ${s.status}`} key={s.key}>
                      {i > 0 && <span className="connector" />}
                      <span className="stage-dot">{s.status === "done" ? "✓" : i + 1}</span>
                      <span className="stage-label">{s.label}</span>
                      <span className="stage-hint">{s.hint}</span>
                    </div>
                  ))}
                </div>

                <div className="panel">
                  <h3><span className="mono">{note.tokenId}</span><span className={`pill ${note.state === "ACTIVE" ? "active" : note.state === "REDEEMED" ? "redeemed" : "issued"}`}>{note.state}</span></h3>
                  <div className="anchor" style={{ wordBreak: "break-all" }}>tape {note.tapeHash}</div>
                </div>

                {/* ── contextual action for the current stage ── */}
                {note.state === "ISSUED" && (
                  <div className="action-card">
                    <p className="stage-lead"><b>Next: run surveillance.</b> Pulls this pool’s post-close performance, anchors each cycle to a tamper-evident record, and moves the Note <b>ISSUED → ACTIVE</b> (tradeable).</p>
                    <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void act("sync", async () => { await vpost(`/venue/notes/${note.id}/surveillance/sync`); await open(note.id); await load(); }, "Surveillance synced — Note is ACTIVE")}>{busy === "sync" ? "Syncing…" : "Run surveillance sync →"}</button>
                  </div>
                )}

                {note.state === "ACTIVE" && (
                  <>
                    <div className="action-card">
                      <p className="stage-lead"><b>Trade: atomic DvP.</b> Sell units to a buyer against an e₹ payment — delivery and payment settle together (or neither), so there’s no settlement risk. Holdings always conserve.</p>
                      <div className="subforms">
                        <label className="lbl">buyer DID<input className="field" value={dvpForm.buyerDid} onChange={(e) => setDvpForm({ ...dvpForm, buyerDid: e.target.value })} /></label>
                        <label className="lbl">units (minor)
                          <input className="field" inputMode="numeric" value={grp(dvpForm.unitsMinor)} onChange={(e) => setDvpForm({ ...dvpForm, unitsMinor: e.target.value.replace(/[^\d]/g, "") })} />
                          {dvpForm.unitsMinor && <span className="hint">{shortIN(dvpForm.unitsMinor)} units</span>}
                        </label>
                        <label className="lbl">price (e₹ minor)
                          <input className="field" inputMode="numeric" value={grp(dvpForm.priceMinor)} onChange={(e) => setDvpForm({ ...dvpForm, priceMinor: e.target.value.replace(/[^\d]/g, "") })} />
                          {dvpForm.priceMinor && <span className="hint">{shortIN(dvpForm.priceMinor)} E₹</span>}
                        </label>
                        <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void act("dvp", async () => { await vpost(`/venue/notes/${note.id}/dvp`, dvpForm); await open(note.id); }, "Atomic DvP settled")}>Sell (atomic DvP)</button>
                      </div>
                    </div>

                    <div className="action-card">
                      <p className="stage-lead"><b>Close / redeem.</b> When the pool matures, fully amortises, or the issuer calls it, the Note is redeemed — the tokens are <b>burned</b> (supply → 0), holdings zeroed, and the closure anchored. A governed action.</p>
                      <div className="subforms">
                        <label className="lbl">reason
                          <select className="field reason-select" value={closeReason} onChange={(e) => setCloseReason(e.target.value)}>
                            {CLOSE_REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                          </select>
                        </label>
                        <button className="btn btn-danger" disabled={busy !== ""} onClick={() => void act("close", async () => { await vpost(`/venue/notes/${note.id}/close`, { reason: closeReason }); await open(note.id); await load(); }, "Note redeemed — tokens burned")}>{busy === "close" ? "Redeeming…" : "Redeem & burn"}</button>
                      </div>
                    </div>
                  </>
                )}

                {note.state === "REDEEMED" && (
                  <div className="action-card closed">
                    <p className="stage-lead"><b>Redeemed.</b> The Note is closed and its tokens are burned — supply is retired and it’s no longer tradeable.</p>
                    <div className="kv"><span className="k">reason</span><span className="v">{note.closeReason}</span></div>
                    <div className="kv"><span className="k">redeemed</span><span className="v">{note.redeemedAt?.slice(0, 19).replace("T", " ")}</span></div>
                    <div className="kv"><span className="k">burn tx</span><span className="anchor">{note.burnTxRef}</span></div>
                    <div className="kv"><span className="k">closure anchor</span><span className="anchor">{note.closeAnchorRef}</span></div>
                  </div>
                )}

                {/* ── detail panels (what you should be seeing) ── */}
                <div className="panel">
                  <h3>Holdings ({holdings.length})</h3>
                  {holdings.map((h) => <div className="kv" key={h.holderDid}><span className="k">{shortDid(h.holderDid)}</span><span className="v">{inr(h.units)}</span></div>)}
                  {holdings.length === 0 && <p className="meta">—</p>}
                </div>

                {surv.length > 0 && (
                  <div className="panel">
                    <h3>Surveillance ({surv.length} cycles, HCS-anchored)</h3>
                    {surv.map((s) => <div className="kv" key={s.period}><span className="k">{s.period} · {s.verdict?.waterfall?.balanced ? "waterfall ✓" : "—"}</span><span className="anchor">{s.anchorRef}</span></div>)}
                  </div>
                )}

                {dvps.length > 0 && (
                  <div className="panel">
                    <h3>Trades — DvP ({dvps.length})</h3>
                    {dvps.map((d, i) => <div className="kv" key={i}><span className="k">{shortDid(d.buyerDid)} · {inr(d.units)} @ {inr(d.settlementMinor)} {d.settlementToken}</span><span className="anchor">{d.anchorRef}</span></div>)}
                  </div>
                )}

                {underlying && (
                  <div className="panel">
                    <h3>Underlying — anonymised (T1.5) · {grp(underlying.loanCount)} loans</h3>
                    <p className="tier-note">{underlying.note}</p>
                    <div className="strat">
                      {underlying.tables.map((t) => (
                        <div className="strat-tbl" key={t.name}>
                          <h4>{t.name}</h4>
                          {t.buckets.map((bk) => (
                            <div className="strat-row" key={bk.label}>
                              <span className="sk">{bk.label}</span>
                              <span className="strat-bar" style={{ width: `${Math.max(4, bk.valueSharePct)}%` }} />
                              <span className="sv">{bk.valueSharePct}%</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── regulator break-glass (secondary, collapsible) ── */}
                <div className="panel">
                  <h3>Regulator break-glass ({bg.length})<button className="linkish" style={{ fontSize: 11 }} onClick={() => setShowBg(!showBg)}>{showBg ? "hide" : "request T2 access"}</button></h3>
                  {showBg && (
                    <div className="subforms">
                      <label className="lbl">regulator DID<input className="field" value={bgForm.regulatorDid} onChange={(e) => setBgForm({ ...bgForm, regulatorDid: e.target.value })} /></label>
                      <label className="lbl" style={{ flex: 1 }}>lawful purpose<input className="field" style={{ width: "100%" }} value={bgForm.lawfulPurpose} onChange={(e) => setBgForm({ ...bgForm, lawfulPurpose: e.target.value })} /></label>
                      <button className="btn" disabled={busy !== ""} onClick={() => void act("bg", async () => { await vpost(`/venue/notes/${note.id}/break-glass`, bgForm); await open(note.id); }, "Access event anchored")}>Anchor T2 access</button>
                    </div>
                  )}
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
