import { auditPage, expectKeyboardReachable, watchBrowserHealth } from "./ux-audit";
import { expect, signIn, test } from "./fixtures";

test.describe("AssureRail authenticated UX release gate", () => {
  test("login cannot accept credentials before its client code loads", async ({ browser, baseURL, page }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
      await expect(page.getByLabel("Email")).toBeDisabled();
      await expect(page.getByLabel("Password", { exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "New here? Create an account" })).toBeDisabled();
    } finally {
      await context.close();
    }
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Email")).toBeEnabled();
    await expect(page.getByLabel("Password", { exact: true })).toBeEnabled();
    await page.getByLabel("Email").fill("hydration-check@example.test");
    await page.getByLabel("Password", { exact: true }).fill("synthetic-not-a-credential");
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  });

  test("anonymous customer routes return to sign-in", async ({ page }) => {
    const health = watchBrowserHealth(page);
    await page.goto("/workspace/assessment");
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
    await auditPage(page);
    health.assertHealthy();
  });

  test("sign-in and registration state remain clear, safe and keyboard reachable", async ({ page }) => {
    await page.goto("/login");
    await auditPage(page);

    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");
    const submit = page.getByRole("button", { name: "Sign in", exact: true });
    const mode = page.getByRole("button", { name: "New here? Create an account" });

    await expect(email).toBeEnabled();
    await expect(password).toBeEnabled();
    await expectKeyboardReachable(page, email);
    await expectKeyboardReachable(page, password);
    await expect(submit).toBeDisabled();
    await expectKeyboardReachable(page, mode);

    await email.fill("assurerail-ux-unregistered@example.test");
    await password.fill("synthetic-invalid-password");
    await expect(submit).toBeEnabled();
    await expectKeyboardReachable(page, submit);
    await page.keyboard.press("Enter");
    const alert = page.getByRole("alert");
    await expect(alert).toHaveText("The email or password was not recognised. Check the details and try again.");
    await expect(alert).not.toContainText(/Firebase|auth\/|invalid-api-key|identitytoolkit/i);

    // The intentionally rejected identity-provider request may produce a browser-generated console
    // error. Begin the unexpected-error watch after that controlled negative test has completed.
    const health = watchBrowserHealth(page);
    await mode.click();
    await expect(page.getByRole("heading", { name: "Create your institutional account" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(email).toHaveValue("assurerail-ux-unregistered@example.test");
    await expect(password).toHaveValue("");
    await auditPage(page);
    health.assertHealthy();
  });

  test("a provisioned participant can sign in and refresh an authenticated screen", async ({ page, participantAdmin }) => {
    const health = watchBrowserHealth(page);
    await signIn(page, participantAdmin);
    await auditPage(page);
    const authenticatedPath = new URL(page.url()).pathname;
    await page.reload({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(new RegExp(`${authenticatedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[/?#]|$)`));
    await auditPage(page);
    health.assertHealthy();
  });
});
