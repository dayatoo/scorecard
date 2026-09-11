import { expect, type Page } from "@playwright/test";

/** The sample data runs April–August 2026, so tests pin the month. */
export const PERIOD = "2026-08";

export const PASSWORD = process.env.APP_PASSWORD ?? "dev-password";

/**
 * Signs in and waits for the redirect to land. Navigating before the session
 * cookie is set bounces straight back to /login, which is a confusing way for
 * an unrelated assertion to fail.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}
