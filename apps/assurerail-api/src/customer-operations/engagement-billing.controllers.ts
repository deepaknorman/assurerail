import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { EngagementBillingService } from "./engagement-billing.service";
type RailRequest = Request & { user?: { id?: string; session?: { id?: string; activeInstitutionId?: string | null } | null; activeInstitution?: { institutionId?: string } | null } };
export function billingActor(req: RailRequest, institutionId?: string) {
  if (!req.user?.id || !req.user.session?.id) throw new UnauthorizedException("approved authenticated session required");
  if (institutionId ? (req.user.activeInstitution?.institutionId !== institutionId || req.user.session.activeInstitutionId !== institutionId) : Boolean(req.user.session.activeInstitutionId || req.user.activeInstitution)) throw new ForbiddenException("active institution context does not match this operation");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: institutionId ?? "" };
}
const actor = billingActor;
@Controller("v1/rail/institutions/:institutionId/engagement-billing")
export class EngagementBillingParticipantController {
  constructor(private readonly service: EngagementBillingService) {}
  @Post("quote-preview") @Header("Cache-Control", "no-store")
  preview(@Req() req: RailRequest, @Param("institutionId") id: string, @Body() body: { uniqueLoanCount?: unknown }) { return this.service.preview(actor(req, id), body); }
  @Get("invoices/:invoiceId/payment-position") @Header("Cache-Control", "no-store")
  position(@Req() req: RailRequest, @Param("institutionId") id: string, @Param("invoiceId") invoiceId: string) { return this.service.paymentPosition(actor(req, id), invoiceId); }
}
@Controller("v1/rail/internal/engagement-billing/institutions/:institutionId")
export class EngagementBillingInternalController {
  constructor(private readonly service: EngagementBillingService) {}
  @Post("receipts/:receiptId/adjustments")
  adjustment(@Req() req: RailRequest, @Param("institutionId") id: string, @Param("receiptId") receiptId: string, @Body() body: Parameters<EngagementBillingService["proposeAdjustment"]>[3]) { return this.service.proposeAdjustment(actor(req),id,receiptId,body); }
  @Post("adjustments/:adjustmentId/review")
  reviewAdjustment(@Req() req: RailRequest, @Param("institutionId") id: string, @Param("adjustmentId") adjustmentId: string, @Body() body: Parameters<EngagementBillingService["reviewAdjustment"]>[3]) { return this.service.reviewAdjustment(actor(req),id,adjustmentId,body); }
  @Post("invoices/:invoiceId/receipts")
  propose(@Req() req: RailRequest, @Param("institutionId") id: string, @Param("invoiceId") invoiceId: string, @Body() body: Parameters<EngagementBillingService["proposeReceipt"]>[3]) { return this.service.proposeReceipt(actor(req), id, invoiceId, body); }
  @Post("receipts/:receiptId/review")
  review(@Req() req: RailRequest, @Param("institutionId") id: string, @Param("receiptId") receiptId: string, @Body() body: Parameters<EngagementBillingService["reviewReceipt"]>[3]) { return this.service.reviewReceipt(actor(req), id, receiptId, body); }
}
