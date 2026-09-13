// Exercises the in-app hierarchy editor: creating, moving and deleting KPIs
// without needing to import a spreadsheet.
import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// The tree is nested `<li>`s, so a row can't be scoped by its text — every
// ancestor row contains its descendants' text, and an `<li>` contains its
// whole subtree. Each row's controls instead carry the KPI's name in their
// accessible name ("Delete Grow the business"), which names one button on
// the page exactly.

test("a KPI can be created, moved and deleted entirely in the app", async ({ page }) => {
  await page.goto("/manage/hierarchy");
  await expect(page.getByRole("heading", { name: "Hierarchy" })).toBeVisible();

  await page.getByRole("button", { name: "Add a sub-KPI under Grow the business" }).click();
  await page.getByPlaceholder("Code").fill("SG1.9");
  await page.getByPlaceholder("Name").fill("A brand new KPI");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("link", { name: "A brand new KPI", exact: true })).toBeVisible();

  // It shows up on the dashboard tree too, without any import.
  await page.goto("/kpis");
  await expect(page.getByText("A brand new KPI")).toBeVisible();

  // Move it under SG2.
  await page.goto("/manage/hierarchy");
  await page
    .getByRole("button", { name: "Move A brand new KPI under a different parent" })
    .click();
  await page
    .getByRole("combobox")
    .filter({ hasText: "Choose a new parent" })
    .selectOption({ label: "SG2 Operate efficiently" });

  // Confirm the move landed under SG2.
  await expect(
    page
      .getByRole("link", { name: "Operate efficiently", exact: true })
      .locator("xpath=ancestor::li[1]")
  ).toContainText("A brand new KPI");

  // Delete it.
  await page.getByRole("button", { name: "Delete A brand new KPI" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByRole("link", { name: "A brand new KPI", exact: true })).toHaveCount(0);
});

test("depth is capped at five levels — a sixth level is refused", async ({ page }) => {
  await page.goto("/manage/hierarchy");

  // SG2.6 -> SG2.6.1 -> SG2.6.1.1 -> SG2.6.1.1.1 is already four levels deep
  // in the seed; adding a child to the deepest leaf would make six.
  await page.getByRole("button", { name: "Add a sub-KPI under Depots converted" }).click();
  await page.getByPlaceholder("Code").fill("SG2.6.1.1.1.1");
  await page.getByPlaceholder("Name").fill("Too deep");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText(/limited to 5 levels/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Too deep", exact: true })).toHaveCount(0);
});
