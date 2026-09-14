// The "Show all bands" toggle on /kpis, the Dashboard's ScoreTree, and a KPI
// detail page's "How this score is made up" table — each swaps a single
// Meet Target column for one column per band (Poor..Excellent).
import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("the /kpis master list expands to all 6 bands and back", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);

  await expect(page.getByRole("columnheader", { name: "Meet Target" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Poor" })).toHaveCount(0);

  await page.getByRole("button", { name: "Show all bands" }).click();

  await expect(page.getByRole("columnheader", { name: "Meet Target" })).toHaveCount(0);
  for (const label of ["Poor", "Improvement Needed", "Meet", "Good", "Very Good", "Excellent"]) {
    await expect(page.getByRole("columnheader", { name: label, exact: true })).toBeVisible();
  }

  const row = page.getByRole("row", { name: /Customer satisfaction/ });
  await expect(row.getByRole("cell", { name: "0–49%" })).toBeVisible();
  await expect(row.getByRole("cell", { name: "96–100%" })).toBeVisible();

  await page.getByRole("button", { name: "Hide bands" }).click();
  await expect(page.getByRole("columnheader", { name: "Meet Target" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Poor" })).toHaveCount(0);
});

test("a milestone KPI shows its target month only under Meet when bands are expanded", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("button", { name: "Show all bands" }).click();

  const row = page.getByRole("row", { name: /Complete ERP rollout/ });
  const cells = await row.getByRole("cell").allInnerTexts();
  // Poor, Improvement Needed, Good, Very Good, Excellent are blank; only
  // Meet (the 3rd band column, after Weight) carries the target month.
  expect(cells.filter((c) => c.includes("Oct 2026")).length).toBe(1);
});

test("the dashboard's Scorecard table has an independent bands toggle from its row Expand all", async ({ page }) => {
  await page.goto(`/?period=${PERIOD}`);

  const table = page.locator("div", { has: page.getByRole("heading", { name: "Scorecard" }) }).first();
  await expect(table.getByRole("columnheader", { name: "Meet Target" })).toBeVisible();

  await table.getByRole("button", { name: "Show all bands" }).click();
  await expect(table.getByRole("columnheader", { name: "Meet Target" })).toHaveCount(0);
  await expect(table.getByRole("columnheader", { name: "Excellent" })).toBeVisible();

  // The row-visibility "Expand all" toggle still works independently.
  await table.getByRole("button", { name: "Expand all" }).click();
  await expect(table.getByRole("columnheader", { name: "Excellent" })).toBeVisible();
});

test("a KPI detail page's sub-KPI table expands to all 6 bands", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("button", { name: "By level" }).click();
  await page.getByRole("rowheader", { name: "Grow the business" }).getByRole("link").click();

  const panel = page.locator("section", { has: page.getByRole("heading", { name: "How this score is made up" }) });
  await expect(panel.getByRole("columnheader", { name: "Meet Target" })).toBeVisible();

  await panel.getByRole("button", { name: "Show all bands" }).click();
  await expect(panel.getByRole("columnheader", { name: "Meet Target" })).toHaveCount(0);

  const csatRow = panel.getByRole("row", { name: /Customer satisfaction/ });
  await expect(csatRow.getByRole("cell", { name: "0–49%" })).toBeVisible();
});
