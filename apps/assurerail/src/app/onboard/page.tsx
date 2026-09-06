"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Onboard() {
  const { firebaseUser, venueUser, needsOnboarding, loading, error, onboard, logout } = useAuth();
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (venueUser && !needsOnboarding) router.replace("/institutions");
  }, [loading, firebaseUser, venueUser, needsOnboarding, router]);

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      await onboard(subject.trim() || undefined);
      router.replace("/institutions");
    } catch (e) {
      setErr((e as Error).message);
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
          <nav><button className="linkish" onClick={() => logout()}>Sign out</button></nav>
        </div>
      </header>

      <main className="wrap auth-wrap">
        <div className="auth-card">
          <h1>Verify your identity</h1>
          <p className="auth-sub">Bind identity evidence from the provider approved for this deployment before applying for or joining an institution. Identity binding alone grants no participant or route access.</p>
          {(err || error) && <div className="msg err">{err || error}</div>}

          <label className="lbl">
            Provider subject reference <span className="opt">(optional in sandbox)</span>
            <input className="field" placeholder="Provider subject reference" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Binding…" : "Bind identity"}</button>

          <p className="auth-fine">Signed in as {venueUser?.email ?? firebaseUser?.email ?? "…"}.</p>
        </div>
      </main>
    </>
  );
}
