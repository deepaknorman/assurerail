"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VenueHeader } from "@/components/VenueHeader";
import { useAuth } from "@/lib/auth-context";
import { vget } from "@/lib/venue";

type Row = { id: string; seq: number; actor: string; event: string; detail: Record<string, unknown>; noteId: string | null; governed: boolean; createdAt: string; fingerprint: string };
type Resp = { total: number; windowVerified: boolean; rows: Row[] };

export default function Activity() {
  const { loading, firebaseUser, venueUser, needsOnboarding } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [err, setErr] = useState("");
  const ready = !loading && !!firebaseUser && !!venueUser && !needsOnboarding;

  const load = useCallback(async () => {
    try {
      setData(await vget<Resp>("/venue/activity?limit=100"));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) router.replace("/login");
    else if (needsOnboarding) router.replace("/onboard");
  }, [loading, firebaseUser, needsOnboarding, router]);
  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return <main className="wrap" style={{ padding: "96px 0", textAlign: "center" }}><p className="meta">Loading…</p></main>;

  return (
    <>
      <VenueHeader />
      <main className="wrap">
        <div className="console-head">
          <h1>Activity log</h1>
          <p>Every venue action, append-only and hash-chained (tamper-evident). Detail is redacted — ids, hashes and aggregates only, never holder or pool data.</p>
        </div>
        {err && <div className="msg err">{err}</div>}
        {data && (
          <>
            <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
              <span className="pill">{data.total.toLocaleString("en-IN")} events</span>
              <span className={`pill ${data.windowVerified ? "pill-ok" : "pill-warn"}`}>{data.windowVerified ? "✓ chain verified" : "⚠ chain check failed"}</span>
            </div>
            <div className="actlog">
              {data.rows.map((r) => (
                <div className="actrow" key={r.id}>
                  <div className="act-main">
                    <span className="act-ev mono">{r.event}</span>
                    {r.governed && <span className="tag tag-gov">governed</span>}
                    {r.noteId && <span className="act-note">{r.noteId}</span>}
                  </div>
                  <div className="act-meta">
                    <span>{r.actor}</span>
                    <span className="act-dot">·</span>
                    <span>{new Date(r.createdAt).toLocaleString("en-IN")}</span>
                    <span className="act-dot">·</span>
                    <span className="mono act-fp" title="chain fingerprint">{r.fingerprint}</span>
                  </div>
                </div>
              ))}
              {data.rows.length === 0 && <p className="meta" style={{ padding: 20 }}>No activity yet — mint, trade or close a note to see it here.</p>}
            </div>
          </>
        )}
      </main>
    </>
  );
}
