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

function scopedService(scopeType = "INSTITUTION", scopeRef: string | null = "inst-1") {
  const institution = activeInstitution();
  const member = institution.members[0];
  return new InstitutionAccessService({
    institution: { findUnique: async () => ({
      ...institution,
      members: [{ ...member, mandates: [{ ...member.mandates[0], scopeType, scopeRef }] }],
    }) },
  } as never);
}

const institutionRequest = { userId: "user-1", institutionId: "inst-1", action: "ADMINISTER_MEMBERS" as const, now };

test("[DEMO][ACCESS] an institution request defaults its reference to that institution", async () => {
  const service = scopedService();
  assert.equal((await service.evaluateHuman(institutionRequest)).code, "AUTHORISED");
  assert.equal((await service.evaluateHuman({ ...institutionRequest, scopeType: "INSTITUTION" })).code, "AUTHORISED");
});

test("[DEMO][ACCESS] explicit foreign or null institution references remain denied", async () => {
  const service = scopedService();
  for (const scopeRef of ["inst-2", null]) {
    assert.equal((await service.evaluateHuman({ ...institutionRequest, scopeRef })).code, "SCOPE_REFERENCE_MISMATCH");
  }
  assert.equal((await scopedService("INSTITUTION", "inst-2").evaluateHuman(institutionRequest)).code, "SCOPE_REFERENCE_MISMATCH");
});

test("[DEMO][ACCESS] institution defaults do not invent references for child resources", async () => {
  const service = scopedService("TRANSACTION_CASE", "case-1");
  const request = { ...institutionRequest, scopeType: "TRANSACTION_CASE" };
  assert.equal((await service.evaluateHuman(request)).code, "SCOPE_REFERENCE_MISMATCH");
  assert.equal((await service.evaluateHuman({ ...request, scopeRef: "case-2" })).code, "SCOPE_REFERENCE_MISMATCH");
  assert.equal((await service.evaluateHuman({ ...request, scopeRef: "case-1" })).code, "AUTHORISED");
  assert.equal((await service.evaluateHuman(institutionRequest)).code, "SCOPE_TYPE_MISMATCH");
  assert.equal((await scopedService().evaluateHuman({ ...request, scopeRef: "case-1" })).code, "SCOPE_TYPE_MISMATCH");
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
