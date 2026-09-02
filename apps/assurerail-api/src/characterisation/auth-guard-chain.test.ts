import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ADMIN_KEY, ENTITY_ROLES_KEY, ROLES_KEY, SUPERADMIN_KEY } from "../auth/roles.decorator";

type Metadata = Record<string, unknown>;
type RequestShape = { headers?: Record<string, string | undefined>; user?: Record<string, unknown>; firebase?: Record<string, unknown> };

function reflector(metadata: Metadata) {
  return {
    getAllAndOverride: <T>(key: string): T | undefined => metadata[key] as T | undefined,
  };
}

function context(req: RequestShape): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
}

const activeIssuer = {
  id: "vu-test",
  firebaseUid: "uid-test",
  email: "issuer@example.invalid",
  displayName: "Test Issuer",
  did: "did:test:issuer",
  role: "ISSUER",
  isAdmin: false,
  platformRole: null,
  entityDid: "did:test:institution",
  entityRole: "OPERATOR",
  allowlisted: true,
  status: "ACTIVE",
};

test("[DB_MODE_GUARD_HARNESS][AUTHZ] a verified DB-mode user is attached then checked for active function role", async () => {
  const req: RequestShape = { headers: { authorization: "Bearer fixture-token" } };
  const auth = new AuthGuard(
    reflector({ [IS_PUBLIC_KEY]: false }) as never,
    { verifyIdToken: async () => ({ uid: "uid-test", email: activeIssuer.email, email_verified: true }) } as never,
    { resolveFromToken: async () => activeIssuer, resolveSession: async () => null } as never,
  );
  assert.equal(await auth.canActivate(context(req)), true);
  assert.equal(req.firebase?.uid, "uid-test");
  assert.equal(req.user?.status, "ACTIVE");

  const roles = new RolesGuard(reflector({ [ROLES_KEY]: ["ISSUER"] }) as never);
  assert.equal(roles.canActivate(context(req)), true);
});

test("[DB_MODE_GUARD_HARNESS][AUTHN] a protected endpoint rejects a missing bearer token", async () => {
  const auth = new AuthGuard(
    reflector({ [IS_PUBLIC_KEY]: false }) as never,
    { verifyIdToken: async () => ({ uid: "never" }) } as never,
    { resolveFromToken: async () => activeIssuer, resolveSession: async () => null } as never,
  );
  await assert.rejects(() => auth.canActivate(context({ headers: {} })), UnauthorizedException);
});

test("[DB_MODE_GUARD_HARNESS][PUBLIC] a public endpoint ignores an invalid optional bearer token", async () => {
  const auth = new AuthGuard(
    reflector({ [IS_PUBLIC_KEY]: true }) as never,
    { verifyIdToken: async () => { throw new UnauthorizedException("fixture invalid token"); } } as never,
    { resolveFromToken: async () => activeIssuer, resolveSession: async () => null } as never,
  );
  assert.equal(
    await auth.canActivate(context({ headers: { authorization: "Bearer invalid-fixture-token" } })),
    true,
  );
});

test("[DB_MODE_GUARD_HARNESS][PR03] institution context must be active and bound to the current session", async () => {
  const req: RequestShape = {
    headers: {
      authorization: "Bearer fixture-token",
      "x-assurerail-institution-id": "inst-1",
    },
  };
  const auth = new AuthGuard(
    reflector({ [IS_PUBLIC_KEY]: false }) as never,
    { verifyIdToken: async () => ({ uid: "uid-test", email: activeIssuer.email, email_verified: true }) } as never,
    {
      resolveFromToken: async () => activeIssuer,
      resolveSession: async () => ({ id: "session-1", activeInstitutionId: "inst-1" }),
      resolveInstitutionContext: async () => ({ institutionId: "inst-1", membershipId: "member-1" }),
    } as never,
  );
  assert.equal(await auth.canActivate(context(req)), true);
  assert.equal((req.user?.activeInstitution as { institutionId?: string }).institutionId, "inst-1");

  const mismatched = new AuthGuard(
    reflector({ [IS_PUBLIC_KEY]: false }) as never,
    { verifyIdToken: async () => ({ uid: "uid-test", email: activeIssuer.email, email_verified: true }) } as never,
    {
      resolveFromToken: async () => activeIssuer,
      resolveSession: async () => ({ id: "session-1", activeInstitutionId: "inst-other" }),
      resolveInstitutionContext: async () => ({ institutionId: "inst-1", membershipId: "member-1" }),
    } as never,
  );
  await assert.rejects(() => mismatched.canActivate(context({ headers: req.headers })), ForbiddenException);
});

