// Fiscal-year helpers. The company's year runs 1 April to 31 March, so
// "FY2026/27" starts in April 2026 and its year-to-date figures reset then.

import { formatPeriod, parsePeriod, shiftPeriod } from "./scoring";

export const FY_START_MONTH = 4; // April

export type FiscalYearRef = { startYear: number };

/** "FY2026/27" for a year starting April 2026. */
export function fiscalYearLabel(startYear: number): string {
  return `FY${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** The fiscal year a calendar month belongs to. January 2027 is in FY2026/27. */
export function fiscalYearOfPeriod(period: string): number {
  const { year, month } = parsePeriod(period);
  return month >= FY_START_MONTH ? year : year - 1;
}

/** All twelve periods of a fiscal year, April first. */
export function periodsOfFiscalYear(startYear: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    shiftPeriod(formatPeriod(startYear, FY_START_MONTH), i)
  );
}

export function firstPeriodOfFiscalYear(startYear: number): string {
  return formatPeriod(startYear, FY_START_MONTH);
}

export function lastPeriodOfFiscalYear(startYear: number): string {
  return formatPeriod(startYear + 1, FY_START_MONTH - 1);
}

export function isPeriodInFiscalYear(period: string, startYear: number): boolean {
  return period >= firstPeriodOfFiscalYear(startYear) && period <= lastPeriodOfFiscalYear(startYear);
}

/** 1 for April, 12 for March — how far through the year a period sits. */
export function monthIndexInFiscalYear(period: string): number {
  const { month } = parsePeriod(period);
  return ((month - FY_START_MONTH + 12) % 12) + 1;
}

/**
 * The scorecard window: `period` plus the three months before it, oldest
 * first, clipped to the fiscal year so a comparison never crosses a year
 * boundary into figures measured against different targets.
 */
export function trailingPeriods(period: string, count = 4): string[] {
  const startYear = fiscalYearOfPeriod(period);
  const window: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const candidate = shiftPeriod(period, -i);
    if (isPeriodInFiscalYear(candidate, startYear)) window.push(candidate);
  }
  return window;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Oct 2026" */
export function formatPeriodLabel(period: string): string {
  const { year, month } = parsePeriod(period);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "Oct 26" — for tight table headers. */
export function formatPeriodShort(period: string): string {
  const { year, month } = parsePeriod(period);
  return `${MONTH_NAMES[month - 1]} ${String(year % 100).padStart(2, "0")}`;
}

/** The current calendar month as a period, in UTC. */
export function currentPeriod(now: Date = new Date()): string {
  return formatPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1);
}
