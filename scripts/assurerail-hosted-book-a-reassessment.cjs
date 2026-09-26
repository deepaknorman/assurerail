#!/usr/bin/env node
/* Guarded hosted continuation for synthetic Book A.
 * Corrects the admitted loan tape, binds the correction to current remediation items,
 * runs a comparable deterministic reassessment, renders its result in Firefox and
 * accepts Portfolio Preparation with the exact displayed remediation disclosure.
 * Run only from the deployed repository as deploy with
 * ASSURERAIL_HOSTED_REASSESSMENT_WRITE=yes. Credentials never leave memory.
 */
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const { readFileSync, statSync } = require('node:fs');
const { createHash, createHmac } = require('node:crypto');
const assert = require('node:assert/strict');
const { firefox } = require(process.cwd() + '/node_modules/playwright');
const baseURL = 'https://arail.assurelocker.com';
let stage = 'preflight';
function report(fields) { console.log(JSON.stringify({ stage, ...fields })); }
function counter() { return Math.floor(Date.now() / 30000); }
function totp(seed) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  assert.match(seed, /^[A-Z2-7]+=*$/);
  const bits = [...seed.replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const value = Buffer.alloc(8); value.writeBigUInt64BE(BigInt(counter()));
  const digest = createHmac('sha1', key).update(value).digest();
  return String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

(async () => {
  assert.equal(process.env.ASSURERAIL_HOSTED_REASSESSMENT_WRITE, 'yes');
  assert.equal(process.cwd(), '/home/deploy/assurerail');
  const accountPath = '/home/deploy/arail-demo/founder-demo-accounts.json';
  assert.equal(statSync(accountPath).mode & 0o077, 0);
  const profile = JSON.parse(readFileSync(accountPath, 'utf8'));
  assert.equal(profile.institutionId, 'demo-nbfc-ev-001');
  const institutionId = profile.institutionId;
  const participantBase = `/v1/rail/institutions/${institutionId}`;
  const browser = await firefox.launch();
  try {
    async function login(role) {
      stage = `login_${role}`;
      const account = profile.accounts[role];
      assert.match(account.email, /^rail-demo-[a-z-]+@example\.test$/);
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
      await page.evaluate(id => localStorage.setItem('arail-active-institution', id), institutionId);
      await page.getByLabel('Email').fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL('**/console', { timeout: 30000 });
      await page.locator('.who').waitFor();
      assert.equal((await page.locator('.who').textContent()).trim(), account.email);
      assert(authorization && apiOrigin);
      async function api(path, data) {
        const response = await page.evaluate(async ({ url, authorization, institutionId, data }) => {
          const result = await fetch(url, { method: data === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
            headers: { authorization, 'Content-Type': 'application/json', 'x-assurerail-institution-id': institutionId },
            ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
          return { ok: result.ok, status: result.status, body: await result.json().catch(() => ({})) };
        }, { url: apiOrigin + path, authorization, institutionId, data });
        if (!response.ok) { report({ result: 'HTTP_ERROR', http: response.status, reason: 'API_REJECTED' }); throw new Error('API_REJECTED'); }
        return response.body;
      }
      async function apiRaw(path, bytes, metadata) {
        const response = await page.evaluate(async ({ url, authorization, institutionId, encoded, bytesBase64 }) => {
          const raw = atob(bytesBase64); const body = Uint8Array.from(raw, character => character.charCodeAt(0));
          const result = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
            headers: { authorization, 'Content-Type': 'application/octet-stream', 'x-assurerail-institution-id': institutionId, 'x-assurerail-document-metadata': encoded }, body });
          return { ok: result.ok, status: result.status, body: await result.json().catch(() => ({})) };
        }, { url: apiOrigin + path, authorization, institutionId, encoded: Buffer.from(JSON.stringify(metadata)).toString('base64url'), bytesBase64: bytes.toString('base64') });
        if (!response.ok) { report({ result: 'HTTP_ERROR', http: response.status, reason: 'RAW_API_REJECTED' }); throw new Error('API_REJECTED'); }
        return response.body;
      }
      const usedCounters = new Map();
      async function proof(purpose) {
        while (usedCounters.get(purpose) === counter()) await wait(1000);
        const used = counter();
        const result = await api('/venue/auth/mfa/verify/totp', { code: totp(account.totpSecret), purpose, institutionId });
        assert(result.stepUp?.id); usedCounters.set(purpose, used); return result.stepUp.id;
      }
      report({ result: 'PASS' }); return { page, api, apiRaw, proof };
    }

    const preparer = await login('sellerDataPreparer');
    stage = 'locate_book_a';
    const engagement = (await preparer.api(`${participantBase}/engagements`)).find(item => item.scope?.bookRef === 'SYN-EV-2W-2025');
    assert(engagement); assert.equal(engagement.scope.primaryPairCount, 1500); assert.equal(engagement.scope.linkedPartyCount, 120);
    const runsPath = `${participantBase}/engagements/${engagement.id}/runs`;
    let runs = await preparer.api(runsPath);
    let latest = runs.find(run => run.stage === 'INITIAL' && run.status === 'AUTO_RELEASED');
    assert(latest); report({ result: 'PASS', engagementId: engagement.id, baselineRunId: latest.id, baselineStatus: latest.result.dataQuality.status });

    if (latest.result.release.outcome !== 'READY_FOR_PORTFOLIO_PREPARATION') {
      assert.equal(latest.result.dataQuality.status, 'RECORD_EXCEPTIONS');
      assert.equal(latest.result.dataQuality.duplicateRecords, 12);
      const tapePath = '/home/deploy/assurerail/demo/assurerail/synthetic-nbfc-55cr/reference-for-step2/book-a-corrected.csv';
      const tape = readFileSync(tapePath);
      assert.equal(createHash('sha256').update(tape).digest('hex'), '6ad252df5f1b05565a8a8435dbfa110c87100ef024376aca49570a2d5b327a4a');
      const tapeManifest = latest.result.manifest.find(entry => entry.evidenceType === 'LOAN_TAPE'); assert(tapeManifest?.evidenceObjectId);
      stage = 'corrected_tape_intake';
      const uploaded = await preparer.apiRaw(`${runsPath}/upload/INITIAL`, tape, {
        filename: 'book-a-corrected.csv', contentType: 'text/csv', documentType: 'LOAN_TAPE', evidenceObjectId: tapeManifest.evidenceObjectId,
        requestRef: 'synthetic-book-a-corrected-upload-20260927-v1',
      });
      assert.equal(uploaded.validationStatus, 'VALID'); assert.equal(uploaded.malwareStatus, 'CLEAN');
      report({ result: 'PASS', evidenceVersionId: uploaded.evidenceVersionId, validationStatus: uploaded.validationStatus, malwareStatus: uploaded.malwareStatus, replay: uploaded.replay });

      stage = 'bind_corrected_tape_to_gaps';
      let items = (await preparer.api(`${runsPath}/remediation`)).filter(item => item.sourceRunId === latest.id && item.requiredEvidenceTypes.includes('LOAN_TAPE') && ['OPEN', 'EVIDENCE_ATTACHED'].includes(item.status));
      assert.equal(items.length, 2);
      for (const item of items) {
        const planned = await preparer.api(`${runsPath}/remediation/${item.id}/plan`, {
          ownerRole: item.defaultOwnerRole, correctionEvidenceVersionIds: [uploaded.evidenceVersionId],
          stepUpEvidenceId: await preparer.proof('ENGAGEMENT_REMEDIATION_PLAN'),
        });
        assert.equal(planned.status, 'EVIDENCE_ATTACHED');
      }
      report({ result: 'PASS', plannedGapCount: items.length });

      const policy = await preparer.api(`${runsPath}/policy`);
      stage = 'comparable_reassessment';
      const requested = await preparer.api(runsPath, {
        stage: 'INITIAL', requestRef: 'synthetic-book-a-reassessment-20260927-v1', evidenceVersionIds: [uploaded.evidenceVersionId],
        scopeDigest: policy.scopeDigest, baselineRunId: latest.id, remediationItemIds: items.map(item => item.id),
        stepUpEvidenceId: await preparer.proof('ENGAGEMENT_PROCESSING_REQUEST'),
      });
      for (let attempt = 0; attempt < 36; attempt += 1) {
        const candidate = (await preparer.api(runsPath)).find(run => run.id === requested.id);
        if (candidate && ['AUTO_RELEASED', 'FAILED'].includes(candidate.status)) { latest = candidate; break; }
        await wait(5000);
      }
      assert.equal(latest.id, requested.id); assert.equal(latest.status, 'AUTO_RELEASED');
    }

    stage = 'verify_reassessment';
    assert.equal(latest.result.dataQuality.status, 'MATCHED');
    assert.equal(latest.result.dataQuality.parsedPrimaryPairCount, 1500);
    assert.equal(latest.result.dataQuality.parsedLinkedPartyCount, 120);
    assert.equal(latest.result.dataQuality.parsedPrincipalMinor, '20000000000');
    assert.equal(latest.result.dataQuality.duplicateRecords, 0);
    assert.equal(latest.result.analysis.provider, 'NOT_APPLICABLE');
    assert.equal(latest.result.analysis.qualification, 'NO_UNSTRUCTURED_DOCUMENTS_SELECTED');
    assert.deepEqual(latest.result.analysis.aiCoverage, { documentsAdmitted: 0, documentsReviewed: 0, unreviewed: [] });
    assert.equal(latest.result.release.outcome, 'READY_FOR_PORTFOLIO_PREPARATION');
    assert.equal(latest.result.remediation.reassessmentOrdinal, 1);
    assert.equal(latest.result.remediation.changeSummary.resolvedGapKeys.length, 1);
    assert.equal(latest.result.remediation.changeSummary.continuingGapKeys.length, 7);
    assert.equal(latest.result.remediation.changeSummary.newGapKeys.length, 0);
    assert.match(latest.result.remediation.disclosure.disclosureDigest, /^sha256:[0-9a-f]{64}$/);
    report({ result: 'PASS', reassessmentRunId: latest.id, dataQuality: 'MATCHED', outcome: latest.result.release.outcome,
      resolved: 1, continuing: 7, new: 0, deterministicTapePath: true });

    stage = 'reassessment_render';
    await preparer.page.goto(`/workspace/assessment/${engagement.id}`, { waitUntil: 'load' });
    await preparer.page.getByText(/1 resolved · 7 continuing · 0 new/).waitFor({ timeout: 30000 });
    await preparer.page.getByText(/Data quality: RECORD EXCEPTIONS → MATCHED/i).waitFor();
    await preparer.page.getByText(/No unstructured supporting documents selected/i).waitFor();
    report({ result: 'PASS', changeSummaryRendered: true, deterministicCoverageRendered: true });

    const seller = await login('sellerCommercialAdmin');
    stage = 'preparation_disclosure_render';
    await seller.page.goto('/workspace/assessment', { waitUntil: 'load' });
    await seller.page.getByLabel('Choose a book').selectOption(engagement.id);
    await seller.page.getByText(/Ready for preparation — 5 evidence families and loan-document coverage to be prepared/).waitFor({ timeout: 30000 });
    await seller.page.getByText(/Loan-document coverage is 0\/1,200/).waitFor();
    report({ result: 'PASS', openGapCount: latest.result.remediation.disclosure.openGaps.length, disclosureRendered: true });
    const current = (await seller.api(`${participantBase}/engagements`)).find(item => item.id === engagement.id);
    if (!current.route) {
      stage = 'accept_preparation_with_disclosure';
      const accepted = await seller.api(`${participantBase}/engagements/${engagement.id}/preparation`, {
        route: 'COMMITTED', quoteDigest: current.quoteDigest, remediationScopeDigest: latest.result.remediation.disclosure.disclosureDigest,
        mandateAndTopUpAccepted: true, stepUpEvidenceId: await seller.proof('ENGAGEMENT_PREPARATION_ACCEPT'),
      });
      assert.equal(accepted.route, 'COMMITTED');
      assert.equal(accepted.preparationRemediationScopeDigest, latest.result.remediation.disclosure.disclosureDigest);
    } else {
      assert.equal(current.route, 'COMMITTED');
      assert.equal(current.preparationRemediationScopeDigest, latest.result.remediation.disclosure.disclosureDigest);
    }
    report({ result: 'PASS', route: 'COMMITTED', remediationDisclosureBound: true, liveDecisionAuthority: false });
  } finally { await browser.close(); }
})().catch(error => { report({ result: 'FAIL', errorType: error.name }); process.exitCode = 1; });
