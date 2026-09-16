import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";
import { sha256Digest } from "../contracts/v1";
import { AssessmentEngagementService, bounded, engagementEnabled } from "./assessment-engagement.service";
import type { ParticipantOpsActor } from "./customer-operations.service";
import { RazorpayAdapter, capturedPaymentAmount, validatePaymentLink, verifyRazorpayWebhook } from "./razorpay.adapter";
import { validatedDesignPartnerPayable } from "./design-partner-discount";

@Injectable()
export class EngagementCheckoutService {
  constructor(private readonly db: PrismaService, private readonly engagements: AssessmentEngagementService) {}
  private config() {
    engagementEnabled();
    if (process.env.ASSURERAIL_CHECKOUT_MODE !== "razorpay_test") throw new ForbiddenException("checkout is disabled");
    const keyId = process.env.ASSURERAIL_RAZORPAY_KEY_ID ?? "";
    const account=process.env.ASSURERAIL_RAZORPAY_ACCOUNT_ID??"";
    if(!/^acc_[A-Za-z0-9]+$/.test(account))throw new ServiceUnavailableException("stable Razorpay merchant account identity required");
    return { account, adapter: new RazorpayAdapter(keyId,process.env.ASSURERAIL_RAZORPAY_KEY_SECRET ?? "") };
  }
  async create(actor: ParticipantOpsActor, engagementId: string, stage: string) {
    await this.engagements.participant(actor,true);
    const { account, adapter } = this.config();
    const checkout = await this.engagements.transaction(async tx => {
      const e = await this.engagements.scoped(tx,actor.actingInstitutionId,engagementId);
      const invoice = e.stages.find(s => s.stage === stage)?.invoice;
      if (e.status !== "ACCEPTED_SHADOW" || e.customerContract.status !== "ACTIVE_SHADOW" || e.customerContract.expiresAt <= new Date() || !invoice || invoice.status !== "ISSUED_SHADOW") throw new ConflictException("current accepted engagement and issued invoice required");
      const s = e.stages.find(s => s.stage === stage)!;
      let payableMinor = s.expectedMinor;
      try { payableMinor = validatedDesignPartnerPayable(invoice, actor.actingInstitutionId) ?? s.expectedMinor; }
      catch { throw new ConflictException("invoice has an invalid design-partner discount"); }
      if (invoice.netFeeMinor !== payableMinor || invoice.grossFeeMinor !== s.expectedMinor) throw new ConflictException("invoice differs from accepted quote");
      const existing = await tx.engagementCheckout.findUnique({ where: { invoiceId: invoice.id } });
      if (existing) {
        if (existing.merchantAccountRef !== account) throw new ConflictException("checkout belongs to a different merchant configuration");
        return { row:existing, created:false };
      }
      const receipts = await tx.customerPaymentReceipt.count({ where: { invoiceStatementId: invoice.id, status: {in:["PROPOSED","VERIFIED_SHADOW"]} } });
      if (receipts) throw new ConflictException("bank transfer already recorded; reconcile it before opening checkout");
      const reference = `ar_${createHash("sha256").update(invoice.id).digest("hex").slice(0,32)}`;
      return { row:await tx.engagementCheckout.create({ data: { id:`checkout_${randomUUID()}`,invoiceId:invoice.id,merchantAccountRef:account,reference,amountMinor:invoice.netFeeMinor } }), created:true };
    });
    if (!checkout.created) return this.publicCheckout(checkout.row);
    try {
      const link = validatePaymentLink(await adapter.create({reference:checkout.row.reference,amountMinor:checkout.row.amountMinor}),checkout.row);
      const row = await this.db.engagementCheckout.update({ where:{id:checkout.row.id},data:{providerLinkId:link.id,checkoutUrl:link.short_url,status:"OPEN"} });
      return this.publicCheckout(row);
    } catch {
      // A timeout may follow successful creation. Never send another POST blindly.
      await this.db.engagementCheckout.update({ where:{id:checkout.row.id},data:{status:"UNKNOWN"} });
      throw new ServiceUnavailableException("checkout outcome unknown; reconcile by its existing reference before retrying");
    }
  }
  private publicCheckout(row: { id:string;status:string;checkoutUrl:string|null;mode:string }) { return { id:row.id,status:row.status,checkoutUrl:row.status === "OPEN" ? row.checkoutUrl : null,mode:row.mode,liveStageUnlock:false }; }

