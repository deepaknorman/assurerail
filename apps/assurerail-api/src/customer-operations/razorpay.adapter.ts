import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRazorpayWebhook(raw: Buffer, signature: string, secrets: string[]) {
  if (!raw.length || raw.length > 100_000 || !/^[a-f0-9]{64}$/.test(signature) || !secrets.length) return false;
  let valid = false;
  for (const secret of secrets) {
    if (secret.length < 32) continue;
    const expected = createHmac("sha256",secret).update(raw).digest();
    valid = timingSafeEqual(expected,Buffer.from(signature,"hex")) || valid;
  }
  return valid;
}
export type RazorpayLink = { id: string; reference_id: string; amount: number; amount_paid: number; currency: string; status: string; short_url: string; payments?: { payment_id: string; amount: number; status: string }[]; };
export type RazorpayPayment = { id: string; amount: number; currency: string; status: string; captured: boolean; amount_refunded: number; refund_status: string | null; };
export function validatePaymentLink(link: RazorpayLink, expected: { reference: string; amountMinor: string }) {
  if (!/^plink_[A-Za-z0-9]+$/.test(link.id) || link.reference_id !== expected.reference || !Number.isSafeInteger(link.amount) || String(link.amount) !== expected.amountMinor || link.currency !== "INR") throw new Error("PAYMENT_LINK_MISMATCH");
  const url = new URL(link.short_url);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !["rzp.io", "rzppay.co"].includes(url.hostname)) throw new Error("UNTRUSTED_CHECKOUT_URL");
  return link;
}
export function capturedPaymentAmount(link: RazorpayLink, payment: RazorpayPayment, expected: string) {
  if (!Number.isSafeInteger(payment.amount) || !Number.isSafeInteger(link.amount_paid) || payment.amount <= 0 || String(payment.amount) !== expected || String(link.amount_paid) !== expected || link.status !== "paid" || payment.currency !== "INR" || payment.status !== "captured" || payment.captured !== true || payment.amount_refunded !== 0 || payment.refund_status !== null) throw new Error("PAYMENT_NOT_FULLY_CAPTURED_OR_REVERSED");
  if (!link.payments?.some(p => p.payment_id === payment.id && p.amount === payment.amount && p.status === "captured")) throw new Error("PAYMENT_DOES_NOT_BELONG_TO_LINK");
  return expected;
}

/** Direct official API; no configurable arbitrary egress origin or redirected credentials. */
export class RazorpayAdapter {
  constructor(private readonly keyId: string, private readonly keySecret: string, private readonly http: typeof fetch = fetch) {
    // Until real invoice/production activation is approved, this adapter accepts only test credentials.
    if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId) || keySecret.length < 16) throw new Error("RAZORPAY_TEST_CREDENTIALS_REQUIRED");
  }
  private async call<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.http(`https://api.razorpay.com/v1/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`, "Content-Type": "application/json" }, ...(body ? {body:JSON.stringify(body)} : {}), redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`RAZORPAY_HTTP_${res.status}`);
    if (!res.body) throw new Error("RAZORPAY_EMPTY_RESPONSE");
    const reader = res.body.getReader(); let size = 0; const parts: Buffer[] = [];
    try { for (;;) { const r = await reader.read(); if(r.done)break; size += r.value.byteLength; if(size > 256000) throw new Error("RAZORPAY_RESPONSE_TOO_LARGE"); parts.push(Buffer.from(r.value)); } } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(parts).toString("utf8")) as T;
  }
  create(input: { reference: string; amountMinor: string }) {
    const amount = Number(input.amountMinor);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !/^[a-zA-Z0-9_-]{1,40}$/.test(input.reference)) throw new Error("INVALID_CHECKOUT_INPUT");
    return this.call<RazorpayLink>("payment_links",{ amount, currency: "INR", reference_id: input.reference, accept_partial: false, description: "AssureRail professional services", notify: { sms:false,email:false }, reminder_enable:false, expire_by: Math.floor(Date.now()/1000)+7*86400 });
  }
  link(id: string) { if (!/^plink_[A-Za-z0-9]+$/.test(id)) throw new Error("INVALID_LINK_ID"); return this.call<RazorpayLink>(`payment_links/${id}`); }
  payment(id: string) { if (!/^pay_[A-Za-z0-9]+$/.test(id)) throw new Error("INVALID_PAYMENT_ID"); return this.call<RazorpayPayment>(`payments/${id}`); }
  async find(reference: string) {
    const r = await this.call<{payment_links?: RazorpayLink[]} | RazorpayLink>(`payment_links?reference_id=${encodeURIComponent(reference)}`);
    if ("id" in r) return [r];
    if (!Array.isArray(r.payment_links)) throw new Error("INVALID_LINK_SEARCH");
    return r.payment_links;
  }
}
