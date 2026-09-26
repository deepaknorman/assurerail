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
  const sellerTotals = new Map();
  for (const book of manifest.books) {
    assert.deepEqual(book.key, [book.sellerInstitutionId, book.bookRef]);
    for (const [fileKey, expectedKey] of [['initialFile', 'initialExpectedStatus'], ['referenceFile', 'referenceExpectedStatus']]) {
      const filename = book[fileKey];
      const bytes = fs.readFileSync(path.join(directory, filename));
      const extractionStart = performance.now();
      const extracted = await extractDocument(bytes, 'text/csv');
      const extractionMs = Number((performance.now() - extractionStart).toFixed(2));
      assert.deepEqual(extracted.exceptions, []);
      const metricsStart = performance.now();
      const metrics = loanTapeMetrics([{ contentType: 'text/csv', segments: extracted.segments }], book.primaryPairCount, book.linkedPartyCount);
      const metricsMs = Number((performance.now() - metricsStart).toFixed(2));
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
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      // An empty version ID is a lower bound, not a made-up live reference. A bound over
      // the worker's cap proves even the shortest possible annotated payload cannot fit.
      const annotatedSourceCharactersLowerBound = JSON.stringify(extracted.segments.map(segment => ({ ...segment, evidenceVersionId: '', digest: `sha256:${digest}`, evidenceType: 'LOAN_TAPE' }))).length;
      const { loanRecords, ...summary } = metrics;
      checks.push({ file: filename, sha256: digest, fileBytes: bytes.length, extractionMs, metricsMs, extractedSegments: extracted.segments.length, extractionCompletedWithinWorkerLimits: true, ...summary,
        ...(manifest.profile === '55cr' ? { loanRecordsDigest: crypto.createHash('sha256').update(JSON.stringify(loanRecords)).digest('hex') } : { loanRecords }),
        analysisBudget: { characterLimit: 120000, annotatedSourceCharactersLowerBound, guaranteedSkipForFullTape: annotatedSourceCharactersLowerBound > 120000 } });
      assert.ok(bytes.length < 20 * 1024 * 1024, 'each file must fit the actual document size limit');
      if (fileKey === 'referenceFile') sellerTotals.set(book.sellerInstitutionId, (sellerTotals.get(book.sellerInstitutionId) || 0n) + BigInt(metrics.parsedPrincipalMinor));
    }
    const inventory = documentInventory(book.assetFamily, ['LOAN_TAPE']);
    assert.equal(inventory.status, 'EXCEPTIONS');
    assert.deepEqual(inventory.missing, manifest.missingEvidenceFamilies);
  }
  if (manifest.profile === '55cr') {
    assert.deepEqual(Object.fromEntries([...sellerTotals].map(([key, value]) => [key, value.toString()])), {
      'demo-nbfc-ev-001': '35000000000', 'demo-nbfc-ev-002': '20000000000',
    });
    assert.equal([...sellerTotals.values()].reduce((sum, value) => sum + value, 0n), 55000000000n);
    assert.equal(manifest.books.reduce((sum, book) => sum + book.loanCount, 0), 3000);
    for (const book of manifest.books) assert.equal(book.aggregateProgrammeConsiderationMinor, '55000000000');
  }
  const workbookName = manifest.workbookFile || 'AssureRail_Synthetic_NBFC_Step1.xlsx';
  const workbookBytes = fs.readFileSync(path.join(directory, workbookName));
  const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const workbookStart = performance.now();
  const workbook = await extractDocument(workbookBytes, contentType);
  const workbookExtractionMs = Number((performance.now() - workbookStart).toFixed(2));
  assert.deepEqual(workbook.exceptions, [], 'workbook must contain literal values, no formulas');
  assert.equal(loanTapeMetrics([{ contentType, segments: workbook.segments }], 0).status, 'TAPE_MAPPING_REQUIRED');
  const evidence = { schemaVersion: 1, status: 'PASS', codeCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), generatedAt: new Date().toISOString(), classification: 'SYNTHETIC_ONLY', hostedAssessmentRun: false, sellerPrincipalMinor: Object.fromEntries([...sellerTotals].map(([key, value]) => [key, value.toString()])), checks, workbook: { file: workbookName, fileBytes: workbookBytes.length, extractionMs: workbookExtractionMs, extractedSegments: workbook.segments.length, automaticTapeMapping: 'TAPE_MAPPING_REQUIRED', sha256: crypto.createHash('sha256').update(workbookBytes).digest('hex') }, documentInventory: documentInventory('VEHICLE_EV', ['LOAN_TAPE']) };
  fs.writeFileSync(path.join(directory, 'validation-results.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ status: evidence.status, csvFiles: checks.length, books: manifest.books.length, loans: manifest.books.reduce((sum, book) => sum + book.loanCount, 0), workbook: 'EXTRACTED_WITHOUT_EXCEPTIONS', supportingEvidence: 'MISSING_AS_EXPECTED', hostedAssessmentRun: false }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
