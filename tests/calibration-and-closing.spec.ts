// Exercises score calibration and the end-of-year close/reopen cycle added
// to give a fiscal year a genuine "done" state.
import { expect, test } from "@playwright/test";

import { MEMBER_USERNAME, PERIOD, signIn } from "./helpers";

test.describe("score calibration", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("admin can calibrate a leaf's score, see it flagged, and clear it again", async ({ page }) => {
    await page.goto(`/kpis?period=${PERIOD}`);
    await page.getByRole("link", { name: "New customer revenue" }).first().click();
    await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();

    await page.getByRole("button", { name: "Calibrate score" }).click();
    await page.getByLabel("Calibrated score (0–5)").fill("5");
    await page
      .getByLabel("Reason")
      .fill("Board-approved adjustment for a documented one-off event.");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTitle(/manually calibrated by an admin/)).toBeVisible();
    await expect(page.getByText("Score calibrated for 2026-08")).toBeVisible();

    await page.getByText("How was this score calculated?").click();
    await expect(page.getByText("An admin calibrated this score to")).toBeVisible();
    await expect(
      page.getByText(/Board-approved adjustment for a documented one-off event\./).first()
    ).toBeVisible();

    // Clean up so the plain computed score is what every other spec sees.
    await page.getByRole("button", { name: "Edit calibration" }).click();
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByTitle(/manually calibrated by an admin/)).not.toBeVisible();
    await expect(page.getByText("Score calibration removed for 2026-08")).toBeVisible();
  });

  test("a member cannot calibrate — the control isn't offered", async ({ page }) => {
    await page.goto("/login");
    await page.context().clearCookies();
    await signIn(page, MEMBER_USERNAME);

    await page.goto(`/kpis?period=${PERIOD}`);
    await page.getByRole("link", { name: "New customer revenue" }).first().click();
    await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Calibrate score/ })).not.toBeVisible();
  });
});

test.describe("closing and reopening a fiscal year", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("closing locks every write on that year; reopening restores them", async ({ page }) => {
    await page.goto("/manage");

    // A fresh year, copied from the active one so it has a real hierarchy to
    // lock, but no recorded figures — closing/reopening this one can't
    // disturb any other spec's assertions about the seeded year.
    await page.getByLabel("Copy KPIs from").selectOption({ label: "FY2026/27" });
    await page.getByRole("button", { name: "Create year" }).click();

    const row = page.getByRole("listitem").filter({ hasText: "FY2027/28" });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Close year" }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await expect(row.getByText("Closed", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Reopen" })).toBeVisible();

    const fyId = await row.getByRole("link", { name: "Open" }).getAttribute("href");
    const newFiscalYearId = new URLSearchParams(fyId?.split("?")[1]).get("fy");
    expect(newFiscalYearId).toBeTruthy();

    // Dashboard shows the closed indicator.
    await page.goto(`/?fy=${newFiscalYearId}`);
    await expect(page.getByText("Closed", { exact: true })).toBeVisible();

    // Entry grid is fully read-only with the closed-year banner.
    await page.goto(`/entry?fy=${newFiscalYearId}`);
    await expect(
      page.getByText("This year is closed. An admin can reopen it to make changes.")
    ).toBeVisible();
    await expect(
      page.getByLabel("Year-to-date value for New customer revenue")
    ).toBeDisabled();

    // The hierarchy editor hides every mutating control for a closed year.
    await page.goto(`/manage/hierarchy?fy=${newFiscalYearId}`);
    await expect(
      page.getByText("This year is closed. An admin can reopen it to make changes.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Strategic Goal" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).not.toBeVisible();

    // A KPI page in this year is read-only for everyone, admins included.
    await page.getByRole("link", { name: "New customer revenue" }).first().click();
    await expect(
      page.getByText("This year is closed. An admin can reopen it to make changes.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Calibrate score/ })).not.toBeVisible();

    // Reopen it.
    await page.goto("/manage");
    await row.getByRole("button", { name: "Reopen" }).click();
    const reopenDialog = page.getByRole("dialog");
    await reopenDialog.getByLabel("Reason").fill("Correcting a figure the board flagged after close.");
    await reopenDialog.getByRole("button", { name: "Reopen" }).click();
    await expect(row.getByText("Closed", { exact: true })).not.toBeVisible();
    await expect(row.getByRole("button", { name: "Close year" })).toBeVisible();

    // Edits work again.
    await page.goto(`/manage/hierarchy?fy=${newFiscalYearId}`);
    await expect(page.getByRole("button", { name: "+ Strategic Goal" })).toBeVisible();

    // Clean up the scratch year so it doesn't linger for other specs.
    await page.goto("/manage");
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await expect(row).not.toBeVisible();
  });
});
