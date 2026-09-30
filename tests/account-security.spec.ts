// Covers the account hardening: changing your own password signs out your
// other sessions, repeated wrong passwords lock sign-in until an admin
// resets the password, and progress updates are limited to a KPI's owning
// departments.
import { execFileSync } from "node:child_process";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { ADMIN_USERNAME, MEMBER_USERNAME, PERIOD, SEED_PASSWORD, signIn } from "./helpers";

// These tests change the member's password and leave failed sign-ins on
// record. Reseeding resets both, so later specs sign in as usual.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

/** A second, independent browser session (its own cookies). */
async function newSession(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  return context.newPage();
}

async function attemptSignIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function openKpi(page: Page, name: string) {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.locator("section", { has: page.getByRole("heading", { name: "Progress updates" }) });
}

test("members can post progress updates only on KPIs their department owns", async ({ page }) => {
  await signIn(page, MEMBER_USERNAME);

  // Owned by Sales and Operations, not Finance.
  const notOwned = await openKpi(page, "Existing customer revenue");
  await expect(notOwned.getByText("Only this KPI's owning departments can post progress updates.")).toBeVisible();
  await expect(notOwned.getByRole("button", { name: "Post update" })).toHaveCount(0);

  // Owned by Finance.
  const owned = await openKpi(page, "Days to close month-end books");
  await expect(owned.getByRole("button", { name: "Post update" })).toBeVisible();
});

test("changing your password keeps this session and signs out the others", async ({ page, browser }) => {
  const newPassword = "a-new-password-42";
  await signIn(page, MEMBER_USERNAME);
  const other = await newSession(browser);
  await signIn(other, MEMBER_USERNAME);

  await page.getByRole("link", { name: MEMBER_USERNAME }).click();
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  // Scoped to the form: Next.js keeps its own empty role="alert" route
  // announcer on every page.
  const form = page.locator("form", { has: page.getByLabel("Current password") });

  // Wrong current password.
  await page.getByLabel("Current password").fill("not-my-password");
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("alert")).toHaveText("Your current password is not correct.");

  // Confirmation doesn't match.
  await page.getByLabel("Current password").fill(SEED_PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(`${newPassword}x`);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("alert")).toHaveText("New passwords do not match.");

  // Everything right.
  await page.getByLabel("Current password").fill(SEED_PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password").fill(newPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(form.getByRole("status")).toHaveText("Password changed. You've been signed out everywhere else.");

  // This browser stays signed in; the other one is sent to sign in again.
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await other.goto("/");
  await expect(other).toHaveURL(/\/login/);

  // The old password no longer works and the new one does.
  await attemptSignIn(other, MEMBER_USERNAME, SEED_PASSWORD);
  await expect(other.getByText("That password is not correct.")).toBeVisible();
  await signIn(other, MEMBER_USERNAME, newPassword);
  await other.context().close();
});

test("repeated wrong passwords lock sign-in until an admin resets the password", async ({ page, browser }) => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });

  // A session the member already had open, to check the reset ends it.
  const earlier = await newSession(browser);
  await signIn(earlier, MEMBER_USERNAME);

  const member = await newSession(browser);
  for (let i = 0; i < 5; i++) {
    await attemptSignIn(member, MEMBER_USERNAME, `wrong-password-${i}`);
    await expect(member.getByText("That password is not correct.")).toBeVisible();
  }
  // Now even the right password is refused.
  await attemptSignIn(member, MEMBER_USERNAME, SEED_PASSWORD);
  await expect(member.getByText(/Too many failed sign-in attempts/)).toBeVisible();

  // An admin resets it and gets a one-time temporary password.
  await signIn(page, ADMIN_USERNAME);
  await page.goto("/manage/users");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("listitem")
    .filter({ hasText: MEMBER_USERNAME })
    .getByRole("button", { name: "Reset password" })
    .click();
  const temporary = page.getByTestId("temporary-password");
  await expect(temporary).toHaveText(/^[a-hjkmnp-zA-HJ-NP-Z2-9]{4}-[a-hjkmnp-zA-HJ-NP-Z2-9]{4}-[a-hjkmnp-zA-HJ-NP-Z2-9]{4}$/);
  const temporaryPassword = (await temporary.textContent())!.trim();

  // The reset clears the lockout, the temporary password works, and the
  // session that was open before the reset is signed out.
  await signIn(member, MEMBER_USERNAME, temporaryPassword);
  await earlier.goto("/");
  await expect(earlier).toHaveURL(/\/login/);

  await earlier.context().close();
  await member.context().close();
});
