import assert from "node:assert/strict";
import test from "node:test";
import { resolveInternalWorkspaces } from "./internal-workspace-policy";

const NOW = new Date("2026-09-01T12:00:00.000Z");
const assignment = (role: string, overrides: Record<string, unknown> = {}) => ({
  id: `assignment-${role}`,
  role,
  status: "ACTIVE",
  scopeType: "GLOBAL",
  scopeRef: null,
  effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
  expiresAt: new Date("2026-10-01T00:00:00.000Z"),
  ...overrides,
});

test("[OP01b][WORKSPACE] system operations never implies security or customer-case tools", () => {
  const workspaces = resolveInternalWorkspaces({
    assignments: [assignment("SYSADMIN")],
    elevations: [],
    now: NOW,
  });
  assert.deepEqual(
    workspaces.map((workspace) => workspace.id),
    ["PRODUCTION_SCALE", "SYSTEM", "INTEGRATIONS"]
  );
  assert.equal(
    workspaces.some((workspace) => workspace.id === "SECURITY"),
    false
  );
  assert.equal(
    workspaces
      .flatMap((workspace) => workspace.permissions)
      .includes("CASE_TASK_PREPARE"),
    false
  );
});

test("[OP01b][WORKSPACE] viewer sees published reporting only, without audit export or operating access", () => {
  const workspaces = resolveInternalWorkspaces({
    assignments: [assignment("VIEWER")],
    elevations: [],
    now: NOW,
  });
  assert.deepEqual(
    workspaces.map((workspace) => workspace.id),
    ["PRODUCTION_SCALE", "AUDIT"]
  );
  assert.deepEqual(workspaces[0].permissions, ["PRODUCTION_SCALE_VIEW"]);
  assert.deepEqual(workspaces[1].permissions, ["REPORT_VIEW"]);
});

test("[OP01b][WORKSPACE] multiple bounded assignments merge without role inheritance", () => {
  const workspaces = resolveInternalWorkspaces({
    assignments: [
      assignment("CASE_OPERATOR", {
        id: "case-role",
        scopeType: "OPERATING_UNIT",
        scopeRef: "ops-india",
      }),
      assignment("RECONCILIATION_ANALYST", {
        id: "recon-role",
        scopeType: "OPERATING_UNIT",
        scopeRef: "control-india",
      }),
    ],
    elevations: [],
    now: NOW,
  });
  assert.deepEqual(
    workspaces.map((workspace) => workspace.id),
    ["OPERATIONS", "RECONCILIATION"]
  );
  assert.equal(
    workspaces.find((workspace) => workspace.id === "OPERATIONS")?.sources[0]
      .scopeRef,
    "ops-india"
  );
});

test("[OP01b][WORKSPACE] expired assignments disappear and an elevation adds only its exact tool", () => {
  const workspaces = resolveInternalWorkspaces({
    assignments: [assignment("MANAGER", { expiresAt: NOW })],
    elevations: [
      {
        id: "elevation-1",
        requestedPermission: "SUPPORT_DIAGNOSTIC_VIEW",
        status: "ACTIVE",
        scopeType: "SUPPORT_TICKET",
        scopeRef: "INC-42",
        startsAt: new Date("2026-09-01T11:55:00.000Z"),
        expiresAt: new Date("2026-09-01T12:30:00.000Z"),
      },
    ],
    now: NOW,
  });
  assert.deepEqual(
    workspaces.map((workspace) => workspace.id),
    ["SUPPORT"]
  );
  assert.deepEqual(workspaces[0].permissions, ["SUPPORT_DIAGNOSTIC_VIEW"]);
  assert.equal(workspaces[0].sources[0].scopeRef, "INC-42");
});

test("[OP01b][WORKSPACE] unrecognised roles and inactive elevations fail closed", () => {
  assert.deepEqual(
    resolveInternalWorkspaces({
      assignments: [assignment("ADMIN")],
      elevations: [
        {
          id: "elevation-1",
          requestedPermission: "REPORT_VIEW",
          status: "REQUESTED",
          scopeType: "GLOBAL",
          scopeRef: null,
          startsAt: null,
          expiresAt: new Date("2026-09-01T12:30:00.000Z"),
        },
      ],
      now: NOW,
    }),
    []
  );
  assert.deepEqual(
    resolveInternalWorkspaces({
      assignments: [
        assignment("VIEWER", { effectiveAt: null, expiresAt: null }),
      ],
      elevations: [],
      now: NOW,
    }),
    []
  );
  assert.deepEqual(
    resolveInternalWorkspaces({
      assignments: [
        assignment("VIEWER", { scopeType: "OPERATING_UNIT", scopeRef: null }),
      ],
      elevations: [],
      now: NOW,
    }),
    []
  );
});
