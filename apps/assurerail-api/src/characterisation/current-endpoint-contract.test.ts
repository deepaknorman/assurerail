import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { AdminController } from "../admin/admin.controller";
import { AmortiseController } from "../amortise/amortise.controller";
import { AuthController } from "../auth/auth.controller";
import { ADMIN_KEY, ENTITY_ROLES_KEY, ROLES_KEY, SUPERADMIN_KEY } from "../auth/roles.decorator";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { BreakGlassController } from "../breakglass/breakglass.controller";
import { CloseController } from "../closure/close.controller";
import { DemoController } from "../demo/demo.controller";
import { DvpController } from "../dvp/dvp.controller";
import { MintController } from "../mint/mint.controller";
import { OpsController } from "../ops/ops.controller";
import { ActivityController } from "../platform/activity.controller";
import { HealthController } from "../platform/health.controller";
import {
  BillingController,
  DocumentsController,
  IngressController,
  SupportController,
  WebhooksController,
} from "../platform/platform.controllers";
import { MetricsController } from "../platform/metrics.controller";
import { ReportsController } from "../reports/reports.controller";
import { MfaController, WebAuthnController } from "../security/security.controllers";
import { SurveillanceController } from "../surveillance/surveillance.controller";
import { TapeController } from "../tape/tape.controller";
import {
  CURRENT_ENDPOINT_CONTRACT,
  type CurrentAccessContract,
  type CurrentEndpointContract,
  type CurrentHttpMethod,
} from "./current-endpoint-contract";

type ControllerClass = abstract new (...args: never[]) => object;

const CONTROLLERS: readonly ControllerClass[] = [
  AdminController,
  AmortiseController,
  AuthController,
  BillingController,
  BreakGlassController,
  CloseController,
  DemoController,
  DocumentsController,
  DvpController,
  HealthController,
  IngressController,
  MetricsController,
  MintController,
  OpsController,
  ActivityController,
  ReportsController,
  MfaController,
  SupportController,
  SurveillanceController,
  TapeController,
  WebAuthnController,
  WebhooksController,
];

interface DiscoveredEndpoint {
  method: CurrentHttpMethod;
  path: string;
  access: CurrentAccessContract;
}

function metadata<T>(key: string, handler: (...args: unknown[]) => unknown, controller: ControllerClass): T | undefined {
  const onHandler = Reflect.getMetadata(key, handler) as T | undefined;
  return onHandler !== undefined ? onHandler : (Reflect.getMetadata(key, controller) as T | undefined);
}

function accessFor(handler: (...args: unknown[]) => unknown, controller: ControllerClass): CurrentAccessContract {
  if (metadata<boolean>(IS_PUBLIC_KEY, handler, controller)) return "PUBLIC";
  if (metadata<boolean>(SUPERADMIN_KEY, handler, controller)) return "SUPERADMIN";
  if (metadata<boolean>(ADMIN_KEY, handler, controller)) return "PLATFORM_ADMIN";
  const entityRoles = metadata<string[]>(ENTITY_ROLES_KEY, handler, controller);
  if (entityRoles?.length) throw new Error(`PR-00 inventory needs an entity-role access label: ${entityRoles.join(",")}`);
  const roles = metadata<string[]>(ROLES_KEY, handler, controller);
  if (!roles?.length) return "AUTHENTICATED";
  if (roles.join(",") === "ISSUER,DESK,INVESTOR,TRUSTEE,REGULATOR") return "ONBOARDED_ANY";
  if (roles.length === 1) return `ROLE:${roles[0]}` as CurrentAccessContract;
  return `ROLES:${roles.join(",")}` as CurrentAccessContract;
}

function joinPath(base: unknown, child: unknown): string {
  const pieces = [base, child]
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .filter((p): p is string => typeof p === "string" && p !== "" && p !== "/")
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return `/${pieces.join("/")}`.replace(/\/{2,}/g, "/");
}

