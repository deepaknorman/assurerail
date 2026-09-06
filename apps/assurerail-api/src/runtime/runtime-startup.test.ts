import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";

const MAIN = path.resolve(__dirname, "../main.js");
const APP_ROOT = path.resolve(__dirname, "../..");
const STARTUP_TIMEOUT_MS = 30_000;
const CONFIG_KEYS = [
  "ASSURERAIL_OPERATING_MODE",
  "ARAIL_DEMO_ENDPOINTS_ENABLED",
  "DATABASE_URL",
  "FIREBASE_ADMIN_CONFIG",
  "TAPE_SOURCE",
  "HTS_ADAPTER",
  "HCS_ANCHOR",
  "SETTLEMENT_ADAPTER",
  "DIGIKYC_GATE",
  "TAPE_PROVIDER_API_URL",
  "TAPE_PROVIDER_API_KEY",
  "IDENTITY_PROVIDER_API_URL",
  "IDENTITY_PROVIDER_API_KEY",
  "ANCHOR_PROVIDER_API_URL",
  "ANCHOR_PROVIDER_API_KEY",
  "SETTLEMENT_PROVIDER_API_URL",
  "SETTLEMENT_PROVIDER_API_KEY",
  "DIGIKYC_STATUS_SERVICE_SECRET",
  "RECAPTCHA_SITE_KEY",
  "RECAPTCHA_ENFORCE",
  "ASSURERAIL_STARTUP_PROBE",
  "ASSURERAIL_CORS_ANY",
  "ASSURERAIL_WEB_ORIGINS",
  "REQUIRE_DB",
  "SEED_ON_BOOT",
  "ARAIL_NEUTRAL_INGRESS_V1",
  "ARAIL_DURABLE_RELAY_MODE",
  "ARAIL_PARTICIPANT_ADMISSION_V1",
  "ARAIL_ROUTE_ENTITLEMENT_ENFORCE",
  "ARAIL_INTERNAL_RBAC_V1",
  "VAULT_ADDR",
  "VAULT_NAMESPACE",
  "VAULT_APPROLE_ROLE_ID",
  "VAULT_APPROLE_SECRET_ID",
  "VAULT_TOKEN",
] as const;

function cleanEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DOTENV_CONFIG_PATH: "/dev/null" };
  for (const key of CONFIG_KEYS) delete env[key];
  return env;
}

test("[STARTUP_PROCESS][DEMO] an optimised explicit demo process boots with demo routes/adapters and no credentials", async () => {
  const child = spawn(process.execPath, [MAIN], {
    cwd: APP_ROOT,
    env: {
      ...cleanEnvironment(),
      NODE_ENV: "production",
      PORT: "0",
      ASSURERAIL_OPERATING_MODE: "DEMO",
      ARAIL_DEMO_ENDPOINTS_ENABLED: "true",
      TAPE_SOURCE: "demo",
      HTS_ADAPTER: "demo",
      HCS_ANCHOR: "demo",
      SETTLEMENT_ADAPTER: "demo",
      DIGIKYC_GATE: "demo",
      ASSURERAIL_STARTUP_PROBE: "true",
      SEED_ON_BOOT: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });

  try {
    await new Promise<void>((resolve, reject) => {
      const marker = "AssureRail operating mode: DEMO (demo endpoints enabled)";
      const timeout = setTimeout(() => reject(new Error(`demo startup marker timed out:\n${output}`)), STARTUP_TIMEOUT_MS);
      const cleanup = () => {
        clearTimeout(timeout);
        child.stdout.off("data", inspect);
        child.stderr.off("data", inspect);
        child.off("exit", exited);
      };
      const inspect = () => {
        if (!output.includes(marker)) return;
        cleanup();
        resolve();
      };
      const exited = () => {
        cleanup();
        reject(new Error(`demo process exited before startup marker:\n${output}`));
      };
      child.stdout.on("data", inspect);
      child.stderr.on("data", inspect);
      child.on("exit", exited);
      inspect();
    });
    assert.match(output, /AssureRail store: IN-MEMORY/);
    if (child.exitCode === null) {
      const [code] = await once(child, "exit") as [number | null, NodeJS.Signals | null];
      assert.equal(code, 0);
    }
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit");
  }
});

test("[STARTUP_PROCESS][PRODUCTION] an undeclared production process exits before listening", async () => {
  const child = spawn(process.execPath, [MAIN], {
    cwd: APP_ROOT,
    env: { ...cleanEnvironment(), NODE_ENV: "production", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  const timeout = setTimeout(() => child.kill("SIGKILL"), STARTUP_TIMEOUT_MS);
  try {
    const [code] = await once(child, "exit") as [number | null, NodeJS.Signals | null];
    assert.notEqual(code, 0);
    assert.match(output, /AssureRail runtime configuration rejected/);
    assert.match(output, /DATABASE_URL is required in PRODUCTION mode/);
    assert.doesNotMatch(output, /Starting Nest application/);
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
});
