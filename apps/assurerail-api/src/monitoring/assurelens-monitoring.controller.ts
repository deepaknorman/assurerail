import { Body, Controller, ForbiddenException, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { TransactionDiscriminatorV1 } from "../contracts/v1";
import { EvidenceIntakeService } from "../evidence/evidence-intake.service";
import { AssureLensMonitoringService, ASSURELENS_PROFILE } from "./assurelens-monitoring.service";

type RailRequest = Request & {
  user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null };
};

interface MonitoringIntakeBody {
  connectorRegistrationId?: string;
  evidenceObjectId?: string | null;
  transactionCaseId?: string;
  transaction?: TransactionDiscriminatorV1;
  classification?: string;
  purpose?: string;
  retentionUntilAt?: string;
  providerEnvelope?: unknown;
}

function actor(req: RailRequest, institutionId: string): string {
  if (!req.user?.id || !req.user.session?.id) throw new UnauthorizedException("authenticated Rail session required");
  if (req.user.activeInstitution?.institutionId !== institutionId) throw new ForbiddenException("path institution does not match the active session context");
  return req.user.id;
}

@Controller("v1/rail/institutions/:institutionId/monitoring")
export class AssureLensMonitoringController {
  constructor(
    private readonly monitoring: AssureLensMonitoringService,
    private readonly evidence: EvidenceIntakeService,
  ) {}

  /**
   * Verify a provider signature, enforce package honesty/privacy invariants, then enter the result
   * through the ordinary certified-connector evidence path. Provider status never becomes a Rail
   * decision: intake is always REVIEW_REQUIRED.
   */
  @Post("assurelens")
  async ingest(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: MonitoringIntakeBody) {
    const actorUserId = actor(req, institutionId);
    const mapped = this.monitoring.verifyAndMap({
      institutionId,
      transactionCaseId: body.transactionCaseId ?? "",
      transaction: body.transaction as TransactionDiscriminatorV1,
      providerEnvelope: body.providerEnvelope,
    });
    const persisted = await this.evidence.ingestJson(actorUserId, institutionId, {
      connectorRegistrationId: body.connectorRegistrationId,
      evidenceObjectId: body.evidenceObjectId,
      evidenceType: "MONITORING_EVIDENCE",
      classification: body.classification ?? "CASE_CONFIDENTIAL",
      purpose: body.purpose,
      retentionUntilAt: body.retentionUntilAt,
      result: "REVIEW_REQUIRED",
      profileRef: ASSURELENS_PROFILE,
      qualifications: mapped.envelope.qualifications,
      envelope: mapped.envelope,
    });
    return { ...persisted, providerResult: mapped.providerResult, railResult: "REVIEW_REQUIRED" };
  }
}
