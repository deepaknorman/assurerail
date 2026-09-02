import assert from "node:assert/strict";
import test from "node:test";
import { InstitutionAccessService } from "./institution-access.service";

const now = new Date("2026-08-30T12:00:00.000Z");

function activeInstitution(overrides: Record<string, unknown> = {}) {
  return {
    id: "inst-1",
    status: "ACTIVE",
    admission: { status: "ADMITTED", effectiveAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: null },
    members: [{
      id: "member-1",
      status: "ACTIVE",
      effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
      expiresAt: null,
      mandates: [{
        id: "mandate-1",
        status: "ACTIVE",
        effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: null,
        action: "ADMINISTER_MEMBERS",
        scopeType: "INSTITUTION",
        scopeRef: null,
      }],
    }],
    ...overrides,
  };
}

test("[PR03][ACCESS] database evaluator returns the exact member and mandate used", async () => {
  const service = new InstitutionAccessService({
    institution: { findUnique: async () => activeInstitution() },
  } as never);
  assert.deepEqual(await service.evaluateHuman({
    userId: "user-1",
    institutionId: "inst-1",
    action: "ADMINISTER_MEMBERS",
    now,
  }), { allowed: true, code: "AUTHORISED", memberId: "member-1", mandateId: "mandate-1" });
});

test("[PR03][ACCESS] suspension is seen on every evaluation even when no mandate rows remain", async () => {
  const service = new InstitutionAccessService({
    institution: { findUnique: async () => activeInstitution({ status: "SUSPENDED", members: [] }) },
  } as never);
  assert.equal((await service.evaluateHuman({
    userId: "user-1",
    institutionId: "inst-1",
    action: "VIEW_INSTITUTION",
    now,
  })).code, "INSTITUTION_NOT_ACTIVE");
});

test("[PR03][ACCESS] route comparison requires active admission and an exact active entitlement", async () => {
  const route = {
    transactionRoute: "PTC",
    representation: "CONVENTIONAL",
    assetClass: "MSME_LOAN",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
    materialFunction: "ISSUANCE_OR_ALLOTMENT",
    operatingMode: "SHADOW",
  };
  const service = new InstitutionAccessService({
    institution: {
      findUnique: async () => ({
        id: "inst-1",
        status: "ACTIVE",
        admission: { status: "ADMITTED", effectiveAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: null },
        routeEntitlements: [{
          id: "route-1",
          status: "ACTIVE",
          effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
          expiresAt: null,
          ...route,
          functionPerformer: "EXTERNAL_AUTHORITY",
          operatingModes: ["REPLAY", "SHADOW"],
        }],
      }),
    },
  } as never);
  assert.deepEqual(await service.evaluateRoute("inst-1", route, now), { allowed: true, code: "ROUTE_ENTITLED" });
  assert.equal((await service.evaluateRoute("inst-1", { ...route, representation: "TOKENISED" }, now)).allowed, false);
});

test("[PR03][ACCESS] route comparison can use the caller's transaction client", async () => {
  const route = {
    transactionRoute: "DA",
    representation: "CONVENTIONAL",
    assetClass: "RECEIVABLES",
    lifecycleLeg: "INITIAL_TRANSFER_OR_ISSUE",
    materialFunction: "ALLOCATION",
    operatingMode: "SHADOW",
  };
  const outside = { institution: { findUnique: async () => { throw new Error("outside client used"); } } };
  const transaction = { institution: { findUnique: async () => ({
    id: "inst-1",
    status: "ACTIVE",
    admission: { status: "ADMITTED", effectiveAt: null, expiresAt: null },
    routeEntitlements: [{ ...route, status: "ACTIVE", effectiveAt: null, expiresAt: null,
      functionPerformer: "PARTICIPANT_OWNED", operatingModes: ["SHADOW"] }],
  }) } };
  const service = new InstitutionAccessService(outside as never);
  assert.deepEqual(await service.evaluateRoute("inst-1", route, now, transaction as never), {
    allowed: true,
    code: "ROUTE_ENTITLED",
  });
});

test("[PR03][ACCESS] a suspended service principal fails despite a matching action", async () => {
  const service = new InstitutionAccessService({
    institutionServicePrincipal: {
      findUnique: async () => ({
        id: "sp-1",
        clientId: "client-1",
        institutionId: "inst-1",
        status: "SUSPENDED",
        effectiveAt: new Date("2026-08-01T00:00:00.000Z"),
        expiresAt: null,
        allowedActions: ["SUBMIT_EVIDENCE"],
        institution: {
          status: "ACTIVE",
          admission: { status: "ADMITTED", effectiveAt: new Date("2026-08-01T00:00:00.000Z"), expiresAt: null },
        },
      }),
    },
  } as never);
  assert.equal((await service.evaluateServicePrincipal({
    clientId: "client-1",
    institutionId: "inst-1",
    action: "SUBMIT_EVIDENCE",
    now,
  })).code, "SERVICE_PRINCIPAL_NOT_ACTIVE");
});
