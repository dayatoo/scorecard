// Covers the "Progress updates" panel (renamed from "Status updates", with a
// Simple/Detailed toggle per post) and the reusable Status attribute.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// This spec posts updates and sets a Status value on seeded KPIs — reseed so
// other specs' hardcoded assertions aren't affected by leftover data.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("Progress updates sits directly under Report, with no lingering \"Status updates\" text", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "New customer revenue" }).click();
  await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();

  await expect(page.getByText("Status updates")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Progress updates" })).toBeVisible();

  // The Report panel's heading and the Progress updates panel should be
  // adjacent, with nothing else (like Definition) between them.
  const headings = page.locator("h2");
  const texts = await headings.allTextContents();
  const reportIndex = texts.findIndex((t) => t.startsWith("Report for"));
  expect(texts[reportIndex + 1]).toBe("Progress updates");
});

test("posting a Simple update and a Detailed update on the same KPI renders each in its own format", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Existing customer revenue" }).click();
  await expect(page.getByRole("heading", { name: "Existing customer revenue" })).toBeVisible();

  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Progress updates" }) });

  // Detailed is the default mode; switch to Simple and post first.
  await panel.getByRole("button", { name: "Simple", exact: true }).click();
  await panel.getByPlaceholder("What has moved on this KPI?").fill("Renewals tracking to plan.");
  await panel.getByRole("button", { name: "Post update" }).click();
  await expect(panel.getByText("Renewals tracking to plan.")).toBeVisible();
  await expect(panel.getByText("Simple", { exact: true }).first()).toBeVisible();

  // Switch to Detailed and post a second update.
  await panel.getByRole("button", { name: "Detailed", exact: true }).click();
  await panel.getByLabel("Current progress").fill("Renewed 3 of 5 top accounts.");
  await panel.getByLabel("Next progress").fill("Close the remaining 2 by month end.");
  await panel.getByRole("button", { name: "Post update" }).click();

  const history = panel.locator("ul").last();
  await expect(history.getByText("Current progress", { exact: true })).toBeVisible();
  await expect(history.getByText("Renewed 3 of 5 top accounts.")).toBeVisible();
  await expect(history.getByText("Next progress", { exact: true })).toBeVisible();
  await expect(history.getByText("Close the remaining 2 by month end.")).toBeVisible();
  // Time/Cost and Issues were left blank on this post, so they don't render
  // in its history entry (the compose form's own labels are unaffected).
  await expect(history.getByText("Time/Cost", { exact: true })).toHaveCount(0);
  await expect(history.getByText("Issues", { exact: true })).toHaveCount(0);
  await expect(history.getByText("Detailed", { exact: true }).first()).toBeVisible();

  // Both updates remain in the history, newest first.
  await expect(panel.getByText("Renewals tracking to plan.")).toBeVisible();
});

test("a new Status value is saved for reuse as a suggestion on other KPIs", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Customer satisfaction" }).click();
  await expect(page.getByRole("heading", { name: "Customer satisfaction" })).toBeVisible();

  const statusInput = page.locator('input[list="kpi-status-options"]');
  await statusInput.fill("On track");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(statusInput).toHaveValue("On track");

  // A different KPI's Status field now suggests the same value.
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Days to close month-end books" }).click();
  await expect(page.getByRole("heading", { name: "Days to close month-end books" })).toBeVisible();

  const options = await page.locator("#kpi-status-options option").evaluateAll((els) =>
    els.map((el) => el.getAttribute("value"))
  );
  expect(options).toContain("On track");
});
