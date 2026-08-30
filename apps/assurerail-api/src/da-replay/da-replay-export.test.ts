import assert from "node:assert/strict";
import test from "node:test";
import { daReplayCsvCell } from "./da-replay-export";

test("[PR09][EXPORT] comparison CSV neutralises spreadsheet formulas", () => {
  for (const value of [
    "=1+1",
    "+cmd",
    "-2+3",
    "@SUM(A1:A2)",
    "\tformula",
    "\rformula",
  ]) {
    assert.equal(daReplayCsvCell(value).replace(/^"/, "").startsWith("'"), true);
  }
});

test("[PR09][EXPORT] comparison CSV quotes delimiters and embedded quotes", () => {
  assert.equal(daReplayCsvCell('reference,"quoted"'), '"reference,""quoted"""');
  assert.equal(daReplayCsvCell("plain-reference"), "plain-reference");
});
