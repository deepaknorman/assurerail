import assert from "node:assert/strict";
import test from "node:test";
import { InternalAccessService } from "./internal-access.service";

const NOW = new Date("2026-09-01T12:00:00.000Z");

test("[OP01][RBAC] persisted assignment evaluation remains scope-bound", async () => {
  const service = new InternalAccessService({
    internalRoleAssignment: {
      findMany: async () => [{
        id: "ira-1", role: "SYSADMIN", status: "ACTIVE", scopeType: "ENVIRONMENT", scopeRef: "prod-in",
        effectiveAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: new Date("2026-12-01T00:00:00.000Z"), createdAt: NOW,
      }],
    },
    privilegedAccessRequest: { findMany: async () => [] },
  } as never, {} as never);
  assert.equal((await service.evaluate({
    userId: "staff-1", permission: "SYSTEM_HEALTH_VIEW", scopeType: "ENVIRONMENT", scopeRef: "prod-in", now: NOW,
  })).source, "ASSIGNMENT");
  assert.equal((await service.evaluate({
    userId: "staff-1", permission: "SYSTEM_HEALTH_VIEW", scopeType: "ENVIRONMENT", scopeRef: "staging-in", now: NOW,
  })).allowed, false);
});

test("[OP01][RBAC] a temporary elevation is exact and cannot turn into broader access", async () => {
  const service = new InternalAccessService({
    internalRoleAssignment: { findMany: async () => [] },
    privilegedAccessRequest: {
      findMany: async () => [{
        id: "par-1", requestedPermission: "SUPPORT_DIAGNOSTIC_VIEW", status: "ACTIVE", scopeType: "SUPPORT_TICKET", scopeRef: "INC-1",
        expiresAt: new Date("2026-09-01T13:00:00.000Z"),
      }],
    },
  } as never, {} as never);
  assert.deepEqual(await service.evaluate({
    userId: "staff-1", permission: "SUPPORT_DIAGNOSTIC_VIEW", scopeType: "SUPPORT_TICKET", scopeRef: "INC-1", now: NOW,
  }), { allowed: true, code: "INTERNAL_ELEVATION_AUTHORISED", source: "ELEVATION", elevationId: "par-1" });
  assert.equal((await service.evaluate({
    userId: "staff-1", permission: "SUPPORT_DIAGNOSTIC_VIEW", scopeType: "SUPPORT_TICKET", scopeRef: "INC-2", now: NOW,
  })).allowed, false);
  assert.equal((await service.evaluate({
    userId: "staff-1", permission: "CASE_TASK_PREPARE", scopeType: "CASE", scopeRef: "case-1", now: NOW,
  })).allowed, false);
});

test("[OP01b][WORKSPACE] staff landing returns only derived internal authority and explicitly grants no customer power", async () => {
  const service = new InternalAccessService({
    venueUser: {
      findUnique: async () => ({ id: "staff-1", status: "ACTIVE", identityVerifiedAt: NOW }),
    },
    internalRoleAssignment: {
      findMany: async () => [{
        id: "ira-1", role: "CASE_OPERATOR", status: "ACTIVE", scopeType: "OPERATING_UNIT", scopeRef: "ops-india",
        effectiveAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: new Date("2026-12-01T00:00:00.000Z"), createdAt: NOW,
      }],
    },
    privilegedAccessRequest: { findMany: async () => [] },
  } as never, {} as never);
  const result = await service.workspaceForUser("staff-1");
  assert.equal(result.customerAuthorityGranted, false);
  assert.deepEqual(result.workspaces.map((workspace) => workspace.id), ["OPERATIONS"]);
  assert.equal(result.workspaces[0].sources[0].scopeRef, "ops-india");
});

test("[OP01b][WORKSPACE] inactive or unbound accounts cannot obtain staff navigation metadata", async () => {
  const service = new InternalAccessService({
    venueUser: { findUnique: async () => ({ id: "staff-1", status: "ACTIVE", identityVerifiedAt: null }) },
  } as never, {} as never);
  await assert.rejects(() => service.workspaceForUser("staff-1"), /active identity-bound staff account/);
});
