// End-to-end smoke test against a running app with the sample data seeded.
//   npm run build && npm run start   (in one terminal)
//   npx playwright test              (in another)
import { expect, test } from "@playwright/test";

import { PERIOD, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("signing out and back in gates the app", async ({ page }) => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // A protected page redirects rather than rendering.
  await page.goto("/kpis");
  await expect(page).toHaveURL(/\/login/);
});

test("the dashboard opens on the current month", async ({ page }) => {
  // Whatever today is, the reporting month belongs to the fiscal year shown.
  await expect(page.getByRole("heading", { name: /FY2026\/27 scorecard/ })).toBeVisible();
  await expect(page.getByText(/^Reporting \w+ \d{4}/).first()).toBeVisible();
});

test("the dashboard shows the scored hierarchy and a total", async ({ page }) => {
  await page.goto(`/?period=${PERIOD}`);
  await expect(page.getByRole("heading", { name: /FY2026\/27 scorecard/ })).toBeVisible();

  // Strategic Goals are expanded by default.
  await expect(page.getByRole("link", { name: /SG1 Grow the business/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /SG2 Operate efficiently/ })).toBeVisible();

  const totalRow = page.getByRole("row", { name: /Total combined score/ });
  await expect(totalRow).toBeVisible();
  await expect(totalRow).toContainText("100%");

  // Coverage is reported honestly: one milestone is not yet due, and doesn't
  // count against the reported share.
  await expect(totalRow).toContainText("10% not due");
});

/**
 * The summary row once carried a hardcoded `slice(0, 3)`, sized for a scorecard
 * with exactly three Strategic Goals, so a fourth and beyond were silently
 * dropped — and the summary is the only place a goal's score is shown without
 * expanding the tree. The seeded year has just two goals, so this builds its own
 * five-goal year rather than relying on the sample data to be wide enough.
 */
test("every Strategic Goal gets a summary card, not just the first few", async ({ page }) => {
  const ExcelJS = (await import("exceljs")).default;
  const { KPI_COLUMNS } = await import("../src/lib/workbook");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("KPIs");
  sheet.addRow([...KPI_COLUMNS]);
  const GOALS = 5;
  for (let n = 1; n <= GOALS; n++) {
    sheet.addRow([
      `WIDE${n}`, `Wide Goal ${n}`, null, 100 / GOALS, null, "QUANTITY", "units",
      "HIGHER_BETTER", "FIXED", 1, 2, 3, 4, 5, 6, null, "No",
    ]);
  }
  const written = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

  await page.goto("/manage");
  await page.getByLabel("Starting year").fill("2029");
  await page.getByRole("button", { name: "Create year" }).click();
  const year = page.getByRole("listitem").filter({ hasText: "FY2029/30" });
  await expect(year).toBeVisible();

  await page.goto("/import");
  await page.locator('select[name="fiscalYearId"]').selectOption({ label: "FY2029/30" });
  await page.setInputFiles('input[type="file"]', {
    name: "wide.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(written),
  });
  await page.getByRole("button", { name: "Check file" }).click();
  await page.getByRole("button", { name: /^Import into/ }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText("Import complete.")).toBeVisible();

  // One card per goal, plus the total — every goal, not the first three.
  await page.goto(`/?fy=${await yearId(page)}`);
  for (let n = 1; n <= GOALS; n++) {
    await expect(page.getByText(`Wide Goal ${n}`, { exact: true })).toBeVisible();
  }

  // Clean up, so the suite can be re-run.
  await page.goto("/manage");
  await year.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "FY2029/30" })).toHaveCount(0);
});

/** The new year's id, read off its "Open" link on the Manage page. */
async function yearId(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/manage");
  const href = await page
    .getByRole("listitem")
    .filter({ hasText: "FY2029/30" })
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  return (href ?? "").replace("/?fy=", "");
}

test("a sub-KPI appears only once its parent is expanded", async ({ page }) => {
  await page.goto(`/?period=${PERIOD}`);
  const child = page.getByRole("link", { name: /SG1.1.1 New customer revenue/ });
  await expect(child).toBeHidden();

  await page.getByRole("button", { name: "Expand Revenue" }).click();
  await expect(child).toBeVisible();

  await page.getByRole("button", { name: "Collapse Revenue" }).click();
  await expect(child).toBeHidden();
});

