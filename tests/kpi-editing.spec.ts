// Exercises full attribute editing on the KPI detail page — metric type,
// target mode and direction were previously read-only after creation.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

// The second test below clears figures permanently, which would otherwise
// leave the shared database in a state other specs' hardcoded score and
// coverage assertions don't expect if this file runs before them. Reseeding
// afterwards (the same reset global-setup.ts uses before the whole suite)
// is simpler and more reliable than trying to restore every field by hand
// through the UI.
test.afterAll(() => {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
});

test("a KPI's metric type can be changed in place, something the app could not do before", async ({ page }) => {
  await page.goto("/kpis");
  await page.getByRole("link", { name: /New customer revenue/ }).click();
  await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();

  // Starts as DOLLAR. Direction is left alone — flipping it too would need
  // the band targets re-ordered, a separate edit from what this checks.
  await page.getByLabel("Metric type").selectOption("QUANTITY");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Scores for every month of the year are recalculated")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and save" }).click();

  await expect(page.getByText("Metric and targets")).toBeVisible();
  // The definition panel reflects the new value after the page refreshes.
  await expect(page.getByLabel("Metric type")).toHaveValue("QUANTITY");
});

test("switching between a numeric metric and month-completion requires clearing figures", async ({ page }) => {
  // A KPI no other spec's entry-grid or dashboard assertions depend on —
  // this test clears its figures permanently (cleaned up by the reseed above).
  await page.goto("/kpis");
  await page.getByRole("link", { name: /Publish the annual report/ }).click();
  await expect(page.getByRole("heading", { name: "Publish the annual report" })).toBeVisible();

  await page.getByLabel("Metric type").selectOption("MONTH_COMPLETION");
  await page.getByLabel("Target month (Meet)").fill("10/2026");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();

  // Refused — figures are recorded and the clear-figures box wasn't ticked.
  // The dialog stays open on a failed save, so back out of it first.
  await expect(page.getByText(/cannot be read the new way/).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Tick the box and it goes through, clearing the figures in the same save.
  await page.getByLabel(/Switching between/).check();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Metric type")).toHaveValue("MONTH_COMPLETION");
});

test("a milestone's completion date can be marked Actual or Estimate, on both the detail page and the entry grid", async ({ page }) => {
  // "Complete ERP rollout" (SG2.2) has no completion date in the seed, so the
  // toggle defaults to Actual with nothing recorded yet. Pin the reporting
  // month explicitly — the KPI table's links carry whatever period is in the
  // URL, and without one the detail page defaults to the real current month.
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Complete ERP rollout" }).click();
  await expect(page.getByRole("heading", { name: "Complete ERP rollout" })).toBeVisible();

  const basis = page.getByRole("radiogroup", { name: "This date is" });
  await expect(basis.getByRole("radio", { name: "Actual" })).toHaveAttribute("aria-checked", "true");

  // Record it as an estimate — the score should carry the same provisional
  // marker an estimated year-to-date figure gets. Dated within the reporting
  // month itself here; a separate test below covers an estimate dated after
  // the reporting month, which (unlike Actual) is allowed.
  await page.getByLabel("Completion date").fill("03/08/2026");
  await basis.getByRole("radio", { name: "Estimate" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();

  await expect(page.getByRole("radiogroup", { name: "This date is" }).getByRole("radio", { name: "Estimate" })).toHaveAttribute("aria-checked", "true");
  // ScoreCell puts "provisional, scored from an estimate" in the chip's title —
  // a more specific target than the "est" superscript, which the score chart's
  // SVG can also emit off-screen copies of.
  await expect(page.locator('[title*="provisional"]').first()).toBeVisible();

  // The same toggle is available from the bulk entry grid, not just here.
  await page.goto(`/entry?period=${PERIOD}`);
  await expect(page.getByLabel("Basis for Complete ERP rollout")).toHaveValue("ESTIMATE");

  // Marking it Actual from the detail page clears the provisional marker.
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Complete ERP rollout" }).click();
  await page.getByRole("radiogroup", { name: "This date is" }).getByRole("radio", { name: "Actual" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  // Reporting a milestone as Actual now offers to mark it complete first;
  // decline — this test only checks that the provisional marker clears.
  await page.getByRole("button", { name: "Not now" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.locator('[title*="provisional"]')).toHaveCount(0);

  // Restore the seed's baseline (no completion date) for other specs.
  await page.getByLabel("Completion date").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Completion date")).toHaveValue("");
});

test("an estimated completion date may be after the reporting month, since it's a projection — an actual one may not", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Complete ERP rollout" }).click();
  await expect(page.getByRole("heading", { name: "Complete ERP rollout" })).toBeVisible();

  const basis = page.getByRole("radiogroup", { name: "This date is" });
  await basis.getByRole("radio", { name: "Estimate" }).click();
  await page.getByLabel("Completion date").fill("15/09/2026");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Completion date")).toHaveValue("15/09/2026");

  // The same date is refused once the figure is marked Actual instead.
  await basis.getByRole("radio", { name: "Actual" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  // Same mark-complete offer as above — decline it; what's under test is the
  // server refusing the date itself, which happens on the save that follows.
  await page.getByRole("button", { name: "Not now" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/is after Aug 2026, the month being reported on/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Restore the seed's baseline for other specs.
  await basis.getByRole("radio", { name: "Estimate" }).click();
  await page.getByLabel("Completion date").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByLabel("Completion date")).toHaveValue("");
});

// Last in the file deliberately: marking a milestone complete turns the Report
// card read-only, so unwinding it through the UI is far more trouble than
// letting the afterAll reseed above clear it.
test("reporting a milestone as Actual offers to mark it complete in the same save", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Complete ERP rollout" }).click();
  await expect(page.getByRole("heading", { name: "Complete ERP rollout" })).toBeVisible();

  // The basis toggle already defaults to Actual, so recording a date is on its
  // own enough to make the milestone read as done.
  await page.getByLabel("Completion date").fill("03/08/2026");
  await page.getByRole("button", { name: "Save" }).click();

  // Named explicitly so this is the mark-complete prompt, not the save
  // confirmation that follows it.
  const prompt = page.getByRole("dialog", { name: "Mark this milestone complete?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Mark complete" }).click();

  await page.getByRole("button", { name: "Confirm and save" }).click();
  // The checkbox's own label reads "Complete"/"Not complete" — the "Mark
  // complete" caption above it is a separate span, not its accessible name.
  await expect(page.getByRole("checkbox", { name: "Complete", exact: true })).toBeChecked();
  await expect(page.getByText(/Value frozen as of Aug 2026/)).toBeVisible();
});
