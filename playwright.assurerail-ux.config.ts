import { defineConfig, devices } from "@playwright/test";

// Playwright's automatic failure prompt includes password input values in its ARIA snapshot.
// This must remain disabled even when traces, screenshots and videos are already off.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

/**
 * Authenticated customer-experience release gate. It targets only an explicitly authorised,
 * synthetic pre-production environment. Credential-bearing traces, screenshots and videos stay
 * disabled because Playwright may otherwise retain passwords entered during sign-in.
 */
export default defineConfig({
  testDir: "tests/e2e/assurerail-ux",
  timeout: 75_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "test-results/assurerail-ux",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/assurerail-ux/results.json" }],
    ["html", { open: "never", outputFolder: "playwright-report/assurerail-ux" }],
  ],
  use: {
    baseURL: process.env.ARAIL_UX_WEB_URL ?? process.env.ARAIL_E2E_WEB_URL ?? "https://invalid.assurerail.test",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "off",
    screenshot: "off",
    video: "off",
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: "ux-chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "ux-firefox-desktop", use: { ...devices["Desktop Firefox"] } },
    { name: "ux-webkit-mobile", use: { ...devices["iPhone 13"] } },
  ],
});