test("a KPI detail page explains a late deadline", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Sites migrated to the new platform" }).click();

  await expect(page.getByRole("heading", { name: "Sites migrated to the new platform" })).toBeVisible();
  // Deadline was July, reporting August: one month late, capped at 2.9.
  await expect(page.getByText(/Past its deadline/)).toBeVisible();
  await expect(page.getByText(/capped at/)).toContainText("2.9");
  await expect(page.getByText(/would\s+have scored/)).toContainText("3.9");
});

test("nothing is written until Save is confirmed", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Customer satisfaction" }).click();

  // Clicking through from an August table lands on August, not today.
  await expect(page).toHaveURL(new RegExp(`period=${PERIOD}`));

  const valueInput = page.getByRole("spinbutton", { name: /Year-to-date value/ });
  const original = await valueInput.inputValue();
  expect(original).not.toBe("");

  await valueInput.fill("95");

  // The save bar appears, but the figure is not yet persisted.
  await expect(page.getByText(/nothing is saved until you confirm/)).toBeVisible();

  // Discarding puts it back.
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(valueInput).toHaveValue(original);
  await expect(page.getByText(/nothing is saved until you confirm/)).toBeHidden();

  // Now make the change for real.
  await valueInput.fill("95");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(original);
  await expect(dialog).toContainText("95");

  await dialog.getByRole("button", { name: "Confirm and save" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(valueInput).toHaveValue("95");
  // 95 sits at the top edge of the Very Good window [90, 95], so it scores 4.5.
  await expect(page.getByTitle("Very Good").first()).toContainText("4.5");

  // Put it back, so the suite can be re-run.
  await valueInput.fill(original);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
});

test("cancelling the confirmation writes nothing", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Voluntary staff turnover" }).click();

  const valueInput = page.getByRole("spinbutton", { name: /Year-to-date value/ });
  const original = await valueInput.inputValue();

  await valueInput.fill("1");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.reload();
  await expect(valueInput).toHaveValue(original);
});

