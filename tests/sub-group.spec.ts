// Exercises the purely-organizational sub-group label: clustering siblings
// on the Hierarchy page (even when interleaved with others), the Weights
// page's informational subtotal, the tag shown on /kpis, and that
// reordering stays scoped to the cluster.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// Reassigns sub-groups on real seeded KPIs; the reseed (the same reset
// global-setup.ts uses before the whole suite) restores the baseline for
// other specs more reliably than undoing it by hand through the UI.
test.afterEach(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("assigning the same sub-group clusters non-adjacent siblings, with a subtotal on the Weights page and a tag on /kpis", async ({ page }) => {
  await page.goto("/manage/hierarchy");

  // SG2's children in seed order are: Days to close month-end books,
  // Complete ERP rollout, Sites migrated to the new platform, Publish the
  // annual report, Voluntary staff turnover, Modernise field operations.
  // Label the 1st and 3rd — non-adjacent, with "Complete ERP rollout"
  // between them — as "Ops".
  for (const kpiName of ["Days to close month-end books", "Sites migrated to the new platform"]) {
    await page.getByRole("button", { name: `Edit ${kpiName}` }).click();
    const panel = page.getByRole("dialog", { name: `Edit ${kpiName}` });
    await expect(panel).toBeVisible();
    await panel.getByLabel("Sub-group").fill("Ops");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel).toHaveCount(0);
  }

  // They render pulled together under one "Ops" header despite being
  // interleaved with "Complete ERP rollout" in the underlying order.
  await page.goto("/manage/hierarchy");
  await expect(page.getByText("Ops", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Days to close month-end books", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sites migrated to the new platform", exact: true })).toBeVisible();

  // Reordering is scoped to the cluster: each is the only other member of
  // its own 2-item cluster, so "up" on the first and "down" on the second
  // are both hidden (there's nothing in-cluster to swap with).
  await expect(page.getByRole("button", { name: "Move Days to close month-end books up" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move Sites migrated to the new platform down" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move Days to close month-end books down" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Move Sites migrated to the new platform up" })).toBeVisible();

  // The Weights page shows the same cluster, with an informational subtotal
  // — the overall group's 100% requirement (shown above) is unaffected.
  await page.getByRole("link", { name: /Operate efficiently totals to/ }).click();
  await expect(page.getByText("Ops", { exact: true })).toBeVisible();
  await expect(page.getByText(/Balanced|left to assign|too much/)).toBeVisible();

  // A small tag on /kpis, next to each labeled KPI's name.
  await page.goto("/kpis");
  await expect(page.getByText("Ops", { exact: true }).first()).toBeVisible();
});

test("a rollup can carry a sub-group too, and an unlabeled KPI shows no tag", async ({ page }) => {
  await page.goto("/manage/hierarchy");
  await page.getByRole("button", { name: "Edit Modernise field operations" }).click();
  const panel = page.getByRole("dialog", { name: "Edit Modernise field operations" });
  await panel.getByLabel("Sub-group").fill("Transformation");
  await panel.getByRole("button", { name: "Save", exact: true }).click();
  await expect(panel).toHaveCount(0);

  await page.goto("/manage/hierarchy");
  await expect(page.getByText("Transformation", { exact: true })).toBeVisible();

  // "Complete ERP rollout" was never given a sub-group — no tag on /kpis.
  await page.goto("/kpis");
  const row = page.getByRole("row", { name: /Complete ERP rollout/ });
  await expect(row.getByText("Transformation")).toHaveCount(0);
});
