// Exercises full attribute editing on the KPI detail page — metric type,
// target mode and direction were previously read-only after creation.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// The second test below clears figures permanently, which would otherwise
// leave the shared database in a state other specs' hardcoded score and
// coverage assertions don't expect if this file runs before them. Reseeding
// afterwards (the same reset global-setup.ts uses before the whole suite)
// is simpler and more reliable than trying to restore every field by hand
// through the UI.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("a KPI's metric type can be changed in place, something the app could not do before", async ({ page }) => {
  await page.goto("/kpis");
  await page.getByRole("link", { name: /New customer revenue/ }).click();
  await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();

  // Starts as DOLLAR. Direction is left alone — flipping it too would need
  // the band targets re-ordered, a separate edit from what this checks.
  await page.getByLabel("Metric type").selectOption("QUANTITY");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Scores for every month of the year are recalculated")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and save" }).click();

  await expect(page.getByText("Metric and targets")).toBeVisible();
  // The definition panel reflects the new value after the page refreshes.
  await expect(page.getByLabel("Metric type")).toHaveValue("QUANTITY");
});

test("switching between a numeric metric and month-completion requires clearing figures", async ({ page }) => {
  // A KPI no other spec's entry-grid or dashboard assertions depend on —
  // this test clears its figures permanently (cleaned up by the reseed above).
  await page.goto("/kpis");
  await page.getByRole("link", { name: /Publish the annual report/ }).click();
  await expect(page.getByRole("heading", { name: "Publish the annual report" })).toBeVisible();

  await page.getByLabel("Metric type").selectOption("MONTH_COMPLETION");
  await page.getByLabel("Target month (Meet)").fill("10/2026");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();

  // Refused — figures are recorded and the clear-figures box wasn't ticked.
  // The dialog stays open on a failed save, so back out of it first.
  await expect(page.getByText(/cannot be read the new way/).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Tick the box and it goes through, clearing the figures in the same save.
  await page.getByLabel(/Switching between/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Metric type")).toHaveValue("MONTH_COMPLETION");
});
