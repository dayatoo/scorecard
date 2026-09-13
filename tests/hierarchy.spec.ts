// Exercises the in-app hierarchy editor: creating, moving and deleting KPIs
// without needing to import a spreadsheet.
import { expect, type Locator, type Page, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

/**
 * The tree is nested `<li>`s, so a plain `hasText` locator on `<li>` matches
 * every ancestor row too (they all "contain" a descendant's text), and even
 * an `<li>` itself contains its whole subtree, not just its own row. Anchoring
 * on the exact-text link, then walking up to its immediate row `<div>` (one
 * level up, not the `<li>`), scopes button lookups to that row alone.
 */
function rowFor(page: Page, name: string): Locator {
  return page
    .getByRole("link", { name, exact: true })
    .locator("xpath=ancestor::div[1]");
}

test("a KPI can be created, moved and deleted entirely in the app", async ({ page }) => {
  await page.goto("/manage/hierarchy");
  await expect(page.getByRole("heading", { name: "Hierarchy" })).toBeVisible();

  // Create a sub-KPI under SG1. Button names are matched exactly — the
  // reorder buttons are accessibly named "Move <name> up/down", which would
  // otherwise substring-match "Move" too.
  await rowFor(page, "Grow the business").getByRole("button", { name: "+ sub", exact: true }).click();
  await page.getByPlaceholder("Code").fill("SG1.9");
  await page.getByPlaceholder("Name").fill("A brand new KPI");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("link", { name: "A brand new KPI", exact: true })).toBeVisible();

  // It shows up on the dashboard tree too, without any import.
  await page.goto("/kpis");
  await expect(page.getByText("A brand new KPI")).toBeVisible();

  // Move it under SG2.
  await page.goto("/manage/hierarchy");
  await rowFor(page, "A brand new KPI").getByRole("button", { name: "Move", exact: true }).click();
  await page.getByRole("combobox").filter({ hasText: "Choose a new parent" }).selectOption({ label: "SG2 Operate efficiently" });

  // Confirm the move landed under SG2.
  const movedRow = rowFor(page, "A brand new KPI");
  await expect(movedRow).toBeVisible();
  await expect(page.getByRole("link", { name: "Operate efficiently", exact: true }).locator("xpath=ancestor::li[1]")).toContainText("A brand new KPI");

  // Delete it.
  await movedRow.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByRole("link", { name: "A brand new KPI", exact: true })).toHaveCount(0);
});

test("depth is capped at five levels — a sixth level is refused", async ({ page }) => {
  await page.goto("/manage/hierarchy");

  // SG2.6 -> SG2.6.1 -> SG2.6.1.1 -> SG2.6.1.1.1 is already four levels deep
  // in the seed; adding a child to the deepest leaf would make six.
  await rowFor(page, "Depots converted").getByRole("button", { name: "+ sub", exact: true }).click();
  await page.getByPlaceholder("Code").fill("SG2.6.1.1.1.1");
  await page.getByPlaceholder("Name").fill("Too deep");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText(/limited to 5 levels/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Too deep", exact: true })).toHaveCount(0);
});
