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
