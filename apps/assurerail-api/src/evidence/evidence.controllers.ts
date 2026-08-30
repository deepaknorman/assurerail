import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { AdminOnly } from "../auth/roles.decorator";
import type { DocumentMetadata } from "./evidence-intake.service";
import { EvidenceIntakeService } from "./evidence-intake.service";

type RailRequest = Request & {
  user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null };
};

function actor(req: RailRequest): string {
  if (!req.user?.id || !req.user.session?.id) throw new UnauthorizedException("authenticated Rail session required");
  return req.user.id;
}

function sessionId(req: RailRequest): string {
  actor(req);
  return req.user!.session!.id!;
}

function actingFor(req: RailRequest, institutionId: string): string {
  if (req.user?.activeInstitution?.institutionId !== institutionId) {
    throw new ForbiddenException("path institution does not match the active session context");
  }
  return actor(req);
}

function documentMetadata(req: Request): DocumentMetadata {
  const encoded = req.header("x-assurerail-document-metadata");
  if (!encoded || encoded.length > 12_000) throw new BadRequestException("bounded x-assurerail-document-metadata is required");
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("metadata is not an object");
    return parsed as DocumentMetadata;
  } catch {
    throw new BadRequestException("x-assurerail-document-metadata must be base64url-encoded JSON");
  }
}

@Controller("v1/rail/institutions")
export class EvidenceController {
  constructor(private readonly evidence: EvidenceIntakeService) {}

  @Get(":institutionId/connectors")
  connectors(@Req() req: RailRequest, @Param("institutionId") institutionId: string) {
    return this.evidence.listConnectors(actingFor(req, institutionId), institutionId);
  }

  @Post(":institutionId/connectors")
  registerConnector(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Parameters<EvidenceIntakeService["registerConnector"]>[2]) {
    return this.evidence.registerConnector(actingFor(req, institutionId), institutionId, body);
  }

  @Post(":institutionId/connectors/:connectorId/certifications")
  proposeCertification(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("connectorId") connectorId: string,
    @Body() body: Parameters<EvidenceIntakeService["proposeCertification"]>[3],
  ) {
    return this.evidence.proposeCertification(actingFor(req, institutionId), institutionId, connectorId, body, sessionId(req));
  }

  @Post(":institutionId/intake/json")
  ingestJson(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: Parameters<EvidenceIntakeService["ingestJson"]>[2]) {
    return this.evidence.ingestJson(actingFor(req, institutionId), institutionId, body);
  }

  /** Raw application/octet-stream body; bounded metadata travels as base64url JSON in one header. */
  @Post(":institutionId/evidence/documents")
  ingestDocument(@Req() req: RailRequest, @Param("institutionId") institutionId: string) {
    if (req.header("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/octet-stream") {
      throw new BadRequestException("document upload requires application/octet-stream");
    }
    return this.evidence.ingestDocument(actingFor(req, institutionId), institutionId, req, documentMetadata(req));
  }

  @Get(":institutionId/evidence")
  listEvidence(@Req() req: RailRequest, @Param("institutionId") institutionId: string) {
    return this.evidence.listEvidence(actingFor(req, institutionId), institutionId);
  }

  @Get(":institutionId/evidence/:evidenceObjectId")
  getEvidence(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Param("evidenceObjectId") evidenceObjectId: string) {
    return this.evidence.getEvidence(actingFor(req, institutionId), institutionId, evidenceObjectId);
  }

  @Get(":institutionId/evidence/:evidenceObjectId/download")
  async download(
    @Req() req: RailRequest,
    @Res() res: Response,
    @Param("institutionId") institutionId: string,
    @Param("evidenceObjectId") evidenceObjectId: string,
  ) {
    const result = await this.evidence.download(actingFor(req, institutionId), institutionId, evidenceObjectId);
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename.replace(/[^\w.-]/g, "_")}"`);
    if (result.object.contentLength !== null) res.setHeader("Content-Length", String(result.object.contentLength));
    result.object.body.on("error", () => res.destroy());
    result.object.body.pipe(res);
  }

  @Post(":institutionId/evidence/:evidenceObjectId/grants")
  grant(
    @Req() req: RailRequest,
    @Param("institutionId") institutionId: string,
    @Param("evidenceObjectId") evidenceObjectId: string,
    @Body() body: Parameters<EvidenceIntakeService["grantAccess"]>[3],
  ) {
    return this.evidence.grantAccess(actingFor(req, institutionId), institutionId, evidenceObjectId, body);
  }
}

@AdminOnly()
@Controller("v1/rail/admin")
export class EvidenceAdminController {
  constructor(private readonly evidence: EvidenceIntakeService) {}

  @Post("connector-certifications/:certificationId/review")
  reviewCertification(
    @Req() req: RailRequest,
    @Param("certificationId") certificationId: string,
    @Body() body: Parameters<EvidenceIntakeService["reviewCertification"]>[2],
  ) {
    return this.evidence.reviewCertification(actor(req), certificationId, body, sessionId(req));
  }

  @Post("evidence/:evidenceObjectId/legal-hold")
  setLegalHold(
    @Req() req: RailRequest,
    @Param("evidenceObjectId") evidenceObjectId: string,
    @Body() body: Parameters<EvidenceIntakeService["setLegalHold"]>[2],
  ) {
    return this.evidence.setLegalHold(actor(req), evidenceObjectId, body, sessionId(req));
  }
}
