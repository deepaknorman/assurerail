#!/usr/bin/env node
/* Hosted synthetic acceptance, using real Firefox login, MFA and guarded APIs.
 * Run from the deployed repository as deploy, with ASSURERAIL_HOSTED_DEMO_WRITE=yes.
 * Credentials stay in memory; no screenshots, traces, videos or raw errors are emitted.
 * Payment uses synthetic NEFT advice through the real evidence/reconciliation controls.
 */
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const { readFileSync, statSync } = require('node:fs');
const { createHash, createHmac } = require('node:crypto');
const assert = require('node:assert/strict');
const { firefox } = require(process.cwd() + '/node_modules/playwright');
const baseURL = 'https://arail.assurelocker.com';
let stage = 'preflight';
function report(fields) { console.log(JSON.stringify({ stage, ...fields })); }
function totp(seed) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  assert.match(seed, /^[A-Z2-7]+=*$/);
  const bits = [...seed.replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  return String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
(async () => {
  assert.equal(process.env.ASSURERAIL_HOSTED_DEMO_WRITE, 'yes');
  assert.equal(process.cwd(), '/home/deploy/assurerail');
  const accountPath = '/home/deploy/arail-demo/founder-demo-accounts.json';
  assert.equal(statSync(accountPath).mode & 0o077, 0);
  const profile = JSON.parse(readFileSync(accountPath, 'utf8'));
  assert.equal(profile.institutionId, 'demo-nbfc-ev-001');
  const roles = ['sellerCommercialAdmin', 'invoicePreparer', 'invoiceChecker'];
  assert.equal(new Set(roles.map(role => profile.accounts[role].email)).size, roles.length);
  const institutionId = profile.institutionId;
  const participantBase = `/v1/rail/institutions/${institutionId}`;
  const browser = await firefox.launch();
  try {
    async function login(role, participant) {
      stage = `login_${role}`;
      const account = profile.accounts[role]; assert.match(account.email, /^rail-demo-[a-z-]+@example\.test$/);
      const context = await browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      let authorization, apiOrigin;
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname === '/venue/auth/session' && url.protocol === 'https:' &&
            url.hostname === 'api.assurerail.com') {
          authorization = request.headers().authorization; apiOrigin = url.origin;
        }
      });
      assert.equal((await page.goto('/login', { waitUntil: 'load', timeout: 45000 })).status(), 200);
      await page.evaluate(id => id ? localStorage.setItem('arail-active-institution', id) : localStorage.removeItem('arail-active-institution'), participant ? institutionId : null);
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL('**/console', { timeout: 30000 });
      await page.locator('.who').waitFor();
      assert.equal((await page.locator('.who').textContent()).trim(), account.email);
      assert(authorization && apiOrigin);
      async function api(path, data) {
        const response = await page.evaluate(async ({ url, authorization, institution, data }) => {
          const r = await fetch(url, { method: data === undefined ? 'GET' : 'POST', redirect: 'error',
            signal: AbortSignal.timeout(45000), headers: { authorization, 'Content-Type': 'application/json',
              ...(institution ? { 'x-assurerail-institution-id': institution } : {}) },
            ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
          return { ok: r.ok, status: r.status, json: r.headers.get('content-type')?.includes('application/json'),
            body: await r.json().catch(() => ({})) };
        }, { url: apiOrigin + path, authorization, institution: participant ? institutionId : null, data });
        if (!response.ok) {
          const body = response.body;
          const known = ['requested institution context is not bound to the active session',
            'active institution context does not match this operation', 'checkout is disabled',
            'stable Razorpay merchant account identity required',
            'checkout outcome unknown; reconcile by its existing reference before retrying'];
          report({ result: 'HTTP_ERROR', http: response.status, json: response.json,
            reason: known.includes(body.message) ? body.message : 'UNCLASSIFIED' });
          throw new Error('API_REJECTED');
        }
        return response.body;
      }
      async function apiRaw(path, bytes, metadata) {
        const response = await page.evaluate(async ({ url, authorization, institution, encoded, bytesBase64 }) => {
          const raw = atob(bytesBase64); const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
          const r = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
            headers: { authorization, 'Content-Type': 'application/octet-stream',
              'x-assurerail-document-metadata': encoded,
              ...(institution ? { 'x-assurerail-institution-id': institution } : {}) }, body: bytes });
          return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
        }, { url: apiOrigin + path, authorization, institution: participant ? institutionId : null,
          encoded: Buffer.from(JSON.stringify(metadata)).toString('base64url'), bytesBase64: bytes.toString('base64') });
        if (!response.ok) { report({ result: 'HTTP_ERROR', http: response.status, reason: 'RAW_API_REJECTED' }); throw new Error('API_REJECTED'); }
        return response.body;
      }
      async function proof(purpose) {
        const result = await api('/venue/auth/mfa/verify/totp', { code: totp(account.totpSecret), purpose, institutionId: participant ? institutionId : null });
        assert(result.stepUp?.id); return result.stepUp.id;
      }
      report({ result: 'PASS' }); return { page, api, apiRaw, proof };
    }
    const seller = await login('sellerCommercialAdmin', true);
    stage = 'book_a_scope';
    const offered = await seller.api(`${participantBase}/engagements`, {
      contractId: `demo-contract-${institutionId}`, requestRef: 'synthetic-55cr-book-a-20260927-v1',
      primaryPairCount: 1500, linkedPartyCount: 120,
      sellerProposedConsiderationMinor: '20000000000', aggregateProgrammeConsiderationMinor: '55000000000',
      bookRef: 'SYN-EV-2W-2025', assetFamily: 'VEHICLE_EV', asOfDate: '2026-09-15', optionalServices: [],
      billingProfile: { legalName: 'Synthetic NBFC 1 — demonstration only', billingEmail: 'billing@example.test',
        address: 'Synthetic demonstration address', stateCode: '27', postalCode: '400001', gstRegistration: 'UNREGISTERED' },
    });
    assert.equal(offered.scope.primaryPairCount, 1500);
    assert.equal(offered.quote.initial.baseMinor, '31200000');
    const id = offered.id; assert.match(id, /^eng_[a-f0-9-]+$/);
    report({ result: 'PASS', engagementId: id, quoteDigest: offered.quoteDigest, initialTotalMinor: offered.quote.initial.totalMinor });
    if (offered.status === 'OFFERED') {
      stage = 'seller_acceptance';
      const response = await seller.api(`${participantBase}/engagements/${id}/accept`, {
        quoteDigest: offered.quoteDigest, termsAccepted: true, dataAuthorityConfirmed: true,
        stepUpEvidenceId: await seller.proof('ENGAGEMENT_ACCEPT'),
      });
      assert.equal(response.status, 'ACCEPTED_SHADOW'); report({ result: 'PASS', engagementId: id });
    }
    const current = () => seller.api(`${participantBase}/engagements`).then(rows => rows.find(row => row.id === id));
    let invoice = (await current()).stages.find(s => s.stage === 'INITIAL')?.invoice;
    if (!invoice) {
      const maker = await login('invoicePreparer', false);
      stage = 'invoice_preparation';
      invoice = await maker.api(`/v1/rail/internal/engagements/institutions/${institutionId}/${id}/stages/INITIAL/invoice`, {
        stepUpEvidenceId: await maker.proof('INTERNAL_INVOICE_PREPARE'),
      });
      assert.equal(invoice.status, 'DRAFT'); report({ result: 'PASS', invoiceId: invoice.id, netFeeMinor: invoice.netFeeMinor });
    }
    if (invoice.status === 'DRAFT') {
      const checker = await login('invoiceChecker', false);
      stage = 'independent_invoice_issue';
      invoice = await checker.api(`/v1/rail/internal/customer-operations/institutions/${institutionId}/invoice-statements/${invoice.id}/issue`, {
        reason: 'Synthetic Book A hosted demonstration: independently checked accepted scope and stage amounts.',
        stepUpEvidenceId: await checker.proof('INTERNAL_INVOICE_REVIEW'),
      });
      assert.equal(invoice.status, 'ISSUED_SHADOW'); assert.notEqual(invoice.preparedByUserId, invoice.issuedByUserId);
      report({ result: 'PASS', invoiceId: invoice.id, independentReviewer: true });
    }
    assert.equal(invoice.status, 'ISSUED_SHADOW');
    assert(invoice.preparedByUserId && invoice.issuedByUserId);
    assert.notEqual(invoice.preparedByUserId, invoice.issuedByUserId);
    stage = 'seller_workspace_render';
    await seller.page.goto('/workspace/assessment', { waitUntil: 'load' });
    await seller.page.getByLabel('Choose a book').selectOption(id);
    await seller.page.getByRole('table', { name: 'Accepted-scope stage pricing' }).waitFor();
    report({ result: 'PASS', engagementId: id, invoiceId: invoice.id, invoiceStatus: invoice.status });
    let readiness = await seller.api(`${participantBase}/engagements/${id}/stages/INITIAL/readiness`);
    if (!readiness.readyForShadowProcessing) {
      stage = 'select_neft';
      const selection = await seller.api(`${participantBase}/engagements/${id}/stages/INITIAL/bank-transfer`, {});
      assert.equal(selection.status, 'AWAITING_BANK_TRANSFER'); assert(selection.transferRails.includes('NEFT'));
      report({ result: 'PASS', transferRail: 'NEFT', amountMinor: selection.amountMinor, livePaymentClaimed: false });

      const advice = Buffer.from([
        'synthetic_marker,transfer_rail,bank_transfer_ref,amount_minor,currency,invoice_id',
        `ASSURERAIL_FOUNDER_DEMO_V1,NEFT,SYNNEFT202609270001,${invoice.netFeeMinor},INR,${invoice.id}`,
      ].join('\n') + '\n');
      const adviceDigest = `sha256:${createHash('sha256').update(advice).digest('hex')}`;
      const preparer = await login('sellerDataPreparer', true);
      stage = 'neft_bank_advice_intake';
      const evidence = await preparer.apiRaw(`${participantBase}/evidence/documents`, advice, {
        idempotencyKey: 'synthetic-neft-book-a-20260927-v1',
        connectorRegistrationId: `demo-connector-assessment-upload-${institutionId}`,
        evidenceType: 'BANK_RECEIPT', classification: 'INSTITUTION_CONFIDENTIAL', purpose: 'CUSTOMER_BILLING',
        retentionUntilAt: '2027-09-27T00:00:00.000Z', title: 'Synthetic NEFT bank advice — Book A',
        documentType: 'BANK_TRANSACTION_ADVICE', filename: 'synthetic-neft-book-a.csv', contentType: 'text/csv',
        schemaId: 'assurerail.neutral-intake', schemaVersion: '1.0.0', sourceAsOfAt: '2026-09-26T00:00:00.000Z',
        signatureStatus: 'NOT_PROVIDED', result: 'REVIEW_REQUIRED', profileRef: 'assurerail.neutral-intake.v1',
        qualifications: [{ code: 'SYNTHETIC_DEMO_PAYMENT_EVIDENCE', severity: 'LIMITATION' }],
      });
      assert.equal(evidence.validationStatus, 'VALID');
      report({ result: 'PASS', evidenceObjectId: evidence.evidenceObjectId, validationStatus: evidence.validationStatus, synthetic: true });

      const collectionRefs = (process.env.ASSURERAIL_BILLING_COLLECTION_ACCOUNT_REFS || '').split(',').map(value => value.trim()).filter(Boolean);
      assert.equal(collectionRefs.length, 1, 'hosted demo requires exactly one configured collection-account reference');
      const maker = await login('invoicePreparer', false);
      stage = 'neft_receipt_proposal';
      const receipt = await maker.api(`/v1/rail/internal/engagement-billing/institutions/${institutionId}/invoices/${invoice.id}/receipts`, {
        collectionAccountRef: collectionRefs[0], transferRail: 'NEFT', syntheticOnly: true, bankTransferRef: 'SYNNEFT202609270001',
        amountMinor: invoice.netFeeMinor, evidenceRef: evidence.evidenceObjectId, evidenceDigest: adviceDigest,
        receivedAt: '2026-09-26T00:00:00.000Z', stepUpEvidenceId: await maker.proof('INTERNAL_PAYMENT_RECEIPT_PROPOSE'),
      });
      assert.equal(receipt.status, 'PROPOSED'); report({ result: 'PASS', receiptId: receipt.id, transferRail: receipt.transferRail });

      const checker = await login('invoiceChecker', false);
      stage = 'independent_neft_review';
      const reviewed = await checker.api(`/v1/rail/internal/engagement-billing/institutions/${institutionId}/receipts/${receipt.id}/review`, {
        decision: 'APPROVE', reason: 'Synthetic NEFT advice matches the issued Book A invoice, exact paise amount and configured collection account.',
        stepUpEvidenceId: await checker.proof('INTERNAL_PAYMENT_RECEIPT_REVIEW'),
      });
      assert.equal(reviewed.status, 'VERIFIED_SHADOW'); report({ result: 'PASS', receiptId: receipt.id, independentReviewer: true, livePaymentClaimed: false });
      readiness = await seller.api(`${participantBase}/engagements/${id}/stages/INITIAL/readiness`);
    }
    stage = 'bank_payment_readiness';
    assert.equal(readiness.readyForShadowProcessing, true); assert.equal(readiness.liveStageUnlock, false);
    report({ result: 'PASS', reason: readiness.reason, transferRail: 'NEFT', shadowOnly: true });

    stage = 'seller_bank_receipt_render';
    await seller.page.goto('/workspace/assessment', { waitUntil: 'load' });
    await seller.page.getByLabel('Choose a book').selectOption(id);
    await seller.page.getByRole('button', { name: 'Check bank transfer' }).click();
    await seller.page.getByRole('table', { name: 'Reconciled bank transfer' }).waitFor();
    await seller.page.getByText('SYNTHETIC ONLY', { exact: true }).waitFor();
    report({ result: 'PASS', transferRail: 'NEFT', syntheticLabelRendered: true });

    const tapePath = '/home/deploy/assurerail/demo/assurerail/synthetic-nbfc-55cr/upload-step1/book-a-initial.csv';
    const tape = readFileSync(tapePath);
    assert.equal(createHash('sha256').update(tape).digest('hex'), 'eb660bdea2874464e0f1d537b1e0dd2a1e1326200c2013d69c7e31d23e65017e');
    const dataPreparer = await login('sellerDataPreparer', true);
    const runsPath = `${participantBase}/engagements/${id}/runs`;
    stage = 'book_a_tape_intake';
    const uploaded = await dataPreparer.apiRaw(`${runsPath}/upload/INITIAL`, tape, {
      filename: 'book-a-initial.csv', contentType: 'text/csv', documentType: 'LOAN_TAPE',
      requestRef: 'synthetic-book-a-initial-upload-20260927-v1',
    });
    assert.equal(uploaded.validationStatus, 'VALID'); assert.equal(uploaded.malwareStatus, 'CLEAN');
    report({ result: 'PASS', evidenceObjectId: uploaded.evidenceObjectId, evidenceVersionId: uploaded.evidenceVersionId, replay: uploaded.replay, validationStatus: uploaded.validationStatus, malwareStatus: uploaded.malwareStatus });

    stage = 'book_a_processing_request';
    const run = await dataPreparer.api(runsPath, {
      stage: 'INITIAL', requestRef: 'synthetic-book-a-initial-run-20260927-v1',
      evidenceVersionIds: [uploaded.evidenceVersionId], stepUpEvidenceId: await dataPreparer.proof('ENGAGEMENT_PROCESSING_REQUEST'),
    });
    assert.match(run.id, /^aprocess_[a-f0-9-]+$/);
    let completed;
    for (let attempt = 0; attempt < 36; attempt += 1) {
      completed = (await dataPreparer.api(runsPath)).find(candidate => candidate.id === run.id);
      if (completed && ['AUTO_RELEASED', 'FAILED'].includes(completed.status)) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert.equal(completed?.status, 'AUTO_RELEASED');
    assert.equal(completed.result.dataQuality.status, 'RECORD_EXCEPTIONS');
    assert.equal(completed.result.dataQuality.parsedPrimaryPairCount, 1500);
    assert.equal(completed.result.dataQuality.parsedLinkedPartyCount, 120);
    assert.equal(completed.result.dataQuality.duplicateRecords, 12);
    assert.equal(completed.result.dataQuality.parsedPrincipalMinor, '20000000000');
    assert.equal(completed.result.analysis.provider, 'NOT_RUN');
    assert.equal(completed.result.analysis.qualification, 'AI_INPUT_BUDGET_EXCEEDED');
    assert.equal(completed.result.release.method, 'AUTOMATED_UNSIGNED');
    assert.equal(completed.result.release.expertReviewed, false);
    assert.equal(completed.result.release.professionalSignoff, false);
    report({ result: 'PASS', runId: run.id, status: completed.status, dataQuality: completed.result.dataQuality.status,
      duplicateRecords: completed.result.dataQuality.duplicateRecords, parsedPrimaryPairCount: completed.result.dataQuality.parsedPrimaryPairCount,
      parsedLinkedPartyCount: completed.result.dataQuality.parsedLinkedPartyCount, parsedPrincipalMinor: completed.result.dataQuality.parsedPrincipalMinor,
      aiQualification: completed.result.analysis.qualification, automatedUnsigned: true });

    stage = 'book_a_result_render';
    await dataPreparer.page.goto(`/workspace/assessment/${id}`, { waitUntil: 'load' });
    await dataPreparer.page.getByText(/12 duplicates/).waitFor({ timeout: 30000 });
    await dataPreparer.page.getByText(/AI INPUT BUDGET EXCEEDED/).waitFor();
    report({ result: 'PASS', runId: run.id, resultRendered: true });
  } finally { await browser.close(); }
})().catch(error => { report({ result: 'FAIL', errorType: error.name }); process.exitCode = 1; });
