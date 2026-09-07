import { Body, Controller, ForbiddenException, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { TransactionDiscriminatorV1 } from "../contracts/v1";
import { EvidenceIntakeService } from "../evidence/evidence-intake.service";
import {
  ASSUREPOOL_PTC_PREPARATION_PROFILE,
  AssurePoolPtcPreparationService,
} from "./assurepool-ptc-preparation.service";

type RailRequest = Request & {
  user?: { id?: string; session?: { id?: string } | null; activeInstitution?: { institutionId?: string } | null };
};

interface PtcPreparationIntakeBody {
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
  if (req.user.activeInstitution?.institutionId !== institutionId) {
    throw new ForbiddenException("path institution does not match the active session context");
  }
  return req.user.id;
}

@Controller("v1/rail/institutions/:institutionId/ptc-preparation")
export class AssurePoolPtcPreparationController {
  constructor(
    private readonly preparation: AssurePoolPtcPreparationService,
    private readonly evidence: EvidenceIntakeService,
  ) {}

  @Post("assurepool")
  async ingest(@Req() req: RailRequest, @Param("institutionId") institutionId: string, @Body() body: PtcPreparationIntakeBody) {
    const actorUserId = actor(req, institutionId);
    const mapped = this.preparation.verifyAndMap({
      institutionId,
      transactionCaseId: body.transactionCaseId ?? "",
      transaction: body.transaction as TransactionDiscriminatorV1,
      providerEnvelope: body.providerEnvelope,
    });
    const persisted = await this.evidence.ingestJson(actorUserId, institutionId, {
      connectorRegistrationId: body.connectorRegistrationId,
      evidenceObjectId: body.evidenceObjectId,
      evidenceType: "PTC_PREPARATION_EVIDENCE",
      classification: body.classification ?? "CASE_CONFIDENTIAL",
      purpose: body.purpose,
      retentionUntilAt: body.retentionUntilAt,
      result: "REVIEW_REQUIRED",
      profileRef: ASSUREPOOL_PTC_PREPARATION_PROFILE,
      qualifications: mapped.envelope.qualifications,
      envelope: mapped.envelope,
    });
    return { ...persisted, providerResult: mapped.providerResult, railResult: "REVIEW_REQUIRED" };
  }
}
