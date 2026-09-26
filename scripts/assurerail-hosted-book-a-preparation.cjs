#!/usr/bin/env node
/* Guarded hosted continuation for synthetic Book A Portfolio Preparation.
 * Generates the bounded 10-loan/50-document corpus, pays the accepted stage by
 * synthetic NEFT, runs the real extraction/model/reconciliation worker, records
 * an audited reviewer read and releases the exact result under a labelled demo
 * qualification. Credentials and document contents never enter stdout.
 */
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const { mkdtempSync, readFileSync, rmSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash, createHmac } = require('node:crypto');
const assert = require('node:assert/strict');
const { firefox } = require(process.cwd() + '/node_modules/playwright');

const baseURL = 'https://arail.assurelocker.com';
const engagementId = 'eng_b8544dc2-ad64-44d7-8f1c-597a004eea07';
let stage = 'preflight';
function report(fields) { console.log(JSON.stringify({ stage, ...fields })); }
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function counter() { return Math.floor(Date.now() / 30000); }
function totp(seed) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  assert.match(seed, /^[A-Z2-7]+=*$/);
  const bits = [...seed.replace(/=+$/, '')].map(character => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(value => parseInt(value, 2)));
  const value = Buffer.alloc(8); value.writeBigUInt64BE(BigInt(counter()));
  const digest = createHmac('sha1', key).update(value).digest();
  return String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}

