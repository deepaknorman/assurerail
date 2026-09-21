#!/usr/bin/env node

import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const demoDir = path.resolve(sourceDir, "..");
const rawDir = path.join(demoDir, ".mini-demo-recording");
const output = path.join(demoDir, "AssureRail_Prospect_Mini_Demo_1080p.mp4");
const durations = [8_000, 9_000, 10_000, 10_000, 9_000, 9_000];

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

await rm(rawDir, { recursive: true, force: true });
await mkdir(rawDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
await page.goto(pathToFileURL(path.join(sourceDir, "index.html")).href, { waitUntil: "load" });
for (let index = 0; index < durations.length; index += 1) {
  await page.evaluate((scene) => window.showScene(scene), index);
  await page.waitForTimeout(durations[index]);
}
await page.close();
await context.close();
await browser.close();

const rawFiles = (await readdir(rawDir)).filter((name) => name.endsWith(".webm"));
if (rawFiles.length !== 1) throw new Error(`Expected one Playwright recording, found ${rawFiles.length}`);
const rawVideo = path.join(rawDir, rawFiles[0]);
const staged = path.join(rawDir, "AssureRail_Prospect_Mini_Demo_1080p.webm");
await rename(rawVideo, staged);
await run("ffmpeg", [
  "-y", "-i", staged,
  "-vf", "scale=1920:1080:flags=lanczos,fps=30",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", output,
]);
await rm(rawDir, { recursive: true, force: true });
console.log(`Recorded ${output}`);
