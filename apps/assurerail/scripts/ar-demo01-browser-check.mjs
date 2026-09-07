#!/usr/bin/env node
import { chromium, request as playwrightRequest, webkit } from "playwright";

const base = new URL(process.env.ARAIL_DEMO_BASE_URL ?? "http://127.0.0.1:3017");
const username = process.env.ARAIL_DEMO_USERNAME;
const password = process.env.ARAIL_DEMO_PASSWORD;
if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash)
  throw new Error("ARAIL_DEMO_BASE_URL must be a bare HTTP(S) origin");
if (!username || username.length < 4 || !password || password.length < 16)
  throw new Error("ARAIL_DEMO_USERNAME and a password of at least 16 characters are required");

const failures = [];
const engines = [
  { label: "Chromium", launcher: chromium },
  { label: "WebKit", launcher: webkit },
];
const viewports = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

const unauthenticated = await playwrightRequest.newContext({ baseURL: base.origin });
try {
  const denied = await unauthenticated.get("/sandbox", { maxRedirects: 0 });
  if (denied.status() !== 401) failures.push(`unauthenticated /sandbox returned ${denied.status()} instead of 401`);
} finally {
  await unauthenticated.dispose();
}

for (const engine of engines) {
  const browser = await engine.launcher.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport,
        httpCredentials: { username, password },
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const errors = [];
      const externalOrigins = new Set();
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        const origin = new URL(request.url()).origin;
        if (origin !== base.origin) externalOrigins.add(origin);
      });

      const response = await page.goto(new URL("/sandbox", base).href, { waitUntil: "networkidle" });
      if (!response || response.status() !== 200) failures.push(`${engine.label}/${viewport.label}: HTTP ${response?.status() ?? "none"}`);
      if (errors.length) failures.push(`${engine.label}/${viewport.label}: browser errors ${errors.join(" | ")}`);
      if (externalOrigins.size) failures.push(`${engine.label}/${viewport.label}: unexpected external request ${[...externalOrigins].join(", ")}`);

      const audit = await page.evaluate(() => ({
        h1: document.querySelectorAll("h1").length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        unnamed: [...document.querySelectorAll("a,button")].filter((node) => !(node.textContent?.trim() || node.getAttribute("aria-label"))).length,
        body: document.body.innerText,
        robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "",
      }));
      if (audit.h1 !== 1) failures.push(`${engine.label}/${viewport.label}: expected one h1, found ${audit.h1}`);
      if (audit.overflow > 1) failures.push(`${engine.label}/${viewport.label}: horizontal overflow ${audit.overflow}px`);
      if (audit.unnamed) failures.push(`${engine.label}/${viewport.label}: ${audit.unnamed} unnamed controls`);
      if (!audit.robots.includes("noindex")) failures.push(`${engine.label}/${viewport.label}: noindex missing`);
      for (const marker of ["SYNTHETIC · NON-EVIDENCE", "JOURNEY PROGRESS", "External effects", "0"])
        if (!audit.body.includes(marker)) failures.push(`${engine.label}/${viewport.label}: marker missing ${marker}`);

      const stages = page.locator('nav[aria-label="Full-system demonstration stages"] button');
      if (await stages.count() !== 10) failures.push(`${engine.label}/${viewport.label}: expected 10 stages`);
      const personas = page.locator('[role="tablist"][aria-label="Institutional persona"] button');
      if (await personas.count() !== 5) failures.push(`${engine.label}/${viewport.label}: expected 5 personas`);

      await stages.nth(5).click();
      await page.getByRole("tab", { name: /Trustee/ }).click();
      await page.getByText("Your signed decision remains final for Rail workflow control", { exact: false }).waitFor();
      await page.getByText("Trustee control decision", { exact: true }).waitFor();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download synthetic dossier" }).click();
      const download = await downloadPromise;
      if (!download.suggestedFilename().endsWith("-trustee.json")) failures.push(`${engine.label}/${viewport.label}: unexpected dossier filename`);

      await page.getByRole("tab", { name: "DA / PTC control lab" }).click();
      await page.getByRole("tab", { name: "PTC issuance" }).click();
      await page.getByText("Conventional PTC issuance replay", { exact: true }).waitFor();
      await page.getByRole("button", { name: /Run next comparison/ }).click();
      await page.getByText("Partially verified; one source qualification open", { exact: true }).waitFor();
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

if (failures.length) {
  console.error("AR-DEMO-01 browser gate FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("AR-DEMO-01 browser gate PASS — Basic denial, 2 engines, 2 viewports, 10 stages, 5 personas, download and route-lab interactions; no external requests.");
