import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDate,
  formatMonth,
  isValidDateInput,
  isValidMonthInput,
  parseDate,
  parseMonth,
  periodOfDateInput,
} from "./dates";

describe("formatDate", () => {
  it("renders ISO dates as dd/mm/yyyy", () => {
    assert.equal(formatDate("2026-03-09"), "09/03/2026");
    assert.equal(formatDate("2026-12-31"), "31/12/2026");
    // A day-month pair that would be ambiguous under mm/dd/yyyy.
    assert.equal(formatDate("2026-01-02"), "02/01/2026");
  });

  it("renders Date objects the same way", () => {
    assert.equal(formatDate(new Date(Date.UTC(2026, 2, 9))), "09/03/2026");
  });

  it("ignores the time part of a timestamp", () => {
    assert.equal(formatDate("2026-03-09T23:45:00.000Z"), "09/03/2026");
  });

  it("returns an empty string for nothing", () => {
    assert.equal(formatDate(null), "");
    assert.equal(formatDate(undefined), "");
    assert.equal(formatDate(""), "");
    assert.equal(formatDate(new Date("nonsense")), "");
  });
});

describe("parseDate", () => {
  it("reads dd/mm/yyyy", () => {
    assert.equal(parseDate("09/03/2026"), "2026-03-09");
    assert.equal(parseDate("31/12/2026"), "2026-12-31");
  });

  it("reads what people actually type", () => {
    assert.equal(parseDate("9/3/2026"), "2026-03-09");
    assert.equal(parseDate("09-03-2026"), "2026-03-09");
    assert.equal(parseDate("09.03.2026"), "2026-03-09");
    assert.equal(parseDate("  09/03/2026  "), "2026-03-09");
  });

  it("reads day-first, never month-first", () => {
    // 03/09 is 3 September, not 9 March.
    assert.equal(parseDate("03/09/2026"), "2026-09-03");
  });

  it("rejects a day that does not exist", () => {
    assert.equal(parseDate("31/02/2026"), null);
    assert.equal(parseDate("30/02/2026"), null);
    assert.equal(parseDate("32/01/2026"), null);
    assert.equal(parseDate("00/01/2026"), null);
  });

  it("accepts 29 February only in a leap year", () => {
    assert.equal(parseDate("29/02/2028"), "2028-02-29");
    assert.equal(parseDate("29/02/2026"), null);
  });

  it("rejects an impossible month", () => {
    assert.equal(parseDate("09/13/2026"), null);
    assert.equal(parseDate("09/00/2026"), null);
  });

  it("rejects anything that is not a whole date", () => {
    assert.equal(parseDate(""), null);
    assert.equal(parseDate("09/03"), null);
    assert.equal(parseDate("09/03/26"), null);
    assert.equal(parseDate("2026-03-09"), null);
    assert.equal(parseDate("tomorrow"), null);
  });

  it("round-trips with formatDate", () => {
    for (const iso of ["2026-01-01", "2026-02-28", "2026-06-15", "2027-03-31"]) {
      assert.equal(parseDate(formatDate(iso)), iso);
    }
  });
});

describe("isValidDateInput", () => {
  it("treats an empty field as valid, since dates are optional", () => {
    assert.equal(isValidDateInput(""), true);
    assert.equal(isValidDateInput("   "), true);
  });

  it("flags a part-typed or impossible date", () => {
    assert.equal(isValidDateInput("09/0"), false);
    assert.equal(isValidDateInput("31/02/2026"), false);
    assert.equal(isValidDateInput("09/03/2026"), true);
  });
});

describe("periodOfDateInput", () => {
  it("gives the month a date falls in", () => {
    assert.equal(periodOfDateInput("09/03/2026"), "2026-03");
    assert.equal(periodOfDateInput("nonsense"), null);
  });
});

describe("formatMonth", () => {
  it("renders YYYY-MM as mm/yyyy", () => {
    assert.equal(formatMonth("2026-03"), "03/2026");
    assert.equal(formatMonth("2026-10"), "10/2026");
    // A month-year pair that a native <input type="month"> would instead spell
    // out in the viewer's own browser language.
    assert.equal(formatMonth("2026-09"), "09/2026");
  });

  it("returns an empty string for nothing", () => {
    assert.equal(formatMonth(null), "");
    assert.equal(formatMonth(undefined), "");
    assert.equal(formatMonth(""), "");
  });
});

describe("parseMonth", () => {
  it("reads mm/yyyy", () => {
    assert.equal(parseMonth("03/2026"), "2026-03");
    assert.equal(parseMonth("10/2026"), "2026-10");
  });

  it("reads what people actually type", () => {
    assert.equal(parseMonth("3/2026"), "2026-03");
    assert.equal(parseMonth("03-2026"), "2026-03");
    assert.equal(parseMonth("03.2026"), "2026-03");
    assert.equal(parseMonth("  03/2026  "), "2026-03");
  });

  it("rejects an impossible month", () => {
    assert.equal(parseMonth("13/2026"), null);
    assert.equal(parseMonth("00/2026"), null);
  });

  it("rejects anything that is not a whole month", () => {
    assert.equal(parseMonth(""), null);
    assert.equal(parseMonth("2026"), null);
    assert.equal(parseMonth("2026-03"), null);
    assert.equal(parseMonth("March"), null);
  });

  it("round-trips with formatMonth", () => {
    for (const period of ["2026-01", "2026-09", "2026-12", "2027-06"]) {
      assert.equal(parseMonth(formatMonth(period)), period);
    }
  });
});

describe("isValidMonthInput", () => {
  it("treats an empty field as valid, since a deadline month is optional", () => {
    assert.equal(isValidMonthInput(""), true);
    assert.equal(isValidMonthInput("   "), true);
  });

  it("flags a part-typed or impossible month", () => {
    assert.equal(isValidMonthInput("03/"), false);
    assert.equal(isValidMonthInput("13/2026"), false);
    assert.equal(isValidMonthInput("03/2026"), true);
  });
});
