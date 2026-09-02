import { Body, Controller, ForbiddenException, Get, Param, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { RoomActor } from "../rooms/room-authority.service";
import { SecondaryTransferService } from "./secondary-transfer.service";

type RailRequest = Request & { user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null } };

function context(req: RailRequest): RoomActor {
  if (!req.user?.id) throw new UnauthorizedException("authenticated Rail user required");
  if (!req.user.session?.id) throw new ForbiddenException("an active Rail session is required");
  if (!req.user.activeInstitution?.institutionId) throw new ForbiddenException("an active institution session context is required");
  return { actorUserId: req.user.id, actorSessionId: req.user.session.id, actingInstitutionId: req.user.activeInstitution.institutionId };
}

@Controller("v1/rail/secondary-transfers")
export class SecondaryTransferRegistryController {
  constructor(private readonly secondary: SecondaryTransferService) {}

  @Get()
  list(@Req() req: RailRequest) { return this.secondary.list(context(req)); }
}

@Controller("v1/rail/cases/:caseId/secondary-transfer")
export class SecondaryTransferController {
  constructor(private readonly secondary: SecondaryTransferService) {}

  @Get()
  get(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.secondary.get(context(req), caseId); }

  @Get("product-overview")
  productOverview(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.secondary.productOverview(context(req), caseId); }

  @Post()
  create(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["create"]>[2]) {
    return this.secondary.create(context(req), caseId, body);
  }

  @Post("evidence")
  evidence(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["addEvidence"]>[2]) {
    return this.secondary.addEvidence(context(req), caseId, body);
  }

  @Post("propose")
  propose(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["propose"]>[2]) {
    return this.secondary.propose(context(req), caseId, body);
  }

  @Post("review")
  review(@Req() req: RailRequest, @Param("caseId") caseId: string, @Body() body: Parameters<SecondaryTransferService["review"]>[2]) {
    return this.secondary.review(context(req), caseId, body);
  }

  @Post("breaks/:breakId/repairs")
  proposeRepair(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("breakId") breakId: string,
    @Body() body: Parameters<SecondaryTransferService["proposeRepair"]>[3]) {
    return this.secondary.proposeRepair(context(req), caseId, breakId, body);
  }

  @Post("breaks/:breakId/repairs/:repairId/review")
  reviewRepair(@Req() req: RailRequest, @Param("caseId") caseId: string, @Param("breakId") breakId: string,
    @Param("repairId") repairId: string, @Body() body: Parameters<SecondaryTransferService["reviewRepair"]>[4]) {
    return this.secondary.reviewRepair(context(req), caseId, breakId, repairId, body);
  }

  @Get("comparison.csv")
  async comparisonCsv(@Req() req: RailRequest, @Res({ passthrough: true }) response: Response, @Param("caseId") caseId: string) {
    response.type("text/csv");
    response.attachment(`assurerail-secondary-${caseId}-comparison.csv`);
    return this.secondary.comparisonCsv(context(req), caseId);
  }

  @Get("evidence-pack")
  evidencePack(@Req() req: RailRequest, @Param("caseId") caseId: string) { return this.secondary.evidencePack(context(req), caseId); }
}
