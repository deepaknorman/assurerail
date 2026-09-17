import { readFileSync } from "node:fs";
import { expect, test as base, type Page } from "@playwright/test";

export type UxAccount = {
  email: string;
  password: string;
  institutionId: string;
};

type AccountDocument = {
  accounts: Record<string, UxAccount>;
};

function loadAccount(name: string): UxAccount {
  const path = process.env.ARAIL_UX_ACCOUNTS_FILE ?? process.env.ARAIL_E2E_ACCOUNTS_FILE;
  if (!path) throw new Error("Run the authenticated UX preflight before Playwright");
  const account = (JSON.parse(readFileSync(path, "utf8")) as AccountDocument).accounts?.[name];
  if (!account) throw new Error(`UX account ${name} is not present in the private account file`);
  return account;
}

export const test = base.extend<{ participantAdmin: UxAccount }>({
  participantAdmin: async ({}, use) => use(loadAccount("participantOrgAdminA")),
});

export { expect };

export async function signIn(page: Page, account: UxAccount): Promise<void> {
  await page.goto("/login");
  await page.evaluate((institutionId) => {
    localStorage.setItem("arail-active-institution", institutionId);
  }, account.institutionId);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/(?:console|workspace|institutions|internal)(?:[/?#]|$)/);
}