(async () => {
  assert.equal(process.env.ASSURERAIL_HOSTED_PREPARATION_WRITE, 'yes');
  assert.equal(process.cwd(), '/home/deploy/assurerail');
  const accountPath = '/home/deploy/arail-demo/founder-demo-accounts.json';
  assert.equal(statSync(accountPath).mode & 0o077, 0);
  const profile = JSON.parse(readFileSync(accountPath, 'utf8'));
  assert.equal(profile.institutionId, 'demo-nbfc-ev-001');
  assert(profile.journeyAccounts?.preparationReviewer);
  const institutionId = profile.institutionId;
  const participantBase = `/v1/rail/institutions/${institutionId}`;
  const runsPath = `${participantBase}/engagements/${engagementId}/runs`;
  const extractorPython = process.env.ASSURERAIL_EXTRACTOR_PYTHON ?? '/usr/bin/python3';
  assert.equal(extractorPython.startsWith('/'), true);
  const extractorReady = spawnSync(extractorPython, ['-I', '-c', 'import pypdf'], {
    encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' },
  });
  assert.equal(extractorReady.status, 0, 'pinned PDF extractor dependency is unavailable');
  const scratch = mkdtempSync(join(tmpdir(), 'assurerail-preparation.'));
  const corpusPath = join(scratch, 'corpus');
  const generated = spawnSync('/usr/bin/python3', [
    'scripts/assurerail-synthetic-preparation-inputs.py',
    '--tape', 'demo/assurerail/synthetic-nbfc-55cr/reference-for-step2/book-a-corrected.csv',
    '--loan-master', 'demo/assurerail/synthetic-nbfc-55cr/reference-loan-master.csv',
    '--output-dir', corpusPath,
  ], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000, env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' } });
  assert.equal(generated.status, 0, 'bounded corpus generation failed');
  const manifest = JSON.parse(readFileSync(join(corpusPath, 'manifest.json'), 'utf8'));
  assert.equal(manifest.syntheticOnly, true); assert.equal(manifest.documentCount, 50); assert.equal(manifest.loanCount, 10);
  assert.equal(manifest.deliberateDefects.length, 1); assert.equal(manifest.deliberateDefects[0].differenceMinor, '10000');
  assert.equal(manifest.selection.selectedLoans.length, 10);
  assert.deepEqual([...new Set(manifest.selection.selectedLoans.map(loan => loan.state))].sort(), ['Karnataka', 'Maharashtra', 'Tamil Nadu']);
  assert.deepEqual([...new Set(manifest.selection.selectedLoans.map(loan => loan.repaymentState))].sort(), ['ARREARS', 'ON_TIME']);

  const browser = await firefox.launch();
  try {
    async function login(role, participant) {
      stage = `login_${role}`;
      const account = profile.accounts[role] ?? profile.journeyAccounts[role];
      assert(account); assert.match(account.email, /^rail-demo-[a-z-]+@example\.test$/);
      const context = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      let authorization, apiOrigin;
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname === '/venue/auth/session' && url.protocol === 'https:' && url.hostname === 'api.assurerail.com') {
          authorization = request.headers().authorization; apiOrigin = url.origin;
        }
      });
      assert.equal((await page.goto('/login', { waitUntil: 'load', timeout: 45000 })).status(), 200);
      await page.evaluate(({ participant, institutionId }) => participant
        ? localStorage.setItem('arail-active-institution', institutionId)
        : localStorage.removeItem('arail-active-institution'), { participant, institutionId });
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL('**/console', { timeout: 30000 });
      await page.locator('.who').waitFor();
      assert.equal((await page.locator('.who').textContent()).trim(), account.email);
      assert(authorization && apiOrigin);
      async function api(path, data) {
        const response = await page.evaluate(async ({ url, authorization, institution, data }) => {
          const result = await fetch(url, { method: data === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
            headers: { authorization, 'Content-Type': 'application/json', ...(institution ? { 'x-assurerail-institution-id': institution } : {}) },
            ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
          return { ok: result.ok, status: result.status, body: await result.json().catch(() => ({})) };
        }, { url: apiOrigin + path, authorization, institution: participant ? institutionId : null, data });
        if (!response.ok) { report({ result: 'HTTP_ERROR', http: response.status, reason: 'API_REJECTED' }); throw new Error('API_REJECTED'); }
        return response.body;
      }
      async function apiRaw(path, bytes, metadata) {
        const response = await page.evaluate(async ({ url, authorization, institution, encoded, bytesBase64 }) => {
          const raw = atob(bytesBase64); const body = Uint8Array.from(raw, character => character.charCodeAt(0));
          const result = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
            headers: { authorization, 'Content-Type': 'application/octet-stream', 'x-assurerail-document-metadata': encoded,
              ...(institution ? { 'x-assurerail-institution-id': institution } : {}) }, body });
          return { ok: result.ok, status: result.status, body: await result.json().catch(() => ({})) };
        }, { url: apiOrigin + path, authorization, institution: participant ? institutionId : null,
          encoded: Buffer.from(JSON.stringify(metadata)).toString('base64url'), bytesBase64: bytes.toString('base64') });
        if (!response.ok) { report({ result: 'HTTP_ERROR', http: response.status, reason: 'RAW_API_REJECTED' }); throw new Error('API_REJECTED'); }
        return response.body;
      }
      const usedCounters = new Map();
      async function proof(purpose) {
        while (usedCounters.get(purpose) === counter()) await wait(1000);
        const used = counter();
        const result = await api('/venue/auth/mfa/verify/totp', { code: totp(account.totpSecret), purpose, institutionId: participant ? institutionId : null });
        assert(result.stepUp?.id); usedCounters.set(purpose, used); return result.stepUp.id;
      }
      report({ result: 'PASS' }); return { page, api, apiRaw, proof };
    }

    const preparer = await login('sellerDataPreparer', true);
    stage = 'locate_accepted_preparation';
    let engagement = (await preparer.api(`${participantBase}/engagements`)).find(item => item.id === engagementId);
    assert(engagement); assert.equal(engagement.scope.bookRef, 'SYN-EV-2W-2025'); assert.equal(engagement.route, 'COMMITTED');
    assert.match(engagement.preparationRemediationScopeDigest, /^sha256:[0-9a-f]{64}$/);
    let invoice = engagement.stages.find(item => item.stage === 'PREPARATION')?.invoice;
    report({ result: 'PASS', engagementId, route: engagement.route, disclosureBound: true });

    if (!invoice) {
      const maker = await login('invoicePreparer', false);
      stage = 'preparation_invoice_prepare';
      invoice = await maker.api(`/v1/rail/internal/engagements/institutions/${institutionId}/${engagementId}/stages/PREPARATION/invoice`, {
        stepUpEvidenceId: await maker.proof('INTERNAL_INVOICE_PREPARE'),
      });
      assert.equal(invoice.status, 'DRAFT'); report({ result: 'PASS', invoiceId: invoice.id, netFeeMinor: invoice.netFeeMinor });
    }
    if (invoice.status === 'DRAFT') {
      const checker = await login('invoiceChecker', false);
      stage = 'preparation_invoice_issue';
      invoice = await checker.api(`/v1/rail/internal/customer-operations/institutions/${institutionId}/invoice-statements/${invoice.id}/issue`, {
        reason: 'Synthetic Book A Preparation: independent check of the accepted route, bound remediation scope and exact stage amount.',
        stepUpEvidenceId: await checker.proof('INTERNAL_INVOICE_REVIEW'),
      });
      assert.equal(invoice.status, 'ISSUED_SHADOW'); assert.notEqual(invoice.preparedByUserId, invoice.issuedByUserId);
      report({ result: 'PASS', invoiceId: invoice.id, independentReviewer: true });
    }
    assert.equal(invoice.status, 'ISSUED_SHADOW');

    const seller = await login('sellerCommercialAdmin', true);
    let readiness = await seller.api(`${participantBase}/engagements/${engagementId}/stages/PREPARATION/readiness`);
    if (!readiness.readyForShadowProcessing) {
      stage = 'select_preparation_neft';
      const selection = await seller.api(`${participantBase}/engagements/${engagementId}/stages/PREPARATION/bank-transfer`, {});
      assert(selection.transferRails.includes('NEFT')); assert(selection.transferRails.includes('IMPS')); assert.equal(selection.amountMinor, invoice.netFeeMinor);
      const advice = Buffer.from(['synthetic_marker,transfer_rail,bank_transfer_ref,amount_minor,currency,invoice_id',
        `ASSURERAIL_FOUNDER_DEMO_V1,NEFT,SYNNEFT202609270002,${invoice.netFeeMinor},INR,${invoice.id}`].join('\n') + '\n');
      const adviceDigest = `sha256:${createHash('sha256').update(advice).digest('hex')}`;
      const evidence = await preparer.apiRaw(`${participantBase}/evidence/documents`, advice, {
        idempotencyKey: 'synthetic-neft-book-a-preparation-20260927-v1', connectorRegistrationId: `demo-connector-assessment-upload-${institutionId}`,
        evidenceType: 'BANK_RECEIPT', classification: 'INSTITUTION_CONFIDENTIAL', purpose: 'CUSTOMER_BILLING',
        retentionUntilAt: '2027-09-27T00:00:00.000Z', title: 'Synthetic NEFT bank advice — Book A Preparation',
        documentType: 'BANK_TRANSACTION_ADVICE', filename: 'synthetic-neft-book-a-preparation.csv', contentType: 'text/csv',
        schemaId: 'assurerail.neutral-intake', schemaVersion: '1.0.0', sourceAsOfAt: '2026-09-27T00:00:00.000Z',
        signatureStatus: 'NOT_PROVIDED', result: 'REVIEW_REQUIRED', profileRef: 'assurerail.neutral-intake.v1',
        qualifications: [{ code: 'SYNTHETIC_DEMO_PAYMENT_EVIDENCE', severity: 'LIMITATION' }],
      });
      assert.equal(evidence.validationStatus, 'VALID');
      const refs = (process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS || '').split(',').map(value => value.trim()).filter(Boolean);
      assert.equal(refs.length, 1);
      const maker = await login('invoicePreparer', false);
      stage = 'preparation_receipt_propose';
      const receipt = await maker.api(`/v1/rail/internal/engagement-billing/institutions/${institutionId}/invoices/${invoice.id}/receipts`, {
        collectionAccountRef: refs[0], transferRail: 'NEFT', syntheticOnly: true, bankTransferRef: 'SYNNEFT202609270002',
        amountMinor: invoice.netFeeMinor, evidenceRef: evidence.evidenceObjectId, evidenceDigest: adviceDigest,
        receivedAt: '2026-09-26T00:00:00.000Z', stepUpEvidenceId: await maker.proof('INTERNAL_PAYMENT_RECEIPT_PROPOSE'),
      });
      const checker = await login('invoiceChecker', false);
      stage = 'preparation_receipt_review';
      const reviewed = await checker.api(`/v1/rail/internal/engagement-billing/institutions/${institutionId}/receipts/${receipt.id}/review`, {
        decision: 'APPROVE', reason: 'Synthetic NEFT advice matches the issued Preparation invoice, configured account and exact paise amount.',
        stepUpEvidenceId: await checker.proof('INTERNAL_PAYMENT_RECEIPT_REVIEW'),
      });
      assert.equal(reviewed.status, 'VERIFIED_SHADOW');
      readiness = await seller.api(`${participantBase}/engagements/${engagementId}/stages/PREPARATION/readiness`);
    }
    assert.equal(readiness.readyForShadowProcessing, true); assert.equal(readiness.liveStageUnlock, false);
    report({ result: 'PASS', invoiceId: invoice.id, transferRail: 'NEFT', paidShadowOnly: true, livePaymentClaimed: false });

    stage = 'upload_bounded_preparation_corpus';
    const uploadedVersionIds = [];
    for (const [index, document] of manifest.documents.entries()) {
      const bytes = readFileSync(join(corpusPath, document.filename));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), document.sha256);
      assert(bytes.includes(Buffer.from('ASSURERAIL_SYNTHETIC_DEMO_INPUT')));
      const uploaded = await preparer.apiRaw(`${runsPath}/upload/PREPARATION`, bytes, {
        filename: document.filename, contentType: document.contentType, documentType: document.documentType,
        requestRef: `synthetic-book-a-preparation-${document.sha256.slice(0, 24)}-v1`,
      });
      assert.equal(uploaded.validationStatus, 'VALID'); assert.equal(uploaded.malwareStatus, 'CLEAN');
      uploadedVersionIds.push(uploaded.evidenceVersionId);
      if ((index + 1) % 10 === 0) report({ result: 'PASS', uploaded: index + 1, total: manifest.documentCount });
    }
    assert.equal(new Set(uploadedVersionIds).size, 50);
    const evidenceRows = await preparer.api(`${participantBase}/evidence`);
    const uploadedRows = evidenceRows.flatMap(item => item.versions.map(version => ({ item, version }))).filter(row => uploadedVersionIds.includes(row.version.id));
    assert.equal(uploadedRows.length, 50);
    assert(uploadedRows.every(row => row.version.qualifications?.some(item => item.code === 'SYNTHETIC_DEMO_ASSESSMENT_INPUT' && item.severity === 'LIMITATION')));
    report({ result: 'PASS', uploaded: 50, syntheticQualificationsPersisted: 50, manifestDigestsVerified: 50 });

    const initial = (await preparer.api(runsPath)).find(run => run.stage === 'INITIAL' && run.status === 'AUTO_RELEASED');
    assert(initial); const tape = initial.result.manifest.find(item => item.evidenceType === 'LOAN_TAPE'); assert(tape?.versionId);
    stage = 'request_preparation_processing';
    const requested = await preparer.api(runsPath, {
      stage: 'PREPARATION', requestRef: 'synthetic-book-a-preparation-run-20260927-v2',
      evidenceVersionIds: [tape.versionId, ...uploadedVersionIds],
      stepUpEvidenceId: await preparer.proof('ENGAGEMENT_PROCESSING_REQUEST'),
    });
    let pending;
    for (let attempt = 0; attempt < 72; attempt += 1) {
      pending = (await preparer.api(runsPath)).find(run => run.id === requested.id);
      if (pending && ['REVIEW_REQUIRED', 'RELEASED', 'FAILED'].includes(pending.status)) break;
      await wait(5000);
    }
    assert.notEqual(pending?.status, 'FAILED'); assert(['REVIEW_REQUIRED', 'RELEASED'].includes(pending?.status));

    const reviewer = await login('preparationReviewer', false);
    stage = 'audited_preparation_report_read';
    let restricted = await reviewer.api(`/v1/rail/internal/engagements/institutions/${institutionId}/${engagementId}/runs/${requested.id}`);
    assert(['REVIEW_REQUIRED', 'RELEASED'].includes(restricted.status));
    assert.equal(restricted.result.dataQuality.status, 'MATCHED');
    assert.equal(restricted.result.documentReview.inventory.status, 'COMPLETE');
    assert.equal(restricted.result.documentReview.loanReconciliation.tapeLoanCount, 1200);
    assert.equal(restricted.result.documentReview.loanReconciliation.documentedLoanCount, 10);
    assert.equal(restricted.result.documentReview.loanReconciliation.principalReconciledLoanCount, 9);
    const mismatches = restricted.result.documentReview.loanReconciliation.loans.filter(loan => loan.validationResults.some(result => result.ruleId === 'LOAN-TAPE-PRINCIPAL-001' && result.result === 'fail'));
    assert.equal(mismatches.length, 1); assert.equal(mismatches[0].loanId, 'SYN-A-LN-0012');
    assert.equal(restricted.result.analysis.provider, 'openai');
    assert.equal(restricted.result.analysis.aiCoverage.documentsAdmitted, 50);
    assert.equal(restricted.result.analysis.aiCoverage.documentsReviewed, 50);
    assert.equal(restricted.result.extraction.exceptions.length, 0);
    report({ result: 'PASS', runId: requested.id, status: restricted.status, modelProvider: 'openai', aiDocuments: '50/50', loanCoverage: '10/1200', uncoveredLoans: 1190, principalReconciled: 9, plantedMismatches: 1 });

    if (restricted.status === 'REVIEW_REQUIRED') {
      stage = 'report_bound_review_evidence';
      const memo = Buffer.from(['synthetic_marker,run_id,result_digest,decision_scope',
        `ASSURERAIL_SYNTHETIC_DEMO_INPUT,${requested.id},${restricted.resultDigest},RELEASE_REPORT_NOT_CREDIT_APPROVAL`].join('\n') + '\n');
      const signoff = await preparer.apiRaw(`${participantBase}/evidence/documents`, memo, {
        idempotencyKey: `synthetic-preparation-review-${requested.id}-v1`, connectorRegistrationId: `demo-connector-assessment-upload-${institutionId}`,
        evidenceType: 'ASSESSMENT_REVIEW_SIGNOFF', classification: 'RESTRICTED', purpose: `ASSESSMENT_REVIEW:${requested.id}:${restricted.resultDigest}`,
        retentionUntilAt: '2027-09-27T00:00:00.000Z', title: 'Synthetic Preparation review decision packet',
        documentType: 'ASSESSMENT_REVIEW_SIGNOFF', filename: 'synthetic-preparation-review.csv', contentType: 'text/csv',
        schemaId: 'assurerail.neutral-intake', schemaVersion: '1.0.0', sourceAsOfAt: '2026-09-26T00:00:00.000Z',
        signatureStatus: 'NOT_PROVIDED', result: 'REVIEW_REQUIRED', profileRef: 'assurerail.neutral-intake.v1',
        qualifications: [{ code: 'SYNTHETIC_DEMO_REVIEW_EVIDENCE', severity: 'LIMITATION' }],
      });
      assert.equal(signoff.validationStatus, 'VALID');
      stage = 'qualified_preparation_release';
      const decision = await reviewer.api(`/v1/rail/internal/engagements/institutions/${institutionId}/${engagementId}/runs/${requested.id}/review`, {
        decision: 'RELEASE', resultDigest: restricted.resultDigest, reviewEvidenceRef: signoff.evidenceObjectId,
        stepUpEvidenceId: await reviewer.proof('ENGAGEMENT_REPORT_REVIEW'),
      });
      assert.equal(decision.status, 'RELEASED'); assert.equal(decision.liveDecisionAuthority, false);
      restricted = await reviewer.api(`/v1/rail/internal/engagements/institutions/${institutionId}/${engagementId}/runs/${requested.id}`);
    }
    assert.equal(restricted.status, 'RELEASED');
    const released = (await preparer.api(runsPath)).find(run => run.id === requested.id);
    assert.equal(released.status, 'RELEASED'); assert.equal(released.review.status, 'SYNTHETIC_DEMONSTRATION_ONLY');
    report({ result: 'PASS', runId: requested.id, resultDigest: released.resultDigest, reviewerIndependent: true, syntheticQualificationDisclosed: true, liveDecisionAuthority: false });

    stage = 'released_preparation_ui';
    await preparer.page.goto(`/workspace/assessment/${engagementId}`, { waitUntil: 'load' });
    await preparer.page.getByText(/Portfolio Preparation — RELEASED/).waitFor({ timeout: 30000 });
    await preparer.page.getByText(/Reviewed using a synthetic qualification — demonstration only; not professional sign-off/).waitFor();
    await preparer.page.getByText(/10 of 1,200 loans .*1,190 not covered/).waitFor();
    await preparer.page.getByText(/9 principal balances reconciled; 1 principal mismatch requires review/).waitFor();
    await preparer.page.getByText(/50 of 50 admitted documents reviewed/).waitFor();
    await preparer.page.getByText('SYNTHETIC DEMO INPUT', { exact: true }).first().waitFor();
    report({ result: 'PASS', releasedResultRendered: true, coveragePairRendered: true, mismatchRendered: true, syntheticInputLabelRendered: true });
  } finally {
    await browser.close(); rmSync(scratch, { recursive: true, force: true });
  }
})().catch(error => { report({ result: 'FAIL', errorType: error.name }); process.exitCode = 1; });
