import { execFileSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";

/** The sample data runs April–August 2026, so tests pin the month. */
export const PERIOD = "2026-08";

/** Seeded by prisma/seed.ts, rerun before the suite by global-setup.ts. */
export const ADMIN_USERNAME = "admin";
export const MEMBER_USERNAME = "finance.member";
export const SEED_PASSWORD = "password123";

/**
 * Signs in and waits for the redirect to land. Navigating before the session
 * cookie is set bounces straight back to /login, which is a confusing way for
 * an unrelated assertion to fail.
 */
export async function signIn(
  page: Page,
  username: string = ADMIN_USERNAME,
  password: string = SEED_PASSWORD
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

/**
 * Deletes a fiscal year on the Manage page through the confirmation dialog
 * (own username, own password, the typed phrase), then purges it outright —
 * deleting now only moves a year into 30-day holding, but most specs that
 * create a scratch year still expect it fully gone afterwards so its
 * starting year is free for the next run of the suite. Call this with the
 * row already visible on /manage.
 */
export async function deleteFiscalYearHard(
  page: Page,
  label: string,
  startYear: number
): Promise<void> {
  const row = page.getByRole("listitem").filter({ hasText: label });
  await row.getByRole("button", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Your username").fill(ADMIN_USERNAME);
  await dialog.getByLabel("Your password").fill(SEED_PASSWORD);
  await dialog.getByLabel(/Type.*to confirm/).fill(`confirm delete ${label} scorecard`);
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(row).not.toBeVisible();
  execFileSync("npx", ["tsx", "scripts/purge-fiscal-year.ts", String(startYear)], { stdio: "inherit" });
}
