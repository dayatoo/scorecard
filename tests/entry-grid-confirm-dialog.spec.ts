// The Enter Data confirm dialog used to collapse every changed field for a
// row into one opaque line ("actual 112, target 100, note: ..."), undercounting
// "N field(s) will be updated" and reading as if only one field changed even
// when several did. This covers the fix: one line per changed field, correctly
// counted, for a VARIANCE KPI where actual+target+basis+note change together.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// This converts "Days to close month-end books" (SG2.1) to VARIANCE, same as
// variance-metric.spec.ts — reseed afterwards so other specs' hardcoded
// scores for it aren't left disturbed.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("the Enter Data confirm dialog lists each changed field separately, not combined into one", async ({
  page,
}) => {
  await page.goto("/kpis");
  await page.getByRole("link", { name: "Days to close month-end books" }).click();
  await expect(page.getByRole("heading", { name: "Days to close month-end books" })).toBeVisible();

  await page.getByLabel("Metric type").selectOption("VARIANCE");
  const bandRows = page.locator("table", { hasText: "Value window" }).locator("tbody tr");
  await expect(bandRows).toHaveCount(6);
  const bandWindows = ["0-1", "2-4", "5-9", "10-15", "20-29", "30-999"];
  for (let i = 0; i < bandWindows.length; i++) {
    await bandRows.nth(i).locator("input").fill(bandWindows[i]);
  }
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Metric type")).toHaveValue("VARIANCE");
  // The dialog is definitely gone and the settings commit has landed before
  // navigating away — otherwise /entry can read a stale, pre-VARIANCE row.
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.waitForTimeout(1500);

  await page.goto(`/entry?period=${PERIOD}`);
  await page.getByLabel("Actual value for Days to close month-end books").fill("112");
  await page.getByLabel("Target value for Days to close month-end books").fill("100");
  await page.getByLabel("Basis for Days to close month-end books").selectOption("ESTIMATE");
  await page.getByLabel("Note for Days to close month-end books").fill("Delayed by audit review");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Four separate fields changed — the dialog says so and lists each one.
  await expect(dialog.getByText("4 fields will be updated.")).toBeVisible();
  await expect(dialog.getByText(/Reported value/)).toBeVisible();
  await expect(dialog.getByText(/Target value/)).toBeVisible();
  await expect(dialog.getByText(/— Basis/)).toBeVisible();
  await expect(dialog.getByText(/— Note/)).toBeVisible();
  await expect(dialog.getByText("Estimate")).toBeVisible();
  await expect(dialog.getByText("Delayed by audit review")).toBeVisible();

  await dialog.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText("1 KPI with unsaved figures")).toBeHidden();
});
