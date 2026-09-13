// Exercises the in-app hierarchy editor: creating, moving and deleting KPIs
// without needing to import a spreadsheet, and — via the Edit panel — setting
// every other attribute (metric, targets, departments) without leaving the page.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { MEMBER_USERNAME, PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// The tree is nested `<li>`s, so a row can't be scoped by its text — every
// ancestor row contains its descendants' text, and an `<li>` contains its
// whole subtree. Each row's controls instead carry the KPI's name in their
// accessible name ("Delete Grow the business"), which names one button on
// the page exactly.

test("a KPI can be created, moved and deleted entirely in the app", async ({ page }) => {
  await page.goto("/manage/hierarchy");
  await expect(page.getByRole("heading", { name: "Hierarchy" })).toBeVisible();

  await page.getByRole("button", { name: "Add a sub-KPI under Grow the business" }).click();
  await page.getByPlaceholder("Code").fill("SG1.9");
  await page.getByPlaceholder("Name").fill("A brand new KPI");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("link", { name: "A brand new KPI", exact: true })).toBeVisible();

  // It shows up on the dashboard tree too, without any import.
  await page.goto("/kpis");
  await expect(page.getByText("A brand new KPI")).toBeVisible();

  // Move it under SG2.
  await page.goto("/manage/hierarchy");
  await page
    .getByRole("button", { name: "Move A brand new KPI under a different parent" })
    .click();
  await page
    .getByRole("combobox")
    .filter({ hasText: "Choose a new parent" })
    .selectOption({ label: "SG2 Operate efficiently" });

  // Confirm the move landed under SG2.
  await expect(
    page
      .getByRole("link", { name: "Operate efficiently", exact: true })
      .locator("xpath=ancestor::li[1]")
  ).toContainText("A brand new KPI");

  // Delete it.
  await page.getByRole("button", { name: "Delete A brand new KPI" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByRole("link", { name: "A brand new KPI", exact: true })).toHaveCount(0);
});

test("depth is capped at five levels — a sixth level is refused", async ({ page }) => {
  await page.goto("/manage/hierarchy");

  // SG2.6 -> SG2.6.1 -> SG2.6.1.1 -> SG2.6.1.1.1 is already four levels deep
  // in the seed; adding a child to the deepest leaf would make six.
  await page.getByRole("button", { name: "Add a sub-KPI under Depots converted" }).click();
  await page.getByPlaceholder("Code").fill("SG2.6.1.1.1.1");
  await page.getByPlaceholder("Name").fill("Too deep");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText(/limited to 5 levels/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Too deep", exact: true })).toHaveCount(0);
});

test.describe("the Edit panel — assigning attributes without leaving the page", () => {
  // Both tests below create a KPI that no other spec depends on; the reseed
  // (the same reset global-setup.ts uses before the whole suite) is simpler
  // and more reliable than restoring every field by hand through the UI.
  test.afterEach(() => {
    execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
  });

  test("a fast-added KPI can have its metric, targets and department set from the same page, and then scores correctly", async ({ page }) => {
    await page.goto("/manage/hierarchy");

    // Fast-add: code and name only, exactly as before this feature existed.
    await page.getByRole("button", { name: "Add a sub-KPI under Grow the business" }).click();
    await page.getByPlaceholder("Name").fill("Full suite test KPI");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const row = page.getByRole("link", { name: "Full suite test KPI", exact: true });
    await expect(row).toBeVisible();
    await page.keyboard.press("Escape"); // stop the continuous-add session

    // Open the Edit panel and give it a real definition.
    await page.getByRole("button", { name: "Edit Full suite test KPI" }).click();
    const panel = page.getByRole("dialog", { name: "Edit Full suite test KPI" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Loading…")).toHaveCount(0);

    await panel.getByLabel("Metric type").selectOption("PERCENTAGE");
    await panel.getByLabel("Direction").selectOption("HIGHER_BETTER");
    await panel.getByLabel("Target mode").selectOption("FIXED");
    const targets: [string, string][] = [
      ["Poor", "10"], ["Improvement Needed", "20"], ["Meet", "30"],
      ["Good", "40"], ["Very Good", "50"], ["Excellent", "60"],
    ];
    for (const [band, value] of targets) {
      // Anchored at the start: "Good" would otherwise also match "Very Good"'s row.
      await panel.getByRole("row", { name: new RegExp(`^${band}\\b`) }).getByRole("textbox").fill(value);
    }
    await panel.getByRole("button", { name: "Finance", exact: true }).click();
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel).toHaveCount(0);

    // The definition landed — check it from the KPI's own page.
    await row.click();
    await expect(page.getByRole("heading", { name: "Full suite test KPI" })).toBeVisible();
    await expect(page.getByLabel("Metric type")).toHaveValue("PERCENTAGE");
    await expect(page.getByLabel("Direction")).toHaveValue("HIGHER_BETTER");
    await expect(page.getByRole("button", { name: "Finance", exact: true })).toHaveAttribute("aria-pressed", "true");

    // And it scores from a real figure: 60 reaches the Excellent target.
    await page.goto(`/entry?period=${PERIOD}`);
    await page.getByLabel("Year-to-date value for Full suite test KPI").fill("60");
    await page.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();

    await page.goto(`/kpis?period=${PERIOD}`);
    await page.getByRole("link", { name: "Full suite test KPI" }).click();
    // The header's band label, next to the score chip — first, and the only
    // one visible without opening the score-vs-target chart or the targets table.
    await expect(page.getByText("Excellent", { exact: true }).first()).toBeVisible();
  });

  test("a rollup KPI's Edit panel has no metric or target fields", async ({ page }) => {
    await page.goto("/manage/hierarchy");
    await page.getByRole("button", { name: "Edit Grow the business" }).click();
    const panel = page.getByRole("dialog", { name: "Edit Grow the business" });
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Metric type")).toHaveCount(0);
    await expect(panel.getByText("Targets")).toHaveCount(0);
    // Weight and departments — the attributes a rollup does carry — still show.
    await expect(panel.getByLabel("Weight % (of its group)")).toBeVisible();
  });

  test("a member cannot reach the hierarchy page at all", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page, MEMBER_USERNAME);
    await page.goto("/manage/hierarchy");
    await expect(page).toHaveURL("/");
  });
});
