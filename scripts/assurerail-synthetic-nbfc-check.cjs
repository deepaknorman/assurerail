#!/usr/bin/env node
// Check input artifacts against the built application, without providers, credentials or DB writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const { extractDocument } = require(path.join(root, 'apps/assurerail-api/dist/customer-operations/document-analysis.js'));
const { loanTapeMetrics } = require(path.join(root, 'apps/assurerail-api/dist/customer-operations/loan-tape-metrics.js'));
const { documentInventory } = require(path.join(root, 'apps/assurerail-api/dist/customer-operations/document-review.js'));

async function main() {
  const directory = path.resolve(process.argv[2] || path.join(root, 'demo/assurerail/synthetic-nbfc-step1'));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'input-manifest.json'), 'utf8'));
  assert.equal(manifest.classification, 'SYNTHETIC_ONLY');
  const keys = manifest.books.map(book => JSON.stringify(book.key));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(new Set(manifest.books.map(book => book.bookRef)).size < keys.length, 'fixture must exercise same bookRef at different sellers');
  const checks = [];
  for (const book of manifest.books) {
    assert.deepEqual(book.key, [book.sellerInstitutionId, book.bookRef]);
    for (const [fileKey, expectedKey] of [['initialFile', 'initialExpectedStatus'], ['referenceFile', 'referenceExpectedStatus']]) {
      const filename = book[fileKey];
      const bytes = fs.readFileSync(path.join(directory, filename));
      const extracted = await extractDocument(bytes, 'text/csv');
      assert.deepEqual(extracted.exceptions, []);
      const metrics = loanTapeMetrics([{ contentType: 'text/csv', segments: extracted.segments }], book.primaryPairCount, book.linkedPartyCount);
      assert.equal(metrics.status, book[expectedKey], filename);
      assert.equal(metrics.parsedUniqueLoanCountActual, book.loanCount, filename);
      assert.equal(metrics.parsedPrincipalMinor, book.principalMinor, filename);
      if (fileKey === 'initialFile') {
        assert.deepEqual(metrics.recordIssues.map(issue => ({ csvRow: issue.rowNumber, code: issue.code, loanId: issue.loanId })).sort((a, b) => a.csvRow - b.csvRow),
          book.deliberateDefects.map(({ csvRow, code, loanId }) => ({ csvRow, code, loanId })).sort((a, b) => a.csvRow - b.csvRow));
      } else {
        assert.equal(metrics.parsedPrimaryPairCount, book.primaryPairCount);
        assert.equal(metrics.parsedLinkedPartyCount, book.linkedPartyCount);
        assert.equal(metrics.invalidRecords + metrics.duplicateRecords, 0);
      }
      checks.push({ file: filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), ...metrics });
    }
    const inventory = documentInventory(book.assetFamily, ['LOAN_TAPE']);
    assert.equal(inventory.status, 'EXCEPTIONS');
    assert.deepEqual(inventory.missing, manifest.missingEvidenceFamilies);
  }
  const workbookName = 'AssureRail_Synthetic_NBFC_Step1.xlsx';
  const workbookBytes = fs.readFileSync(path.join(directory, workbookName));
  const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const workbook = await extractDocument(workbookBytes, contentType);
  assert.deepEqual(workbook.exceptions, [], 'workbook must contain literal values, no formulas');
  assert.equal(loanTapeMetrics([{ contentType, segments: workbook.segments }], 0).status, 'TAPE_MAPPING_REQUIRED');
  const evidence = { schemaVersion: 1, status: 'PASS', codeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), generatedAt: new Date().toISOString(), classification: 'SYNTHETIC_ONLY', hostedAssessmentRun: false, checks, workbook: { file: workbookName, extractedSegments: workbook.segments.length, automaticTapeMapping: 'TAPE_MAPPING_REQUIRED', sha256: crypto.createHash('sha256').update(workbookBytes).digest('hex') }, documentInventory: documentInventory('VEHICLE_EV', ['LOAN_TAPE']) };
  fs.writeFileSync(path.join(directory, 'validation-results.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, csvFiles: checks.length, books: manifest.books.length, loans: manifest.books.reduce((sum, book) => sum + book.loanCount, 0), workbook: 'EXTRACTED_WITHOUT_EXCEPTIONS', supportingEvidence: 'MISSING_AS_EXPECTED', hostedAssessmentRun: false }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
