// Client for the AssureRail venue API. Standalone origin (its own deploy); DEMO endpoints are
// unauthenticated for now (auth lands in P2).
export const VENUE_BASE = (process.env.NEXT_PUBLIC_ASSURERAIL_VENUE_URL || "http://localhost:3006").replace(/\/$/, "");

export async function vget<T>(path: string): Promise<T> {
  const r = await fetch(`${VENUE_BASE}${path}`);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export async function vpost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${VENUE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { message?: string }).message || `${path} → ${r.status}`);
  return j as T;
}

export const inr = (minor?: string) => (minor ? `₹${(Number(minor) / 100_00_00_000).toFixed(2)} cr` : "—");
export const shortDid = (d: string) => (d && d.length > 20 ? `…${d.slice(-16)}` : d || "—");
