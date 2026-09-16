import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { InternalAccessService } from "../internal-access/internal-access.service";
import { PrismaService } from "../store/prisma.service";
import { asJson, bounded, engagementEnabled } from "./assessment-engagement.service";
import type { InternalOpsActor, ParticipantOpsActor } from "./customer-operations.service";
import { validatedDesignPartnerPayable } from "./design-partner-discount";
import { exactMinor, type ExactFeeRule } from "./fee-calculation";
import { executionFeeCalculation, executionFeeRecordDigest, executionFeeSettlementLeg, executionFeeStatementDigest } from "./execution-fee-invoice";

type Tx = Prisma.TransactionClient;
type AcceptedQuote = {
  executionMinimumMinor: string;
  standalonePremiumMinor: string;
};
const dimensions = { transactionRoute: "DA", representation: "CONVENTIONAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE" };

@Injectable()
export class ExecutionFeeInvoiceService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly staff: InternalAccessService, private readonly stepUp: StepUpService) {}

  private async transaction<T>(fn: (tx: Tx) => Promise<T>) {
    try { return await this.db.$transaction(fn, { isolationLevel: "Serializable" }); }
    catch (error) { if (["P2002", "P2034"].includes((error as {code?: string}).code ?? "")) throw new ConflictException("execution invoice changed concurrently; refresh before retrying"); throw error; }
  }

  private async participant(actor: ParticipantOpsActor) {
    engagementEnabled();
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "VIEW_CUSTOMER_OPERATIONS" });
  }

  private active(contract: { status: string; effectiveAt: Date; expiresAt: Date; currency: string; currencyScale: number }) {
    const now = new Date();
    if (contract.status !== "ACTIVE_SHADOW" || contract.effectiveAt > now || contract.expiresAt <= now || contract.currency !== "INR" || contract.currencyScale !== 2) throw new ConflictException("current accepted INR-paise contract required");
  }

  private async assertPreparationPaid(tx: Tx, engagementId: string) {
    const stage = await tx.assessmentEngagementStage.findUnique({
      where: { engagementId_stage: { engagementId, stage: "PREPARATION" } },
      include: { invoice: { include: { paymentReceipts: { include: { adjustments: true } }, checkout: true } } },
    });
    if (!stage?.invoice || stage.invoice.status !== "ISSUED_SHADOW") throw new ConflictException("issued Portfolio Preparation invoice required before execution invoicing");
    const receipts = stage.invoice.paymentReceipts;
    if (receipts.some(receipt => receipt.adjustments.some(adjustment => adjustment.status === "PROPOSED"))) throw new ConflictException("Portfolio Preparation payment adjustment is unresolved");
    const bankPaid = receipts.filter(receipt => receipt.status === "VERIFIED_SHADOW").reduce((sum, receipt) => sum + BigInt(receipt.amountMinor) - receipt.adjustments.filter(adjustment => adjustment.status === "APPROVED").reduce((part, adjustment) => part + BigInt(adjustment.amountMinor), 0n), 0n);
    const checkoutPaid = stage.invoice.checkout?.status === "PAID_TEST" ? BigInt(stage.invoice.checkout.verifiedPaidMinor) : 0n;
    const disputedCheckout = stage.invoice.checkout?.providerPaymentId ? await tx.paymentWebhookInbox.count({ where: { merchantAccountRef: stage.invoice.checkout.merchantAccountRef, providerPaymentId: stage.invoice.checkout.providerPaymentId, OR: [{ eventType: { startsWith: "refund." } }, { eventType: { startsWith: "payment.dispute." } }] } }) : 0;
    if (disputedCheckout) throw new ConflictException("Portfolio Preparation payment has an unresolved refund or dispute event");
    if (bankPaid + checkoutPaid !== BigInt(stage.invoice.netFeeMinor)) throw new ConflictException("Portfolio Preparation must be paid before execution invoicing");
  }

  async prepare(actor: InternalOpsActor, institutionId: string, engagementId: string, body: {
    requestRef?: unknown;
    transactionCaseId?: unknown;
    closingRef?: unknown;
    acceptedCumulativeConsiderationMinor?: unknown;
    considerationAcceptanceDigest?: unknown;
    sellerAcceptanceEvidenceRef?: unknown;
    buyerAcceptanceEvidenceRef?: unknown;
    acceptedAt?: unknown;
    stepUpEvidenceId?: unknown;
  }) {
    engagementEnabled();
    await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_PREPARE", scopeType: "GLOBAL", scopeRef: null });
    const requestRef = bounded(body.requestRef, "requestRef");
    const transactionCaseId = bounded(body.transactionCaseId, "transactionCaseId");
    const closingRef = bounded(body.closingRef, "closingRef");
    let acceptedCumulativeConsiderationMinor: string;
    try { acceptedCumulativeConsiderationMinor = exactMinor(body.acceptedCumulativeConsiderationMinor, "acceptedCumulativeConsiderationMinor", false); }
    catch (error) { throw new BadRequestException((error as Error).message); }
    const considerationAcceptanceDigest = bounded(body.considerationAcceptanceDigest, "considerationAcceptanceDigest", 80);
    if (!/^sha256:[a-f0-9]{64}$/.test(considerationAcceptanceDigest)) throw new BadRequestException("considerationAcceptanceDigest must be a lowercase sha256 digest");
    const sellerAcceptanceEvidenceRef = bounded(body.sellerAcceptanceEvidenceRef, "sellerAcceptanceEvidenceRef", 500);
    const buyerAcceptanceEvidenceRef = bounded(body.buyerAcceptanceEvidenceRef, "buyerAcceptanceEvidenceRef", 500);
    if (sellerAcceptanceEvidenceRef === buyerAcceptanceEvidenceRef) throw new BadRequestException("separate seller and buyer acceptance evidence is required");
    const acceptedAt = new Date(bounded(body.acceptedAt, "acceptedAt", 80));
    if (!Number.isFinite(acceptedAt.getTime()) || acceptedAt > new Date()) throw new BadRequestException("acceptedAt must be a valid non-future instant");
    const step = bounded(body.stepUpEvidenceId, "stepUpEvidenceId");

    return this.transaction(async tx => {
      const existing = await tx.executionFeeInvoice.findUnique({ where: { engagementId_requestRef: { engagementId, requestRef } }, include: { invoiceStatement: true } });
      if (existing) {
        const sameRequest = existing.sellerInstitutionId === institutionId && existing.transactionCaseId === transactionCaseId && existing.closingRef === closingRef && existing.acceptedCumulativeConsiderationMinor === acceptedCumulativeConsiderationMinor && existing.considerationAcceptanceDigest === considerationAcceptanceDigest && existing.sellerAcceptanceEvidenceRef === sellerAcceptanceEvidenceRef && existing.buyerAcceptanceEvidenceRef === buyerAcceptanceEvidenceRef && existing.acceptedAt.getTime() === acceptedAt.getTime();
        if (!sameRequest) throw new ConflictException("requestRef was reused with different execution-invoice input");
        return existing;
      }
      const engagement = await tx.assessmentEngagement.findUnique({ where: { id: engagementId }, include: { customerContract: true } });
      if (!engagement || engagement.customerContract.institutionId !== institutionId) throw new NotFoundException("engagement not found");
      this.active(engagement.customerContract);
      if (engagement.status !== "ACCEPTED_SHADOW" || !engagement.route) throw new ConflictException("accepted engagement and Portfolio Preparation route required");
      await this.assertPreparationPaid(tx, engagementId);
      const transactionCase = await tx.transactionCase.findFirst({
        where: { id: transactionCaseId, transactionRoute: "DA", representation: "CONVENTIONAL", status: { notIn: ["CANCELLED", "COMPLETED"] }, ownerInstitutionId: institutionId, parties: { some: { institutionId, partyRole: "TRANSFEROR", status: "ACTIVE" } } },
        include: { parties: { where: { status: "ACTIVE" } } },
      });
      if (!transactionCase) throw new NotFoundException("active seller-owned conventional DA case not found");
      if (!transactionCase.parties.some(party => party.partyRole === "TRANSFEREE" && party.institutionId !== institutionId)) throw new ConflictException("active buyer/transferee acceptance is required before execution invoicing");
      const proposed = await tx.executionFeeInvoice.findFirst({ where: { engagementId, transactionCaseId, status: "PROPOSED" } });
      if (proposed) throw new ConflictException("an execution invoice is already awaiting independent review");
      const previous = await tx.executionFeeInvoice.findFirst({ where: { engagementId, transactionCaseId, status: "APPROVED" }, orderBy: { sequence: "desc" } });
      const latestAttempt = await tx.executionFeeInvoice.findFirst({ where: { engagementId, transactionCaseId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
      const previousCumulativeConsiderationMinor = previous?.acceptedCumulativeConsiderationMinor ?? "0";
      const sequence = (latestAttempt?.sequence ?? 0) + 1;
      const previouslyAppliedPremiumMinor = (await tx.executionFeeInvoice.findMany({ where: { engagementId, transactionCaseId, status: "APPROVED" }, select: { appliedPremiumCreditMinor: true } })).reduce((sum, invoice) => sum + BigInt(invoice.appliedPremiumCreditMinor), 0n).toString();
      const quote = engagement.quote as unknown as AcceptedQuote;
      const eligibleStandalonePremiumMinor = engagement.route === "STANDALONE" ? quote.standalonePremiumMinor : "0";
      const card = await tx.customerRateCard.findUnique({ where: { id: engagement.rateCardId }, include: { feeRules: true } });
      const taxRule = card?.feeRules.find(rule => rule.metric === "ENGAGEMENT_TAX" && Object.entries(dimensions).every(([key, value]) => rule[key as keyof typeof dimensions] === value));
      if (!taxRule) throw new ConflictException("accepted GST rule unavailable");
      const coupon = await tx.customerDesignPartnerCoupon.findFirst({ where: { institutionId, status: "APPROVED" } });
      let calculation;
      try {
        calculation = executionFeeCalculation({ sellerInstitutionId: institutionId, engagementId, transactionCaseId, closingRef, sequence, acceptedMinimumMinor: quote.executionMinimumMinor, previousCumulativeConsiderationMinor, acceptedCumulativeConsiderationMinor, eligibleStandalonePremiumMinor, previouslyAppliedPremiumMinor, considerationAcceptanceDigest, sellerAcceptanceEvidenceRef, buyerAcceptanceEvidenceRef, acceptedAt: acceptedAt.toISOString(), taxRule: taxRule as ExactFeeRule, coupon });
      } catch (error) { throw new BadRequestException((error as Error).message); }
      if (calculation.incrementalGrossBaseMinor === "0") throw new ConflictException("accepted cumulative consideration does not create an incremental execution fee");
      await this.stepUp.consume({ evidenceId: step, userId: actor.actorUserId, sessionId: actor.actorSessionId, institutionId: null, purpose: "INTERNAL_INVOICE_PREPARE" }, tx);
      const invoiceId = `inv_${randomUUID()}`;
      const executionInvoiceId = `efi_${randomUUID()}`;
      const now = new Date();
      const statementRef = `EXEC:${engagementId}:${sequence}`;
      const statementDigest = executionFeeStatementDigest({ executionInvoiceId, executionSnapshotDigest: calculation.snapshotDigest, statementRef, grossFeeMinor: calculation.invoiceGrossTotalMinor, creditMinor: calculation.designPartnerTotalCreditMinor, netFeeMinor: calculation.netTotalMinor });
      await tx.customerInvoiceStatement.create({ data: { id: invoiceId, customerContractId: engagement.customerContractId, customerRateCardId: engagement.rateCardId, statementRef, periodStart: acceptedAt, periodEnd: now > acceptedAt ? now : new Date(acceptedAt.getTime() + 1), currency: "INR", currencyScale: 2, grossFeeMinor: calculation.invoiceGrossTotalMinor, creditMinor: calculation.designPartnerTotalCreditMinor, netFeeMinor: calculation.netTotalMinor, statementDigest, preparedByUserId: actor.actorUserId, preparationStepUpId: step } });
      if (coupon && calculation.invoiceDiscount) await tx.customerInvoiceDiscount.create({ data: {
        id: `idisc_${randomUUID()}`, invoiceId, couponId: coupon.id, programmeCode: calculation.invoiceDiscount.programmeCode,
        discountBps: calculation.invoiceDiscount.discountBps, standardBaseMinor: calculation.invoiceDiscount.standardBaseMinor,
        standardTaxMinor: calculation.invoiceDiscount.standardTaxMinor, standardTotalMinor: calculation.invoiceDiscount.standardTotalMinor,
        discountedBaseMinor: calculation.invoiceDiscount.discountedBaseMinor, discountedTaxMinor: calculation.invoiceDiscount.discountedTaxMinor,
        discountedTotalMinor: calculation.invoiceDiscount.discountedTotalMinor, baseCreditMinor: calculation.invoiceDiscount.baseCreditMinor,
        taxCreditMinor: calculation.invoiceDiscount.taxCreditMinor, totalCreditMinor: calculation.invoiceDiscount.totalCreditMinor,
        snapshotDigest: calculation.invoiceDiscount.snapshotDigest,
      } });
      return tx.executionFeeInvoice.create({ data: {
        id: executionInvoiceId, sellerInstitutionId: institutionId, engagementId, transactionCaseId, invoiceStatementId: invoiceId, requestRef, closingRef, sequence,
        policyVersion: calculation.policyVersion, policyDigest: calculation.policyDigest, acceptedMinimumMinor: calculation.acceptedMinimumMinor,
        previousCumulativeConsiderationMinor: calculation.previousCumulativeConsiderationMinor, acceptedCumulativeConsiderationMinor: calculation.acceptedCumulativeConsiderationMinor,
        considerationAcceptanceDigest, sellerAcceptanceEvidenceRef, buyerAcceptanceEvidenceRef, acceptedAt,
        cumulativeGrossBaseMinor: calculation.cumulativeGrossBaseMinor, incrementalGrossBaseMinor: calculation.incrementalGrossBaseMinor,
        eligibleStandalonePremiumMinor, previouslyAppliedPremiumMinor, appliedPremiumCreditMinor: calculation.appliedPremiumCreditMinor, remainingPremiumMinor: calculation.remainingPremiumMinor,
        postPremiumBaseMinor: calculation.postPremiumBaseMinor, designPartnerCouponId: calculation.designPartnerCouponId,
        designPartnerProgrammeCode: calculation.designPartnerProgrammeCode, designPartnerDiscountBps: calculation.designPartnerDiscountBps,
        designPartnerCreditBaseMinor: calculation.designPartnerCreditBaseMinor, netBaseMinor: calculation.netBaseMinor,
        grossTaxMinor: calculation.grossTaxMinor, premiumTaxCreditMinor: calculation.premiumTaxCreditMinor,
        designPartnerTaxCreditMinor: calculation.designPartnerTaxCreditMinor, totalTaxCreditMinor: calculation.totalTaxCreditMinor,
        netTaxMinor: calculation.netTaxMinor, grossTotalMinor: calculation.grossTotalMinor, invoiceGrossTotalMinor: calculation.invoiceGrossTotalMinor,
        designPartnerTotalCreditMinor: calculation.designPartnerTotalCreditMinor, totalCreditMinor: calculation.totalCreditMinor, netTotalMinor: calculation.netTotalMinor,
        taxRuleSnapshot: asJson(calculation.taxRuleSnapshot), snapshotDigest: calculation.snapshotDigest, preparedByUserId: actor.actorUserId, preparationStepUpId: step,
      }, include: { invoiceStatement: true } });
    });
  }

  async review(actor: InternalOpsActor, institutionId: string, engagementId: string, executionInvoiceId: string, body: { decision?: unknown; reason?: unknown; stepUpEvidenceId?: unknown }) {
    engagementEnabled();
    await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_REVIEW", scopeType: "GLOBAL", scopeRef: null });
    const decision = body.decision === "APPROVE" || body.decision === "REJECT" ? body.decision : null;
    if (!decision) throw new BadRequestException("decision must be APPROVE or REJECT");
    const reason = bounded(body.reason, "reason", 1_000), step = bounded(body.stepUpEvidenceId, "stepUpEvidenceId");
    return this.transaction(async tx => {
      const record = await tx.executionFeeInvoice.findFirst({ where: { id: executionInvoiceId, engagementId, sellerInstitutionId: institutionId }, include: { invoiceStatement: { include: { designPartnerDiscount: { include: { coupon: true } } } } } });
      if (!record) throw new NotFoundException("execution fee invoice not found");
      if (record.status !== "PROPOSED" || record.invoiceStatement.status !== "DRAFT") throw new ConflictException("execution fee invoice is already decided");
      if (record.preparedByUserId === actor.actorUserId) throw new ForbiddenException("execution invoice preparer cannot review the same invoice");
      if (executionFeeRecordDigest(record as unknown as Record<string, unknown>) !== record.snapshotDigest) throw new ConflictException("execution fee snapshot integrity check failed");
      if (record.invoiceStatement.grossFeeMinor !== record.invoiceGrossTotalMinor || record.invoiceStatement.creditMinor !== record.designPartnerTotalCreditMinor || record.invoiceStatement.netFeeMinor !== record.netTotalMinor) throw new ConflictException("invoice statement no longer matches execution fee snapshot");
      const expectedStatementDigest = executionFeeStatementDigest({ executionInvoiceId: record.id, executionSnapshotDigest: record.snapshotDigest, statementRef: record.invoiceStatement.statementRef, grossFeeMinor: record.invoiceStatement.grossFeeMinor, creditMinor: record.invoiceStatement.creditMinor, netFeeMinor: record.invoiceStatement.netFeeMinor });
      if (record.invoiceStatement.statementDigest !== expectedStatementDigest) throw new ConflictException("execution invoice statement digest is invalid");
      try {
        const payable = validatedDesignPartnerPayable(record.invoiceStatement, institutionId);
        if ((payable ?? record.invoiceStatement.grossFeeMinor) !== record.netTotalMinor) throw new Error("payable mismatch");
      } catch { throw new ConflictException("execution invoice design-partner discount snapshot is invalid"); }
      await this.stepUp.consume({ evidenceId: step, userId: actor.actorUserId, sessionId: actor.actorSessionId, institutionId: null, purpose: "INTERNAL_INVOICE_REVIEW" }, tx);
      const now = new Date(), approved = decision === "APPROVE";
      const changed = await tx.executionFeeInvoice.updateMany({ where: { id: record.id, status: "PROPOSED" }, data: { status: approved ? "APPROVED" : "REJECTED", reviewedByUserId: actor.actorUserId, reviewStepUpId: step, reviewReason: reason, reviewedAt: now } });
      if (changed.count !== 1) throw new ConflictException("execution invoice was concurrently decided");
      await tx.customerInvoiceStatement.update({ where: { id: record.invoiceStatementId }, data: { status: approved ? "ISSUED_SHADOW" : "VOID", issuedByUserId: actor.actorUserId, issueStepUpId: step, issueReason: reason, issuedAt: now } });
      return tx.executionFeeInvoice.findUniqueOrThrow({ where: { id: record.id }, include: { invoiceStatement: true } });
    });
  }

  async list(actor: ParticipantOpsActor, engagementId: string) {
    await this.participant(actor);
    const engagement = await this.db.assessmentEngagement.findUnique({ where: { id: engagementId }, include: { customerContract: true } });
    if (!engagement || engagement.customerContract.institutionId !== actor.actingInstitutionId) throw new NotFoundException("engagement not found");
    return this.db.executionFeeInvoice.findMany({ where: { engagementId, sellerInstitutionId: actor.actingInstitutionId, status: { not: "REJECTED" } }, include: { invoiceStatement: true }, orderBy: { sequence: "asc" } });
  }

  async settlementLeg(actor: ParticipantOpsActor, engagementId: string, executionInvoiceId: string) {
    await this.participant(actor);
      const record = await this.db.executionFeeInvoice.findFirst({ where: { id: executionInvoiceId, engagementId, sellerInstitutionId: actor.actingInstitutionId }, include: { invoiceStatement: { include: { designPartnerDiscount: { include: { coupon: true } } } } } });
    if (!record) throw new NotFoundException("execution fee invoice not found");
    if (executionFeeRecordDigest(record as unknown as Record<string, unknown>) !== record.snapshotDigest) throw new ConflictException("execution fee snapshot integrity check failed");
    try {
      const payable = validatedDesignPartnerPayable(record.invoiceStatement, actor.actingInstitutionId);
      if ((payable ?? record.invoiceStatement.grossFeeMinor) !== record.netTotalMinor) throw new Error("execution invoice payable mismatch");
      return executionFeeSettlementLeg(record);
    }
    catch (error) { throw new ConflictException((error as Error).message); }
  }
}
