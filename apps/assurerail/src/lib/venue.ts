// Client for the AssureRail venue API. Standalone origin (its own deploy). Authenticated calls attach
// the current Firebase ID token as a Bearer; the venue API verifies it (P2). Public endpoints (health,
// /venue/auth/session) accept it opportunistically.
import { auth } from "./firebase";
import { UserFacingError, userFacingError } from "./user-facing-error";

export const VENUE_BASE = (process.env.NEXT_PUBLIC_ASSURERAIL_VENUE_URL || "http://localhost:3006").replace(/\/$/, "");

const ACTIVE_INSTITUTION_KEY = "arail-active-institution";

export interface VenueRequestOptions {
  /** undefined = current participant context; null = explicitly no participant context. */
  institutionId?: string | null;
}

export class VenueRequestError extends UserFacingError {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "VenueRequestError";
  }
}

function responseMessage(status: number, path: string): string {
  if (status === 400) return "We could not process that request. Review the information and try again.";
  if (status === 401) return "Your session has expired. Sign in again to continue.";
  if (status === 403) return "Your account does not have permission to complete that action.";
  if (status === 404) return "The requested record is no longer available in this workspace.";
  if (status === 409) return "This record changed while you were working. Refresh it before trying again.";
  if (status === 413) return "The selected file is too large for this upload.";
  if (status === 415) return "This file format is not supported for the selected document type.";
  if (status === 422) return "Some information could not be validated. Review the entries and try again.";
  if (status === 429) return "Too many requests were received. Wait a moment and try again.";
  if (status >= 500) return "AssureRail is temporarily unable to complete this action. Please try again shortly.";
  return path.includes("upload")
    ? "The file could not be uploaded. Check the file and try again."
    : "We could not complete that action. Please try again.";
}

async function venueFetch(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${VENUE_BASE}${path}`, init);
  } catch (cause) {
    throw new VenueRequestError(userFacingError(cause, "We could not reach AssureRail. Check your connection and try again."), null);
  }
}

export function currentInstitutionContext(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_INSTITUTION_KEY)?.trim() || null;
}

export function rememberInstitutionContext(institutionId: string | null): void {
  if (typeof window === "undefined") return;
  if (institutionId) window.localStorage.setItem(ACTIVE_INSTITUTION_KEY, institutionId);
  else window.localStorage.removeItem(ACTIVE_INSTITUTION_KEY);
}

async function authHeaders(options: VenueRequestOptions = {}): Promise<Record<string, string>> {
  try {
    const u = auth.currentUser;
    if (!u) return {};
    const institutionId = options.institutionId === undefined
      ? currentInstitutionContext()
      : options.institutionId;
    return {
      authorization: `Bearer ${await u.getIdToken()}`,
      ...(institutionId ? { "x-assurerail-institution-id": institutionId } : {}),
    };
  } catch {
    return {};
  }
}

export async function vget<T>(path: string, options: VenueRequestOptions = {}): Promise<T> {
  const r = await venueFetch(path, { headers: { ...(await authHeaders(options)) } });
  if (!r.ok) {
    throw new VenueRequestError(responseMessage(r.status, path), r.status);
  }
  return r.json() as Promise<T>;
}

export async function vpost<T>(path: string, body?: unknown, options: VenueRequestOptions = {}): Promise<T> {
  const r = await venueFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders(options)) },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new VenueRequestError(responseMessage(r.status, path), r.status);
  return j as T;
}

export async function vpostRaw<T>(
  path: string,
  body: Blob,
  metadata: Record<string, unknown>,
  options: VenueRequestOptions = {},
): Promise<T> {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(metadata))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const r = await venueFetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "x-assurerail-document-metadata": encoded,
      ...(await authHeaders(options)),
    },
    body,
  });
  const result = await r.json().catch(() => ({}));
  if (!r.ok) throw new VenueRequestError(responseMessage(r.status, path), r.status);
  return result as T;
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
export async function vpatch<T>(path: string, body?: unknown, options: VenueRequestOptions = {}): Promise<T> {
  const r = await venueFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeaders(options)) },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new VenueRequestError(responseMessage(r.status, path), r.status);
  return j as T;
}

export const inr = (v?: string | number) => {
  const g = grp(v);
  return g ? `₹${g}` : "—";
};

export const shortDid = (d: string) => (d && d.length > 20 ? `…${d.slice(-16)}` : d || "—");

export async function vdelete<T>(path: string, options: VenueRequestOptions = {}): Promise<T> {
  const r = await venueFetch(path, { method: "DELETE", headers: { ...(await authHeaders(options)) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new VenueRequestError(responseMessage(r.status, path), r.status);
  return j as T;
}

/** Authenticated file download (CSV/report/document) — attaches the Bearer, then saves the blob. */
export async function vdownload(path: string, filename: string, options: VenueRequestOptions = {}): Promise<void> {
  const r = await venueFetch(path, { headers: { ...(await authHeaders(options)) } });
  if (!r.ok) throw new VenueRequestError(responseMessage(r.status, path), r.status);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
