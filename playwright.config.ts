import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Reseed first: the tests share one database and write to it.
  globalSetup: "./tests/global-setup.ts",
  // The app holds one shared database, so parallel tests would fight over the
  // figures they write and assert on.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: {
      // Use the Chromium already on the machine rather than downloading one.
      // Unset CHROMIUM_PATH to fall back to Playwright's own browser.
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },
});
