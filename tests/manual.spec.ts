// Smoke-tests the /manual help page: it renders, the nav link reaches it,
// and the Admin tools section is gated to admin accounts.
import { expect, test } from "@playwright/test";

import { ADMIN_USERNAME, MEMBER_USERNAME, signIn } from "./helpers";

test("the nav link opens the manual", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Help" }).click();
  await expect(page).toHaveURL("/manual");
  await expect(page.getByRole("heading", { name: "User Manual" })).toBeVisible();
});

test("admin tools section is shown to admins and hidden from members", async ({ page }) => {
  await signIn(page, ADMIN_USERNAME);
  await page.goto("/manual");
  await expect(page.getByRole("heading", { name: "Admin tools" })).toBeVisible();

  await signIn(page, MEMBER_USERNAME);
  await page.goto("/manual");
  await expect(page.getByRole("heading", { name: "Admin tools" })).toHaveCount(0);
});
