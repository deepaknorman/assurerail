import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { sha256Digest } from "../contracts/v1";
import { InstitutionAccessService } from "../institutions/institution-access.service";
import { inspectPersistenceFlags } from "../persistence/feature-flags";
import type { RoomActor } from "../rooms/room-authority.service";
import { PrismaService } from "../store/prisma.service";
import { PTC_TOKEN_GATE_SPECS } from "../ptc-token/ptc-token-policy";
import { deriveTokenisedDaJourney, deriveTokenisedPtcJourney } from "./tokenised-product";

type CurrentEvidence = { status: string; currentVersion: number; institution: { status: string;
  admission: { status: string; effectiveAt: Date | null; expiresAt: Date | null } | null };
  versions: Array<{ version: number; validationStatus: string; signatureStatus: string; result: string;
    payloadDigest: string; expiresAt: Date | null }> };

function enabled(): void {
  if (inspectPersistenceFlags(process.env).tokenisedProduct !== "shadow") {
    throw new ForbiddenException("tokenised route product is disabled");
  }
}

@Injectable()
export class TokenisedProductService {
  constructor(private readonly db: PrismaService, private readonly access: InstitutionAccessService) {}

  async list(actor: RoomActor) {
    enabled();
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId, action: "VIEW_CASE" });
    const cases = await this.db.transactionCase.findMany({
      where: {
        representation: "TOKENISED",
        lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
        transactionRoute: { in: ["DA", "PTC"] },
        operatingMode: { in: ["REPLAY", "SHADOW"] },
        OR: [
          { ownerInstitutionId: actor.actingInstitutionId },
          { parties: { some: { institutionId: actor.actingInstitutionId, status: "ACTIVE" } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, caseReference: true, ownerInstitutionId: true, transactionRoute: true,
        representation: true, lifecycleLeg: true, assetClass: true, operatingMode: true,
        status: true, updatedAt: true,
        tokenRepresentations: { select: { id: true, network: true, tokenId: true, authorityMode: true, status: true,
          _count: { select: { actions: true, reconciliationSnapshots: true, breaks: true, connectorBindings: true } } } },
        ptcTokenRepresentation: { select: { id: true, network: true, tokenId: true, classReference: true,
          authorityMode: true, status: true, _count: { select: { evidenceGates: true, actionPlans: true } } } },
      },
    });
    return cases.map((item) => {
      const representation = item.transactionRoute === "DA" ? item.tokenRepresentations[0] ?? null : item.ptcTokenRepresentation;
      return { ...item, tokenRepresentations: undefined, ptcTokenRepresentation: undefined, representationRecord: representation };
    });
  }

  async overview(actor: RoomActor, caseId: string) {
    const transactionCase = await this.requireCase(actor, caseId);
    const [canOperateRoute, canViewEvidence] = await Promise.all([
      this.may(actor, caseId, "OPERATE_ROUTE"),
      this.may(actor, caseId, "VIEW_EVIDENCE"),
    ]);
    if (transactionCase.transactionRoute === "DA") {
      const representation = transactionCase.tokenRepresentations[0] ?? null;
      const latest = representation?.reconciliationSnapshots[0] ?? null;
      const now = new Date();
      const currentReconciliationEvidenceDigest = latest ? sha256Digest({
        tokenSupplyMinor: latest.tokenSupplyMinor, tokenHoldings: latest.tokenHoldings,
        economicInterests: latest.economicInterests, authoritativeRecord: latest.authoritativeRecord,
        sourceAsOfAt: latest.sourceAsOfAt.toISOString(),
      }) : null;
      const currentReconciliation = latest && this.currentEvidence(latest.evidenceObject, currentReconciliationEvidenceDigest, now)
        ? latest.reconciliationState : latest ? "REVIEW_REQUIRED" : null;
      const activeBindings = representation?.connectorBindings.filter((item) => item.status === "ACTIVE"
        && (!item.effectiveAt || item.effectiveAt <= now) && (!item.expiresAt || item.expiresAt > now)) ?? [];
      const journey = deriveTokenisedDaJourney({
        linked: Boolean(representation), representationStatus: representation?.status ?? null,
        activeBindingCount: activeBindings.length, actionCount: representation?.actions.length ?? 0,
        reconciledActionCount: representation?.actions.filter((item) => item.state === "RECONCILED").length ?? 0,
        reconciliationState: currentReconciliation,
        openBreakCount: representation?.breaks.filter((item) => item.status === "OPEN").length ?? 0,
        canOperateRoute, canViewEvidence,
      });
      return {
        operatingBoundary: "OBSERVE_ONLY", authorityMode: "MIRROR", dispatchPermitted: false,
        authorityNotice: "The DA token is a mirror of a route-defined authoritative record. This product journey cannot mint, transfer, burn, move funds or make ownership legally effective.",
        case: this.caseView(transactionCase), ...journey,
        representation: representation ? {
          id: representation.id, noteId: representation.noteId, network: representation.network,
          tokenId: representation.tokenId, authorityMode: representation.authorityMode, status: representation.status,
          authoritativeRecordDeclarationId: representation.authoritativeRecordDeclarationId,
          connectorBindings: representation.connectorBindings.map((item) => ({ id: item.id, version: item.version,
            connectorRegistrationId: item.connectorRegistrationId, connectorCertificationId: item.connectorCertificationId,
            custodyInstitutionId: item.custodyInstitutionId, custodyModel: item.custodyModel, status: item.status,
            effectiveAt: item.effectiveAt, expiresAt: item.expiresAt })),
          actions: representation.actions.map((item) => ({ id: item.id, sequence: item.sequence, actionType: item.actionType,
            executionMode: item.executionMode, state: item.state, expectedDigest: canViewEvidence ? item.expectedDigest : null,
            instructionRequestDigest: canViewEvidence ? item.externalInstruction.requestDigest : null,
            acknowledgements: item.externalInstruction.acknowledgements.map((ack) => ({ id: ack.id, status: ack.status,
              finalityClass: ack.finalityClass, signatureStatus: ack.signatureStatus,
              responseDigest: canViewEvidence ? ack.responseDigest : null, acknowledgedAt: ack.acknowledgedAt })) })),
          latestReconciliation: latest ? { id: latest.id, version: latest.version,
            reconciliationState: currentReconciliation, recordedReconciliationState: latest.reconciliationState,
            comparisonDigest: canViewEvidence ? latest.comparisonDigest : null,
            sourceAsOfAt: latest.sourceAsOfAt } : null,
          breaks: representation.breaks.map((item) => ({ id: item.id, breakCode: item.breakCode, severity: item.severity,
            status: item.status, ownerInstitutionId: item.ownerInstitutionId, dueAt: item.dueAt }))
        } : null,
      };
    }

    const representation = transactionCase.ptcTokenRepresentation;
    const now = new Date();
    const gateStates = new Map((representation?.evidenceGates ?? []).map((gate) => [gate.gateCode,
      gate.status === "VERIFIED" && this.currentEvidence(gate.evidenceObject, gate.evidenceDigest, now)
        ? "VERIFIED" : gate.status === "VERIFIED" && (gate.expiresAt && gate.expiresAt <= now) ? "EXPIRED"
          : gate.status === "VERIFIED" ? "REVIEW_REQUIRED" : gate.status]));
    const currentVerified = representation?.evidenceGates.filter((gate) => gateStates.get(gate.gateCode) === "VERIFIED") ?? [];
    const trusteeRecordReconciled = currentVerified.some((gate) => gate.gateCode === "TRUSTEE_RECORD_RECONCILIATION");
    const journey = deriveTokenisedPtcJourney({
      proposed: Boolean(representation), representationStatus: representation?.status === "SHADOW_READY"
        && currentVerified.length !== PTC_TOKEN_GATE_SPECS.length ? "EVIDENCE_OPEN" : representation?.status ?? null,
      verifiedGateCount: currentVerified.length, requiredGateCount: PTC_TOKEN_GATE_SPECS.length,
      shadowReadyActionCount: representation?.actionPlans.filter((item) => item.state === "SHADOW_READY").length ?? 0,
      requiredActionCount: representation?.actionPlans.length ?? 0,
      trusteeRecordReconciled, canOperateRoute, canViewEvidence,
    });
    return {
      operatingBoundary: "OBSERVE_ONLY", authorityMode: "MIRROR", dispatchPermitted: false,
      authorityNotice: "The PTC token is a separately governed mirror. The trustee controls the Rail transaction workflow, while the route-defined RTA, depository or register remains legally operative. No action plan can dispatch.",
      case: this.caseView(transactionCase), ...journey,
      representation: representation ? {
        id: representation.id, programmeReference: representation.programmeReference,
        trustReference: representation.trustReference, classReference: representation.classReference,
        trusteeInstitutionId: representation.trusteeInstitutionId,
        recordkeeperInstitutionId: representation.recordkeeperInstitutionId,
        assuranceProviderInstitutionId: representation.assuranceProviderInstitutionId,
        authoritativeRecordDeclarationId: representation.authoritativeRecordDeclarationId,
        network: representation.network, tokenId: representation.tokenId,
        authorityMode: representation.authorityMode, status: representation.status,
        proposedByUserId: representation.proposedByUserId,
        evidenceGates: representation.evidenceGates.map((gate) => ({ gateCode: gate.gateCode,
          expectedEvidenceType: gate.expectedEvidenceType, accountableInstitutionId: gate.accountableInstitutionId,
          status: gateStates.get(gate.gateCode) ?? gate.status,
          evidenceObjectId: canViewEvidence ? gate.evidenceObjectId : null,
          evidenceDigest: canViewEvidence ? gate.evidenceDigest : null,
          sourceAsOfAt: gate.sourceAsOfAt, expiresAt: gate.expiresAt })),
        actionPlans: representation.actionPlans.map((item) => ({ actionType: item.actionType, sequence: item.sequence,
          candidateCapabilityId: item.candidateCapabilityId, state: item.state,
          blockingGateCodes: item.blockingGateCodes, planDigest: canViewEvidence ? item.planDigest : null })),
      } : null,
    };
  }

  async evidencePack(actor: RoomActor, caseId: string) {
    const canView = await this.may(actor, caseId, "VIEW_EVIDENCE");
    if (!canView) throw new ForbiddenException("VIEW_EVIDENCE authority is required to export a tokenised-route pack");
    const overview = await this.overview(actor, caseId);
    const content = {
      schemaId: "assurerail.tokenised-product-evidence-pack", schemaVersion: "1.0.0",
      case: overview.case, route: overview.route, operatingBoundary: overview.operatingBoundary,
      authorityMode: overview.authorityMode, dispatchPermitted: overview.dispatchPermitted,
      representation: overview.representation, stages: overview.stages,
      openExternalGates: overview.openExternalGates,
      disclaimer: "This pack records an observe-only mirror and does not prove legal title, settlement finality, custody acceptance or controlled-live approval.",
    };
    return { generatedAt: new Date().toISOString(), content, contentDigest: sha256Digest(content) };
  }

  private async requireCase(actor: RoomActor, caseId: string) {
    enabled();
    const item = await this.db.transactionCase.findUnique({ where: { id: caseId }, include: {
      parties: true,
      tokenRepresentations: { include: {
        connectorBindings: { orderBy: { version: "asc" } },
        actions: { orderBy: { sequence: "asc" }, include: { externalInstruction: { include: { acknowledgements: { orderBy: { acknowledgedAt: "asc" } } } } } },
        reconciliationSnapshots: { orderBy: { version: "desc" }, take: 1,
          include: { evidenceObject: { include: { institution: { include: { admission: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } } } },
        breaks: { orderBy: { createdAt: "asc" } },
      } },
      ptcTokenRepresentation: { include: { evidenceGates: { orderBy: { gateCode: "asc" },
        include: { evidenceObject: { include: { institution: { include: { admission: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } } } },
        actionPlans: { orderBy: { sequence: "asc" } } } },
    } });
    if (!item || item.representation !== "TOKENISED" || !["DA", "PTC"].includes(item.transactionRoute)
      || item.lifecycleLeg !== "INITIAL_TRANSFER_OR_ISSUE" || !["REPLAY", "SHADOW"].includes(item.operatingMode)) {
      throw new NotFoundException("tokenised route case not found");
    }
    const participant = item.ownerInstitutionId === actor.actingInstitutionId
      || item.parties.some((party) => party.institutionId === actor.actingInstitutionId && party.status === "ACTIVE");
    if (!participant) throw new NotFoundException("tokenised route case not found");
    await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
      action: "VIEW_CASE", scopeType: "TRANSACTION_CASE", scopeRef: caseId });
    return item;
  }

  private async may(actor: RoomActor, caseId: string, action: "OPERATE_ROUTE" | "VIEW_EVIDENCE") {
    try {
      await this.access.requireHuman({ userId: actor.actorUserId, institutionId: actor.actingInstitutionId,
        action, scopeType: "TRANSACTION_CASE", scopeRef: caseId });
      return true;
    } catch { return false; }
  }

  private caseView(item: { id: string; caseReference: string; ownerInstitutionId: string; transactionRoute: string;
    representation: string; lifecycleLeg: string; assetClass: string; operatingMode: string; status: string }) {
    return { id: item.id, caseReference: item.caseReference, ownerInstitutionId: item.ownerInstitutionId,
      transactionRoute: item.transactionRoute, representation: item.representation, lifecycleLeg: item.lifecycleLeg,
      assetClass: item.assetClass, operatingMode: item.operatingMode, status: item.status };
  }

  private currentEvidence(item: CurrentEvidence | null, expectedDigest: string | null, now: Date): boolean {
    const version = item?.versions[0]; const admission = item?.institution.admission;
    return Boolean(item && expectedDigest && item.status === "AVAILABLE" && item.institution.status === "ACTIVE"
      && admission?.status === "ADMITTED" && (!admission.effectiveAt || admission.effectiveAt <= now)
      && (!admission.expiresAt || admission.expiresAt > now) && version && item.currentVersion === version.version
      && version.validationStatus === "VALID" && version.signatureStatus === "VERIFIED" && version.result === "VERIFIED"
      && version.payloadDigest === expectedDigest && (!version.expiresAt || version.expiresAt > now));
  }
}
