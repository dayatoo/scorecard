// Covers the "Achievement change log" panel: every write to a KPI's reported
// figures appends an entry, even a same-month correction, showing who made
// the change (username + company ID) and when (in Brunei time).
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// This mutates "New customer revenue"'s reported value — reseed afterwards,
// same as the other specs that write KPI values.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("a same-month correction appends a second change-log entry instead of replacing the first", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "New customer revenue" }).click();
  await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();

  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Achievement change log" }) });
  await expect(panel).toHaveCount(0);

  await page.getByLabel("Year-to-date value (BND)").fill("111");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Year-to-date value (BND)")).toHaveValue("111");

  await page.getByLabel("Year-to-date value (BND)").fill("222");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Year-to-date value (BND)")).toHaveValue("222");

  await expect(panel).toHaveCount(1);
  const entries = panel.locator("ul > li");
  await expect(entries).toHaveCount(2);

  // Newest entry first: the second edit (→ 222) precedes the first (→ 111).
  await expect(entries.nth(0).getByText("111")).toBeVisible();
  await expect(entries.nth(0).getByText("222")).toBeVisible();
  await expect(entries.nth(1).getByText("222")).toHaveCount(0);

  // Each entry names the author (username + company ID) and a Brunei-time stamp.
  await expect(entries.nth(0).getByText("admin (EMP-0001)")).toBeVisible();
  await expect(entries.nth(0).getByText(/Brunei time/)).toBeVisible();
});
