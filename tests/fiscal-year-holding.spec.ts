// Deleting a fiscal year now gates on a much harder confirmation (own
// username, own password, a typed phrase naming the year) and moves it into
// a 30-day recoverable "holding" state instead of deleting it outright. This
// covers: the confirmation rejecting a wrong username/password/phrase, a
// held year disappearing from every list, Restore undoing it, and the
// fiscal-year lifecycle events landing on the Change log page.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { ADMIN_USERNAME, SEED_PASSWORD, signIn } from "./helpers";

const YEAR = "2040";
const LABEL = "FY2040/41";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test.afterAll(() => {
  execFileSync("npx", ["tsx", "scripts/purge-fiscal-year.ts", YEAR], { stdio: "inherit" });
});

test("deleting a fiscal year requires the right username, password and typed phrase, then holds it for 30 days", async ({
  page,
}) => {
  await page.goto("/manage");
  await page.getByLabel("Starting year").fill(YEAR);
  await page.getByRole("button", { name: "Create year" }).click();
  const year = page.getByRole("listitem").filter({ hasText: LABEL });
  await expect(year).toBeVisible();

  await year.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Delete ${LABEL}?` })).toBeVisible();

  // Wrong username.
  await page.getByLabel("Your username").fill("not.the.admin");
  await page.getByLabel("Your password").fill(SEED_PASSWORD);
  await page.getByLabel(/Type.*to confirm/).fill(`confirm delete ${LABEL} scorecard`);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog.getByText("That isn't your username.")).toBeVisible();
  await expect(year).toBeVisible();

  // Right username, wrong password.
  await page.getByLabel("Your username").fill(ADMIN_USERNAME);
  await page.getByLabel("Your password").fill("wrong-password");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog.getByText("That password is not correct.")).toBeVisible();
  await expect(year).toBeVisible();

  // Right credentials, wrong typed phrase.
  await page.getByLabel("Your password").fill(SEED_PASSWORD);
  await page.getByLabel(/Type.*to confirm/).fill("delete it");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog.getByText(/Type ".*" exactly to confirm\./)).toBeVisible();
  await expect(year).toBeVisible();

  // Everything right: the year moves to holding and disappears from Manage.
  await page.getByLabel(/Type.*to confirm/).fill(`confirm delete ${LABEL} scorecard`);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: LABEL })).toHaveCount(0);

  // A held year no longer offers itself anywhere a fiscal year is picked.
  await page.goto("/manage/backups");
  await expect(page.locator("select").getByRole("option", { name: LABEL })).toHaveCount(0);

  await page.goto("/manage/holding");
  const held = page.getByRole("listitem").filter({ hasText: LABEL });
  await expect(held).toBeVisible();
  await expect(held).toContainText("held by admin");
  await expect(held).toContainText(/Expires in \d+ days?/);

  // Restore brings it back to Manage.
  await held.getByRole("button", { name: "Restore" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: LABEL })).toHaveCount(0);
  await page.goto("/manage");
  await expect(page.getByRole("listitem").filter({ hasText: LABEL })).toBeVisible();

  // The lifecycle is recorded on the Change log.
  await page.goto("/manage/change-log");
  await expect(page.getByText(`Moved to holding — ${LABEL}`)).toBeVisible();
  await expect(page.getByText(`Restored from holding — ${LABEL}`)).toBeVisible();
});
