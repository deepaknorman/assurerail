import assert from "node:assert/strict";
import test from "node:test";
import { detectContentType, safeFilename } from "./content-policy";

test("[PR05][FILE] executable and claimed-type confusion fail before storage", () => {
  assert.throws(() => detectContentType(Buffer.from([0x4d, 0x5a, 0, 0]), "claim.pdf", "application/pdf"), /executable/);
  assert.throws(() => detectContentType(Buffer.from("%PDF-1.7\n"), "claim.pdf", "text/plain"), /does not match/);
  assert.equal(detectContentType(Buffer.from("%PDF-1.7\n"), "claim.pdf", "application/pdf"), "application/pdf");
  assert.equal(safeFilename("../deal\\schedule.pdf"), ".._deal_schedule.pdf");
});

test("[PR05][FILE] OOXML requires an approved extension and a matching claim", () => {
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  assert.equal(detectContentType(zip, "schedule.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.throws(() => detectContentType(zip, "archive.zip", "application/pdf"), /approved DOCX or XLSX/);
});
