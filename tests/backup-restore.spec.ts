// Exercises the recovery path: saving a checkpoint, restoring from it,
// downloading a backup file and uploading it back.
//
// Everything runs against a scratch fiscal year created by the test itself,
// so no other spec's figures are disturbed by a restore.
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { MEMBER_USERNAME, signIn } from "./helpers";

/** Creates a scratch year copied from the seeded one, and returns its id. */
async function createScratchYear(page: Page, startYear: number): Promise<string> {
  await page.goto("/manage");
  await page.getByLabel("Starting year").fill(String(startYear));
  await page.getByLabel("Copy KPIs from").selectOption({ label: "FY2026/27" });
  await page.getByRole("button", { name: "Create year" }).click();

  const label = `FY${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
  const row = page.getByRole("listitem").filter({ hasText: label });
  await expect(row).toBeVisible();

  const href = await row.getByRole("link", { name: "Open" }).getAttribute("href");
  const id = new URLSearchParams(href?.split("?")[1]).get("fy");
  expect(id).toBeTruthy();
  return id as string;
}

async function deleteYear(page: Page, label: string): Promise<void> {
  await page.goto("/manage");
  const row = page.getByRole("listitem").filter({ hasText: label });
  if (!(await row.isVisible())) return;
  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(row).not.toBeVisible();
}

test("a checkpoint restores a year to how it was", async ({ page }) => {
  await signIn(page);
  const startYear = 2031;
  const label = "FY2031/32";
  const fyId = await createScratchYear(page, startYear);

  try {
    // Save a restore point of the freshly copied year.
    await page.goto(`/manage/backups?fy=${fyId}`);
    await page.getByLabel("Name").fill("Known-good baseline");
    await page.getByRole("button", { name: "Save checkpoint" }).click();

    const checkpoint = page.getByRole("listitem").filter({ hasText: "Known-good baseline" });
    await expect(checkpoint).toBeVisible();
    await expect(checkpoint).toContainText("15 KPIs");

    // Wreck it: delete a whole Strategic Goal from the hierarchy.
    await page.goto(`/manage/hierarchy?fy=${fyId}`);
    await page.getByRole("button", { name: "Delete Operate efficiently" }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    // exact: true — the group's colored "totals to" balance link also carries this name.
    await expect(page.getByRole("link", { name: "Operate efficiently", exact: true })).not.toBeVisible();

    // Put it back.
    await page.goto(`/manage/backups?fy=${fyId}`);
    await checkpoint.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByRole("dialog")).toContainText("Known-good baseline");
    await expect(page.getByRole("dialog")).toContainText(
      "A checkpoint of the current state is saved first"
    );
    await page.getByRole("button", { name: "Confirm and save" }).click();

    await expect(page.getByText(/Restored FY2031\/32/)).toBeVisible();

    await page.goto(`/manage/hierarchy?fy=${fyId}`);
    await expect(page.getByRole("link", { name: "Operate efficiently", exact: true })).toBeVisible();

    // The restore itself left an automatic checkpoint behind, so it is undoable.
    await page.goto(`/manage/backups?fy=${fyId}`);
    await expect(page.getByText("auto").first()).toBeVisible();
  } finally {
    await deleteYear(page, label);
  }
});

test("a downloaded backup file can be uploaded to build a new year", async ({ page }) => {
  await signIn(page);
  const startYear = 2032;
  const sourceLabel = "FY2032/33";
  const restoredLabel = "FY2033/34";
  const fyId = await createScratchYear(page, startYear);

  try {
    await page.goto(`/manage/backups?fy=${fyId}`);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: /Download FY2032\/33 as it is now/ }).click();
    const file = await downloadPromise;
    const path = await file.path();
    expect(path).toBeTruthy();

    const parsed = JSON.parse(readFileSync(path as string, "utf8"));
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.kpis.length).toBe(15);
    // A backup is never a credential store.
    expect(JSON.stringify(parsed)).not.toContain("passwordHash");

    // Upload it back as a brand-new year, leaving the source untouched.
    await page.getByRole("radio", { name: /As a new fiscal year/ }).check();
    await page.getByLabel("New year starts").fill("2033");
    await page.getByLabel("Backup file").setInputFiles(path as string);
    await page.getByRole("button", { name: "Check this file" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Nothing already in the app changes");
    await page.getByRole("button", { name: "Confirm and save" }).click();

    await expect(page.getByText(/Restored FY2033\/34/)).toBeVisible();

    // Both years now exist, with the same scorecard.
    await page.goto("/manage");
    await expect(page.getByRole("listitem").filter({ hasText: sourceLabel })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: restoredLabel })).toBeVisible();
  } finally {
    await deleteYear(page, restoredLabel);
    await deleteYear(page, sourceLabel);
  }
});

test("a member cannot reach checkpoints or download a backup", async ({ page }) => {
  await signIn(page, MEMBER_USERNAME);

  // The admin-only page bounces a member back to the dashboard.
  await page.goto("/manage/backups");
  await expect(page).toHaveURL("/");

  const response = await page.request.get("/api/backup?fy=does-not-matter");
  expect(response.status()).toBe(403);
});
