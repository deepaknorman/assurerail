import { readFileSync } from "node:fs";
import { expect, request, test, type Page } from "@playwright/test";

type Account = {
  email: string;
  password: string;
  institutionId?: string;
  expectedWorkspace?: string;
};
type Accounts = Record<string, Account>;

function loadAccounts(): Accounts {
  const path = process.env.ARAIL_E2E_ACCOUNTS_FILE;
  if (!path) throw new Error("ARAIL_E2E_ACCOUNTS_FILE is required; run the SEC-01 preflight");
  return (JSON.parse(readFileSync(path, "utf8")) as { accounts: Accounts }).accounts;
}

async function login(page: Page, account: Account): Promise<string> {
  await page.goto("/login");
  await page.evaluate((institutionId) => {
    if (institutionId) localStorage.setItem("arail-active-institution", institutionId);
    else localStorage.removeItem("arail-active-institution");
  }, account.institutionId ?? null);

  const exchange = page.waitForRequest((req) =>
    req.method() === "POST" && req.url().endsWith("/venue/auth/session"),
  );
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const sessionRequest = await exchange;
  const body = sessionRequest.postDataJSON() as { idToken?: string; activeInstitutionId?: string | null };
  expect(body.idToken, "session exchange must carry a Firebase ID token").toBeTruthy();
  expect(body.activeInstitutionId ?? null).toBe(account.institutionId ?? null);
  await expect(page).not.toHaveURL(/\/onboard(?:\?|$)/);
  await expect(page).toHaveURL(/\/(?:console|workspace|internal)(?:\?|$)/);
  return body.idToken!;
}

async function apiFor(token: string) {
  return request.newContext({
    baseURL: process.env.ARAIL_E2E_API_URL,
    extraHTTPHeaders: { authorization: `Bearer ${token}` },
  });
}

test.describe("AssureRail SEC-01 anonymous boundary", () => {
  test("protected participant and internal pages return to sign-in", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await page.goto("/internal");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
});

test.describe("AssureRail SEC-01 participant isolation", () => {
  test("tenant A viewer cannot switch the path/header to tenant B or open platform admin", async ({ page }) => {
    const accounts = loadAccounts();
    const account = accounts.participantViewerA;
    const token = await login(page, account);
    const api = await apiFor(token);
    try {
      const own = await api.get(`/v1/rail/institutions/${encodeURIComponent(account.institutionId!)}`, {
        headers: { "x-assurerail-institution-id": account.institutionId! },
      });
      expect(own.status()).toBe(200);

      const crossTenant = await api.get(`/v1/rail/institutions/${encodeURIComponent(accounts.participantViewerB.institutionId!)}`, {
        headers: { "x-assurerail-institution-id": account.institutionId! },
      });
      expect(crossTenant.status()).toBe(403);

      const forgedContext = await api.get(`/v1/rail/institutions/${encodeURIComponent(accounts.participantViewerB.institutionId!)}`, {
        headers: { "x-assurerail-institution-id": accounts.participantViewerB.institutionId! },
      });
      expect(forgedContext.status()).toBe(403);

      const platformAdmin = await api.get("/venue/admin/users");
      expect(platformAdmin.status()).toBe(403);
    } finally {
      await api.dispose();
    }
  });

  test("participant context cannot be combined with an internal staff workspace", async ({ page }) => {
    const account = loadAccounts().participantOrgAdminA;
    const token = await login(page, account);
    const api = await apiFor(token);
    try {
      const response = await api.get("/v1/rail/internal-access/workspaces", {
        headers: { "x-assurerail-institution-id": account.institutionId! },
      });
      expect(response.status()).toBe(403);
    } finally {
      await api.dispose();
    }
  });
});

const internalCases = [
  ["internalViewer", "Audit and reporting"],
  ["internalManager", "Operations"],
  ["internalSysadmin", "System operations"],
  ["internalSecurityAdmin", "Security"],
  ["internalSuperadmin", "Governance"],
] as const;

for (const [accountName, expectedWorkspace] of internalCases) {
  test(`internal ${accountName} sees its bounded workspace`, async ({ page }) => {
    const account = loadAccounts()[accountName];
    const token = await login(page, account);
    await page.goto("/internal");
    await expect(page.getByRole("heading", { name: expectedWorkspace })).toBeVisible();
    await expect(page.getByText("CUSTOMER AUTHORITY: NONE")).toBeVisible();

    const api = await apiFor(token);
    try {
      const workspaces = await api.get("/v1/rail/internal-access/workspaces");
      expect(workspaces.status()).toBe(200);
      const payload = (await workspaces.json()) as { customerAuthorityGranted?: boolean; workspaces?: { title?: string }[] };
      expect(payload.customerAuthorityGranted).toBe(false);
      expect(payload.workspaces?.some((workspace) => workspace.title === (account.expectedWorkspace ?? expectedWorkspace))).toBe(true);

      if (accountName !== "internalSuperadmin") {
        const assignments = await api.get("/v1/rail/admin/internal-access/assignments");
        expect(assignments.status()).toBe(403);
      }
    } finally {
      await api.dispose();
    }
  });
}
