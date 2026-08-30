import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { InstitutionApplicationService } from "./institution-application.service";

const NOW = new Date("2026-08-30T12:00:00.000Z");

function service(input: {
  membership?: Record<string, unknown> | null;
  institution?: Record<string, unknown> | null;
  access?: (action: string) => { allowed: boolean; code: string };
  admin?: boolean;
  institutions?: Record<string, unknown>[];
}) {
  const db = {
    institutionMember: { findUnique: async () => input.membership ?? null },
    institution: {
      findUnique: async () => input.institution ?? null,
      findUniqueOrThrow: async () => {
        if (!input.institution) throw new NotFoundException();
        return input.institution;
      },
      findMany: async () => input.institutions ?? [],
    },
    appointment: { findMany: async () => [] },
    venueUser: {
      findUnique: async () => input.admin ? { id: "admin-1", status: "ACTIVE", platformRole: "ADMIN" } : null,
    },
  };
  const access = {
    evaluateHuman: async ({ action }: { action: string }) => input.access?.(action) ?? { allowed: false, code: "NO_MANDATE" },
  };
  return new InstitutionApplicationService(db as never, {} as never, access as never);
}

test("[PR04][WORKSPACE] a person without an exact institution membership cannot discover the workspace", async () => {
  await assert.rejects(
    () => service({ membership: null }).getWorkspaceForUser("user-a", "inst-b"),
    NotFoundException,
  );
});

test("[PR04][WORKSPACE] a pre-admission applicant receives only the application view", async () => {
  const result = await service({
    membership: { id: "member-a", status: "PENDING_ADMISSION", membershipRole: "APPLICANT" },
    institution: {
      id: "inst-a", legalName: "Applicant Limited", institutionKind: "NBFC", jurisdiction: "IND",
      status: "APPLICANT", createdAt: NOW, updatedAt: NOW,
      admission: { status: "APPLIED", termsVersion: "terms-1", rulebookVersion: "rules-1", reviewDueAt: null, effectiveAt: null, expiresAt: null, decisionReason: null },
      evidenceSnapshots: [], members: [{ id: "member-a", userId: "user-a", invitedEmail: "a@example.test", membershipRole: "APPLICANT", status: "PENDING_ADMISSION", acceptedAt: NOW, expiresAt: null }],
    },
  }).getWorkspaceForUser("user-a", "inst-a");

  assert.equal(result.accessLevel, "APPLICATION");
  assert.deepEqual(result.capabilities, {
    view: true,
    administerMembers: false,
    proposeAuthority: false,
    approveAuthority: false,
    manageAppointments: false,
    proposeRouteEntitlement: false,
  });
  assert.deepEqual(result.institution.appointments, []);
  assert.deepEqual(result.institution.routeEntitlements, []);
  assert.deepEqual(result.institution.changeProposals, []);
  assert.equal(result.connectorReadiness.grantsAuthority, false);
});

test("[PR04][WORKSPACE] an active member needs an exact VIEW_INSTITUTION mandate", async () => {
  await assert.rejects(
    () => service({
      membership: { id: "member-a", status: "ACTIVE", membershipRole: "MEMBER" },
      access: () => ({ allowed: false, code: "NO_MATCHING_MANDATE" }),
    }).getWorkspaceForUser("user-a", "inst-a", "inst-a"),
    (error: unknown) => error instanceof ForbiddenException && error.message.includes("NO_MATCHING_MANDATE"),
  );
});

test("[PR04][WORKSPACE] an active member cannot read without the matching session institution", async () => {
  await assert.rejects(
    () => service({
      membership: { id: "member-a", status: "ACTIVE", membershipRole: "MEMBER" },
      access: () => ({ allowed: true, code: "AUTHORISED" }),
    }).getWorkspaceForUser("user-a", "inst-a", null),
    (error: unknown) => error instanceof ForbiddenException && error.message.includes("active session context"),
  );
});

test("[PR04][OPERATOR] platform review explicitly excludes institution impersonation", async () => {
  const institution = {
    id: "inst-a", legalName: "Participant Limited", institutionKind: "BANK", jurisdiction: "IND",
    status: "APPLICANT", createdAt: NOW, updatedAt: NOW, admission: { status: "APPLIED" },
    evidenceSnapshots: [], members: [], routeEntitlements: [], appointments: [], changeProposals: [],
  };
  const result = await service({ admin: true, institution }).getAdminWorkspace("admin-1", "inst-a");
  assert.deepEqual(result.operatorBoundary, {
    mayReviewAdmission: true,
    mayReviewRouteEntitlement: true,
    mayActForInstitution: false,
    supportImpersonationAvailable: false,
  });
});

test("[PR04][OPERATOR] a non-administrator cannot list the platform work queue", async () => {
  await assert.rejects(() => service({ admin: false }).listAdminWorkQueue("user-a"), ForbiddenException);
});
