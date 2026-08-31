import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { IdentityBindingService } from "../auth/identity-binding.service";
import { VenueUserService } from "../auth/venue-user.service";
import { InstitutionApplicationService } from "./institution-application.service";
import { InstitutionGovernanceService } from "./institution-governance.service";
import { StepUpService } from "./step-up.service";

const userRow = {
  id: "vu-1",
  firebaseUid: "uid-1",
  email: "person@example.invalid",
  displayName: "Person",
  did: null,
  role: "INVESTOR",
  isAdmin: false,
  platformRole: null,
  entityDid: null,
  entityRole: null,
  allowlisted: false,
  status: "PENDING",
  identityProvider: null,
  identitySubject: null,
  identityVerifiedAt: null,
};

test("[PR03][IDENTITY] AssureLocker is one adapter and unsupported providers fail closed", async () => {
  let calls = 0;
  const service = new IdentityBindingService({
    verify: async () => {
      calls += 1;
      return { ok: true, did: "did:test:person", reason: "fixture" };
    },
  } as never);
  assert.deepEqual(await service.verify({ email: userRow.email }), {
    ok: true,
    providerKey: "ASSURELOCKER_DIGIKYC",
    subject: "did:test:person",
    reason: "fixture",
  });
  assert.equal(calls, 1);
  assert.deepEqual(await service.verify({ provider: "lender-registry", email: userRow.email }), {
    ok: false,
    providerKey: "LENDER-REGISTRY",
    reason: "identity-provider-not-configured",
  });
  assert.equal(calls, 1);
});

test("[PR03][AR-C03] identity binding activates identity but never grants legacy allow-list admission", async () => {
  let updateData: Record<string, unknown> | undefined;
  const service = new VenueUserService({
    venueUser: {
      findUnique: async () => userRow,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { ...userRow, ...data };
      },
    },
  } as never);
  const bound = await service.bindIdentity("uid-1", "ASSURELOCKER_DIGIKYC", "did:test:person");
  assert.equal(updateData?.allowlisted, false);
  assert.equal(bound.allowlisted, false);
  assert.equal(bound.status, "ACTIVE");
  assert.equal(bound.identityProvider, "ASSURELOCKER_DIGIKYC");
  assert.ok(bound.identityVerifiedAt instanceof Date);
});

test("[PR03][AR-C03] identity rebinding cannot reactivate or rewrite a suspended account", async () => {
  let updated = false;
  const service = new VenueUserService({
    venueUser: {
      findUnique: async () => ({ ...userRow, status: "SUSPENDED" }),
      update: async () => { updated = true; },
    },
  } as never);
  await assert.rejects(
    () => service.bindIdentity("uid-1", "ASSURELOCKER_DIGIKYC", "did:test:person"),
    ForbiddenException,
  );
  assert.equal(updated, false);
});

test("[PR03][SESSION] active institution context is retained without storing the bearer token", async () => {
  let upsert: Record<string, unknown> | undefined;
  const service = new VenueUserService({
    venueSession: {
      findUnique: async () => null,
      upsert: async (input: Record<string, unknown>) => {
        upsert = input;
        const create = input.create as Record<string, unknown>;
        return create;
      },
    },
  } as never);
  service.resolveInstitutionContext = async () => ({ institutionId: "inst-1" }) as never;
  const session = await service.recordSession({
    userId: "vu-1",
    idToken: "test-only-bearer-token",
    activeInstitutionId: "inst-1",
    credentialAssurance: "FIREBASE:password",
  });
  assert.match(session.id, /^vs_[a-f0-9]{40}$/);
  assert.equal(session.activeInstitutionId, "inst-1");
  assert.doesNotMatch(JSON.stringify(upsert), /test-only-bearer-token/);
});

test("[PR03][STEP_UP] evidence is bounded to exact actor, institution, purpose, expiry and one use", async () => {
  let created: Record<string, unknown> | undefined;
  let consumedWhere: Record<string, unknown> | undefined;
  const db = {
    venueUser: { findUnique: async () => ({ ...userRow, status: "ACTIVE" }) },
    venueSession: { findUnique: async () => ({ id: "session-1", userId: "vu-1", activeInstitutionId: "inst-1", revokedAt: null, expiresAt: null }) },
    stepUpEvidence: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created = data;
        return data;
      },
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        consumedWhere = where;
        return { count: 1 };
      },
    },
  };
  const service = new StepUpService(db as never);
  const issued = await service.issue({
    firebaseUid: "uid-1",
    sessionId: "session-1",
    purpose: "MANDATE_REVIEW",
    institutionId: "inst-1",
    method: "TOTP",
  });
  assert.equal(issued.purpose, "MANDATE_REVIEW");
  assert.equal(created?.userId, "vu-1");
  assert.equal(created?.institutionId, "inst-1");
  assert.ok((created?.expiresAt as Date).getTime() - (created?.issuedAt as Date).getTime() === 300_000);

  await service.consume({
    evidenceId: issued.id as string,
    userId: "vu-1",
    sessionId: "session-1",
    purpose: "MANDATE_REVIEW",
    institutionId: "inst-1",
  });
  assert.deepEqual(
    {
      userId: consumedWhere?.userId,
      sessionId: consumedWhere?.sessionId,
      purpose: consumedWhere?.purpose,
      institutionId: consumedWhere?.institutionId,
      consumedAt: consumedWhere?.consumedAt,
    },
    { userId: "vu-1", sessionId: "session-1", purpose: "MANDATE_REVIEW", institutionId: "inst-1", consumedAt: null },
  );
  assert.ok(consumedWhere?.expiresAt);
});

