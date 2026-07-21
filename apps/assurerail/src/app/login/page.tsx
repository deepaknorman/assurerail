"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Login() {
  const { firebaseUser, venueUser, needsOnboarding, loading, error, loginGoogle, loginEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && venueUser) router.replace(needsOnboarding ? "/onboard" : "/console");
  }, [loading, firebaseUser, venueUser, needsOnboarding, router]);

  async function go(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch {
      /* error is surfaced via context */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.svg" alt="AssureRail" className="brand-logo" /></Link>
        </div>
      </header>

      <main className="wrap auth-wrap">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="auth-sub">Access is gated on an existing AssureLocker DigiKYC identity.</p>
          {error && <div className="msg err">{error}</div>}

          <button className="btn btn-google" disabled={busy} onClick={() => go(loginGoogle)}>Continue with Google</button>
          <div className="auth-or"><span>or</span></div>

          <label className="lbl">Email<input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="lbl">Password<input className="field" type="password" autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn btn-primary" disabled={busy || !email || !password} onClick={() => go(() => loginEmail(email, password, register))}>
            {busy ? "…" : register ? "Create account" : "Sign in"}
          </button>
          <button className="linkish" onClick={() => setRegister(!register)}>{register ? "Have an account? Sign in" : "New here? Create an account"}</button>

          <p className="auth-fine">Protected by reCAPTCHA Enterprise. Sandbox / design stage — institutional &amp; professional counterparties only.</p>
        </div>
      </main>
    </>
  );
}
