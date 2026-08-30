import { BadRequestException } from "@nestjs/common";

const CONTENT_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function startsWith(bytes: Buffer, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function looksText(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  const sample = bytes.toString("utf8");
  const replacementCount = [...sample].filter((char) => char === "�").length;
  return replacementCount <= Math.max(1, Math.floor(sample.length * 0.01));
}

export function safeFilename(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException("filename is required");
  const name = value.trim().replace(/[\\/\u0000-\u001f\u007f]/g, "_").slice(0, 240);
  if (!name || name === "." || name === "..") throw new BadRequestException("filename is invalid");
  return name;
}

/** Small, deterministic magic-byte policy. OOXML is accepted only as a ZIP container with a matching extension. */
export function detectContentType(bytes: Buffer, filename: string, claimed: string): string {
  if (!CONTENT_TYPES.has(claimed)) throw new BadRequestException(`content-type is not permitted: ${claimed}`);
  if (startsWith(bytes, [0x4d, 0x5a]) || startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46])) {
    throw new BadRequestException("executable content is forbidden");
  }
  let detected: string | null = null;
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") detected = "application/pdf";
  else if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) detected = "image/png";
  else if (startsWith(bytes, [0xff, 0xd8, 0xff])) detected = "image/jpeg";
  else if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (filename.toLowerCase().endsWith(".docx")) detected = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (filename.toLowerCase().endsWith(".xlsx")) detected = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else throw new BadRequestException("ZIP containers require an approved DOCX or XLSX filename");
  } else if (looksText(bytes)) {
    const text = bytes.toString("utf8").trim();
    detected = claimed === "text/csv" ? "text/csv" : "text/plain";
  }
  if (!detected) throw new BadRequestException("content type could not be safely identified");
  if (detected !== claimed) throw new BadRequestException(`claimed content-type ${claimed} does not match detected ${detected}`);
  return detected;
}

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
