"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { FeedbackBanner } from "@/components/FeedbackBanner";

type LoginAction = "" | "google" | "email";

export default function Login() {
  const { firebaseUser, venueUser, needsOnboarding, loading, error, clearError, loginGoogle, loginEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busyAction, setBusyAction] = useState<LoginAction>("");
  const [interactive, setInteractive] = useState(false);
  const busy = busyAction !== "";

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "register") setRegister(true);
    setInteractive(true);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && venueUser) router.replace(needsOnboarding ? "/onboard" : "/console");
  }, [loading, firebaseUser, venueUser, needsOnboarding, router]);

  async function go(action: Exclude<LoginAction, "">, fn: () => Promise<void>) {
    clearError();
    setBusyAction(action);
    try {
      await fn();
    } catch {
      /* error is surfaced via context */
    } finally {
      setBusyAction("");
    }
  }

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email || !password) return;
    void go("email", () => loginEmail(email, password, register));
  }

  function changeMode() {
    clearError();
    setPassword("");
    const next = !register;
    setRegister(next);
    router.replace(next ? "/login?mode=register" : "/login", { scroll: false });
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
          <h1>{register ? "Create your institutional account" : "Sign in"}</h1>
          <p className="auth-sub">{register ? "Create the account that will hold your organisation's assessment application and onboarding record." : "Access your institution's assessments, preparation work and transaction cases."}</p>
          <FeedbackBanner error={error} id="auth-feedback" />

          <button className="btn btn-google" type="button" disabled={!interactive || busy} aria-busy={busyAction === "google"} onClick={() => void go("google", loginGoogle)}>
            {busyAction === "google" ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <div className="auth-or"><span>or</span></div>

          <form className="auth-form" onSubmit={submitEmail} aria-busy={!interactive || busyAction === "email"}>
            <label className="lbl">Email<input className="field" type="email" autoComplete="email" required disabled={!interactive} value={email} onChange={(e) => { setEmail(e.target.value); clearError(); }} /></label>
            <label className="lbl">Password<input className="field" type="password" autoComplete={register ? "new-password" : "current-password"} required disabled={!interactive} minLength={6} aria-describedby={register ? "password-guidance" : undefined} value={password} onChange={(e) => { setPassword(e.target.value); clearError(); }} /></label>
            {register && <p className="auth-guidance" id="password-guidance">Use at least 6 characters. A longer, unique password is safer.</p>}
            <button className="btn btn-primary" type="submit" disabled={!interactive || busy || !email || !password} aria-busy={busyAction === "email"}>
              {busyAction === "email" ? (register ? "Creating account…" : "Signing in…") : register ? "Create account" : "Sign in"}
            </button>
          </form>
          <button className="linkish" type="button" disabled={!interactive || busy} onClick={changeMode}>{register ? "Have an account? Sign in" : "New here? Create an account"}</button>

          <p className="auth-fine">Protected by reCAPTCHA Enterprise. Sandbox / design stage — institutional &amp; professional counterparties only.</p>
        </div>
      </main>
    </>
  );
}
