"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { vget, vpost, vpatch, shortDid } from "@/lib/venue";
import { useAuth } from "@/lib/auth-context";

type User = { id: string; email: string; displayName: string | null; did: string | null; role: string; isAdmin: boolean; allowlisted: boolean; status: string };
type Status = {
  store: string;
  adapters: { tape: string; hts: string; hcs: string; settlement: string };
  digikycGate: string;
  recaptchaEnforce: boolean;
  roles: string[];
  counts: { notes: number; issued: number; active: number; redeemed: number };
};
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"];

export default function Admin() {
  const { loading, firebaseUser, venueUser, needsOnboarding, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");
  const [inv, setInv] = useState({ email: "", role: "INVESTOR" });

  const isAdmin = !!venueUser?.isAdmin;
  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([vget<User[]>("/venue/admin/users"), vget<Status>("/venue/admin/status")]);
      setUsers(u);
      setStatus(s);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
    else if (venueUser && !isAdmin) router.replace("/console");
  }, [loading, firebaseUser, needsOnboarding, venueUser, isAdmin, router]);
  useEffect(() => {
    if (ready && isAdmin) void load();
  }, [ready, isAdmin, load]);

  async function patchUser(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    setErr("");
    setOk("");
    try {
      await vpatch(`/venue/admin/users/${id}`, patch);
      await load();
      setOk("Saved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function invite() {
    setBusy("invite");
    setErr("");
    setOk("");
    try {
      await vpost("/venue/admin/users/invite", inv);
      setInv({ email: "", role: "INVESTOR" });
      await load();
      setOk("Invited");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (!ready || !isAdmin || !venueUser) {
    return (
      <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}>
        <p className="meta">{loading ? "Loading…" : "Admin only — redirecting…"}</p>
      </main>
    );
  }

  const ROLES = status?.roles ?? ["ISSUER", "DESK", "INVESTOR", "TRUSTEE", "REGULATOR"];

  return (
    <>
      <header className="topbar">
        <div className="wrap row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.svg" alt="AssureRail" className="brand-logo" /></Link>
          <nav className="row" style={{ gap: 16 }}>
            <Link href="/console">Console</Link>
            <span className="user-chip">{venueUser.email} · admin</span>
            <button className="linkish" onClick={() => { void logout(); router.replace("/login"); }}>Sign out</button>
          </nav>
        </div>
      </header>

      <main className="wrap">
        <div className="console-head">
          <h1>Admin</h1>
          <p>User access management and venue status. Admin only. Roles gate what a member can do; onboarding (ACTIVE + allow-listed) is required to act on venue data.</p>
        </div>

        {err && <div className="msg err">{err}</div>}
        {ok && <div className="msg ok">{ok}</div>}

        {status && (
          <div className="panel">
            <h3>System</h3>
            <div className="kv"><span className="k">store</span><span className="v">{status.store}</span></div>
            <div className="kv"><span className="k">adapters</span><span className="v mono">tape:{status.adapters.tape} · hts:{status.adapters.hts} · hcs:{status.adapters.hcs} · settle:{status.adapters.settlement}</span></div>
            <div className="kv"><span className="k">DigiKYC gate</span><span className="v">{status.digikycGate}</span></div>
            <div className="kv"><span className="k">reCAPTCHA enforce</span><span className="v">{String(status.recaptchaEnforce)}</span></div>
            <div className="kv"><span className="k">notes</span><span className="v">{status.counts.notes} · {status.counts.active} active · {status.counts.redeemed} redeemed</span></div>
          </div>
        )}

        <div className="panel">
          <h3>Invite user</h3>
          <div className="subforms">
            <label className="lbl" style={{ flex: 1 }}>email<input className="field" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} /></label>
            <label className="lbl">role<select className="field reason-select" value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
            <button className="btn btn-primary" disabled={busy !== "" || !inv.email} onClick={() => void invite()}>{busy === "invite" ? "…" : "Invite"}</button>
          </div>
          <p className="tier-note">Pre-registers the email with a role (allow-listed). On their first login — still gated on an existing AssureLocker DigiKYC identity — they arrive already assigned.</p>
        </div>

        <div className="panel">
          <h3>Users ({users.length})</h3>
          <div className="utable">
            <div className="utable-head"><span>Email</span><span>Role</span><span>Status</span><span>Allow</span><span>DID</span></div>
            {users.map((u) => (
              <div className="utable-row" key={u.id}>
                <span className="uemail">{u.email}{u.isAdmin && <span className="tag">admin</span>}</span>
                <select className="field mini" value={u.role} disabled={busy === u.id} onChange={(e) => void patchUser(u.id, { role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
                <select className="field mini" value={u.status} disabled={busy === u.id} onChange={(e) => void patchUser(u.id, { status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <button className={`toggle ${u.allowlisted ? "on" : ""}`} disabled={busy === u.id} onClick={() => void patchUser(u.id, { allowlisted: !u.allowlisted })} title="allow-listed">{u.allowlisted ? "✓" : "—"}</button>
                <span className="anchor">{u.did ? shortDid(u.did) : "—"}</span>
              </div>
            ))}
            {users.length === 0 && <p className="meta">No users yet.</p>}
          </div>
        </div>
      </main>
    </>
  );
}
