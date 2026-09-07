#!/usr/bin/env node
import { chromium, request as playwrightRequest, webkit } from "playwright";

const base = new URL(process.env.ARAIL_PUBLIC_BASE_URL ?? "http://127.0.0.1:3007");
if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash) {
  throw new Error("ARAIL_PUBLIC_BASE_URL must be a bare HTTP(S) origin");
}

const paths = [
  "/",
  "/routes/direct-assignment",
  "/routes/ptc",
  "/for/originators",
  "/for/transferees-investors",
  "/for/trustees",
  "/replay",
  "/trust",
  "/status",
  "/resources",
  "/resources/completed-deal-replay-before-platform-replacement",
  "/resources/direct-assignment-and-ptc-need-different-control-maps",
  "/resources/authoritative-records-reconciliation-and-digital-representations",
  "/resources/signed-evidence-packages-still-require-institutional-review",
  "/resources/from-completed-deal-replay-to-a-controlled-shadow",
];
const viewports = [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "mobile", width: 375, height: 812 },
];
const engines = [
  { label: "Chromium", launcher: chromium, options: {} },
  { label: "Installed Chrome", launcher: chromium, options: { channel: "chrome" } },
  { label: "WebKit", launcher: webkit, options: {} },
];
const forbidden = [
  /\b(?:PR|AR|SEC|CX|SIM|PUB|INBOUND)-\d/,
  /\bVAPT\b/i,
  /\bAzure\b/i,
  /\bHyderabad\b/i,
  /\bPune\b/i,
  /\bKey Vault\b/i,
  /\bHMAC\b/i,
];
const disabledControlledPaths = [
  "/diligence",
  "/sandbox",
  "/activity",
  "/admin",
  "/cases",
  "/console",
  "/institutions",
  "/internal",
  "/onboard",
  "/settings",
  "/workspace",
  "/admin/access",
  "/internal/production-scale",
  "/workspace/start",
];

const failures = [];
const internalLinks = new Set(paths);

function fail(engine, viewport, path, message) {
  failures.push(`${engine}/${viewport} ${path}: ${message}`);
}

for (const engine of engines) {
  const browser = await engine.launcher.launch({ headless: true, ...engine.options });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      for (const path of paths) {
        const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
        if (!response || response.status() >= 400) {
          fail(engine.label, viewport.label, path, `HTTP ${response?.status() ?? "no response"}`);
          continue;
        }

        const audit = await page.evaluate(() => {
          const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "";
          const headings = [...document.querySelectorAll("h1")].map((node) => node.textContent?.trim() ?? "");
          const duplicateIds = [...document.querySelectorAll("[id]")]
            .map((node) => node.id)
            .filter((id, index, all) => id && all.indexOf(id) !== index);
          const unnamedActions = [...document.querySelectorAll("a,button")]
            .filter((node) => !(node.textContent?.trim() || node.getAttribute("aria-label") || node.getAttribute("title")))
            .length;
          const unlabelledControls = [...document.querySelectorAll("input,select,textarea")]
            .filter((node) => !(node.labels?.length || node.getAttribute("aria-label") || node.getAttribute("aria-labelledby")))
            .length;
          const imagesWithoutAlt = [...document.querySelectorAll("img")].filter((node) => !node.hasAttribute("alt")).length;
          const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent ?? "");
          const links = [...document.querySelectorAll("a[href]")].map((node) => node.getAttribute("href") ?? "");
          return {
            canonical,
            headings,
            duplicateIds,
            unnamedActions,
            unlabelledControls,
            imagesWithoutAlt,
            jsonLd,
            links,
            lang: document.documentElement.lang,
            title: document.title,
            body: document.body.innerText,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });

        if (!audit.title.trim()) fail(engine.label, viewport.label, path, "missing document title");
        if (audit.lang !== "en") fail(engine.label, viewport.label, path, `unexpected html lang ${JSON.stringify(audit.lang)}`);
        if (audit.headings.length !== 1 || !audit.headings[0]) fail(engine.label, viewport.label, path, "requires exactly one non-empty h1");
        if (audit.overflow > 1) fail(engine.label, viewport.label, path, `horizontal overflow ${audit.overflow}px`);
        if (audit.duplicateIds.length) fail(engine.label, viewport.label, path, `duplicate IDs ${[...new Set(audit.duplicateIds)].join(", ")}`);
        if (audit.unnamedActions) fail(engine.label, viewport.label, path, `${audit.unnamedActions} unnamed link/button controls`);
        if (audit.unlabelledControls) fail(engine.label, viewport.label, path, `${audit.unlabelledControls} unlabelled form controls`);
        if (audit.imagesWithoutAlt) fail(engine.label, viewport.label, path, `${audit.imagesWithoutAlt} images missing alt`);
        if (!audit.canonical || new URL(audit.canonical, base).pathname !== path) fail(engine.label, viewport.label, path, `canonical mismatch ${JSON.stringify(audit.canonical)}`);
        if (!audit.jsonLd.length) fail(engine.label, viewport.label, path, "missing JSON-LD");
        for (const [index, json] of audit.jsonLd.entries()) {
          try {
            const parsed = JSON.parse(json);
            if (parsed["@context"] !== "https://schema.org") throw new Error("missing schema.org context");
            const entries = parsed["@graph"] ?? [parsed];
            if (!Array.isArray(entries) || !entries.length || entries.some((entry) => !entry || typeof entry !== "object" || !entry["@type"])) {
              throw new Error("missing typed schema.org node");
            }
          } catch (error) {
            fail(engine.label, viewport.label, path, `invalid JSON-LD #${index + 1}: ${error.message}`);
          }
        }
        for (const pattern of forbidden) if (pattern.test(audit.body)) fail(engine.label, viewport.label, path, `protected/internal marker ${pattern}`);
        for (const href of audit.links) {
          if (!href || href.startsWith("#") || /^(?:mailto|tel):/i.test(href)) continue;
          const target = new URL(href, base);
          if (target.origin === base.origin) internalLinks.add(target.pathname);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

const request = await playwrightRequest.newContext({ baseURL: base.origin });
try {
  for (const path of [...internalLinks].sort()) {
    const response = await request.get(path, { maxRedirects: 5 });
    if (response.status() >= 400) failures.push(`link ${path}: HTTP ${response.status()}`);
  }
  for (const path of disabledControlledPaths) {
    const response = await request.get(path, { maxRedirects: 0 });
    if (response.status() !== 404) failures.push(`controlled route ${path}: expected 404 while disabled, received ${response.status()}`);
  }
  const inbound = await request.post("/api/inquiries", {
    data: {},
    headers: { Origin: base.origin },
  });
  if (inbound.status() !== 503) failures.push(`disabled inbound endpoint: expected 503, received ${inbound.status()}`);
} finally {
  await request.dispose();
}

if (failures.length) {
  console.error("AssureRail PUB-RELEASE-01 browser gate FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`AssureRail PUB-RELEASE-01 browser gate PASS — ${paths.length} pages, ${engines.length} engines, ${viewports.length} viewports, ${internalLinks.size} internal links.`);
console.log("This does not replace public/private artifact separation, founder visual/claims approval, actual Edge testing, Lighthouse scoring or post-deployment validation.");
