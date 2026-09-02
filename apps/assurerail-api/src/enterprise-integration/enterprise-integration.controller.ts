import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { EnterpriseIntegrationService } from "./enterprise-integration.service";

type RailRequest = Request & {
  user?: {
    id?: string;
    session?: { id?: string } | null;
    activeInstitution?: { institutionId?: string } | null;
  };
};
function activeActor(req: RailRequest) {
  if (!req.user?.id)
    throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id || !req.user.activeInstitution?.institutionId)
    throw new ForbiddenException("active institution session required");
  return {
    actorUserId: req.user.id,
    actorSessionId: req.user.session.id,
    actingInstitutionId: req.user.activeInstitution.institutionId,
  };
}
function institutionActor(req: RailRequest, institutionId: string) {
  const actor = activeActor(req);
  if (actor.actingInstitutionId !== institutionId)
    throw new ForbiddenException(
      "path institution must match active session context"
    );
  return actor;
}

@Controller("v1/rail/institutions/:institutionId/integrations")
export class EnterpriseIntegrationController {
  constructor(private readonly service: EnterpriseIntegrationService) {}
  @Get("catalogue/v1") catalogue(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string
  ) {
    return this.service.catalogue(institutionActor(req, institutionId));
  }
  @Get("profiles") profiles(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string
  ) {
    return this.service.listProfiles(institutionActor(req, institutionId));
  }
  @Post("profiles") propose(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.proposeProfile(
      institutionActor(req, institutionId),
      body
    );
  }
  @Post("profiles/:profileId/software-conformance") conformance(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("profileId") profileId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.attachConformance(
      institutionActor(req, institutionId),
      profileId,
      body
    );
  }
  @Post("profiles/:profileId/gates/:gateCode/evidence") evidence(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("profileId") profileId: string,
    @Param("gateCode") gateCode: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.attachExternalEvidence(
      institutionActor(req, institutionId),
      profileId,
      gateCode,
      body
    );
  }
  @Post("profiles/:profileId/health-observations") health(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("profileId") profileId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.recordHealth(
      institutionActor(req, institutionId),
      profileId,
      body
    );
  }
  @Post("profiles/:profileId/review") review(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("profileId") profileId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.reviewProfile(
      institutionActor(req, institutionId),
      profileId,
      body
    );
  }
  @Get("profiles/:profileId/evidence-pack") pack(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("profileId") profileId: string
  ) {
    return this.service.evidencePack(
      institutionActor(req, institutionId),
      profileId
    );
  }
}

@Controller("v1/rail/cases/:caseId/integrations")
export class EnterpriseCaseIntegrationController {
  constructor(private readonly service: EnterpriseIntegrationService) {}
  @Get() list(@Req() req: RailRequest, @Param("caseId") caseId: string) {
    return this.service.listCaseBindings(activeActor(req), caseId);
  }
  @Post() propose(
    @Req() req: RailRequest,
    @Param("caseId") caseId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.proposeCaseBinding(activeActor(req), caseId, body);
  }
  @Post(":bindingId/review") review(
    @Req() req: RailRequest,
    @Param("caseId") caseId: string,
    @Param("bindingId") bindingId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.service.reviewCaseBinding(
      activeActor(req),
      caseId,
      bindingId,
      body
    );
  }
}
