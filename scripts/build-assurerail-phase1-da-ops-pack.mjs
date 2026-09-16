#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "docs/operations/phase1-da/artifact-manifest.json");
const checkOnly = process.argv.includes("--check");
let activeSourceDir = repoRoot;
let activeOutputDir = repoRoot;

const escapeHtml = (value) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function inlineMarkdown(value) {
  const code = [];
  let rendered = value.replace(/`([^`]+)`/g, (_, item) => {
    const marker = `@@CODE${code.length}@@`;
    code.push(`<code>${escapeHtml(item)}</code>`);
    return marker;
  });
  rendered = escapeHtml(rendered);
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    let safeHref = href;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^(https?:|mailto:)/i.test(href)) safeHref = "#";
    else if (!/^(https?:|mailto:|#)/.test(href)) {
      const [filePart, fragment] = href.split("#", 2);
      const absolute = path.resolve(activeSourceDir, filePart);
      safeHref = path.relative(activeOutputDir, absolute).split(path.sep).join("/") || ".";
      if (fragment) safeHref += `#${fragment}`;
    }
    return `<a href="${escapeHtml(safeHref)}">${label}</a>`;
  });
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  code.forEach((item, index) => {
    rendered = rendered.replace(`@@CODE${index}@@`, item);
  });
  return rendered;
}

function tableCells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
}

function markdownToHtml(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const out = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) out.push(`</${listType}>`);
    listType = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushParagraph(); closeList();
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (!line.trim()) { flushParagraph(); closeList(); continue; }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) { flushParagraph(); closeList(); out.push("<hr>"); continue; }

    if (line.trim().startsWith("|") && lines[i + 1] && isTableSeparator(lines[i + 1])) {
      flushParagraph(); closeList();
      const headers = tableCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(tableCells(lines[i]));
        i += 1;
      }
      i -= 1;
      out.push("<div class=\"table-wrap\"><table><thead><tr>" + headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("") + "</tr></thead><tbody>");
      rows.forEach((row) => out.push("<tr>" + row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("") + "</tr>"));
      out.push("</tbody></table></div>");
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const desired = unordered ? "ul" : "ol";
      if (listType !== desired) { closeList(); listType = desired; out.push(`<${desired}>`); }
      out.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }
    if (line.startsWith("> ")) {
      flushParagraph(); closeList(); out.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`); continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph(); closeList();
  if (inCode) throw new Error("Unclosed code fence");
  return out.join("\n");
}

function documentHtml(title, classification, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="${classification === "PUBLIC" ? "index,follow" : "noindex,nofollow"}">
  <title>${escapeHtml(title)} | AssureRail</title>
  <style>
    :root{--ink:#122431;--body:#405260;--muted:#6a7882;--line:#d8e2e7;--panel:#f7fafb;--brand:#0b6477;--accent:#c6812a}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--body);font:16px/1.58 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}header{border-bottom:1px solid var(--line);background:linear-gradient(135deg,#f8fbfc,#eef6f7);padding:34px max(24px,calc((100vw - 1080px)/2)) 28px}.brand{color:var(--brand);font-weight:850;letter-spacing:.12em;text-transform:uppercase}.class{display:inline-block;margin-top:12px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;color:var(--muted);font-size:12px;font-weight:750}main{max-width:1080px;margin:auto;padding:34px 24px 72px}h1,h2,h3,h4{color:var(--ink);line-height:1.22}h1{font-size:clamp(30px,4vw,46px);margin:.4em 0}h2{margin-top:2.2em;padding-top:.45em;border-top:1px solid var(--line)}h3{margin-top:1.8em}p,li{max-width:88ch}.table-wrap{overflow-x:auto;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}th{background:var(--panel);color:var(--ink)}blockquote{margin:20px 0;padding:14px 18px;border-left:4px solid var(--accent);background:#fff8ef;color:var(--ink)}code{background:var(--panel);padding:2px 5px;border-radius:4px}pre{overflow:auto;background:#122431;color:#eef7f8;padding:16px;border-radius:8px}a{color:var(--brand)}footer{max-width:1080px;margin:auto;padding:18px 24px 40px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media print{header{background:#fff}a{color:inherit;text-decoration:none}.class{border:0;padding:0}}
  </style>
</head>
<body>
  <header><div class="brand">AssureRail</div><div class="class">${escapeHtml(classification)}</div></header>
  <main>${body}</main>
  <footer>Generated from the controlled Markdown source. Verify the version and distribution classification before use.</footer>
</body>
</html>
`;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generated = manifest.artifacts.filter((item) => item.output);
let differences = 0;

for (const item of generated) {
  const sourcePath = path.resolve(repoRoot, item.source);
  const outputPath = path.resolve(repoRoot, item.output);
  if (!sourcePath.startsWith(repoRoot + path.sep) || !outputPath.startsWith(repoRoot + path.sep)) {
    throw new Error(`Manifest path escapes repository: ${item.id}`);
  }
  const source = await readFile(sourcePath, "utf8");
  activeSourceDir = path.dirname(sourcePath);
  activeOutputDir = path.dirname(outputPath);
  const html = documentHtml(item.title, item.classification, markdownToHtml(source));
  if (checkOnly) {
    let current = "";
    try { current = await readFile(outputPath, "utf8"); } catch { /* reported as different */ }
    if (current !== html) { differences += 1; console.error(`outdated: ${item.output}`); }
  } else {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html, "utf8");
    console.log(`generated: ${item.output}`);
  }
}

if (differences) process.exitCode = 1;
