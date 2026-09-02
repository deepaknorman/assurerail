import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { InternalAccessService } from "../internal-access/internal-access.service";
import type { InternalPermission } from "../internal-access/internal-access-policy";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import { ProductionScaleService } from "./production-scale.service";

type RailRequest = Request & {
  user?: {
    id?: string;
    session?: { id?: string; activeInstitutionId?: string | null } | null;
  };
};

function actor(req: RailRequest) {
  if (!req.user?.id || !req.user.session?.id) {
    throw new UnauthorizedException(
      "authenticated Rail staff session required"
    );
  }
  if (req.user.session.activeInstitutionId) {
    throw new ForbiddenException(
      "production-scale governance requires internal context without an active participant institution"
    );
  }
  return { userId: req.user.id, sessionId: req.user.session.id };
}

@Controller("v1/rail/internal/production-scale")
export class ProductionScaleController {
  constructor(
    private readonly service: ProductionScaleService,
    private readonly access: InternalAccessService
  ) {}

  private async authorise(req: RailRequest, permission: InternalPermission) {
    if (inspectPersistenceFlags(process.env).productionScale !== "shadow") {
      throw new ForbiddenException(
        "production-scale command centre is disabled"
      );
    }
    const current = actor(req);
    const authority = await this.access.require({
      userId: current.userId,
      permission,
      scopeType: "GLOBAL",
      scopeRef: null,
    });
    return {
      ...current,
      authorityRef:
        authority.assignmentId ?? authority.elevationId ?? "missing-authority",
    };
  }

  @Get("catalogue/v1")
  async catalogue(@Req() req: RailRequest) {
    await this.authorise(req, "PRODUCTION_SCALE_VIEW");
    return this.service.catalogue();
  }

  @Get("board")
  async board(
    @Req() req: RailRequest,
    @Query("environment") environment?: string,
    @Query("targetOperatingMode") targetOperatingMode?: string,
    @Query("buildCommit") buildCommit?: string
  ) {
    await this.authorise(req, "PRODUCTION_SCALE_VIEW");
    return this.service.board({
      environment,
      targetOperatingMode,
      buildCommit,
    });
  }

  @Get("assessments")
  async assessments(
    @Req() req: RailRequest,
    @Query("environment") environment?: string
  ) {
    await this.authorise(req, "PRODUCTION_SCALE_VIEW");
    return this.service.list(environment?.trim() || undefined);
  }

  @Post("assessments")
  async generate(
    @Req() req: RailRequest,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.authorise(req, "PRODUCTION_SCALE_ASSESS");
    return this.service.generate(current, body);
  }

  @Post("assessments/:assessmentId/review")
  async review(
    @Req() req: RailRequest,
    @Param("assessmentId") assessmentId: string,
    @Body() body: Record<string, unknown>
  ) {
    const current = await this.authorise(req, "PRODUCTION_SCALE_REVIEW");
    return this.service.review(current, assessmentId, body);
  }

  @Get("assessments/:assessmentId/evidence-pack")
  async evidencePack(
    @Req() req: RailRequest,
    @Param("assessmentId") assessmentId: string
  ) {
    await this.authorise(req, "AUDIT_EVIDENCE_VIEW");
    return this.service.evidencePack(assessmentId);
  }
}
