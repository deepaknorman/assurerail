import { expect, loadAccount, signIn, test } from "./fixtures";

// Real hosted authentication and API responses only. This first slice is read-only: quote-preview
// computes prices but does not create an engagement, issue an invoice or submit a payment.
test.describe("Seller demonstration readiness", () => {
  test("seller gets a real quote that changes with the supplied scope", async ({ page, participantAdmin }) => {
    await signIn(page, participantAdmin);
    await page.goto("/workspace/assessment", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Know the scope. See the cost." })).toBeVisible();
    await page.locator("#primary-count").fill("12");
    await page.locator("#linked-count").fill("0");
    await page.locator("#seller-consideration").fill("1.085");
    await page.locator("#programme-consideration").fill("1.085");

    async function quote() {
      const pending = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === `/v1/rail/institutions/${participantAdmin.institutionId}/engagement-billing/quote-preview`
          && response.request().method() === "POST";
      });
      await page.getByRole("button", { name: "Calculate stage fees" }).click();
      const response = await pending;
      expect(response.ok(), `real quote endpoint returned HTTP ${response.status()}`).toBe(true);
      const result = await response.json();
      expect(result.quoteDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(BigInt(result.initialAssessmentMinor) > 0n).toBe(true);
      await expect(page.getByRole("table", { name: /Stage fees for/ })).toBeVisible();
      return result;
    }

    const small = await quote();
    expect(small.primaryPairCount).toBe(12);
    // Cross the seller minimum so that the pricing engine must produce a different amount.
    await page.locator("#primary-count").fill("2500");
    const larger = await quote();
    expect(larger.primaryPairCount).toBe(2500);
    expect(larger.quoteDigest === small.quoteDigest).toBe(false);
    expect(BigInt(larger.initialAssessmentMinor) > BigInt(small.initialAssessmentMinor)).toBe(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Know the scope. See the cost." })).toBeVisible();
  });

  test("commercial and data users keep separate authenticated sessions", async ({ browser, baseURL }) => {
    const commercial = loadAccount("sellerCommercialAdmin");
    const preparer = loadAccount("sellerDataPreparer");
    expect(commercial.email === preparer.email).toBe(false);
    const first = await browser.newContext({ baseURL });
    const second = await browser.newContext({ baseURL });
    try {
      const commercialPage = await first.newPage();
      const preparerPage = await second.newPage();
      await signIn(commercialPage, commercial);
      await signIn(preparerPage, preparer);
      for (const [page, account] of [[commercialPage, commercial], [preparerPage, preparer]] as const) {
        await page.goto("/workspace/assessment", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Know the scope. See the cost." })).toBeVisible();
        await expect(page.locator(".who")).toHaveText(account.email);
      }
      await commercialPage.reload({ waitUntil: "domcontentloaded" });
      await expect(commercialPage.locator(".who")).toHaveText(commercial.email);
      await preparerPage.reload({ waitUntil: "domcontentloaded" });
      await expect(preparerPage.locator(".who")).toHaveText(preparer.email);
    } finally {
      await first.close();
      await second.close();
    }
  });
});
