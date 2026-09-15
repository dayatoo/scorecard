import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  autoFormatDateInput,
  autoFormatMonthInput,
  calendarWeeks,
  formatDate,
  formatMonth,
  isValidDateInput,
  isValidMonthInput,
  isoDate,
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

describe("autoFormatDateInput", () => {
  it("inserts a slash only once a group is complete and another digit follows", () => {
    assert.equal(autoFormatDateInput("0"), "0");
    assert.equal(autoFormatDateInput("09"), "09");
    assert.equal(autoFormatDateInput("090"), "09/0");
    assert.equal(autoFormatDateInput("0903"), "09/03");
    assert.equal(autoFormatDateInput("09032"), "09/03/2");
    assert.equal(autoFormatDateInput("09032026"), "09/03/2026");
  });

  it("drops a trailing slash as soon as the digit before it is removed — how a mobile numeric keypad's own backspace naturally erases one", () => {
    // Typing "9/0/3" then backspacing the "3" leaves the raw text "09/0/"
    // (the browser deletes exactly one character); reformatting that
    // shouldn't reintroduce a slash for the now-empty third group.
    assert.equal(autoFormatDateInput("09/0/"), "09/0");
    assert.equal(autoFormatDateInput("09/"), "09");
  });

  it("re-groups pasted text with its own separators the same way", () => {
    assert.equal(autoFormatDateInput("09/03/2026"), "09/03/2026");
    assert.equal(autoFormatDateInput("09-03-2026"), "09/03/2026");
  });

  it("truncates digits past a full date rather than appending them", () => {
    assert.equal(autoFormatDateInput("090320269999"), "09/03/2026");
  });

  it("has no effect on an already-empty field", () => {
    assert.equal(autoFormatDateInput(""), "");
  });
});

describe("autoFormatMonthInput", () => {
  it("inserts a slash only once the month group is complete and another digit follows", () => {
    assert.equal(autoFormatMonthInput("0"), "0");
    assert.equal(autoFormatMonthInput("09"), "09");
    assert.equal(autoFormatMonthInput("092"), "09/2");
    assert.equal(autoFormatMonthInput("092026"), "09/2026");
  });

  it("drops a trailing slash as soon as the digit before it is removed", () => {
    assert.equal(autoFormatMonthInput("09/"), "09");
  });

  it("truncates digits past a full month rather than appending them", () => {
    assert.equal(autoFormatMonthInput("0920269999"), "09/2026");
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

describe("isoDate", () => {
  it("builds an ISO date from year/month/day parts", () => {
    assert.equal(isoDate(2026, 3, 9), "2026-03-09");
    assert.equal(isoDate(2026, 1, 2), "2026-01-02");
  });

  it("normalizes overflow, so a calendar grid can walk past month/year edges", () => {
    assert.equal(isoDate(2026, 13, 1), "2027-01-01"); // month 13 rolls to next year
    assert.equal(isoDate(2026, 3, 0), "2026-02-28"); // day 0 is the last day of the prior month
    assert.equal(isoDate(2026, 3, 32), "2026-04-01"); // past the month's end rolls forward
  });
});

describe("calendarWeeks", () => {
  it("returns six Monday-first weeks of seven ISO dates each", () => {
    const weeks = calendarWeeks(2026, 3);
    assert.equal(weeks.length, 6);
    for (const week of weeks) assert.equal(week.length, 7);
  });

  it("includes every day of the month, in order, on a Monday-first grid", () => {
    // March 2026 starts on a Sunday, so the first row is Feb's last Monday..Sunday.
    const weeks = calendarWeeks(2026, 3);
    const marchDays = weeks.flat().filter((iso) => iso.startsWith("2026-03"));
    assert.deepEqual(
      marchDays,
      Array.from({ length: 31 }, (_, i) => `2026-03-${String(i + 1).padStart(2, "0")}`)
    );
    assert.equal(weeks[0][6], "2026-03-01"); // Sunday of the first row
    assert.equal(weeks[0][0], "2026-02-23"); // Monday of the first row
  });

  it("pads a month that fits in five weeks with a sixth, from the following month", () => {
    // April 2026 starts on a Wednesday and has 30 days — five weeks of grid
    // cover it, so the sixth is entirely May.
    const weeks = calendarWeeks(2026, 4);
    assert.ok(weeks[5].every((iso) => iso.startsWith("2026-05")));
  });
});
