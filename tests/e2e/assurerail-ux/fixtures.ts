import { readFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";

// Apply inside each worker as well as the config loader process.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

export type UxAccount = {
  email: string;
  password: string;
  institutionId: string;
};

type AccountDocument = {
  institutionId?: string;
  accounts: Record<string, UxAccount | Omit<UxAccount, "institutionId">>;
};

export function loadAccount(name: string): UxAccount {
  const path = process.env.ARAIL_UX_ACCOUNTS_FILE ?? process.env.ARAIL_E2E_ACCOUNTS_FILE;
  if (!path) throw new Error("Run the authenticated UX preflight before Playwright");
  const document = JSON.parse(readFileSync(path, "utf8")) as AccountDocument;
  const account = document.accounts?.[name]
    ?? (name === "participantOrgAdminA" ? document.accounts?.sellerCommercialAdmin : undefined);
  if (!account) throw new Error(`UX account ${name} is not present in the private account file`);
  const institutionId = "institutionId" in account ? account.institutionId : document.institutionId;
  if (typeof institutionId !== "string" || !institutionId) throw new Error(`UX account ${name} has no institution scope`);
  return { ...account, institutionId };
}

export const test = base.extend<{ participantAdmin: UxAccount }>({
  participantAdmin: async ({}, use) => use(loadAccount("participantOrgAdminA")),
});

export { expect };

export async function signIn(page: Page, account: UxAccount): Promise<void> {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.status(), "login entry must be available before entering credentials").toBe(200);
  await page.evaluate((institutionId) => {
    localStorage.setItem("arail-active-institution", institutionId);
  }, account.institutionId);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/(?:console|workspace|institutions|internal)(?:[/?#]|$)/);
}
