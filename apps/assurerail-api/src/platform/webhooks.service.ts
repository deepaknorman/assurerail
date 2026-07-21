import { Injectable } from "@nestjs/common";
import { createHmac, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";

// Partner egress: HMAC-signed webhook delivery on venue lifecycle events, with a delivery log.
@Injectable()
export class WebhooksService {
  constructor(private readonly db: PrismaService) {}

  list() {
    return this.db.webhookSubscription.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, url: true, events: true, active: true, createdAt: true } });
  }
  async subscribe(url: string, events: string[]) {
    const secret = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const s = await this.db.webhookSubscription.create({ data: { id: `whs_${randomUUID()}`, url, secret, events: events as Prisma.InputJsonValue, active: true } });
    return { id: s.id, url: s.url, events: s.events, active: s.active, secret }; // secret shown ONCE on create
  }
  async remove(id: string) {
    await this.db.webhookSubscription.deleteMany({ where: { id } });
    return { ok: true };
  }
  deliveries(limit = 50) {
    return this.db.webhookDelivery.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(limit, 200) });
  }

  /** Fire-and-forget dispatch to all active subscriptions matching the event (HMAC-SHA256 signed). */
  async dispatch(event: string, payload: Record<string, unknown>): Promise<void> {
    const subs = await this.db.webhookSubscription.findMany({ where: { active: true } }).catch(() => []);
    if (!subs.length) return;
    const body = JSON.stringify({ event, payload, at: new Date().toISOString() });
    for (const s of subs) {
      const events = Array.isArray(s.events) ? (s.events as string[]) : [];
      if (!events.includes("*") && !events.includes(event)) continue;
      const sig = createHmac("sha256", s.secret).update(body).digest("hex");
      let statusCode = 0;
      let ok = false;
      try {
        const res = await fetch(s.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-arail-signature": `sha256=${sig}`, "x-arail-event": event },
          body,
          signal: AbortSignal.timeout(5000),
        });
        statusCode = res.status;
        ok = res.ok;
      } catch {
        statusCode = 0;
        ok = false;
      }
      await this.db.webhookDelivery.create({ data: { id: `whd_${randomUUID()}`, subscriptionId: s.id, event, statusCode, ok } }).catch(() => undefined);
    }
  }
}
