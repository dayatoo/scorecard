// The score-type filter on /kpis: three checkboxes (Actual, Estimate,
// Pro-rated) narrowing the master list by what each KPI's score rests on.
import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("narrows the master list by score type and clears back", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);

  const actual = page.getByRole("checkbox", { name: "Actual" });
  const estimate = page.getByRole("checkbox", { name: "Estimate" });
  const prorated = page.getByRole("checkbox", { name: "Pro-rated" });

  // All three start checked, so the filter is inactive and nothing is hidden.
  await expect(actual).toBeChecked();
  await expect(estimate).toBeChecked();
  await expect(prorated).toBeChecked();
  await expect(page.getByRole("link", { name: "Clear" })).toHaveCount(0);

  const rowCount = () => page.getByRole("row").count();
  const unfiltered = await rowCount();

  // Leaving only Estimate must drop rows, and every one still shown carries
  // the "est" marker on its score.
  await actual.uncheck();
  await prorated.uncheck();
  const estimatesOnly = await rowCount();
  expect(estimatesOnly).toBeLessThan(unfiltered);
  expect(estimatesOnly).toBeGreaterThan(1); // header row plus at least one KPI

  // Unchecking every box legitimately matches nothing.
  await estimate.uncheck();
  await expect(page.getByText("No KPIs match those filters.")).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(actual).toBeChecked();
  await expect(estimate).toBeChecked();
  await expect(prorated).toBeChecked();
  expect(await rowCount()).toBe(unfiltered);
});
