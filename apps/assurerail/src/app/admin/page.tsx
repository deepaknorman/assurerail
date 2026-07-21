"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { vget, vpost, vpatch, vdelete, inr, shortDid } from "@/lib/venue";
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
type Overview = { health: string; notes: { total: number; byState: Record<string, number> }; events: number; documents: number; webhooks: { failedDeliveries: number }; uptimeSec: number };
type Statement = { period: string; currency: string; events: number; lines: { type: string; count: number; rateMinor: number; amountMinor: number }[]; totalMinor: number };
type Webhook = { id: string; url: string; events: string[]; active: boolean; createdAt: string; secret?: string };
type Delivery = { id: string; subscriptionId: string; event: string; statusCode: number; ok: boolean; createdAt: string };
type EventRow = { id: string; event: string; createdAt: string };
const STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"];
const rupeesFromMinor = (m: number) => inr(Math.round(m / 100));

export default function Admin() {
  const { loading, firebaseUser, venueUser, needsOnboarding, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState("");
  const [inv, setInv] = useState({ email: "", role: "INVESTOR" });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [newHook, setNewHook] = useState("");
  const [newSecret, setNewSecret] = useState("");

  const isAdmin = !!venueUser?.isAdmin;
  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;

  const load = useCallback(async () => {
    try {
      const [u, s, ov, st, wh, dl, ev] = await Promise.all([
        vget<User[]>("/venue/admin/users"),
        vget<Status>("/venue/admin/status"),
        vget<Overview>("/venue/support/overview").catch(() => null),
        vget<Statement>("/venue/billing/statement").catch(() => null),
        vget<Webhook[]>("/venue/webhooks").catch(() => []),
        vget<Delivery[]>("/venue/webhooks/deliveries?limit=10").catch(() => []),
        vget<EventRow[]>("/venue/support/events?limit=12").catch(() => []),
      ]);
      setUsers(u);
      setStatus(s);
      setOverview(ov);
      setStatement(st);
      setWebhooks(wh);
      setDeliveries(dl);
      setEvents(ev);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  async function subscribeHook() {
    if (!/^https?:\/\//.test(newHook)) { setErr("Enter a valid http(s) URL"); return; }
    setBusy("hook");
    setErr("");
    setOk("");
    try {
      const s = await vpost<Webhook>("/venue/webhooks", { url: newHook, events: ["*"] });
      setNewSecret(s.secret ?? "");
      setNewHook("");
      await load();
      setOk("Webhook added — copy the signing secret now (shown once)");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function removeHook(id: string) {
    setBusy(id);
    setErr("");
    try {
      await vdelete(`/venue/webhooks/${id}`);
      await load();
      setOk("Webhook removed");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

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

        {overview && (
          <div className="panel">
            <h3>Operations</h3>
            <div className="ops-grid">
              <div className="ops-stat"><span className="ops-n">{overview.notes.total}</span><span className="ops-l">notes</span></div>
              <div className="ops-stat"><span className="ops-n">{overview.events.toLocaleString("en-IN")}</span><span className="ops-l">events</span></div>
              <div className="ops-stat"><span className="ops-n">{overview.documents}</span><span className="ops-l">documents</span></div>
              <div className={`ops-stat ${overview.webhooks.failedDeliveries > 0 ? "ops-warn" : ""}`}><span className="ops-n">{overview.webhooks.failedDeliveries}</span><span className="ops-l">failed hooks</span></div>
              <div className="ops-stat"><span className="ops-n">{Math.round(overview.uptimeSec / 60)}m</span><span className="ops-l">uptime</span></div>
            </div>
            {events.length > 0 && (
              <div className="evlog">
                {events.map((e) => (
                  <div className="evrow" key={e.id}><span className="evname mono">{e.event}</span><span className="meta">{new Date(e.createdAt).toLocaleString("en-IN")}</span></div>
                ))}
              </div>
            )}
          </div>
        )}

        {statement && (
          <div className="panel">
            <h3>Billing · usage to date</h3>
            <p className="tier-note">Illustrative per-event metering (subscription + minimum allowances apply commercially; reuse is lender-scoped).</p>
            <div className="utable">
              <div className="utable-head" style={{ gridTemplateColumns: "1fr 80px 120px 140px" }}><span>Event</span><span>Count</span><span>Rate</span><span>Amount</span></div>
              {statement.lines.map((l) => (
                <div className="utable-row" key={l.type} style={{ gridTemplateColumns: "1fr 80px 120px 140px" }}>
                  <span className="uemail">{l.type}</span><span>{l.count}</span><span className="mono">{rupeesFromMinor(l.rateMinor)}</span><span className="mono">{rupeesFromMinor(l.amountMinor)}</span>
                </div>
              ))}
              {statement.lines.length === 0 && <p className="meta">No billable events yet.</p>}
            </div>
            <div className="kv" style={{ marginTop: 10 }}><span className="k">Total ({statement.events} events)</span><span className="v mono" style={{ fontWeight: 700 }}>{rupeesFromMinor(statement.totalMinor)}</span></div>
          </div>
        )}

        <div className="panel">
          <h3>Webhooks · partner egress</h3>
          <p className="tier-note">HMAC-SHA256 signed (header <code>x-arail-signature</code>) on note.minted / dvp.settled / note.closed. Subscribe with <code>*</code> for all events.</p>
          <div className="subforms">
            <label className="lbl" style={{ flex: 1 }}>endpoint URL<input className="field" type="url" placeholder="https://partner.example/hooks/arail" value={newHook} onChange={(e) => setNewHook(e.target.value)} /></label>
            <button className="btn btn-primary" disabled={busy !== "" || !newHook} onClick={() => void subscribeHook()}>{busy === "hook" ? "…" : "Add"}</button>
          </div>
          {newSecret && <div className="msg ok">Signing secret (copy now — shown once): <code className="mono">{newSecret}</code></div>}
          <div className="utable" style={{ marginTop: 10 }}>
            {webhooks.map((w) => (
              <div className="utable-row" key={w.id} style={{ gridTemplateColumns: "1fr 120px 60px" }}>
                <span className="uemail mono">{w.url}</span>
                <span className="meta">{Array.isArray(w.events) ? w.events.join(",") : "*"}</span>
                <button className="linkish" disabled={busy === w.id} onClick={() => void removeHook(w.id)}>remove</button>
              </div>
            ))}
            {webhooks.length === 0 && <p className="meta">No subscriptions.</p>}
          </div>
          {deliveries.length > 0 && (
            <div className="evlog" style={{ marginTop: 10 }}>
              {deliveries.map((d) => (
                <div className="evrow" key={d.id}><span className="evname mono">{d.event} → {d.statusCode}{d.ok ? " ✓" : " ✗"}</span><span className="meta">{new Date(d.createdAt).toLocaleString("en-IN")}</span></div>
              ))}
            </div>
          )}
        </div>

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
