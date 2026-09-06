#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  cwd: root,
  encoding: "utf8",
});
const files = output.split("\0").filter(Boolean);
const checkedExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".css", ".yml", ".yaml", ".sh", ".prisma", ".toml"]);
const noTabsExtensions = new Set([".json", ".yml", ".yaml"]);
const failures = [];
let checked = 0;

for (const relative of files) {
  const extension = extname(relative);
  if (!checkedExtensions.has(extension) && relative !== ".editorconfig") continue;
  let fileText;
  try {
    fileText = readFileSync(resolve(root, relative), "utf8");
  } catch (error) {
    failures.push(`${relative}: cannot read as UTF-8 (${error.message})`);
    continue;
  }
  checked += 1;
  if (fileText.includes("\r")) failures.push(`${relative}: CR/CRLF line ending`);
  if (fileText && !fileText.endsWith("\n")) failures.push(`${relative}: missing final newline`);
  if (/[ \t]+$/m.test(fileText)) failures.push(`${relative}: trailing whitespace`);
  if (/^(?:<{7}|={7}|>{7})(?: |$)/m.test(fileText)) failures.push(`${relative}: merge-conflict marker`);
  if (noTabsExtensions.has(extension) && fileText.includes("\t")) failures.push(`${relative}: tab indentation is prohibited`);
  if (extension === ".json") {
    try { JSON.parse(fileText); } catch (error) { failures.push(`${relative}: invalid JSON (${error.message})`); }
  }
}

if (failures.length) {
  console.error(`AssureRail format/configuration gate FAILED (${failures.length} issue(s))`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`AssureRail format/configuration gate PASS — ${checked} tracked/unignored code and configuration files.`);
