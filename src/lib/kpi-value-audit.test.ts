import assert from "node:assert/strict";
import { test } from "node:test";

import { diffKpiValueFields, stringifyField } from "@/lib/kpi-value-audit";

const BASE = {
  value: null,
  plannedValue: null,
  basis: "ACTUAL" as const,
  completionDate: null,
  note: null,
};

test("diffKpiValueFields — no existing row, only changed fields are reported", () => {
  const changes = diffKpiValueFields(null, { ...BASE, value: 42 });
  assert.deepEqual(changes, [{ field: "value", from: null, to: "42" }]);
});

test("diffKpiValueFields — a same-month edit to an already-reported value still appends a row", () => {
  const existing = { ...BASE, value: 10 };
  const changes = diffKpiValueFields(existing, { ...BASE, value: 20 });
  assert.deepEqual(changes, [{ field: "value", from: "10", to: "20" }]);
});

test("diffKpiValueFields — a no-op write (same value) produces no entries", () => {
  const existing = { ...BASE, value: 10, note: "hello" };
  const changes = diffKpiValueFields(existing, { ...BASE, value: 10, note: "hello" });
  assert.deepEqual(changes, []);
});

test("diffKpiValueFields — every changed field is reported, not just value", () => {
  const existing = { ...BASE, value: 10, note: "old" };
  const nextDate = new Date("2026-08-15T00:00:00.000Z");
  const changes = diffKpiValueFields(existing, {
    value: 15,
    plannedValue: 100,
    basis: "ESTIMATE",
    completionDate: nextDate,
    note: "new",
  });
  assert.deepEqual(changes, [
    { field: "value", from: "10", to: "15" },
    { field: "plannedValue", from: null, to: "100" },
    { field: "basis", from: "ACTUAL", to: "ESTIMATE" },
    { field: "completionDate", from: null, to: nextDate.toISOString() },
    { field: "note", from: "old", to: "new" },
  ]);
});

test("diffKpiValueFields — clearing a value back to null is itself a tracked change", () => {
  const existing = { ...BASE, value: 10 };
  const changes = diffKpiValueFields(existing, { ...BASE, value: null });
  assert.deepEqual(changes, [{ field: "value", from: "10", to: null }]);
});

test("stringifyField — null stays null, never the text \"null\"", () => {
  assert.equal(stringifyField(null), null);
  assert.equal(stringifyField(0), "0");
  assert.equal(stringifyField("ACTUAL"), "ACTUAL");
  assert.equal(stringifyField(new Date("2026-08-15T00:00:00.000Z")), "2026-08-15T00:00:00.000Z");
});