test("the KPI table filters and sorts", async ({ page }) => {
  await page.goto(`/kpis?period=${PERIOD}`);

  // The master list shows lowest-level KPIs only — a Strategic Goal is not one
  // of them, though it still appears in the Strategic Goal column.
  await expect(page.getByRole("rowheader", { name: /New customer revenue/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /Grow the business/ })).toHaveCount(0);

  await page.getByLabel("Department").selectOption("Finance");
  await expect(page.getByRole("rowheader", { name: /Days to close month-end books/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /New customer revenue/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("rowheader", { name: /New customer revenue/ })).toBeVisible();

  // Switching to the level view surfaces the Strategic Goals themselves.
  await page.getByRole("button", { name: "By level" }).click();
  await expect(page.getByRole("rowheader", { name: /Grow the business/ })).toBeVisible();

  // Sorting by score orders the rows, whatever the figures happen to be.
  await page.getByRole("button", { name: "Master list" }).click();
  const scoreHeader = page.getByRole("button", { name: "Score", exact: true });

  await scoreHeader.click(); // first click sorts best first
  const descending = await scoreColumn(page);
  expect(descending).toEqual([...descending].sort((a, b) => b - a));

  await scoreHeader.click(); // second click flips it
  const ascending = await scoreColumn(page);
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
  expect(ascending).toEqual([...descending].reverse());
});

test("deadlines page separates overdue from upcoming", async ({ page }) => {
  await page.goto(`/milestones?period=${PERIOD}`);

  const overdue = page.locator("section", { hasText: "Overdue" }).first();
  await expect(overdue).toContainText("Sites migrated to the new platform");

  const dueSoon = page.locator("section", { hasText: "Due within three months" }).first();
  await expect(dueSoon).toContainText("Complete ERP rollout");
});

test("the entry grid saves several KPIs at once", async ({ page }) => {
  await page.goto(`/entry?period=${PERIOD}`);
  await expect(page.getByRole("heading", { name: /Enter data/ })).toBeVisible();

  const days = page.getByLabel("Year-to-date value for Days to close month-end books");
  const turnover = page.getByLabel("Year-to-date value for Voluntary staff turnover");

  const originalDays = await days.inputValue();
  const originalTurnover = await turnover.inputValue();

  // Derive values that always differ from what is there, so the test does not
  // depend on the sample data being freshly seeded.
  const newDays = originalDays === "7" ? "6" : "7";
  const newTurnover = originalTurnover === "5" ? "4" : "5";

  await days.fill(newDays);
  await turnover.fill(newTurnover);

  await expect(page.getByText("2 KPIs with unsaved figures")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  // Wait for the save to land before reloading. The grid writes its entries one
  // at a time, so navigating while the action is still in flight can read a
  // half-applied state — one figure updated and the other not.
  await expect(page.getByText("2 KPIs with unsaved figures")).toBeHidden();

  await page.goto(`/entry?period=${PERIOD}`);
  await expect(days).toHaveValue(newDays);
  await expect(turnover).toHaveValue(newTurnover);

  // Restore, so the suite leaves the sample data as it found it and can be
  // re-run without the figures drifting.
  await days.fill(originalDays);
  await turnover.fill(originalTurnover);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText("2 KPIs with unsaved figures")).toBeHidden();
  await page.goto(`/entry?period=${PERIOD}`);
  await expect(days).toHaveValue(originalDays);
});

/** The Score column, top to bottom, skipping rows with no score. */
async function scoreColumn(page: import("@playwright/test").Page): Promise<number[]> {
  const cells = await page.locator("tbody tr td:nth-child(8)").allInnerTexts();
  return cells
    .map((text) => Number(text.replace(/[^\d.]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
}

test("the Excel export downloads", async ({ page }) => {
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export to Excel" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^kpi-scorecard-FY2026-27-\d{4}-\d{2}\.xlsx$/);
});

test("the import template downloads", async ({ page }) => {
  await page.goto("/import");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download blank template" }).click();
  expect((await download).suggestedFilename()).toBe("kpi-import-template.xlsx");
});

test("dates are written and read as dd/mm/yyyy", async ({ page }) => {
  const label = "Completion date for Complete ERP rollout";

  // Start from a known state rather than whatever a previous run left behind.
  const clear = async () => {
    await page.goto(`/entry?period=${PERIOD}`);
    if ((await page.getByLabel(label).inputValue()) === "") return;
    await page.getByLabel(label).fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await page.goto(`/entry?period=${PERIOD}`);
    await expect(page.getByLabel(label)).toHaveValue("");
  };
  await clear();

  await expect(page.getByLabel(label)).toHaveAttribute("placeholder", "dd/mm/yyyy");

  // A date that would be read differently month-first: 3 August, not 8 March.
  await page.getByLabel(label).fill("03/08/2026");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("completed 03/08/2026");
  await page.getByRole("button", { name: "Confirm and save" }).click();

  // It comes back in the same form.
  await page.goto(`/entry?period=${PERIOD}`);
  await expect(page.getByLabel(label)).toHaveValue("03/08/2026");

  // And it was read as August — two months early against an October target, so
  // Very Good, rather than being mistaken for March and scored as five months
  // early.
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("link", { name: "Complete ERP rollout" }).click();
  await expect(page.getByRole("row", { name: /Aug 2026/ })).toContainText("03/08/2026");
  await expect(page.getByTitle("Very Good").first()).toContainText("4.5");

  // An impossible date is refused rather than rolled forward into March.
  await page.goto(`/entry?period=${PERIOD}`);
  await page.getByLabel(label).fill("31/02/2026");
  await expect(page.getByText("Enter the date as dd/mm/yyyy")).toBeVisible();

  // A completion after the month being reported on is refused too — you cannot
  // report in August something that happened in September.
  await page.reload();
  await page.getByLabel(label).fill("03/09/2026");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(page.getByText(/is after Aug 2026, the month being reported on/)).toBeVisible();

  await clear();
});
