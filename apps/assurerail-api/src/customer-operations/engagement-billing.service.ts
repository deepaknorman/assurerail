import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../store/prisma.service";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { InternalAccessService } from "../internal-access/internal-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { engagementQuote } from "./engagement-pricing";
import { exactMinor } from "./fee-calculation";
import { invoicePaymentPosition, validateReceiptReview } from "./payment-reconciliation";
import type { InternalOpsActor, ParticipantOpsActor } from "./customer-operations.service";

type Tx = Prisma.TransactionClient;
function ref(value: unknown, name: string, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BadRequestException(`${name} required (maximum ${max} characters)`);
  return value.trim();
}
function enabled() {
  if (process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE !== "shadow" || inspectPersistenceFlags(process.env).customerOperations !== "shadow") throw new ForbiddenException("engagement billing is disabled");
}

@Injectable()
export class EngagementBillingService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly staff: InternalAccessService, private readonly stepUp: StepUpService) {}

  async preview(actor: ParticipantOpsActor, body: { uniqueLoanCount?: unknown }) {
    enabled();
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "VIEW_CUSTOMER_OPERATIONS" });
    try { return { ...engagementQuote(body.uniqueLoanCount), status: "PREVIEW_NOT_ACCEPTED", paymentAuthority: false }; }
    catch (e) { throw new BadRequestException((e as Error).message); }
  }

  async paymentPosition(actor: ParticipantOpsActor, invoiceId: string) {
    enabled();
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "VIEW_CUSTOMER_OPERATIONS" });
    const invoice = await this.invoice(this.db, actor.actingInstitutionId, invoiceId);
    const receipts = await this.netReceipts(this.db, invoice.id);
    const checkout=await this.db.engagementCheckout.findUnique({where:{invoiceId:invoice.id}});
    const captured=checkout?.status==="PAID_TEST"&&checkout.mode==="TEST"&&checkout.checkedAt&&checkout.checkedAt.getTime()>Date.now()-5*60000?checkout.verifiedPaidMinor:"0";
    const position=invoicePaymentPosition(invoice.netFeeMinor,[...receipts,...(captured!=="0"?[captured]:[])]);
    const pending=await this.db.customerPaymentAdjustment.count({where:{receipt:{invoiceStatementId:invoice.id},status:"PROPOSED"}});
    return { invoiceId, operatingMode: "SHADOW", liveStageUnlock: false, ...position, bankReceiptsMinor:receipts.reduce((sum,v)=>sum+BigInt(v),0n).toString(),gatewayCapturedMinor:captured,checkoutStatus:checkout?.status??null,fullyReconciled:position.fullyReconciled&&!pending&&checkout?.status!=="HOLD",reconciliationRequired:position.reconciliationRequired||Boolean(pending)||checkout?.status==="HOLD" };
  }

  private async netReceipts(tx: Tx, invoiceId: string) {
    const receipts = await tx.customerPaymentReceipt.findMany({ where: { invoiceStatementId: invoiceId, status: "VERIFIED_SHADOW" }, include: { adjustments: true } });
    return receipts.map(r => (BigInt(r.amountMinor) - (r.adjustments ?? []).filter(a => a.status === "APPROVED").reduce((sum,a) => sum + BigInt(a.amountMinor), 0n)).toString()).filter(v => v !== "0");
  }

  async proposeAdjustment(actor: InternalOpsActor, institutionId: string, receiptId: string, body: { requestRef?: unknown; kind?: unknown; amountMinor?: unknown; evidenceRef?: unknown; evidenceDigest?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    enabled(); await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_PREPARE", scopeType: "GLOBAL", scopeRef: null });
    if (body.kind !== "REFUND" && body.kind !== "REVERSAL") throw new BadRequestException("REFUND or REVERSAL required; this records evidence of a completed movement, it does not send money");
    const kind = body.kind, evidenceRef = ref(body.evidenceRef,"evidenceRef"), evidenceDigest = ref(body.evidenceDigest,"evidenceDigest",80), reason = ref(body.reason,"reason",1000), requestRef = ref(body.requestRef,"requestRef");
    let amountMinor: string; try { amountMinor = exactMinor(body.amountMinor,"amountMinor",false); } catch(e) { throw new BadRequestException((e as Error).message); }
    return this.transaction(async tx => {
      const r = await tx.customerPaymentReceipt.findUnique({ where: { id: receiptId } });
      if (!r) throw new NotFoundException("receipt not found");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CustomerInvoiceStatement" WHERE "id" = ${r.invoiceStatementId} FOR UPDATE`);
      await this.invoice(tx,institutionId,r.invoiceStatementId);
      if (r.status !== "VERIFIED_SHADOW" || BigInt(amountMinor) > BigInt(r.amountMinor)) throw new ConflictException("verified receipt and bounded adjustment required");
      await this.evidence(tx,institutionId,evidenceRef,evidenceDigest);
      const step = ref(body.stepUpEvidenceId,"stepUpEvidenceId");
      await this.stepUp.consume({ evidenceId: step,userId: actor.actorUserId,sessionId: actor.actorSessionId,institutionId: null,purpose: "INTERNAL_PAYMENT_RECEIPT_PROPOSE" },tx);
      return tx.customerPaymentAdjustment.create({ data: { id: `padj_${randomUUID()}`, receiptId, requestRef, kind, amountMinor, evidenceRef, evidenceDigest, reason, proposedByUserId: actor.actorUserId, proposalStepUpId: step } });
    });
  }

  async reviewAdjustment(actor: InternalOpsActor, institutionId: string, adjustmentId: string, body: { decision?: unknown; stepUpEvidenceId?: unknown }) {
    enabled(); await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_REVIEW", scopeType: "GLOBAL", scopeRef: null });
    if (body.decision !== "APPROVE" && body.decision !== "REJECT") throw new BadRequestException("APPROVE or REJECT required");
    return this.transaction(async tx => {
      const a = await tx.customerPaymentAdjustment.findUnique({ where: { id: adjustmentId }, include: { receipt: true } });
      if (!a) throw new NotFoundException("adjustment not found");
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CustomerInvoiceStatement" WHERE "id" = ${a.receipt.invoiceStatementId} FOR UPDATE`);
      await this.invoice(tx,institutionId,a.receipt.invoiceStatementId);
      if (a.status !== "PROPOSED") throw new ConflictException("adjustment already decided");
      if (a.proposedByUserId === actor.actorUserId) throw new ForbiddenException("independent adjustment reviewer required");
      if (body.decision === "APPROVE") {
        await this.evidence(tx,institutionId,a.evidenceRef,a.evidenceDigest);
        const prior = await tx.customerPaymentAdjustment.findMany({ where: { receiptId: a.receiptId, status: "APPROVED" } });
        if (prior.reduce((sum,x) => sum + BigInt(x.amountMinor),BigInt(a.amountMinor)) > BigInt(a.receipt.amountMinor)) throw new ConflictException("adjustments exceed original receipt");
      }
      const step = ref(body.stepUpEvidenceId,"stepUpEvidenceId");
      await this.stepUp.consume({ evidenceId: step,userId: actor.actorUserId,sessionId: actor.actorSessionId,institutionId: null,purpose: "INTERNAL_PAYMENT_RECEIPT_REVIEW" },tx);
      return tx.customerPaymentAdjustment.update({ where: { id: adjustmentId }, data: { status: body.decision === "APPROVE" ? "APPROVED" : "REJECTED", reviewedByUserId: actor.actorUserId, reviewStepUpId: step, reviewedAt: new Date() } });
    });
  }

  private async invoice(tx: Tx, institutionId: string, invoiceId: string) {
    const invoice = await tx.customerInvoiceStatement.findUnique({ where: { id: invoiceId }, include: { customerContract: true } });
    if (!invoice || invoice.customerContract.institutionId !== institutionId) throw new NotFoundException("invoice not found");
    if (!["ISSUED_SHADOW", "CORRECTED"].includes(invoice.status) || invoice.currency !== "INR" || invoice.currencyScale !== 2) throw new ConflictException("issued INR-paise invoice required");
    return invoice;
  }

  private async evidence(tx: Tx, institutionId: string, evidenceRef: string, digest: string) {
    const e = await tx.evidenceObject.findUnique({ where: { id: evidenceRef }, include: { versions: true } });
    const v = e?.versions.find(x => x.version === e.currentVersion);
    if (!e || e.institutionId !== institutionId || e.status !== "AVAILABLE" || e.evidenceType !== "BANK_RECEIPT" || e.purpose !== "CUSTOMER_BILLING" || !v || v.validationStatus !== "VALID" || v.payloadDigest !== digest || (v.expiresAt && v.expiresAt <= new Date())) throw new ForbiddenException("current validated bank-receipt evidence for this institution required");
  }

  private async transaction<T>(fn: (tx: Tx) => Promise<T>) {
    try { return await this.db.$transaction(fn, { isolationLevel: "Serializable" }); }
    catch (e) { if (["P2002", "P2034"].includes((e as { code?: string }).code ?? "")) throw new ConflictException("duplicate transfer or concurrent reconciliation; refresh before retrying"); throw e; }
  }

  async proposeReceipt(actor: InternalOpsActor, institutionId: string, invoiceId: string, body: {
    collectionAccountRef?: unknown; bankTransferRef?: unknown; amountMinor?: unknown; evidenceRef?: unknown;
    evidenceDigest?: unknown; receivedAt?: unknown; stepUpEvidenceId?: unknown;
  }) {
    enabled(); await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_PREPARE", scopeType: "GLOBAL", scopeRef: null });
    const collectionAccountRef = ref(body.collectionAccountRef, "collectionAccountRef");
    const allowed = (process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS ?? "").split(",").map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(collectionAccountRef)) throw new ForbiddenException("collection account must be configured by the platform");
    const bankTransferRef = ref(body.bankTransferRef, "bankTransferRef").toUpperCase();
    if (!/^[A-Z0-9-]{6,100}$/.test(bankTransferRef)) throw new BadRequestException("canonical bank transfer reference required");
    let amountMinor: string;
    try { amountMinor = exactMinor(body.amountMinor, "amountMinor", false); } catch (e) { throw new BadRequestException((e as Error).message); }
    const evidenceRef = ref(body.evidenceRef, "evidenceRef"), evidenceDigest = ref(body.evidenceDigest, "evidenceDigest", 80);
    if (!/^sha256:[a-f0-9]{64}$/.test(evidenceDigest)) throw new BadRequestException("sha256 evidence digest required");
    const receivedAt = new Date(ref(body.receivedAt, "receivedAt", 40));
    if (!Number.isFinite(receivedAt.getTime()) || receivedAt > new Date()) throw new BadRequestException("valid non-future receipt date required");
    return this.transaction(async tx => {
      await this.invoice(tx, institutionId, invoiceId);
      await this.evidence(tx, institutionId, evidenceRef, evidenceDigest);
      await this.stepUp.consume({ evidenceId: ref(body.stepUpEvidenceId, "stepUpEvidenceId"), userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "INTERNAL_PAYMENT_RECEIPT_PROPOSE", institutionId: null }, tx);
      return tx.customerPaymentReceipt.create({ data: { id: `pay_${randomUUID()}`, invoiceStatementId: invoiceId, collectionAccountRef, bankTransferRef, amountMinor, currency: "INR", evidenceRef, evidenceDigest, receivedAt, proposedByUserId: actor.actorUserId, proposalStepUpId: ref(body.stepUpEvidenceId, "stepUpEvidenceId") } });
    });
  }

  async reviewReceipt(actor: InternalOpsActor, institutionId: string, receiptId: string, body: { decision?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    enabled(); await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_REVIEW", scopeType: "GLOBAL", scopeRef: null });
    if (!["APPROVE", "REJECT"].includes(String(body.decision))) throw new BadRequestException("APPROVE or REJECT required");
    const reason = ref(body.reason, "reason", 1000);
    return this.transaction(async tx => {
      const receipt = await tx.customerPaymentReceipt.findUnique({ where: { id: receiptId } });
      if (!receipt) throw new NotFoundException("receipt not found");
      // Same invoice lock as credit correction: receipt and invoice adjustments cannot race.
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CustomerInvoiceStatement" WHERE "id" = ${receipt.invoiceStatementId} FOR UPDATE`);
      const invoice = await this.invoice(tx, institutionId, receipt.invoiceStatementId);
      if (receipt.proposedByUserId === actor.actorUserId) throw new ForbiddenException("receipt proposer cannot review their own receipt");
      if (receipt.status !== "PROPOSED") throw new ConflictException("receipt is already decided");
      if (body.decision === "APPROVE") {
        await this.evidence(tx, institutionId, receipt.evidenceRef, receipt.evidenceDigest);
        const verified = await this.netReceipts(tx, invoice.id);
        try { validateReceiptReview({ proposer: receipt.proposedByUserId, reviewer: actor.actorUserId, status: receipt.status, netFeeMinor: invoice.netFeeMinor, verifiedAmounts: verified, proposedAmountMinor: receipt.amountMinor }); }
        catch (e) { throw new ConflictException((e as Error).message); }
      }
      const stepUpId = ref(body.stepUpEvidenceId, "stepUpEvidenceId");
      await this.stepUp.consume({ evidenceId: stepUpId, userId: actor.actorUserId, sessionId: actor.actorSessionId, purpose: "INTERNAL_PAYMENT_RECEIPT_REVIEW", institutionId: null }, tx);
      const claimed = await tx.customerPaymentReceipt.updateMany({ where: { id: receiptId, status: "PROPOSED" }, data: { status: body.decision === "APPROVE" ? "VERIFIED_SHADOW" : "REJECTED", reviewedByUserId: actor.actorUserId, reviewStepUpId: stepUpId, reviewedAt: new Date(), reviewReason: reason } });
      if (claimed.count !== 1) throw new ConflictException("receipt review was concurrently decided");
      return { receiptId, status: body.decision === "APPROVE" ? "VERIFIED_SHADOW" : "REJECTED", liveStageUnlock: false };
    });
  }
}
