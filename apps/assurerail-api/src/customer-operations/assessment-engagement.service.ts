import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/assurerail-client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../store/prisma.service";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { InternalAccessService } from "../internal-access/internal-access.service";
import { StepUpService } from "../institutions/step-up.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { sha256Digest } from "../contracts/v1";
import { acceptedPricing, ASSET_FAMILIES, billingProfile, engagementAcceptanceDigest, paidStageReadiness, stageAmount } from "./engagement-workflow";
import { calculateExactFee, type ExactFeeRule } from "./fee-calculation";
import type { ParticipantOpsActor, InternalOpsActor } from "./customer-operations.service";
import type { PreparationRoute } from "./engagement-pricing";

export function engagementEnabled() {
  if (process.env.ASSURERAIL_ENGAGEMENT_BILLING_MODE !== "shadow" || inspectPersistenceFlags(process.env).customerOperations !== "shadow") throw new ForbiddenException("engagement billing is disabled");
}
export function bounded(value: unknown, name: string, max = 160): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BadRequestException(`${name} required (maximum ${max} characters)`);
  return value.trim();
}
export const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;
type Quote = ReturnType<typeof acceptedPricing>;
const dimensions = { transactionRoute: "DA", representation: "CONVENTIONAL", lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE" };

@Injectable()
export class AssessmentEngagementService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService, private readonly staff: InternalAccessService, private readonly stepUp: StepUpService) {}

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    try { return await this.db.$transaction(fn, { isolationLevel: "Serializable" }); }
    catch (e) { if (["P2002", "P2034"].includes((e as {code?: string}).code ?? "")) throw new ConflictException("concurrent change or reused reference; refresh before retrying"); throw e; }
  }
  async participant(actor: ParticipantOpsActor, manage = false) {
    engagementEnabled();
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: manage ? "MANAGE_CUSTOMER_OPERATIONS" : "VIEW_CUSTOMER_OPERATIONS" });
  }
  async evidenceAuthority(actor: ParticipantOpsActor, manage = false) {
    await this.access.requireHuman({userId:actor.actorUserId,institutionId:actor.actingInstitutionId,action:manage?"MANAGE_EVIDENCE":"VIEW_EVIDENCE"});
  }
  async scoped(tx: Tx, institutionId: string, id: string) {
    const e = await tx.assessmentEngagement.findUnique({ where: { id }, include: { customerContract: true, stages: { include: { invoice: true } } } });
    if (!e || e.customerContract.institutionId !== institutionId) throw new NotFoundException("engagement not found");
    return e;
  }
  private active(contract: { status: string; effectiveAt: Date; expiresAt: Date; currency: string; currencyScale: number }) {
    const now = new Date();
    if (contract.status !== "ACTIVE_SHADOW" || contract.effectiveAt > now || contract.expiresAt <= now || contract.currency !== "INR" || contract.currencyScale !== 2) throw new ConflictException("current accepted INR-paise contract required");
  }

  async list(actor: ParticipantOpsActor) {
    await this.participant(actor);
    return this.db.assessmentEngagement.findMany({ where: { customerContract: { institutionId: actor.actingInstitutionId } }, include: { stages: { include: { invoice: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  }

  async offer(actor: ParticipantOpsActor, body: { contractId?: unknown; requestRef?: unknown; uniqueLoanCount?: unknown; assetFamily?: unknown; bookRef?: unknown; asOfDate?: unknown; billingProfile?: unknown; optionalServices?: unknown }) {
    await this.participant(actor, true);
    const contractId = bounded(body.contractId, "contractId"), requestRef = bounded(body.requestRef, "requestRef"), bookRef = bounded(body.bookRef, "bookRef");
    const assetFamily = bounded(body.assetFamily, "assetFamily"), asOfDate = bounded(body.asOfDate, "asOfDate", 10);
    if (!(ASSET_FAMILIES as readonly string[]).includes(assetFamily)) throw new BadRequestException("choose a supported asset family");
    const date = new Date(asOfDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== asOfDate || date > new Date()) throw new BadRequestException("valid non-future book date required");
    const optionalServices = body.optionalServices ?? [];
    if (!Array.isArray(optionalServices) || optionalServices.length > 2 || new Set(optionalServices).size !== optionalServices.length || optionalServices.some(v => !["SECURE_FILE", "API_QUOTE"].includes(v))) throw new BadRequestException("invalid optional service selections");
    let profile; try { profile = billingProfile(body.billingProfile); } catch (e) { throw new BadRequestException((e as Error).message); }
    const scope = { bookRef, assetFamily, asOfDate, uniqueLoanCount: body.uniqueLoanCount, optionalServiceRequests: [...optionalServices].sort(), optionalServicesPurchased: false, transactionRoute: "DA", representation: "CONVENTIONAL" };
    const requestDigest = sha256Digest({ contractId, profile, scope });
    return this.transaction(async tx => {
      const contract = await tx.customerContract.findUnique({ where: { id: contractId } });
      if (!contract || contract.institutionId !== actor.actingInstitutionId) throw new NotFoundException("contract not found");
      this.active(contract);
      const existing = await tx.assessmentEngagement.findUnique({ where: { customerContractId_requestRef: { customerContractId: contractId, requestRef } } });
      if (existing) { if (existing.requestDigest !== requestDigest) throw new ConflictException("request reference already has different content"); return existing; }
      const now = new Date();
      const card = await tx.customerRateCard.findFirst({ where: { customerContractId: contractId, status: "APPROVED_SHADOW", effectiveAt: { lte: now }, expiresAt: { gt: now } }, orderBy: { version: "desc" }, include: { feeRules: true } });
      if (!card) throw new ConflictException("approved institution rate card required before an offer");
      const tax = card.feeRules.find(r => Object.entries(dimensions).every(([k,v]) => r[k as keyof typeof dimensions] === v) && r.metric === "ENGAGEMENT_TAX");
      const fee = card.feeRules.find(r => Object.entries(dimensions).every(([k,v]) => r[k as keyof typeof dimensions] === v) && r.metric === "ENGAGEMENT_STAGE_FEE");
      if (!tax || !fee || fee.feeBasis !== "PER_UNIT_MINOR" || fee.rateValue !== "1" || fee.minimumFeeMinor != null || fee.maximumFeeMinor != null) throw new ConflictException("approved stage fee and tax rules required");
      let quote: Quote; try { quote = acceptedPricing(body.uniqueLoanCount, tax as ExactFeeRule); } catch(e) { throw new BadRequestException((e as Error).message); }
      const quoteDigest = engagementAcceptanceDigest({ quote, scope, billingProfile: profile, contractId, termsDigest: contract.termsDigest });
      return tx.assessmentEngagement.create({ data: { id: `eng_${randomUUID()}`, customerContractId: contractId, requestRef, requestDigest, billingProfile: asJson(profile), scope: asJson(scope), quote: asJson(quote), quoteDigest, termsDigest: contract.termsDigest, rateCardId: card.id, offerExpiresAt: new Date(Math.min(now.getTime() + 7 * 86400000, card.expiresAt.getTime(), contract.expiresAt.getTime())) } });
    });
  }

  async accept(actor: ParticipantOpsActor, id: string, body: { quoteDigest?: unknown; dataAuthorityConfirmed?: unknown; termsAccepted?: unknown; stepUpEvidenceId?: unknown }) {
    await this.participant(actor, true);
    if (body.dataAuthorityConfirmed !== true || body.termsAccepted !== true) throw new BadRequestException("terms and seller data authority must be explicitly confirmed");
    return this.transaction(async tx => {
      const e = await this.scoped(tx, actor.actingInstitutionId, id); this.active(e.customerContract);
      if (e.status !== "OFFERED" || e.offerExpiresAt <= new Date() || e.quoteDigest !== body.quoteDigest || e.termsDigest !== e.customerContract.termsDigest) throw new ConflictException("current unexpired offer and matching digest required");
      const step = bounded(body.stepUpEvidenceId, "stepUpEvidenceId");
      await this.stepUp.consume({ evidenceId: step, userId: actor.actorUserId, sessionId: actor.actorSessionId, institutionId: actor.actingInstitutionId, purpose: "ENGAGEMENT_ACCEPT" }, tx);
      await tx.assessmentEngagementStage.create({ data: { id: `est_${randomUUID()}`, engagementId: id, stage: "INITIAL", expectedMinor: (e.quote as unknown as Quote).initial.totalMinor } });
      return tx.assessmentEngagement.update({ where: { id }, data: { status: "ACCEPTED_SHADOW", acceptedByUserId: actor.actorUserId, acceptanceStepUpId: step, acceptedAt: new Date() } });
    });
  }

  async choosePreparation(actor: ParticipantOpsActor, id: string, body: { route?: unknown; quoteDigest?: unknown; mandateAndTopUpAccepted?: unknown; stepUpEvidenceId?: unknown }) {
    await this.participant(actor, true);
    if (body.route !== "COMMITTED" && body.route !== "STANDALONE") throw new BadRequestException("preparation route required");
    if (body.route === "COMMITTED" && body.mandateAndTopUpAccepted !== true) throw new BadRequestException("committed route requires explicit mandate and voluntary-withdrawal top-up acceptance");
    const route = body.route;
    return this.transaction(async tx => {
      const e = await this.scoped(tx, actor.actingInstitutionId, id); this.active(e.customerContract);
      if (e.status !== "ACCEPTED_SHADOW" || e.route || e.quoteDigest !== body.quoteDigest) throw new ConflictException("accepted quote and unselected preparation route required");
      await this.requirePaid(tx, actor.actingInstitutionId, id, "INITIAL");
      const report = await tx.assessmentProcessingJob.findFirst({ where: { engagementId: id, stage: "INITIAL" }, orderBy: { createdAt: "desc" } });
      if (!report || report.status !== "AUTO_RELEASED") throw new ConflictException("latest automated Initial Assessment must be complete before preparation");
      if ((report.result as {release?:{outcome?:string}} | null)?.release?.outcome !== "READY_FOR_PORTFOLIO_PREPARATION") throw new ConflictException("resolve the automated Initial Assessment outcome before accepting preparation");
      for (const source of report.sourceManifest as {versionId:string}[]) {
        const v = await tx.evidenceVersion.findUnique({where:{id:source.versionId},include:{evidenceObject:true,documentVersion:true}});
        if (!v || v.evidenceObject.institutionId !== actor.actingInstitutionId || v.evidenceObject.purpose !== `ASSESSMENT:${id}` || v.evidenceObject.status !== "AVAILABLE" || v.evidenceObject.currentVersion !== v.version || v.validationStatus !== "VALID" || (v.expiresAt && v.expiresAt <= new Date()) || v.documentVersion?.malwareStatus !== "CLEAN") throw new ConflictException("initial report evidence has changed; reassess before preparation");
      }
      if ((report.result as {dataQuality?:{status:string}} | null)?.dataQuality?.status !== "MATCHED") throw new ConflictException("reconcile loan tape and quoted unique-loan count before accepting preparation");
      const step = bounded(body.stepUpEvidenceId, "stepUpEvidenceId");
      await this.stepUp.consume({ evidenceId: step, userId: actor.actorUserId, sessionId: actor.actorSessionId, institutionId: actor.actingInstitutionId, purpose: "ENGAGEMENT_PREPARATION_ACCEPT" }, tx);
      await tx.assessmentEngagementStage.create({ data: { id: `est_${randomUUID()}`, engagementId: id, stage: "PREPARATION", expectedMinor: stageAmount(e.quote as unknown as Quote, "PREPARATION", route).totalMinor } });
      return tx.assessmentEngagement.update({ where: { id }, data: { route, preparationAcceptedBy: actor.actorUserId, preparationStepUpId: step, preparationAcceptedAt: new Date() } });
    });
  }

  async prepareInvoice(actor: InternalOpsActor, institutionId: string, id: string, stage: string, body: { stepUpEvidenceId?: unknown }) {
    engagementEnabled(); await this.staff.require({ userId: actor.actorUserId, permission: "COMMERCIAL_INVOICE_PREPARE", scopeType: "GLOBAL", scopeRef: null });
    return this.transaction(async tx => {
      const e = await this.scoped(tx, institutionId, id); this.active(e.customerContract);
      const s = e.stages.find(s => s.stage === stage);
      if (e.status !== "ACCEPTED_SHADOW" || !s) throw new ConflictException("accepted stage required");
      if (s.invoiceId) return tx.customerInvoiceStatement.findUniqueOrThrow({ where: { id: s.invoiceId }, include: { lines: true } });
      const card = await tx.customerRateCard.findUniqueOrThrow({ where: { id: e.rateCardId }, include: { feeRules: true } });
      // Accepted pricing is retained across later rate-card supersession, never recalculated from a new card.
      const amount = stageAmount(e.quote as unknown as Quote, stage, e.route as PreparationRoute | null);
      const rules = ["ENGAGEMENT_STAGE_FEE", "ENGAGEMENT_TAX"].map(metric => card.feeRules.find(r => r.metric === metric && Object.entries(dimensions).every(([k,v]) => r[k as keyof typeof dimensions] === v)));
      if (rules.some(r => !r)) throw new ConflictException("accepted rate rules unavailable");
      const step = bounded(body.stepUpEvidenceId, "stepUpEvidenceId");
      await this.stepUp.consume({ evidenceId: step, userId: actor.actorUserId, sessionId: actor.actorSessionId, institutionId: null, purpose: "INTERNAL_INVOICE_PREPARE" }, tx);
      const now = new Date(), invoiceId = `inv_${randomUUID()}`;
      const statement = await tx.customerInvoiceStatement.create({ data: { id: invoiceId, customerContractId: e.customerContractId, customerRateCardId: e.rateCardId, statementRef: `${id}:${stage}`, periodStart: now, periodEnd: new Date(now.getTime()+1), currency: "INR", currencyScale: 2, grossFeeMinor: amount.totalMinor, creditMinor: "0", netFeeMinor: amount.totalMinor, statementDigest: sha256Digest({ engagementId: id, stage, quoteDigest: e.quoteDigest, amount, billingProfile: e.billingProfile }), preparedByUserId: actor.actorUserId, preparationStepUpId: step } });
      for (const rule of rules) {
        const isTax = rule!.metric === "ENGAGEMENT_TAX";
        const input = { quantityMinor: isTax ? "1" : amount.baseMinor, notionalMinor: amount.baseMinor };
        const calculation = calculateExactFee(rule as ExactFeeRule, input);
        if (calculation.feeMinor !== (isTax ? amount.taxMinor : amount.baseMinor)) throw new ConflictException("frozen rate card differs from accepted pricing");
        const event = await tx.customerUsageEvent.create({ data: { id: `usage_${randomUUID()}`, institutionId, customerContractId: e.customerContractId, sourceEventRef: `${id}:${stage}:${rule!.metric}`, sourceEventDigest: e.quoteDigest, ...dimensions, metric: rule!.metric, ...input, currency: "INR", occurredAt: now, status: "BILLED", recordedByUserId: actor.actorUserId } });
        await tx.customerInvoiceLine.create({ data: { id: `iline_${randomUUID()}`, invoiceStatementId: invoiceId, usageEventId: event.id, feeRuleId: rule!.id, basisMinor: calculation.basisMinor, rateValue: rule!.rateValue, calculatedFeeMinor: calculation.feeMinor, calculationDigest: sha256Digest({ eventId: event.id, ruleId: rule!.id, ...calculation }) } });
      }
      await tx.assessmentEngagementStage.update({ where: { id: s.id }, data: { invoiceId } });
      return statement; // Existing independent invoice review endpoint must issue it.
    });
  }

  async requirePaid(tx: Tx, institutionId: string, id: string, stage: string) {
    const e = await this.scoped(tx, institutionId, id); this.active(e.customerContract);
    const s = e.stages.find(s => s.stage === stage);
    if (e.status !== "ACCEPTED_SHADOW" || !s?.invoice) throw new ConflictException("accepted invoiced stage required");
    const receipts = await tx.customerPaymentReceipt.findMany({ where: { invoiceStatementId: s.invoice.id, status: "VERIFIED_SHADOW" }, include: { adjustments: true } });
    const checkout = await tx.engagementCheckout.findUnique({where:{invoiceId:s.invoice.id}});
    const bankReceived = receipts.reduce((sum,r) => sum + BigInt(r.amountMinor) - r.adjustments.filter(a => a.status === "APPROVED").reduce((x,a) => x + BigInt(a.amountMinor), 0n), 0n);
    const checkoutPaid = checkout?.status === "PAID_TEST" && checkout.mode === "TEST" && checkout.checkedAt && checkout.checkedAt.getTime() > Date.now()-5*60000;
    const received = bankReceived + (checkoutPaid ? BigInt(checkout.verifiedPaidMinor) : 0n);
    const unresolvedWebhook = checkout?.providerPaymentId ? await tx.paymentWebhookInbox.count({where:{merchantAccountRef:checkout.merchantAccountRef,providerPaymentId:checkout.providerPaymentId,OR:[{eventType:{startsWith:"refund."}},{eventType:{startsWith:"payment.dispute."}}]}}) : 0;
    const result = paidStageReadiness({ invoiceStatus: s.invoice.status, grossMinor: s.invoice.grossFeeMinor, netMinor: s.invoice.netFeeMinor, expectedMinor: s.expectedMinor, receivedMinor: received.toString(), unresolvedAdjustment: Boolean(unresolvedWebhook) || checkout?.status === "HOLD" || receipts.some(r => r.adjustments.some(a => a.status === "PROPOSED")) });
    if (!result.ready) throw new ConflictException(result.reason);
    return { engagement: e, stage: s, operatingMode: "SHADOW", liveStageUnlock: false as const };
  }

  async readiness(actor: ParticipantOpsActor, id: string, stage: string) {
    await this.participant(actor);
    // Resolve scope before translating readiness errors, to retain cross-institution denial.
    await this.scoped(this.db, actor.actingInstitutionId, id);
    try { await this.requirePaid(this.db, actor.actingInstitutionId, id, stage); return { readyForShadowProcessing: true, liveStageUnlock: false, reason: "PAID_SHADOW_ONLY" }; }
    catch(e) { if (!(e instanceof ConflictException)) throw e; return { readyForShadowProcessing: false, liveStageUnlock: false, reason: e.message }; }
  }
}
