// Client for the AssureRail venue API. Standalone origin (its own deploy). Authenticated calls attach
// the current Firebase ID token as a Bearer; the venue API verifies it (P2). Public endpoints (health,
// /venue/auth/session) accept it opportunistically.
import { auth } from "./firebase";

export const VENUE_BASE = (process.env.NEXT_PUBLIC_ASSURERAIL_VENUE_URL || "http://localhost:3006").replace(/\/$/, "");

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const u = auth.currentUser;
    if (!u) return {};
    return { authorization: `Bearer ${await u.getIdToken()}` };
  } catch {
    return {};
  }
}

export async function vget<T>(path: string): Promise<T> {
  const r = await fetch(`${VENUE_BASE}${path}`, { headers: { ...(await authHeaders()) } });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || `${path} → ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export async function vpost<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${VENUE_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { message?: string }).message || `${path} → ${r.status}`);
  return j as T;
}

// ── number formatting (Indian system) ──
const digits = (v?: string | number) => String(v ?? "").replace(/[^\d]/g, "");

/**
 * Indian digit grouping, done on the raw digit STRING (never via Number → exact at any length, and
 * never scientific/exponential notation): "5000000000" → "5,00,00,00,000" (last 3, then pairs).
 */
export const grp = (v?: string | number) => {
  const d = digits(v).replace(/^0+(?=\d)/, "");
  if (!d) return "";
  if (d.length <= 3) return d;
  const last3 = d.slice(-3);
  const head = d.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${last3}`;
};

/** Compact magnitude hint (readable at a glance): ≥1 Cr → "X Cr", ≥1 L → "X L", else the grouped number. */
export const shortIN = (v?: string | number) => {
  const d = digits(v);
  const n = Number(d);
  if (!n) return "";
  const trim = (x: number) => x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (n >= 1e7) return `${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `${trim(n / 1e5)} L`;
  return grp(d);
};

/** Display amount: comma-grouped ₹ (Indian), full number. "5000000000" → "₹5,00,00,00,000". */
export const inr = (v?: string | number) => {
  const g = grp(v);
  return g ? `₹${g}` : "—";
};

export const shortDid = (d: string) => (d && d.length > 20 ? `…${d.slice(-16)}` : d || "—");
