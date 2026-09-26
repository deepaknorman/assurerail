#!/usr/bin/env node
/* Hosted synthetic acceptance, using real Firefox login, MFA and guarded APIs.
 * Run from the deployed repository as deploy, with ASSURERAIL_HOSTED_DEMO_WRITE=yes.
 * Credentials stay in memory; no screenshots, traces, videos or raw errors are emitted.
 * This stops at provider checkout: an OPEN checkout is not evidence of payment.
 */
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const { readFileSync, statSync } = require('node:fs');
const { createHmac } = require('node:crypto');
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
      async function proof(purpose) {
        const result = await api('/venue/auth/mfa/verify/totp', { code: totp(account.totpSecret), purpose, institutionId: participant ? institutionId : null });
        assert(result.stepUp?.id); return result.stepUp.id;
      }
      report({ result: 'PASS' }); return { page, api, proof };
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
    stage = 'test_checkout';
    let checkout = await seller.api(`${participantBase}/engagements/${id}/stages/INITIAL/checkout`, {});
    assert.equal(checkout.mode, 'TEST');
    if (checkout.status === 'UNKNOWN') checkout = await seller.api(`${participantBase}/engagements/${id}/stages/INITIAL/checkout/reconcile`, {});
    assert(['OPEN', 'PAID_TEST'].includes(checkout.status));
    report({ result: 'PASS', checkoutId: checkout.id, status: checkout.status, paymentProven: checkout.status === 'PAID_TEST' });
  } finally { await browser.close(); }
})().catch(error => { report({ result: 'FAIL', errorType: error.name }); process.exitCode = 1; });
