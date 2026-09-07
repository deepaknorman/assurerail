#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const source = await readFile(resolve(root, "apps/assurerail/brand/favicon.svg"), "utf8");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:64px;height:64px;background:transparent}svg{display:block;width:64px;height:64px}</style></head><body>${source}</body></html>`);
  await page.screenshot({
    path: resolve(root, "apps/assurerail/public/favicon.png"),
    omitBackground: true,
    animations: "disabled",
  });
} finally {
  await browser.close();
}

console.log("Generated apps/assurerail/public/favicon.png (64×64) from the approved vector source.");
