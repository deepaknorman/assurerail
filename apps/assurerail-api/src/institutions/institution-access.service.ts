import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/assurerail-client";
import { PrismaService } from "../store/prisma.service";
import {
  evaluateInstitutionAuthority,
  evaluateRouteEntitlement,
  type InstitutionAction,
  type PolicyDecision,
} from "./institution-policy";

export interface RequestedRouteFunction {
  transactionRoute: string;
  representation: string;
  assetClass: string;
  lifecycleLeg: string;
  materialFunction: string;
  operatingMode: string;
}

@Injectable()
export class InstitutionAccessService {
  constructor(private readonly db: PrismaService) {}

  async evaluateHuman(input: {
    userId: string;
    institutionId: string;
    action: InstitutionAction;
    scopeType?: string;
    scopeRef?: string | null;
    now?: Date;
  }): Promise<PolicyDecision & { memberId?: string; mandateId?: string }> {
    const institution = await this.db.institution.findUnique({
      where: { id: input.institutionId },
      include: {
        admission: true,
        members: {
          where: { userId: input.userId },
          include: { mandates: { where: { action: input.action }, orderBy: { version: "desc" } } },
        },
      },
    });
    if (!institution) return { allowed: false, code: "INSTITUTION_NOT_FOUND" };
    const member = institution.members[0];
    const now = input.now ?? new Date();
    const scopeType = input.scopeType ?? "INSTITUTION";
    const candidates = member?.mandates ?? [];
    let last: PolicyDecision = { allowed: false, code: "MANDATE_NOT_FOUND" };
    if (candidates.length === 0) {
      return evaluateInstitutionAuthority({
        now,
        institutionStatus: institution.status,
        admissionStatus: institution.admission?.status ?? null,
        admissionEffectiveAt: institution.admission?.effectiveAt ?? null,
        admissionExpiresAt: institution.admission?.expiresAt ?? null,
        memberStatus: member?.status ?? null,
        memberEffectiveAt: member?.effectiveAt ?? null,
        memberExpiresAt: member?.expiresAt ?? null,
        mandateStatus: null,
        mandateEffectiveAt: null,
        mandateExpiresAt: null,
        mandateAction: null,
        mandateScopeType: null,
        mandateScopeRef: null,
        requestedAction: input.action,
        requestedScopeType: scopeType,
        requestedScopeRef: input.scopeRef,
      });
    }
    for (const mandate of candidates) {
      last = evaluateInstitutionAuthority({
        now,
        institutionStatus: institution.status,
        admissionStatus: institution.admission?.status ?? null,
        admissionEffectiveAt: institution.admission?.effectiveAt ?? null,
        admissionExpiresAt: institution.admission?.expiresAt ?? null,
        memberStatus: member?.status ?? null,
        memberEffectiveAt: member?.effectiveAt ?? null,
        memberExpiresAt: member?.expiresAt ?? null,
        mandateStatus: mandate.status,
        mandateEffectiveAt: mandate.effectiveAt,
        mandateExpiresAt: mandate.expiresAt,
        mandateAction: mandate.action,
        mandateScopeType: mandate.scopeType,
        mandateScopeRef: mandate.scopeRef,
        requestedAction: input.action,
        requestedScopeType: scopeType,
        requestedScopeRef: input.scopeRef,
      });
      if (last.allowed) return { ...last, memberId: member.id, mandateId: mandate.id };
    }
    return last;
  }

  async requireHuman(input: {
    userId: string;
    institutionId: string;
    action: InstitutionAction;
    scopeType?: string;
    scopeRef?: string | null;
  }) {
    const result = await this.evaluateHuman(input);
    if (!result.allowed) throw new ForbiddenException(`institution authority denied: ${result.code}`);
    return result;
  }

  async evaluateRoute(
    institutionId: string,
    requested: RequestedRouteFunction,
    now = new Date(),
    database: Pick<Prisma.TransactionClient, "institution"> = this.db,
  ): Promise<PolicyDecision> {
    const institution = await database.institution.findUnique({
      where: { id: institutionId },
      include: { admission: true, routeEntitlements: true },
    });
    if (!institution || institution.status !== "ACTIVE" || institution.admission?.status !== "ADMITTED"
      || (institution.admission.effectiveAt && institution.admission.effectiveAt > now)
      || (institution.admission.expiresAt && institution.admission.expiresAt <= now)) {
      return { allowed: false, code: "PARTICIPANT_NOT_ACTIVE" };
    }
    for (const entitlement of institution.routeEntitlements) {
      const result = evaluateRouteEntitlement({
        now,
        status: entitlement.status,
        effectiveAt: entitlement.effectiveAt,
        expiresAt: entitlement.expiresAt,
        transactionRoute: entitlement.transactionRoute,
        representation: entitlement.representation,
        assetClass: entitlement.assetClass,
        lifecycleLeg: entitlement.lifecycleLeg,
        materialFunction: entitlement.materialFunction,
        functionPerformer: entitlement.functionPerformer,
        operatingModes: entitlement.operatingModes,
        requested,
      });
      if (result.allowed) return result;
    }
    return { allowed: false, code: "NO_MATCHING_ROUTE_ENTITLEMENT" };
  }

  async evaluateServicePrincipal(input: {
    clientId: string;
    institutionId: string;
    action: string;
    now?: Date;
  }): Promise<PolicyDecision> {
    const principal = await this.db.institutionServicePrincipal.findUnique({
      where: { clientId: input.clientId },
      include: { institution: { include: { admission: true } } },
    });
    const now = input.now ?? new Date();
    if (!principal || principal.institutionId !== input.institutionId) return { allowed: false, code: "SERVICE_PRINCIPAL_NOT_FOUND" };
    if (principal.institution.status !== "ACTIVE" || principal.institution.admission?.status !== "ADMITTED"
      || (principal.institution.admission.effectiveAt && principal.institution.admission.effectiveAt > now)
      || (principal.institution.admission.expiresAt && principal.institution.admission.expiresAt <= now)) {
      return { allowed: false, code: "PARTICIPANT_NOT_ACTIVE" };
    }
    if (principal.status !== "ACTIVE" || (principal.effectiveAt && principal.effectiveAt > now)
      || (principal.expiresAt && principal.expiresAt <= now)) {
      return { allowed: false, code: "SERVICE_PRINCIPAL_NOT_ACTIVE" };
    }
    const actions = Array.isArray(principal.allowedActions) ? principal.allowedActions : [];
    return actions.includes(input.action)
      ? { allowed: true, code: "SERVICE_PRINCIPAL_AUTHORISED" }
      : { allowed: false, code: "SERVICE_PRINCIPAL_ACTION_NOT_ALLOWED" };
  }
}
