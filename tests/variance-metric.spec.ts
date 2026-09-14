// VARIANCE metrics score the symmetric %-deviation of an actual figure from a
// per-period target — +12% and -12% off target should land in the same band.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// This mutates "Days to close month-end books" (SG2.1), which other specs'
// hardcoded scores depend on — reseed afterwards, same as kpi-editing.spec.ts.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("a VARIANCE KPI scores +12% and -12% off target identically, and hides the fields it forces", async ({
  page,
}) => {
  await page.goto("/kpis");
  await page.getByRole("link", { name: "Days to close month-end books" }).click();
  await expect(page.getByRole("heading", { name: "Days to close month-end books" })).toBeVisible();

  await page.getByLabel("Metric type").selectOption("VARIANCE");

  // Direction, target mode and phasing are forced for VARIANCE and hidden —
  // the banner explaining that replaces them.
  await expect(page.getByText(/aren't asked for/)).toBeVisible();

  // Fill the six band windows by row order (Excellent through Poor) — the
  // table's own row text ("Good"/"Very Good") is ambiguous for a text-based
  // locator, so address rows positionally instead.
  const bandRows = page.locator("table", { hasText: "Value window" }).locator("tbody tr");
  await expect(bandRows).toHaveCount(6);
  const bandWindows = ["0-1", "2-4", "5-9", "10-15", "20-29", "30-999"];
  for (let i = 0; i < bandWindows.length; i++) {
    await bandRows.nth(i).locator("input").fill(bandWindows[i]);
  }

  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Metric type")).toHaveValue("VARIANCE");

  // Report an actual 12% above target for one month, and 12% below for
  // another — both should land in the same band (Meet, per the 10-15 window).
  await page.getByLabel("Actual value").fill("112");
  await page.getByLabel("Target value").fill("100");
  await expect(page.getByText("Variance: 12.0%")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText(/^3\.2$/).first()).toBeVisible();
  await expect(page.getByText("Meet", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Reporting month").selectOption({ label: "Jul 2026" });
  await expect(page.getByRole("heading", { name: "Days to close month-end books" })).toBeVisible();
  await page.getByLabel("Actual value").fill("88");
  await page.getByLabel("Target value").fill("100");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText(/^3\.2$/).first()).toBeVisible();
  await expect(page.getByText("Meet", { exact: true }).first()).toBeVisible();

  // The Score Explainer narrates the variance math, not the raw figures
  // plugged directly into the %-window (which would be misleading).
  await page.getByText("How was this score calculated?").click();
  await expect(page.getByText(/Variance = \|/)).toBeVisible();
});
