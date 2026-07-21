import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "../auth/public.decorator";
import { Roles, AdminOnly, ALL_ROLES } from "../auth/roles.decorator";
import { audit } from "../common/audit";
import { DocumentsService } from "./documents.service";
import { IngressService } from "./ingress.service";
import { BillingService } from "./billing.service";
import { WebhooksService } from "./webhooks.service";
import { PrismaService } from "../store/prisma.service";
import { MintRepository } from "../mint/note.repository";

const callerDid = (req: Request): string | undefined => (req as { user?: { did?: string } }).user?.did;

// ---- Documents (deal-room uploads/downloads) --------------------------------------------------
interface UploadBody {
  filename?: string;
  contentType?: string;
  contentBase64?: string;
  noteId?: string;
}

@Controller("venue/documents")
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Roles(...ALL_ROLES)
  @Get()
  list(@Query("noteId") noteId?: string) {
    return this.docs.list(noteId);
  }

  @Roles("ISSUER", "DESK", "TRUSTEE")
  @Post()
  async upload(@Body() body: UploadBody, @Req() req: Request) {
    if (!body.contentBase64 || !body.filename || !body.contentType) throw new BadRequestException("filename, contentType and contentBase64 are required");
    let buffer: Buffer;
    try {
      buffer = Buffer.from(body.contentBase64, "base64");
    } catch {
      throw new BadRequestException("contentBase64 is not valid base64");
    }
    const doc = await this.docs.upload({ originalname: body.filename, mimetype: body.contentType, size: buffer.length, buffer }, body.noteId, callerDid(req));
    audit("document.uploaded", { id: doc.id, noteId: doc.noteId, size: doc.size });
    return doc;
  }

  @Roles(...ALL_ROLES)
  @Get(":id/download")
  async download(@Param("id") id: string, @Res() res: Response) {
    const d = await this.docs.download(id);
    res.setHeader("Content-Type", d.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${d.filename.replace(/[^\w.-]/g, "_")}"`);
    res.send(Buffer.from(d.data));
  }
}

// ---- Data-feed ingress ------------------------------------------------------------------------
interface IngestBody {
  poolId?: string;
  source?: string;
  spec?: Record<string, unknown>;
}

@Controller("venue/ingress")
export class IngressController {
  constructor(private readonly ingress: IngressService) {}

  @Roles(...ALL_ROLES)
  @Get("pools")
  list() {
    return this.ingress.list();
  }

  @Roles("ISSUER", "DESK")
  @Post("pools")
  async ingest(@Body() body: IngestBody) {
    if (!body.poolId || !body.source) throw new BadRequestException("poolId and source are required");
    const p = await this.ingress.ingest(body.poolId, body.source, body.spec ?? {});
    audit("pool.ingested", { poolId: p.poolId, source: p.source });
    return p;
  }
}

// ---- Billing (usage metering) -----------------------------------------------------------------
@Controller("venue/billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Roles("ISSUER", "DESK")
  @Get("statement")
  statement() {
    return this.billing.statement();
  }

  @Roles("ISSUER", "DESK")
  @Get("events")
  events(@Query("limit") limit?: string) {
    return this.billing.recent(limit ? Number(limit) : 50);
  }
}

// ---- Webhooks (partner API egress) ------------------------------------------------------------
interface SubscribeBody {
  url?: string;
  events?: string[];
}

@AdminOnly()
@Controller("venue/webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list() {
    return this.webhooks.list();
  }

  @Post()
  async subscribe(@Body() body: SubscribeBody) {
    if (!body.url || !/^https?:\/\//.test(body.url)) throw new BadRequestException("a valid http(s) url is required");
    const events = Array.isArray(body.events) && body.events.length ? body.events : ["*"];
    const s = await this.webhooks.subscribe(body.url, events);
    audit("webhook.subscribed", { id: s.id, url: s.url, events });
    return s;
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const r = await this.webhooks.remove(id);
    audit("webhook.removed", { id });
    return r;
  }

  @Get("deliveries")
  deliveries(@Query("limit") limit?: string) {
    return this.webhooks.deliveries(limit ? Number(limit) : 50);
  }
}

// ---- Support / ops dashboard ------------------------------------------------------------------
@AdminOnly()
@Controller("venue/support")
export class SupportController {
  constructor(
    private readonly db: PrismaService,
    private readonly repo: MintRepository,
  ) {}

  @Get("events")
  async events(@Query("limit") limit?: string, @Query("event") event?: string) {
    const take = Math.min(limit ? Number(limit) : 100, 500);
    return this.db.eventLog.findMany({ where: event ? { event } : {}, orderBy: { createdAt: "desc" }, take });
  }

  @Get("overview")
  async overview() {
    const [notes, eventCount, failedDeliveries, docCount] = await Promise.all([
      this.repo.listNotes(),
      this.db.eventLog.count(),
      this.db.webhookDelivery.count({ where: { ok: false } }),
      this.db.document.count(),
    ]);
    const byState: Record<string, number> = {};
    for (const n of notes) byState[n.state] = (byState[n.state] ?? 0) + 1;
    return {
      health: "ok",
      store: "postgres",
      notes: { total: notes.length, byState },
      events: eventCount,
      documents: docCount,
      webhooks: { failedDeliveries },
      uptimeSec: Math.round(process.uptime()),
    };
  }
}

// ---- Prometheus metrics (public scrape endpoint) ----------------------------------------------
@Controller("metrics")
export class MetricsController {
  constructor(private readonly repo: MintRepository) {}

  @Public()
  @Get()
  async metrics(@Res() res: Response) {
    const notes = await this.repo.listNotes().catch(() => []);
    const byState: Record<string, number> = { ISSUED: 0, ACTIVE: 0, REDEEMED: 0 };
    for (const n of notes) byState[n.state] = (byState[n.state] ?? 0) + 1;
    const mem = process.memoryUsage();
    const lines = [
      "# HELP arail_notes_total Total notes on the venue.",
      "# TYPE arail_notes_total gauge",
      `arail_notes_total ${notes.length}`,
      "# HELP arail_notes_by_state Notes by lifecycle state.",
      "# TYPE arail_notes_by_state gauge",
      ...Object.entries(byState).map(([s, c]) => `arail_notes_by_state{state="${s}"} ${c}`),
      "# HELP arail_process_uptime_seconds Process uptime.",
      "# TYPE arail_process_uptime_seconds gauge",
      `arail_process_uptime_seconds ${Math.round(process.uptime())}`,
      "# HELP arail_process_resident_memory_bytes Resident memory.",
      "# TYPE arail_process_resident_memory_bytes gauge",
      `arail_process_resident_memory_bytes ${mem.rss}`,
    ];
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(lines.join("\n") + "\n");
  }
}