test("[PR03][STEP_UP] unrecognised ceremony purposes and already-consumed evidence fail closed", async () => {
  const service = new StepUpService({
    venueUser: { findUnique: async () => ({ ...userRow, status: "ACTIVE" }) },
    venueSession: { findUnique: async () => null },
    stepUpEvidence: {
      create: async () => { throw new Error("must not create"); },
      updateMany: async () => ({ count: 0 }),
    },
  } as never);
  await assert.rejects(
    () => service.issue({ firebaseUid: "uid-1", sessionId: "session-1", purpose: "DO_ANYTHING", method: "TOTP" }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.consume({
      evidenceId: "sup-used",
      userId: "vu-1",
      sessionId: "session-1",
      purpose: "MANDATE_REVIEW",
      institutionId: "inst-1",
    }),
    ForbiddenException,
  );
});

test("[PR03][STEP_UP] participant ceremony cannot cross the session's institution context", async () => {
  const service = new StepUpService({
    venueUser: { findUnique: async () => ({ ...userRow, status: "ACTIVE" }) },
    venueSession: {
      findUnique: async () => ({
        id: "session-1",
        userId: "vu-1",
        activeInstitutionId: "inst-other",
        revokedAt: null,
        expiresAt: null,
      }),
    },
    stepUpEvidence: { create: async () => { throw new Error("must not create"); } },
  } as never);
  await assert.rejects(
    () => service.issue({
      firebaseUid: "uid-1",
      sessionId: "session-1",
      purpose: "MANDATE_PROPOSE",
      institutionId: "inst-1",
      method: "TOTP",
    }),
    ForbiddenException,
  );
});

test("[OP01][STEP_UP] internal-control ceremony is identity-bound and cannot run in a participant context", async () => {
  const customerContext = new StepUpService({
    venueUser: { findUnique: async () => ({ ...userRow, status: "ACTIVE", identityVerifiedAt: new Date() }) },
    venueSession: { findUnique: async () => ({ id: "session-1", userId: "vu-1", activeInstitutionId: "inst-1", revokedAt: null, expiresAt: null }) },
    stepUpEvidence: { create: async () => { throw new Error("must not create"); } },
  } as never);
  await assert.rejects(
    () => customerContext.issue({ firebaseUid: "uid-1", sessionId: "session-1", purpose: "INTERNAL_ROLE_PROPOSE", method: "TOTP" }),
    ForbiddenException,
  );

  const unbound = new StepUpService({
    venueUser: { findUnique: async () => ({ ...userRow, status: "ACTIVE", identityVerifiedAt: null }) },
    venueSession: { findUnique: async () => ({ id: "session-1", userId: "vu-1", activeInstitutionId: null, revokedAt: null, expiresAt: null }) },
    stepUpEvidence: { create: async () => { throw new Error("must not create"); } },
  } as never);
  await assert.rejects(
    () => unbound.issue({ firebaseUid: "uid-1", sessionId: "session-1", purpose: "PRIVILEGED_ACCESS_REQUEST", method: "TOTP" }),
    ForbiddenException,
  );
});

test("[PR03][MAKER_CHECKER] admission, mandate and entitlement makers cannot review themselves", async () => {
  const application = new InstitutionApplicationService({
    participantAdmissionDecision: {
      findUnique: async () => ({
        id: "decision-1",
        status: "PENDING",
        proposedByUserId: "maker",
        participantAdmission: { institutionId: "inst-1", institution: { applicantUserId: "maker" } },
      }),
    },
  } as never, {} as never, {} as never);
  await assert.rejects(
    () => application.reviewDecision("maker", "decision-1", { approve: true, reviewNote: "self", stepUpEvidenceId: "sup" }, "session-1"),
    ForbiddenException,
  );

  const governance = new InstitutionGovernanceService({
    authorityMandate: { findUnique: async () => ({
      id: "mandate-1", status: "PROPOSED", proposedByUserId: "maker", institutionId: "inst-1",
      member: { status: "ACTIVE" }, expiresAt: null,
    }) },
    routeEntitlement: { findUnique: async () => ({
      id: "route-1", status: "PROPOSED", proposedByUserId: "maker", institutionId: "inst-1", expiresAt: null,
      institution: { status: "ACTIVE", admission: { status: "ADMITTED" } },
    }) },
  } as never, {} as never, {} as never, {} as never);
  await assert.rejects(
    () => governance.reviewMandate("maker", "mandate-1", { approve: true, reason: "self", stepUpEvidenceId: "sup" }, "inst-1", "session-1"),
    ForbiddenException,
  );
  await assert.rejects(
    () => governance.reviewRouteEntitlement("maker", "route-1", { approve: true, reason: "self", stepUpEvidenceId: "sup" }, "session-1"),
    ForbiddenException,
  );
});

test("[PR03][ENTITLEMENT] participant authority cannot approve its own route permission", async () => {
  const governance = new InstitutionGovernanceService({
    routeEntitlement: {
      findUnique: async () => ({
        id: "route-1",
        status: "PROPOSED",
        proposedByUserId: "participant-maker",
        institutionId: "inst-1",
        expiresAt: null,
        institution: { status: "ACTIVE", admission: { status: "ADMITTED" } },
      }),
    },
    venueUser: {
      findUnique: async () => ({ id: "participant-checker", status: "ACTIVE", platformRole: null }),
    },
  } as never, {} as never, {} as never, {} as never);
  await assert.rejects(
    () => governance.reviewRouteEntitlement("participant-checker", "route-1", {
      approve: true,
      reason: "participant self grant",
      stepUpEvidenceId: "sup",
    }, "session-1"),
    ForbiddenException,
  );
});
