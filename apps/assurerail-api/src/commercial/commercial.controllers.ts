import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { CommercialService } from "./commercial.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };

function context(req: RailRequest) {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}

@Controller("v1/rail")
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Get("commercial/opportunities")
  list(@Req() req: RailRequest) { return this.commercial.list(context(req)); }

  @Post("cases/:caseId/commercial/opportunities")
  create(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<CommercialService["createOpportunity"]>[2]) {
    return this.commercial.createOpportunity(context(req), caseId, body);
  }

  @Get("cases/:caseId/commercial/opportunities/:opportunityId")
  get(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string) {
    return this.commercial.get(context(req), caseId, opportunityId);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/terms")
  createTerm(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Body() body: Parameters<CommercialService["createTerm"]>[3]) {
    return this.commercial.createTerm(context(req), caseId, opportunityId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/audience")
  invite(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Body() body: Parameters<CommercialService["inviteAudience"]>[3]) {
    return this.commercial.inviteAudience(context(req), caseId, opportunityId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/audience/:institutionId/revoke")
  revokeAudience(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("institutionId") institutionId: string, @Body() body: Parameters<CommercialService["revokeAudience"]>[4]) {
    return this.commercial.revokeAudience(context(req), caseId, opportunityId, institutionId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/changes")
  proposeChange(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Body() body: Parameters<CommercialService["proposeChange"]>[3]) {
    return this.commercial.proposeChange(context(req), caseId, opportunityId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/changes/:changeId/review")
  reviewChange(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("changeId") changeId: string, @Body() body: Parameters<CommercialService["reviewChange"]>[4]) {
    return this.commercial.reviewChange(context(req), caseId, opportunityId, changeId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/interests")
  interest(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Body() body: Parameters<CommercialService["submitInterest"]>[3]) {
    return this.commercial.submitInterest(context(req), caseId, opportunityId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/interests/:interestId/withdraw")
  withdrawInterest(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("interestId") interestId: string, @Body() body: Parameters<CommercialService["withdrawInterest"]>[4]) {
    return this.commercial.withdrawInterest(context(req), caseId, opportunityId, interestId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/rfqs")
  rfq(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Body() body: Parameters<CommercialService["submitRfq"]>[3]) {
    return this.commercial.submitRfq(context(req), caseId, opportunityId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/rfqs/:rfqId/respond")
  respondRfq(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("rfqId") rfqId: string, @Body() body: Parameters<CommercialService["respondRfq"]>[4]) {
    return this.commercial.respondRfq(context(req), caseId, opportunityId, rfqId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/threads/:threadId/messages")
  message(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("threadId") threadId: string, @Body() body: Parameters<CommercialService["postMessage"]>[4]) {
    return this.commercial.postMessage(context(req), caseId, opportunityId, threadId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/allocations")
  allocation(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Body() body: Parameters<CommercialService["proposeAllocation"]>[3]) {
    return this.commercial.proposeAllocation(context(req), caseId, opportunityId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/allocations/:allocationId/review")
  reviewAllocation(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("allocationId") allocationId: string, @Body() body: Parameters<CommercialService["reviewAllocation"]>[4]) {
    return this.commercial.reviewAllocation(context(req), caseId, opportunityId, allocationId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/allocations/:allocationId/respond")
  respondAllocation(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("allocationId") allocationId: string, @Body() body: Parameters<CommercialService["respondAllocation"]>[4]) {
    return this.commercial.respondAllocation(context(req), caseId, opportunityId, allocationId, body);
  }

  @Post("cases/:caseId/commercial/opportunities/:opportunityId/allocations/:allocationId/case-handoff")
  prepareCaseHandoff(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("opportunityId") opportunityId: string, @Param("allocationId") allocationId: string, @Body() body: Parameters<CommercialService["prepareCaseHandoff"]>[4]) {
    return this.commercial.prepareCaseHandoff(context(req), caseId, opportunityId, allocationId, body);
  }
}
