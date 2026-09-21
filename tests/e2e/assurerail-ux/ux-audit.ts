import { expect, type Locator, type Page } from "@playwright/test";

const unsafeVisibleText = [
  /Firebase:\s*Error/i,
  /auth\/[a-z-]+/i,
  /Prisma(?:Client)?/i,
  /\bP\d{4}\b/,
  /(?:localhost|127\.0\.0\.1):\d{2,5}/i,
  /(?:secret|credential)[-_ ]?ref[-_: ]+[a-z0-9]/i,
];

export function watchBrowserHealth(page: Page): { assertHealthy: () => void } {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console error: ${message.text()}`);
  });
  return {
    assertHealthy: () => expect(failures, failures.join("\n")).toEqual([]),
  };
}

export async function auditPage(page: Page): Promise<void> {
  const audit = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };
    const actions = [...document.querySelectorAll("a,button")].filter(visible);
    const controls = [...document.querySelectorAll("input,select,textarea")]
      .filter((element) => (element as HTMLInputElement).type !== "hidden" && visible(element));
    return {
      headings: [...document.querySelectorAll("h1")].filter(visible).map((node) => node.textContent?.trim() ?? ""),
      duplicateIds: [...document.querySelectorAll("[id]")]
        .map((node) => node.id)
        .filter((id, index, all) => id && all.indexOf(id) !== index),
      unnamedActions: actions.filter((node) => !(
        node.textContent?.trim()
        || node.getAttribute("aria-label")
        || node.getAttribute("aria-labelledby")
        || node.getAttribute("title")
        || node.querySelector("img[alt]")?.getAttribute("alt")?.trim()
      )).length,
      unlabelledControls: controls.filter((node) => !(node.labels?.length || node.getAttribute("aria-label") || node.getAttribute("aria-labelledby"))).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.innerText,
    };
  });

  expect(audit.headings, "page must have one visible, non-empty h1").toHaveLength(1);
  expect(audit.headings[0], "page h1 must not be empty").toBeTruthy();
  expect([...new Set(audit.duplicateIds)], "page must not contain duplicate IDs").toEqual([]);
  expect(audit.unnamedActions, "every visible link and button needs an accessible name").toBe(0);
  expect(audit.unlabelledControls, "every visible form control needs a label").toBe(0);
  expect(audit.overflow, "page must not overflow horizontally").toBeLessThanOrEqual(1);
  for (const pattern of unsafeVisibleText) expect(audit.body).not.toMatch(pattern);
}

export async function expectKeyboardReachable(page: Page, target: Locator, maxTabs = 20): Promise<void> {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`control was not keyboard reachable after ${maxTabs} Tab presses`);
}
