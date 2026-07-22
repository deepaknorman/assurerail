"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";

type Theme = "system" | "light" | "dark";

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
  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;

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

  if (!ready || !venueUser) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading…</p></main>;

  const setT = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
  };

  return (
    <>
      <VenueHeader />
      <main className="wrap">
        <div className="console-head">
          <h1>Settings</h1>
          <p>Your profile, appearance and account security.</p>
        </div>

        <div className="set-section">
          <h3>Profile</h3>
          <p>Your venue identity. The DID is your AssureLocker DigiKYC identity — the venue references it, never copies your data.</p>
          <div className="set-row"><div className="set-kv"><span className="k">Email</span><span className="v">{venueUser.email}</span></div></div>
          <div className="set-row"><div className="set-kv"><span className="k">DID</span><span className="v">{venueUser.did || "—"}</span></div></div>
          <div className="set-row"><div className="set-kv"><span className="k">Role</span><span className="v">{venueUser.role}{venueUser.isAdmin ? " · admin" : ""}</span></div></div>
          <div className="set-row"><div className="set-kv"><span className="k">Status</span><span className="v">{venueUser.status}{venueUser.allowlisted ? " · allow-listed" : ""}</span></div></div>
        </div>

        <div className="set-section">
          <h3>Appearance</h3>
          <p>Theme preference for this device. The AssureRail mark and wordmark track the theme.</p>
          <div className="row" style={{ gap: 8 }}>
            {(["system", "light", "dark"] as Theme[]).map((t) => (
              <button key={t} className={`btn ${theme === t ? "btn-primary" : ""}`} onClick={() => setT(t)} style={{ textTransform: "capitalize" }}>{t}</button>
            ))}
          </div>
        </div>

        <div className="set-section">
          <h3>Security</h3>
          <p>Add a passkey (biometric / hardware) and multi-factor authentication to your account — the same protections as AssureLocker.</p>
          <div className="set-row">
            <div><div className="sr-label">Passkey (WebAuthn)</div><div className="sr-sub">Sign in with Face ID / Touch ID / a security key.</div></div>
            <span className="pill">Coming in the security update</span>
          </div>
          <div className="set-row">
            <div><div className="sr-label">Multi-factor authentication</div><div className="sr-sub">Authenticator app (TOTP) + SMS/email one-time codes.</div></div>
            <span className="pill">Coming in the security update</span>
          </div>
        </div>
      </main>
    </>
  );
}