function discoverControllerSurface(): DiscoveredEndpoint[] {
  const found: DiscoveredEndpoint[] = [];
  for (const controller of CONTROLLERS) {
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as unknown;
    for (const name of Object.getOwnPropertyNames(controller.prototype)) {
      if (name === "constructor") continue;
      const handler = (controller.prototype as Record<string, unknown>)[name];
      if (typeof handler !== "function") continue;
      const endpointHandler = handler as (...args: unknown[]) => unknown;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, endpointHandler) as RequestMethod | undefined;
      if (requestMethod === undefined) continue;
      const method = RequestMethod[requestMethod] as CurrentHttpMethod;
      if (!(["GET", "POST", "PATCH", "DELETE"] as string[]).includes(method)) {
        throw new Error(`unsupported method ${method} on ${controller.name}.${name}`);
      }
      found.push({
        method,
        path: joinPath(basePath, Reflect.getMetadata(PATH_METADATA, endpointHandler)),
        access: accessFor(endpointHandler, controller),
      });
    }
  }
  return found.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

const expectedSurface = (): DiscoveredEndpoint[] =>
  CURRENT_ENDPOINT_CONTRACT.map(({ method, path, access }) => ({ method, path, access })).sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`),
  );

test("[SOURCE_CONTRACT][CURRENT] all 58 controller endpoints and access decorators match the reviewed inventory", () => {
  const discovered = discoverControllerSurface();
  assert.equal(discovered.length, 58);
  assert.deepEqual(discovered, expectedSurface());
});

test("[SOURCE_CONTRACT][CURRENT] endpoint keys are unique and every row carries data/scope/enforcement classification", () => {
  const keys = CURRENT_ENDPOINT_CONTRACT.map((row) => `${row.method} ${row.path}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const row of CURRENT_ENDPOINT_CONTRACT) {
    assert.ok(row.dataClass, `${row.method} ${row.path} missing dataClass`);
    assert.ok(row.currentScope, `${row.method} ${row.path} missing currentScope`);
    assert.equal(
      row.authorizationEnforcement,
      row.access === "PUBLIC" ? "PUBLIC" : "DB_MODE_GLOBAL_GUARDS",
      `${row.method} ${row.path} has an inaccurate enforcement label`,
    );
  }
});

test("[SOURCE_CONTRACT][KNOWN_GAP] every global/resource-id-only participant surface is explicitly linked to AR-C01", () => {
  const exposed = CURRENT_ENDPOINT_CONTRACT.filter(
    (row) => row.currentScope === "GLOBAL_VENUE" || row.currentScope === "RESOURCE_ID_ONLY",
  );
  assert.ok(exposed.length > 0);
  for (const row of exposed) {
    assert.ok(
      row.findings?.includes("AR-C01"),
      `${row.method} ${row.path} is ${row.currentScope} but is not linked to AR-C01`,
    );
  }
});

test("[SOURCE_CONTRACT][DEMO] only the two one-call demo endpoints are supplied by DemoModule", () => {
  const demo = CURRENT_ENDPOINT_CONTRACT.filter((row) => row.availability === "DEMO_MODULE").map(
    (row) => `${row.method} ${row.path}`,
  );
  assert.deepEqual(demo, [
    "POST /venue/demo/run/:poolId",
    "POST /venue/demo/receivables/run/:poolId",
  ]);
  assert.ok(demo.every((key) => CURRENT_ENDPOINT_CONTRACT.find((row) => `${row.method} ${row.path}` === key)?.findings?.includes("AR-H13")));
});

test("[SOURCE_CONTRACT][PUBLIC] the reviewed public surface is exactly health, readiness, metrics, and session exchange", () => {
  const publicSurface = CURRENT_ENDPOINT_CONTRACT.filter((row) => row.access === "PUBLIC")
    .map((row) => `${row.method} ${row.path}`)
    .sort();
  assert.deepEqual(publicSurface, [
    "GET /health",
    "GET /healthz",
    "GET /metrics",
    "GET /readyz",
    "POST /venue/auth/session",
  ]);
});
