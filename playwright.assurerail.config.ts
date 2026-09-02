import { defineConfig, devices } from "@playwright/test";

/**
 * SEC-01 authenticated AssureRail harness. It targets an already-running, explicitly authorised
 * pre-production environment. The preflight script enforces HTTPS, a private 0600 account file and
 * the full two-tenant/staff-role account matrix before this configuration can execute.
 */
export default defineConfig({
  testDir: "tests/e2e/assurerail-sec01",
  timeout: 75_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "test-results/assurerail-sec01",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/assurerail-sec01/results.json" }],
    ["html", { open: "never", outputFolder: "playwright-report/assurerail-sec01" }],
  ],
  use: {
    baseURL: process.env.ARAIL_E2E_WEB_URL ?? "https://invalid.assurerail.test",
    ...devices["Desktop Chrome"],
    ...(process.env.ARAIL_E2E_PROXY_URL
      ? { proxy: { server: process.env.ARAIL_E2E_PROXY_URL } }
      : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // ZAP terminates TLS only during an explicitly gated DAST proxy run. Ordinary E2E must validate
    // the target certificate and cannot opt out via a generic environment toggle.
    ignoreHTTPSErrors: process.env.ARAIL_E2E_DAST_PROXY === "yes",
  },
  projects: [{ name: "assurerail-sec01-chromium" }],
});
