// Dates are written and read as dd/mm/yyyy everywhere in this app.
//
// A native <input type="date"> cannot be used for that: Chromium renders it in
// the viewer's own OS language, so the same field reads mm/dd/yyyy for one
// colleague and dd/mm/yyyy for another regardless of the page's `lang`. The
// helpers here back a plain text field instead, keeping ISO (yyyy-mm-dd) as
// the storage and transport format.

export const DATE_PLACEHOLDER = "dd/mm/yyyy";

// Fixed English names, not `toLocaleDateString` — a calendar picker's month
// names are exactly the kind of thing that would otherwise render in the
// viewer's own browser language, the same problem this file exists to avoid.
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO "2026-03-09" (or a Date) to "09/03/2026". Empty input gives "". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return [
      String(value.getUTCDate()).padStart(2, "0"),
      String(value.getUTCMonth() + 1).padStart(2, "0"),
      value.getUTCFullYear(),
    ].join("/");
  }

  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** ISO "2026-03-09" to "9 Mar 2026". Empty input gives "". */
export function formatDateAbbrev(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTH_ABBR[Number(month) - 1]} ${year}`;
}

/**
 * "09/03/2026" to ISO "2026-03-09", or null if it is not a real date.
 *
 * Accepts single-digit day and month and `-` or `.` as separators, since that
 * is what people type. Deliberately strict about the result: 31/02/2026 is
 * rejected rather than rolled forward into March.
 */
export function parseDate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;

  // Reject a day that does not exist in that month.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** True when the text is either empty or a date this app can read. */
export function isValidDateInput(text: string): boolean {
  return text.trim() === "" || parseDate(text) !== null;
}

/**
 * Digits-only input to "dd/mm/yyyy" as more digits arrive. A slash only
 * appears between two groups once both have at least one digit, so typing
 * never requires a "/" key — the mobile numeric keypad `DateField` uses has
 * none — and backspacing away the last digit of a group drops its trailing
 * slash too. Pasted text with its own separators works the same way, since
 * everything but the digits is stripped before re-grouping.
 */
export function autoFormatDateInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

/** The period ("YYYY-MM") a dd/mm/yyyy date falls in. */
export function periodOfDateInput(text: string): string | null {
  const iso = parseDate(text);
  return iso ? iso.slice(0, 7) : null;
}

/** ISO "yyyy-mm-dd" for a given year and 1-12 month/day, normalizing overflow (month 13 rolls into next year). */
export function isoDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * A Monday-first 6-week grid of ISO dates covering the given month, padded
 * with the leading/trailing days of adjacent months needed to fill whole
 * weeks — for a calendar picker's day grid.
 */
export function calendarWeeks(year: number, month: number): string[][] {
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // 0 = Monday
  const days = Array.from({ length: 42 }, (_, i) => isoDate(year, month, i - firstWeekday + 1));
  return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

// --------------------------------------------------------------------------
// Month-only fields (a milestone's target month, a KPI's deadline month)
// --------------------------------------------------------------------------
//
// Same problem as full dates: a native <input type="month"> renders in the
// viewer's own browser language ("September ----" for one person, a different
// order for another) rather than anything the page controls. These back a
// plain text field the same way, at mm/yyyy, keeping "YYYY-MM" as the
// storage and transport format used throughout scoring.ts.

export const MONTH_PLACEHOLDER = "mm/yyyy";

/** "YYYY-MM" to "mm/yyyy". Empty input gives "". */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  return `${match[2]}/${match[1]}`;
}

/** "mm/yyyy" (or "m/yyyy") to "YYYY-MM", or null if it is not a real month. */
export function parseMonth(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return `${year}-${String(month).padStart(2, "0")}`;
}

/** True when the text is either empty or a month this app can read. */
export function isValidMonthInput(text: string): boolean {
  return text.trim() === "" || parseMonth(text) !== null;
}

/** Same idea as `autoFormatDateInput`, for mm/yyyy. */
export function autoFormatMonthInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 6);
  const parts = [digits.slice(0, 2), digits.slice(2, 6)].filter(Boolean);
  return parts.join("/");
}
