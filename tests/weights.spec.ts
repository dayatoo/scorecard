// Exercises the per-parent weights page — colored balance links on the
// Hierarchy page, editing a group's weights in both percentage and ratio
// mode, the equal-split helpers, and the single-child special case.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { MEMBER_USERNAME, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// Both tests below rewrite real weights; the reseed (the same reset
// global-setup.ts uses before the whole suite) is simpler and more reliable
// than restoring every field by hand through the UI.
test.afterEach(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("a group's weights can be edited in percentage and ratio mode, with equal-split helpers", async ({ page }) => {
  await page.goto("/manage/hierarchy");

  // The colored "totals to" line is a link straight into that group's editor.
  const balanceLink = page.getByRole("link", { name: /Operate efficiently totals to/ });
  await expect(balanceLink).toHaveClass(/text-emerald-700/); // SG2's children already sum to 100 in the seed
  await balanceLink.click();
  await expect(page.getByRole("heading", { name: "Edit weights" })).toBeVisible();

  // Equal split — all: every child gets the same share, balanced at 100%.
  await page.getByRole("button", { name: "Equal split — all" }).click();
  await expect(page.getByText(/Balanced — totals to 100\.00%/)).toBeVisible();

  // Clear one child's weight — the group is now under 100%, shown in amber.
  const lastWeight = page.getByLabel("Weight for Modernise field operations");
  await lastWeight.fill("");
  await expect(page.getByText(/left to assign/)).toBeVisible();

  // Equal split — remaining fills just the blank one back in.
  await page.getByRole("button", { name: "Equal split — remaining" }).click();
  await expect(page.getByText(/Balanced — totals to 100\.00%/)).toBeVisible();

  // Switch to ratio mode: equal percentages convert to an equal ratio (1 each).
  await page.getByRole("button", { name: "Ratio", exact: true }).click();
  const firstRatio = page.getByLabel("Weight for Days to close month-end books");
  await expect(firstRatio).toHaveValue("1");

  // Ratio mode always normalizes to 100% — raising one child's ratio doesn't
  // unbalance the group, it just shifts the derived percentages.
  await firstRatio.fill("2");
  await expect(page.getByText(/Balanced — totals to 100\.00%/)).toBeVisible();

  // Switching back to percentage bakes in those derived percentages.
  await page.getByRole("button", { name: "Percentage", exact: true }).click();
  await expect(firstRatio).toHaveValue("28.57");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Reflected back on the Hierarchy page.
  await page.goto("/manage/hierarchy");
  await expect(page.getByRole("link", { name: /Operate efficiently totals to/ })).toHaveClass(/text-emerald-700/);
});

test("a group with a single child shows a fixed 100% and no input", async ({ page }) => {
  await page.goto("/manage/hierarchy");
  await page.getByRole("link", { name: /Modernise field operations totals to/ }).click();
  await expect(page.getByText("100% (only child)")).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  // No mode toggle or equal-split controls either — nothing to divide.
  await expect(page.getByRole("button", { name: "Equal split — all" })).toHaveCount(0);
});

test("the weights index page lists every group, and a member can't reach any of it", async ({ page }) => {
  await page.goto("/manage/hierarchy/weights");
  await expect(page.getByRole("heading", { name: "Weights" })).toBeVisible();
  // Anchored: "Grow the business" is also a sub-group's breadcrumb, e.g. on "Revenue"'s row.
  await expect(page.getByRole("link", { name: /^Grow the business/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Strategic Goals/ })).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, MEMBER_USERNAME);
  await page.goto("/manage/hierarchy/weights");
  await expect(page).toHaveURL("/");
});