  async refresh(actor: ParticipantOpsActor, engagementId: string, stage: string) {
    await this.engagements.participant(actor,true);
    const e = await this.engagements.scoped(this.db,actor.actingInstitutionId,engagementId);
    const invoiceId = e.stages.find(s => s.stage === stage)?.invoiceId;
    if (!invoiceId) throw new ConflictException("stage invoice required");
    const checkout = await this.db.engagementCheckout.findUnique({ where:{invoiceId} });
    if (!checkout) throw new ConflictException("checkout has not been created");
    return this.reconcile(checkout.id);
  }
  async reconcile(id: string) {
    const { account,adapter } = this.config();
    const row = await this.db.engagementCheckout.findUniqueOrThrow({where:{id}});
    if (row.merchantAccountRef !== account) throw new ConflictException("merchant mismatch");
    if (row.status === "HOLD") return this.publicCheckout(row);
    const started = new Date();
    try {
      const matches = row.providerLinkId ? [await adapter.link(row.providerLinkId)] : await adapter.find(row.reference);
      if (matches.length !== 1) throw new Error("AMBIGUOUS_LINK_LOOKUP");
      const link = validatePaymentLink(matches[0],row);
      let verifiedPaidMinor = "0", providerPaymentId: string | null = null;
      if (link.status === "paid") {
        if (link.payments?.length !== 1) throw new Error("UNEXPECTED_PAYMENT_ALLOCATION");
        providerPaymentId = link.payments[0].payment_id;
        const payment = await adapter.payment(providerPaymentId);
        verifiedPaidMinor = capturedPaymentAmount(link,payment,row.amountMinor);
      }
      const adverse=providerPaymentId?await this.db.paymentWebhookInbox.count({where:{merchantAccountRef:account,providerPaymentId,OR:[{eventType:{startsWith:"refund."}},{eventType:{startsWith:"payment.dispute."}}]}}):0;
      const status = adverse ? "HOLD" : verifiedPaidMinor !== "0" ? "PAID_TEST" : link.status === "created" ? "OPEN" : "HOLD";
      if(adverse)verifiedPaidMinor="0";
      await this.db.engagementCheckout.updateMany({where:{id,status:{not:"HOLD"},OR:[{checkedAt:null},{checkedAt:{lte:started}}]},data:{providerLinkId:link.id,checkoutUrl:link.short_url,providerPaymentId,verifiedPaidMinor,status,checkedAt:started,reconciliationDigest:sha256Digest({linkId:link.id,providerPaymentId,verifiedPaidMinor,checkedAt:started.toISOString()})}});
      return this.publicCheckout(await this.db.engagementCheckout.findUniqueOrThrow({where:{id}}));
    } catch {
      await this.db.engagementCheckout.updateMany({where:{id,status:{not:"HOLD"},OR:[{checkedAt:null},{checkedAt:{lte:started}}]},data:{status:"UNKNOWN",verifiedPaidMinor:"0",checkedAt:started}});
      throw new ServiceUnavailableException("payment verification unavailable or mismatched; stage remains locked");
    }
  }

  async webhook(raw: Buffer | undefined, signature: string | undefined, eventId: string | undefined) {
    const {account} = this.config();
    const secrets = [process.env.ASSURERAIL_RAZORPAY_WEBHOOK_SECRET,process.env.ASSURERAIL_RAZORPAY_PREVIOUS_WEBHOOK_SECRET].filter((v):v is string => Boolean(v));
    if (!raw || !verifyRazorpayWebhook(raw,signature ?? "",secrets)) throw new ForbiddenException("invalid payment webhook signature");
    const eventRef = bounded(eventId,"eventId",160);
    let payload: Record<string,any>; try { payload = JSON.parse(raw.toString("utf8")); } catch { throw new BadRequestException("invalid webhook JSON"); }
    if(!payload||payload.account_id!==account)throw new ForbiddenException("webhook merchant account mismatch");
    const eventType = bounded(payload.event,"event",100);
    const providerLinkId = payload.payload?.payment_link?.entity?.id ?? null;
    const providerPaymentId = payload.payload?.payment?.entity?.id ?? payload.payload?.refund?.entity?.payment_id ?? payload.payload?.dispute?.entity?.payment_id ?? null;
    if ((providerLinkId !== null && (typeof providerLinkId !== "string" || !/^plink_[A-Za-z0-9]+$/.test(providerLinkId))) || (providerPaymentId !== null && (typeof providerPaymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(providerPaymentId)))) throw new BadRequestException("invalid provider entity reference");
    const payloadDigest = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
    return this.engagements.transaction(async tx => {
      const existing = await tx.paymentWebhookInbox.findUnique({where:{provider_merchantAccountRef_eventId:{provider:"RAZORPAY",merchantAccountRef:account,eventId:eventRef}}});
      if (existing) { if(existing.payloadDigest !== payloadDigest) throw new ConflictException("event identity has conflicting content"); return {received:true,replay:true}; }
      await tx.paymentWebhookInbox.create({data:{id:`pweb_${randomUUID()}`,provider:"RAZORPAY",merchantAccountRef:account,eventId:eventRef,payloadDigest,eventType,providerLinkId,providerPaymentId}});
      if (eventType.startsWith("refund.") || eventType.startsWith("payment.dispute.")) {
        // Freeze before any asynchronous API refresh. A later success event cannot clear this hold.
        if(providerPaymentId) await tx.engagementCheckout.updateMany({where:{merchantAccountRef:account,providerPaymentId},data:{status:"HOLD",verifiedPaidMinor:"0"}});
      }
      return {received:true,replay:false};
    });
  }

  async processInbox() {
    if (process.env.ASSURERAIL_CHECKOUT_MODE !== "razorpay_test") return;
    const rows = await this.db.paymentWebhookInbox.findMany({where:{status:"RECEIVED"},orderBy:{createdAt:"asc"},take:20});
    for(const event of rows) {
      if (!event.providerLinkId && !event.providerPaymentId) { await this.db.paymentWebhookInbox.update({where:{id:event.id},data:{status:"IGNORED"}}); continue; }
      const links = await this.db.engagementCheckout.findMany({where:{merchantAccountRef:event.merchantAccountRef,OR:[...(event.providerLinkId?[{providerLinkId:event.providerLinkId}]:[]),...(event.providerPaymentId?[{providerPaymentId:event.providerPaymentId}]:[])]}});
      if(!links.length) { await this.db.paymentWebhookInbox.update({where:{id:event.id},data:{status:"UNMATCHED"}}); continue; } // Retained for reconciliation; cannot starve later events.
      for(const link of links) {
        if(event.eventType.startsWith("refund.") || event.eventType.startsWith("payment.dispute.")) await this.db.engagementCheckout.update({where:{id:link.id},data:{status:"HOLD",verifiedPaidMinor:"0"}});
        else { try { await this.reconcile(link.id); } catch { continue; } }
        await this.db.paymentWebhookInbox.update({where:{id:event.id},data:{status:"PROCESSED"}});
      }
    }
  }
}
