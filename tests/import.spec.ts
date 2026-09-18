// Exercises the export -> import round-trip through the real UI: download the
// scorecard, upload that same file back, and check the hierarchy survives.
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { PERIOD, deleteFiscalYearHard, signIn } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("exporting and re-importing the scorecard preserves it", async ({ page }) => {
  // Capture the hierarchy as it stands.
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("button", { name: "By level" }).click();
  const goalsBefore = await page.getByRole("rowheader").allInnerTexts();

  // Export.
  await page.goto(`/?period=${PERIOD}`);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export to Excel" }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();

  // Re-import it.
  await page.goto("/import");
  await page.setInputFiles('input[type="file"]', file as string);
  await page.getByRole("button", { name: "Check file" }).click();

  // The preview must report a clean file — a round-trip that needs fixing up
  // means the two formats have drifted apart.
  await expect(page.getByText("KPIs in file")).toBeVisible();
  await expect(page.getByText(/problem.? reading the file/)).toHaveCount(0);
  // The round-trip must come back complete: a file that needed fixing up
  // would mean the export and import formats have drifted apart.
  await expect(page.locator('dt:text-is("Strategic Goals total") + dd')).toHaveText("100.00%");
  await expect(page.locator('dt:text-is("KPIs in file") + dd')).toHaveText("15");
  // Seeded with one Progress Update (SG2.2) and several months of figures —
  // both should now round-trip via the export's Values and Updates sheets.
  await expect(page.locator('dt:text-is("Progress updates") + dd')).toHaveText("1");
  await expect(page.getByText("Monthly figures")).toBeVisible();

  await page.getByRole("button", { name: /^Import into/ }).click();
  await page.getByRole("button", { name: "Confirm and save" }).click();

  await expect(page.getByText("Import complete.")).toBeVisible();
  // Matched on code, so everything is an update and nothing is removed. The
  // one seeded Progress Update already exists (same Id), so re-importing it
  // is a no-op — nothing new is posted.
  await expect(page.getByText(/0 KPIs added, 15 updated/)).toBeVisible();
  await expect(page.getByText(/progress update/)).toHaveCount(0);

  // The hierarchy is unchanged.
  await page.goto(`/kpis?period=${PERIOD}`);
  await page.getByRole("button", { name: "By level" }).click();
  expect(await page.getByRole("rowheader").allInnerTexts()).toEqual(goalsBefore);

  // Re-importing did not duplicate the seeded Progress Update.
  await page.getByRole("button", { name: "Master list" }).click();
  await page.getByRole("link", { name: "Complete ERP rollout" }).click();
  await expect(page.getByText("Vendor contract signed")).toHaveCount(1);
});

test("a file that is not a workbook cannot be imported", async ({ page }) => {
  await page.goto("/import");
  // Not a workbook at all.
  await page.setInputFiles('input[type="file"]', {
    name: "not-a-workbook.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("this is not a spreadsheet"),
  });
  await page.getByRole("button", { name: "Check file" }).click();

  await expect(page.getByText(/could not be read as an Excel workbook/)).toBeVisible();
  // The import button stays on screen but refuses to act, with the reason next
  // to it — nothing reaches the database.
  await expect(page.getByRole("button", { name: /^Import into/ })).toBeDisabled();
  await expect(page.getByText("Fix the problems above before importing.")).toBeVisible();
});

test("a new fiscal year can be started from the current one", async ({ page }) => {
  await page.goto("/manage");

  // Copy the active year into the next one.
  await page.getByLabel("Starting year").fill("2027");
  await page.getByLabel("Copy KPIs from").selectOption({ label: "FY2026/27" });
  await page.getByRole("button", { name: "Create year" }).click();

  const newYear = page.getByRole("listitem").filter({ hasText: "FY2027/28" });
  await expect(newYear).toBeVisible();
  // The hierarchy came across; the figures deliberately did not.
  await expect(newYear).toContainText("15 KPIs");

  await newYear.getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: /FY2027\/28 scorecard/ })).toBeVisible();

  // No figures were copied, so nothing is scored yet.
  const totalRow = page.getByRole("row", { name: /Total combined score/ });
  await expect(totalRow).toContainText("0%");

  // Clean up, so the suite can be re-run.
  await page.goto("/manage");
  await deleteFiscalYearHard(page, "FY2027/28", 2027);
});

test("a new fiscal year starts empty unless you choose to copy one", async ({ page }) => {
  // Copying is a deliberate choice, not the default: it fills the new year
  // with the active year's KPIs, and importing a smaller workbook into it
  // afterwards would then remove whatever the workbook didn't mention.
  await page.goto("/manage");

  await expect(page.getByLabel("Copy KPIs from")).toHaveValue("");
  await page.getByLabel("Starting year").fill("2028");
  await page.getByRole("button", { name: "Create year" }).click();

  const newYear = page.getByRole("listitem").filter({ hasText: "FY2028/29" });
  await expect(newYear).toBeVisible();
  await expect(newYear).toContainText("0 KPIs");

  // Clean up, so the suite can be re-run.
  await deleteFiscalYearHard(page, "FY2028/29", 2028);
});

// A bulk import writes KpiValue rows directly, bypassing the Entry Grid and
// KPI detail Report form — it must still append to the audit trail exactly
// as those two paths do, so a change made this way isn't invisible on the
// KPI's "Achievement change log".
test("importing a workbook that changes a figure appends a change-log entry", async ({ page }) => {
  const ExcelJS = (await import("exceljs")).default;
  const { VALUES_SHEET } = await import("../src/lib/workbook");

  // Export, then edit one KPI's already-recorded figure in the Values sheet.
  await page.goto(`/?period=${PERIOD}`);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export to Excel" }).click();
  const file = await (await download).path();
  expect(file).toBeTruthy();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file as string);
  const sheet = workbook.getWorksheet(VALUES_SHEET);
  expect(sheet).toBeTruthy();

  let edited = false;
  sheet!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (row.getCell(1).value === "SG1.1.1" && row.getCell(2).value === PERIOD) {
      row.getCell(3).value = 999999;
      edited = true;
    }
  });
  expect(edited).toBe(true);

  const editedPath = (file as string).replace(/\.xlsx$/, "-edited.xlsx");
  await workbook.xlsx.writeFile(editedPath);

  try {
    await page.goto("/import");
    await page.setInputFiles('input[type="file"]', editedPath);
    await page.getByRole("button", { name: "Check file" }).click();
    await expect(page.getByText("KPIs in file")).toBeVisible();

    await page.getByRole("button", { name: /^Import into/ }).click();
    await page.getByRole("button", { name: "Confirm and save" }).click();
    await expect(page.getByText("Import complete.")).toBeVisible();

    await page.goto(`/kpis?period=${PERIOD}`);
    await page.getByRole("link", { name: "New customer revenue" }).click();
    await expect(page.getByRole("heading", { name: "New customer revenue" })).toBeVisible();

    const panel = page.locator("section", { has: page.getByRole("heading", { name: "Achievement change log" }) });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("999999")).toBeVisible();
  } finally {
    // The import mutated a real KPI figure — reseed so other specs see the
    // original data.
    execFileSync("npx", ["tsx", "prisma/seed.ts"], { stdio: "inherit" });
  }
});
