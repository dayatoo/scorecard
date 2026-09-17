// The Simulate page: live "what if" scoring that recomputes entirely in the
// browser and never writes anything back.
import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("editing a simulated value updates every score live, and nothing is saved", async ({ page }) => {
  await page.goto(`/?period=${PERIOD}`);
  const realTotal = await page.locator("section", { hasText: "Total score" }).locator(".font-heading").innerText();

  await page.goto(`/simulate?period=${PERIOD}`);
  await expect(page.getByText("Simulation only")).toBeVisible();

  // Starts equal to the real dashboard total — nothing simulated yet.
  const heroScore = page.locator("section", { hasText: "Total score" }).locator(".font-heading");
  await expect(heroScore).toHaveText(realTotal);

  const input = page.getByLabel("Simulated actual value for New customer revenue");
  const row = page.locator("tr", { has: input });
  const scoreCellBefore = await row.locator("td").last().innerText();

  // Seeded well below its Poor threshold (2,000,000) — pushing it to its
  // Excellent target (4,500,000) should move both the row and the hero.
  await input.fill("4500000");

  await expect(heroScore).not.toHaveText(realTotal);
  await expect(row.locator("td").last()).not.toHaveText(scoreCellBefore);
  await expect(page.getByRole("button", { name: "Reset simulation" })).toBeVisible();

  // Resetting restores the original figure and score.
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(input).toHaveValue("1800000");
  await expect(heroScore).toHaveText(realTotal);

  // The real dashboard is untouched by any of this.
  await page.goto(`/?period=${PERIOD}`);
  const totalAfter = await page.locator("section", { hasText: "Total score" }).locator(".font-heading").innerText();
  expect(totalAfter).toBe(realTotal);
});

test("an unreported month starts from the latest actual on file, not blank", async ({ page }) => {
  // September has no entries in the seed — the last reported month is August.
  await page.goto("/simulate?period=2026-09");

  const input = page.getByLabel("Simulated actual value for New customer revenue");
  await expect(input).toHaveValue("1800000"); // August's own figure, carried forward
  const row = page.locator("tr", { has: input });
  await expect(row).toContainText("not yet reported — starting from Aug 2026");

  // Carried-forward figures already score, with no reset button offered —
  // nothing has been touched yet.
  await expect(row.locator("td").last()).not.toHaveText("—");
  await expect(page.getByRole("button", { name: "Reset simulation" })).toHaveCount(0);
});

test("the grid can be sorted by weight or by due date", async ({ page }) => {
  await page.goto(`/simulate?period=${PERIOD}`);

  const weightColumn = () => page.locator("tbody tr td:nth-child(2)").allInnerTexts();
  const parseWeight = (cells: string[]) => cells.map((c) => (c === "—" ? -Infinity : parseFloat(c)));

  // Default order is by code — clicking Weight switches to weight descending.
  await page.getByRole("button", { name: "Weight" }).click();
  let weights = parseWeight(await weightColumn());
  expect(weights).toEqual([...weights].sort((a, b) => b - a));

  // Clicking again toggles to ascending.
  await page.getByRole("button", { name: "Weight" }).click();
  weights = parseWeight(await weightColumn());
  expect(weights).toEqual([...weights].sort((a, b) => a - b));

  // Due date: undated rows always sort last, whichever direction is active.
  const dueColumn = () => page.locator("tbody tr td:nth-child(3)").allInnerTexts();
  await page.getByRole("button", { name: "Due" }).click();
  let due = await dueColumn();
  const firstDash = due.indexOf("—");
  if (firstDash !== -1) expect(due.slice(firstDash).every((d) => d === "—")).toBe(true);

  await page.getByRole("button", { name: "Due" }).click();
  due = await dueColumn();
  const firstDash2 = due.indexOf("—");
  if (firstDash2 !== -1) expect(due.slice(firstDash2).every((d) => d === "—")).toBe(true);
});
