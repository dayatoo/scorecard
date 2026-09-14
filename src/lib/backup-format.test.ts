import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BACKUP_FORMAT_VERSION,
  countValues,
  parseBackup,
  type FiscalYearBackup,
} from "./backup-format";

function kpi(overrides: Record<string, unknown> = {}) {
  return {
    code: "SG1",
    parentCode: null,
    name: "Grow the business",
    sortOrder: 0,
    weight: 100,
    frequency: "MONTHLY",
    phasing: "NONE",
    phaseConfig: null,
    metricType: null,
    direction: null,
    targetMode: null,
    targetConfig: null,
    unit: null,
    deadlineMonth: null,
    scoreFinalAfterDeadline: false,
    departments: [],
    values: [],
    updates: [],
    audits: [],
    overrides: [],
    ...overrides,
  };
}

function document(kpis: unknown[]): string {
  return JSON.stringify({
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: "2026-09-13T12:00:00.000Z",
    fiscalYear: { startYear: 2026, label: "FY2026/27", wasClosed: false },
    departments: ["Finance"],
    kpis,
  });
}

describe("parseBackup", () => {
  it("round-trips a document without losing anything", () => {
    const original = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: "2026-09-13T12:00:00.000Z",
      fiscalYear: { startYear: 2026, label: "FY2026/27", wasClosed: true },
      departments: ["Finance", "Sales"],
      kpis: [
        kpi(),
        kpi({
          code: "SG1.1",
          parentCode: "SG1",
          name: "New customer revenue",
          weight: 60,
          metricType: "DOLLAR",
          direction: "HIGHER_BETTER",
          targetMode: "FIXED",
          targetConfig: '{"MEET":3000000}',
          unit: "BND",
          departments: ["Sales"],
          values: [
            { period: "2026-04", value: 260000, basis: "ACTUAL", completionDate: null, note: "on plan" },
            { period: "2026-05", value: 610000, basis: "ESTIMATE", completionDate: null, note: null },
          ],
          updates: [
            {
              period: "2026-05", mode: "SIMPLE", body: "Pipeline holding up.",
              currentProgress: null, nextProgress: null, timeCost: null, issues: null,
              author: "admin", createdAt: "2026-05-31T00:00:00.000Z",
            },
          ],
          audits: [
            { field: "weight", label: "Weight", from: "50", to: "60", author: "admin", createdAt: "2026-05-01T00:00:00.000Z" },
          ],
          overrides: [
            { period: "2026-05", score: 4.5, reason: "Board adjustment", byUsername: "admin", createdAt: "2026-06-01T00:00:00.000Z" },
          ],
        }),
      ],
    };

    const parsed = parseBackup(JSON.stringify(original));

    assert.deepEqual(parsed, original as FiscalYearBackup);
    assert.equal(countValues(parsed), 2);
  });

  it("rejects a format version it does not understand", () => {
    const future = JSON.stringify({
      formatVersion: 99,
      fiscalYear: { startYear: 2026 },
      kpis: [],
    });
    assert.throws(() => parseBackup(future), /format version 99/);
  });

  it("rejects text that is not JSON", () => {
    assert.throws(() => parseBackup("<html>nope</html>"), /isn't valid JSON/);
  });

  it("rejects a parent code no KPI in the file carries", () => {
    const orphan = document([kpi({ code: "SG1.1", parentCode: "MISSING" })]);
    assert.throws(() => parseBackup(orphan), /isn't in this backup/);
  });

  it("rejects a duplicated code", () => {
    const twice = document([kpi(), kpi({ name: "Same code again" })]);
    assert.throws(() => parseBackup(twice), /twice/);
  });

  it("rejects a hierarchy that loops", () => {
    const cycle = document([
      kpi({ code: "A", parentCode: "B" }),
      kpi({ code: "B", parentCode: "A" }),
    ]);
    assert.throws(() => parseBackup(cycle), /own ancestor/);
  });

  it("rejects a figure whose period is not a month", () => {
    const bad = document([
      kpi({ values: [{ period: "April", value: 1, basis: "ACTUAL" }] }),
    ]);
    assert.throws(() => parseBackup(bad), /where a month like 2026-08 should be/);
  });

  it("keeps a year whose weights don't add up — a backup records what was there", () => {
    // Structural *warnings* are not the validator's business: restoring must
    // reproduce an imperfect year exactly as it stood.
    const lopsided = document([
      kpi({ code: "A", weight: 30 }),
      kpi({ code: "B", weight: 30 }),
    ]);
    assert.equal(parseBackup(lopsided).kpis.length, 2);
  });

  it("defaults missing optional fields rather than refusing the document", () => {
    const sparse = JSON.stringify({
      formatVersion: BACKUP_FORMAT_VERSION,
      fiscalYear: { startYear: 2026 },
      kpis: [{ code: "SG1" }],
    });
    const parsed = parseBackup(sparse);
    assert.equal(parsed.kpis[0].name, "SG1");
    assert.equal(parsed.kpis[0].frequency, "MONTHLY");
    assert.equal(parsed.kpis[0].phasing, "NONE");
    assert.equal(parsed.kpis[0].metricType, null);
    assert.deepEqual(parsed.kpis[0].values, []);
    assert.equal(parsed.fiscalYear.label, "FY2026/27");
  });

  it("refuses a KPI with no code, naming which one", () => {
    const nameless = document([kpi(), { name: "no code here" }]);
    assert.throws(() => parseBackup(nameless), /KPI 2 .* has no code/);
  });
});
