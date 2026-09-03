import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { qualificationStage, validateReplayInquiry } from "@/lib/inbound-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8_192;
const WINDOW_MS = 15 * 60_000;
const MAX_PER_WINDOW = 5;
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function clientKey(request: NextRequest) {
  return request.headers.get("x-azure-clientip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

function takeRateLimit(key: string) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [candidate, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(candidate);
      if (buckets.size >= MAX_BUCKETS) return false;
    }
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

async function readBoundedBody(request: NextRequest) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : null);
  if (!ipv4) return false;
  const parts = ipv4.split(".").map(Number);
  return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

async function approvedWebhook() {
  const raw = process.env.ASSURERAIL_INBOUND_WEBHOOK_URL;
  const allowed = (process.env.ASSURERAIL_INBOUND_ALLOWED_HOSTS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!raw || !allowed.length) throw new Error("inbound destination unavailable");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || !allowed.includes(url.hostname.toLowerCase())) throw new Error("inbound destination rejected");
  if (isPrivateAddress(url.hostname) || url.hostname === "localhost") throw new Error("inbound destination rejected");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("inbound destination rejected");
  return url;
}

export async function POST(request: NextRequest) {
  if (process.env.ASSURERAIL_INBOUND_ENABLED !== "yes") return json(503, { accepted: false, message: "Replay enquiries are temporarily unavailable." });
  const allowedOrigins = (process.env.ASSURERAIL_PUBLIC_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) return json(403, { accepted: false, message: "Request origin rejected." });
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return json(415, { accepted: false, message: "JSON is required." });
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BYTES) return json(413, { accepted: false, message: "Request is too large." });
  if (!takeRateLimit(clientKey(request))) return json(429, { accepted: false, message: "Please wait before trying again." });

  const raw = await readBoundedBody(request);
  if (raw === null) return json(413, { accepted: false, message: "Request is too large." });
  let candidate: unknown;
  try { candidate = JSON.parse(raw); } catch { return json(400, { accepted: false, message: "Invalid request." }); }
  const parsed = validateReplayInquiry(candidate);
  if (!parsed.ok) return json(400, { accepted: false, message: parsed.error });

  const secret = process.env.ASSURERAIL_INBOUND_WEBHOOK_SECRET ?? "";
  if (secret.length < 32) return json(503, { accepted: false, message: "Replay enquiries are temporarily unavailable." });
  let webhook: URL;
  try { webhook = await approvedWebhook(); } catch { return json(503, { accepted: false, message: "Replay enquiries are temporarily unavailable." }); }

  const { website: _honeypot, ...inquiry } = parsed.data;
  void _honeypot;
  const requestId = randomUUID();
  const submittedAt = new Date().toISOString();
  const outbound = JSON.stringify({
    schemaVersion: 1,
    eventType: "ASSURERAIL_REPLAY_INQUIRY_RECEIVED",
    requestId,
    submittedAt,
    source: "assurerail-public",
    qualificationStage: qualificationStage(parsed.data),
    inquiry,
  });
  const signature = createHmac("sha256", secret).update(`${submittedAt}.${outbound}`).digest("hex");
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json", "x-assurerail-event-id": requestId, "x-assurerail-timestamp": submittedAt, "x-assurerail-signature": `sha256=${signature}` },
      body: outbound,
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!response.ok) return json(502, { accepted: false, message: "We could not record the enquiry. Please try again later." });
  } catch {
    return json(502, { accepted: false, message: "We could not record the enquiry. Please try again later." });
  }
  return json(202, { accepted: true, requestId, message: "Enquiry recorded. We will contact you about the appropriate first proof." });
}