test("[DB_MODE_GUARD_HARNESS][PR03][AR-C02] entity-role gate rejects a suspended/non-allowlisted matching role", () => {
  const req: RequestShape = {
    user: { ...activeIssuer, status: "SUSPENDED", allowlisted: false, entityRole: "OPERATOR" },
  };
  const roles = new RolesGuard(reflector({ [ENTITY_ROLES_KEY]: ["OPERATOR"] }) as never);

  assert.throws(() => roles.canActivate(context(req)), ForbiddenException);
});

test("[DB_MODE_GUARD_HARNESS][CURRENT] the function-role gate rejects the same suspended user", () => {
  const req: RequestShape = {
    user: { ...activeIssuer, status: "SUSPENDED", allowlisted: false },
  };
  const roles = new RolesGuard(reflector({ [ROLES_KEY]: ["ISSUER"] }) as never);
  assert.throws(() => roles.canActivate(context(req)), ForbiddenException);
});

test("[DB_MODE_GUARD_HARNESS][CURRENT] platform admin and superadmin gates remain distinct", () => {
  const admin = { ...activeIssuer, isAdmin: true, platformRole: "ADMIN" };
  assert.equal(
    new RolesGuard(reflector({ [ADMIN_KEY]: true }) as never).canActivate(context({ user: admin })),
    true,
  );
  assert.throws(
    () => new RolesGuard(reflector({ [SUPERADMIN_KEY]: true }) as never).canActivate(context({ user: admin })),
    ForbiddenException,
  );
  assert.equal(
    new RolesGuard(reflector({ [SUPERADMIN_KEY]: true }) as never).canActivate(
      context({ user: { ...admin, platformRole: "SUPERADMIN" } }),
    ),
    true,
  );
});

test("[PR12][OP01c] enforcement retires the complete legacy role and platform-admin surface", () => {
  const previous = process.env.ARAIL_INTERNAL_RBAC_V1;
  process.env.ARAIL_INTERNAL_RBAC_V1 = "enforce";
  try {
    const superadmin = { ...activeIssuer, isAdmin: true, platformRole: "SUPERADMIN" };
    assert.throws(
      () => new RolesGuard(reflector({ [SUPERADMIN_KEY]: true }) as never).canActivate(context({ user: superadmin })),
      /legacy SUPERADMIN route is disabled/,
    );
    assert.throws(
      () => new RolesGuard(reflector({ [ADMIN_KEY]: true }) as never).canActivate(context({ user: superadmin })),
      /legacy platform-admin route is disabled/,
    );
    assert.throws(
      () => new RolesGuard(reflector({ [ROLES_KEY]: ["TRUSTEE"] }) as never).canActivate(context({ user: superadmin })),
      /legacy function-role route is disabled/,
    );
    assert.throws(
      () => new RolesGuard(reflector({ [ROLES_KEY]: ["ISSUER"] }) as never).canActivate(context({ user: activeIssuer })),
      /legacy function-role route is disabled/,
    );
    assert.throws(
      () => new RolesGuard(reflector({ [ENTITY_ROLES_KEY]: ["OPERATOR"] }) as never).canActivate(context({ user: activeIssuer })),
      /legacy entity-role route is disabled/,
    );
  } finally {
    if (previous === undefined) delete process.env.ARAIL_INTERNAL_RBAC_V1;
    else process.env.ARAIL_INTERNAL_RBAC_V1 = previous;
  }
});
