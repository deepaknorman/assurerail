import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { DeveloperPortalService } from "./developer-portal.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };
function actor(req: RailRequest, institutionId: string) {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("active Rail session required");
  if (req.user.activeInstitution?.institutionId !== institutionId) throw new ForbiddenException("path institution must match active session context");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: institutionId };
}

@Controller("v1/rail/institutions/:institutionId/developer")
export class DeveloperPortalController {
  constructor(private readonly portal: DeveloperPortalService) {}
  @Get("contracts/v1") contracts(@Req() req: RailRequest, @Param("institutionId") institutionId: string) { return this.portal.contracts(actor(req, institutionId)); }
  @Get("sandbox/fixtures/v1") fixtures(@Req() req: RailRequest, @Param("institutionId") institutionId: string) { return this.portal.fixtures(actor(req, institutionId)); }
  @Get("clients") clients(@Req() req: RailRequest, @Param("institutionId") institutionId: string) { return this.portal.listClients(actor(req, institutionId)); }
  @Post("clients") register(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Parameters<DeveloperPortalService["registerClient"]>[1]) { return this.portal.registerClient(actor(req, institutionId), body); }
  @Post("clients/:clientId/credentials") rotate(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("clientId") clientId: string, @Body() body: Parameters<DeveloperPortalService["rotateCredential"]>[2]) { return this.portal.rotateCredential(actor(req, institutionId), clientId, body); }
  @Get("conformance-runs") conformance(@Req() req: RailRequest, @Param("institutionId") institutionId: string) { return this.portal.listConformance(actor(req, institutionId)); }
  @Post("conformance-runs") run(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Parameters<DeveloperPortalService["runConformance"]>[1]) { return this.portal.runConformance(actor(req, institutionId), body); }
  @Get("webhooks") webhooks(@Req() req: RailRequest, @Param("institutionId") institutionId: string) { return this.portal.listWebhooks(actor(req, institutionId)); }
  @Post("webhooks") subscribe(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Parameters<DeveloperPortalService["subscribeWebhook"]>[1]) { return this.portal.subscribeWebhook(actor(req, institutionId), body); }
  @Post("webhooks/:id/verify") verify(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("id") id: string, @Body() body: { stepUpEvidenceId?: string }) { return this.portal.verifyWebhook(actor(req, institutionId), id, body.stepUpEvidenceId ?? ""); }
  @Get("deliveries") deliveries(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Query("limit") limit?: string) { return this.portal.deliveryHealth(actor(req, institutionId), limit ? Number(limit) : undefined); }
  @Post("deliveries/:id/replay") replay(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("id") id: string, @Body() body: { stepUpEvidenceId?: string }) { return this.portal.replayDelivery(actor(req, institutionId), id, body.stepUpEvidenceId ?? ""); }
  @Post("exit-exports") exit(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Parameters<DeveloperPortalService["exportIntegration"]>[1]) { return this.portal.exportIntegration(actor(req, institutionId), body); }
}
