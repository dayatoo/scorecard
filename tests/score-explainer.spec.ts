// Exercises the "How was this score calculated?" explainer added to the KPI
// detail page, across every scoring path the engine supports.
import { expect, test, type Page } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

async function openExplainer(page: Page, name: string | RegExp) {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name }).first().click();
  const summary = page.getByText("How was this score calculated?");
  await summary.click();
  return summary.locator("xpath=ancestor::details");
}

test("a fixed-numeric leaf below the Poor target shows the proportional-credit formula", async ({ page }) => {
  const panel = await openExplainer(page, "New customer revenue");
  await expect(panel).toContainText("Did not reach even the Poor target of 2,000,000 BND");
  await expect(panel).toContainText("2.4 × (1,800,000 ÷ 2,000,000) = 2.160");
  await expect(panel).toContainText("2.160 → 2.2");
});

test("a phased fixed-numeric leaf shows the pro-rated target derivation", async ({ page }) => {
  const panel = await openExplainer(page, "Existing customer revenue");
  await expect(panel).toContainText("41.7% of the annual target applies");
  await expect(panel).toContainText("Reached the Good target of 2,708,333.33 BND");
});

test("a range-numeric leaf shows the matched window and interpolation", async ({ page }) => {
  const panel = await openExplainer(page, "Voluntary staff turnover");
  await expect(panel).toContainText("Falls in the Meet window of 12–15.9 %");
  await expect(panel).toContainText("3.349 → 3.3");
});

test("a milestone not yet due explains why, with no formula", async ({ page }) => {
  const panel = await openExplainer(page, "Complete ERP rollout");
  await expect(panel).toContainText("hasn’t passed yet");
  await expect(panel).not.toContainText("Score =");
});

test("a leaf past its deadline shows the lateness cap applied to the raw score", async ({ page }) => {
  const panel = await openExplainer(page, "Sites migrated to the new platform");
  await expect(panel).toContainText("1 month late");
  await expect(panel).toContainText("Score = min(3.9, 2.9) = 2.9");
});

test("a leaf frozen at its deadline shows the raw score it would otherwise have gotten", async ({ page }) => {
  const panel = await openExplainer(page, "Publish the annual report");
  await expect(panel).toContainText("Score freezes at its deadline-month value");
  await expect(panel).toContainText("Score = 2.9");
});

test("a rollup KPI shows the weighted-average arithmetic and excludes unscored children", async ({ page }) => {
  const panel = await openExplainer(page, "Operate efficiently");
  await expect(panel).toContainText("SG2.1 — scored weight 30.0 × score 4.500 = 135.000");
  await expect(panel).toContainText("3.600 → 3.6");
  await expect(panel).toContainText("SG2.2");
  await expect(panel).toContainText("SG2.6");
  await expect(panel).toContainText("excluded entirely");
});
