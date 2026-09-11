// Dates are written and read as dd/mm/yyyy everywhere in this app.
//
// A native <input type="date"> cannot be used for that: Chromium renders it in
// the viewer's own OS language, so the same field reads mm/dd/yyyy for one
// colleague and dd/mm/yyyy for another regardless of the page's `lang`. The
// helpers here back a plain text field instead, keeping ISO (yyyy-mm-dd) as
// the storage and transport format.

export const DATE_PLACEHOLDER = "dd/mm/yyyy";

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

/** The period ("YYYY-MM") a dd/mm/yyyy date falls in. */
export function periodOfDateInput(text: string): string | null {
  const iso = parseDate(text);
  return iso ? iso.slice(0, 7) : null;
}
