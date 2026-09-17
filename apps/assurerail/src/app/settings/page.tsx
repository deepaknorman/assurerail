"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vget, vpost, vdelete } from "@/lib/venue";
import { listPasskeys, registerPasskey, deletePasskey, type Passkey } from "@/lib/webauthn";
import { userFacingError } from "@/lib/user-facing-error";
import { FeedbackBanner } from "@/components/FeedbackBanner";

type Theme = "system" | "light" | "dark";
type MfaStatus = { methods: string[]; pending: string[]; enrolled: boolean };
type TotpSetup = { secret: string; uri: string };

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  try {
    localStorage.setItem("arail-theme", t);
  } catch {
    /* ignore */
  }
}

export default function Settings() {
  const { loading, firebaseUser, venueUser, needsOnboarding } = useAuth();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("system");
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [totp, setTotp] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [securityLoading, setSecurityLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;

  const loadSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const [pk, m] = await Promise.all([listPasskeys(), vget<MfaStatus>("/venue/auth/mfa/status")]);
      setPasskeys(pk);
      setMfa(m);
    } finally {
      setSecurityLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setTheme((localStorage.getItem("arail-theme") as Theme) || "system");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => {
    if (ready) void loadSecurity().catch((cause) => setErr(userFacingError(cause, "We couldn’t load your security settings. Refresh the page or try again.")));
  }, [ready, loadSecurity]);

  if (!ready || !venueUser) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading…</p></main>;

  const setT = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };
  const run = async (label: string, fn: () => Promise<void>, okMsg?: string) => {
    setBusy(label);
    setErr("");
    setOk("");
    try {
      await fn();
      if (okMsg) setOk(okMsg);
    } catch (e) {
      setErr(userFacingError(e, "The security settings could not be updated. Please try again."));
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <VenueHeader />
      <main className="wrap" aria-busy={busy !== "" || securityLoading}>
        <div className="console-head">
          <h1>Settings</h1>
          <p>Your profile, appearance and account security.</p>
        </div>
        <FeedbackBanner error={err} success={ok} />

        <div className="set-section">
          <h2>Profile</h2>
          <p>Your venue identity. The DID is your AssureLocker DigiKYC identity — the venue references it, never copies your data.</p>
          <div className="set-row"><div className="set-kv"><span className="k">Email</span><span className="v">{venueUser.email}</span></div></div>
          <div className="set-row"><div className="set-kv"><span className="k">DID</span><span className="v">{venueUser.did || "—"}</span></div></div>
          <div className="set-row"><div className="set-kv"><span className="k">Role</span><span className="v">{venueUser.role}{venueUser.platformRole ? ` · ${venueUser.platformRole}` : ""}{venueUser.entityRole ? ` · ${venueUser.entityRole}` : ""}</span></div></div>
          <div className="set-row"><div className="set-kv"><span className="k">Status</span><span className="v">{venueUser.status}{venueUser.allowlisted ? " · allow-listed" : ""}</span></div></div>
        </div>

        <div className="set-section">
          <h2>Appearance</h2>
          <p>Theme preference for this device. The AssureRail mark and wordmark track the theme.</p>
          <div className="row" style={{ gap: 8 }}>
            {(["system", "light", "dark"] as Theme[]).map((t) => (
              <button key={t} className={`btn ${theme === t ? "btn-primary" : ""}`} type="button" aria-pressed={theme === t} onClick={() => setT(t)} style={{ textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
        </div>

        <div className="set-section">
          <h2>Security</h2>
          <p>Add a passkey and multi-factor authentication — the same protections as AssureLocker.</p>
          {securityLoading && <p className="meta" role="status">Loading your security methods…</p>}

          <div className="set-row">
            <div><div className="sr-label">Passkeys (WebAuthn)</div><div className="sr-sub">Sign in with Face&nbsp;ID / Touch&nbsp;ID / a security key.</div></div>
            <button className="btn btn-primary" disabled={busy !== ""} onClick={() => void run("pk", () => registerPasskey().then(loadSecurity), "Passkey added")}>{busy === "pk" ? "Waiting…" : "Add passkey"}</button>
          </div>
          {passkeys.map((pk) => (
            <div className="set-row" key={pk.id}>
              <div><div className="sr-label">{pk.name || "Passkey"}{pk.backedUp && <span className="tag" style={{ marginLeft: 6 }}>synced</span>}</div><div className="sr-sub">added {new Date(pk.createdAt).toLocaleDateString("en-IN")}</div></div>
              <button className="linkish" disabled={busy !== ""} onClick={() => void run(`rm-${pk.id}`, () => deletePasskey(pk.id).then(loadSecurity), "Passkey removed")}>Remove</button>
            </div>
          ))}
          {!securityLoading && passkeys.length === 0 && <p className="meta" style={{ padding: "6px 0" }}>No passkeys yet.</p>}

          <div className="set-row" style={{ marginTop: 12 }}>
            <div><div className="sr-label">Authenticator app (TOTP)</div><div className="sr-sub">{securityLoading ? "Checking enrolment…" : mfa?.enrolled ? "Enabled — 6-digit codes required." : "6-digit codes from Google Authenticator, 1Password, Authy, etc."}</div></div>
            {!securityLoading && (mfa?.enrolled ? (
              <button className="btn" disabled={busy !== ""} onClick={() => void run("mfa", () => vdelete("/venue/auth/mfa/TOTP").then(loadSecurity), "MFA disabled")}>Disable</button>
            ) : !totp ? (
              <button className="btn btn-primary" disabled={busy !== ""} aria-busy={busy === "mfa"} onClick={() => void run("mfa", async () => setTotp(await vpost<TotpSetup>("/venue/auth/mfa/enroll/totp")))}>{busy === "mfa" ? "Setting up…" : "Set up"}</button>
            ) : null)}
          </div>
          {totp && (
            <div className="totp-setup">
              <p className="sr-sub"><b>1.</b> Scan this with your authenticator app (or enter the secret manually).</p>
              <div className="qr-box"><QRCodeSVG value={totp.uri} size={168} /></div>
              <div className="set-kv" style={{ marginTop: 10 }}><span className="k">Secret</span><span className="v">{totp.secret}</span></div>
              <p className="sr-sub" style={{ marginTop: 14 }}><b>2.</b> Enter the current 6-digit code to confirm.</p>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input className="field" aria-label="Six-digit authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))} placeholder="123456" style={{ maxWidth: 150, letterSpacing: "0.3em", textAlign: "center", fontFamily: "var(--arail-font-mono)" }} />
                <button className="btn btn-primary" disabled={busy !== "" || code.length < 6} aria-busy={busy === "mfa"} onClick={() => void run("mfa", () => vpost("/venue/auth/mfa/verify/totp", { code }).then(() => { setTotp(null); setCode(""); }).then(loadSecurity), "MFA enabled")}>{busy === "mfa" ? "Confirming…" : "Confirm"}</button>
                <button className="linkish" onClick={() => { setTotp(null); setCode(""); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
