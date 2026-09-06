import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(appRoot, "../..");
const read = (relative: string) => readFileSync(path.resolve(repoRoot, relative), "utf8");

test("[SEP01][LOGICAL] Rail runtime owns its domain and imports no AssureLocker application or database client", () => {
  const files = [
    "apps/assurerail-api/src/app.module.ts",
    "apps/assurerail-api/src/store/prisma.service.ts",
    "apps/assurerail-api/src/auth/auth.module.ts",
    "apps/assurerail-api/src/institutions/institutions.module.ts",
  ].map(read).join("\n");

  assert.doesNotMatch(files, /from ["']@code\//);
  assert.doesNotMatch(files, /@prisma\/(?:client|data-client|control-client)\b/);
  assert.match(files, /@prisma\/assurerail-client/);
});

test("[SEP01][API] branded online room compatibility surfaces are retired, while offline sealed imports remain", () => {
  const roomsModule = read("apps/assurerail-api/src/rooms/rooms.module.ts");
  const integrationsModule = read("apps/assurerail-api/src/integrations/integrations.module.ts");
  const providerProfiles = read("apps/assurerail-api/src/evidence/provider-profiles.ts");
  const flags = read("apps/assurerail-api/src/persistence/feature-flags.ts");
  const roomService = read("apps/assurerail-api/src/rooms/rooms.service.ts");

  assert.doesNotMatch(`${roomsModule}\n${integrationsModule}`, /LegacyRoomProxy|ConnectorSubjectMapping/);
  assert.doesNotMatch(providerProfiles, /assurerail\.legacy-room-proxy/);
  assert.match(flags, /LEGACY_ROOM_PROXY_VALUES = \["off"\]/);
  assert.match(roomService, /sealedExport/);
});

test("[SEP01][NETWORK] default configuration has no AssureLocker or Plaza host and provider paths are deployment-selected", () => {
  const config = read("apps/assurerail-api/src/config.ts");
  const compose = read("docker-compose.assurerail.yml");
  const anchor = read("apps/assurerail-api/src/surveillance/hcs.adapter.ts");
  const settlement = read("apps/assurerail-api/src/settlement/settlement.adapter.ts");
  const identity = read("apps/assurerail-api/src/auth/identity-assurance-provider.service.ts");
  const executable = `${config}\n${compose}\n${anchor}\n${settlement}\n${identity}`;

  assert.doesNotMatch(executable, /ASSURELOCKER_API_URL|DIGIKYC_API_KEY|X-DigiKYC-Key/i);
  assert.doesNotMatch(executable, /host\.docker\.internal:300[0-5]|localhost:300[0-5]/i);
  assert.doesNotMatch(`${anchor}\n${settlement}`, /plaza/i);
  assert.match(anchor, /anchorProviderSubmitPath/);
  assert.match(settlement, /settlementProviderTransferPath/);
  assert.match(anchor, /redirect: "error"/);
  assert.match(settlement, /redirect: "error"/);
  assert.match(identity, /redirect: "error"/);
  assert.match(identity, /IDENTITY_PROVIDER_KEY/);
});

test("[SEP01][AUTHORITY] identity evidence cannot grant participant admission or select its provider from the request", () => {
  const controller = read("apps/assurerail-api/src/auth/auth.controller.ts");
  const users = read("apps/assurerail-api/src/auth/venue-user.service.ts");
  assert.doesNotMatch(controller, /body\.provider/i);
  assert.match(users, /allowlisted: false/);
  assert.match(controller, /grantsAdmission: false/);
});
