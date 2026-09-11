// The one place band colours are defined. Everything that shows a score —
// cells, pills, charts, the Excel export — reads from here, so the palette
// stays consistent.

import { BAND_BOUNDS, type Band } from "./scoring";

export type BandStyle = {
  label: string;
  /** Tailwind classes for a filled pill or table cell. */
  chip: string;
  /** A softer treatment for large areas like table rows. */
  soft: string;
  /** Hex, for SVG charts and the Excel export, which cannot use classes. */
  hex: string;
};

export const BAND_STYLES: Record<Band, BandStyle> = {
  POOR: {
    label: BAND_BOUNDS.POOR.label,
    chip: "bg-rose-600 text-white",
    soft: "bg-rose-50 text-rose-900 ring-1 ring-inset ring-rose-200",
    hex: "#e11d48",
  },
  IMPROVEMENT_NEEDED: {
    label: BAND_BOUNDS.IMPROVEMENT_NEEDED.label,
    chip: "bg-orange-500 text-white",
    soft: "bg-orange-50 text-orange-900 ring-1 ring-inset ring-orange-200",
    hex: "#f97316",
  },
  MEET: {
    label: BAND_BOUNDS.MEET.label,
    chip: "bg-amber-400 text-amber-950",
    soft: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    hex: "#fbbf24",
  },
  GOOD: {
    label: BAND_BOUNDS.GOOD.label,
    chip: "bg-lime-500 text-lime-950",
    soft: "bg-lime-50 text-lime-900 ring-1 ring-inset ring-lime-200",
    hex: "#84cc16",
  },
  VERY_GOOD: {
    label: BAND_BOUNDS.VERY_GOOD.label,
    chip: "bg-emerald-500 text-white",
    soft: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
    hex: "#10b981",
  },
  EXCELLENT: {
    label: BAND_BOUNDS.EXCELLENT.label,
    chip: "bg-teal-700 text-white",
    soft: "bg-teal-50 text-teal-900 ring-1 ring-inset ring-teal-200",
    hex: "#0f766e",
  },
};

/** Styling for a cell with no score yet — deliberately not a band colour. */
export const NO_SCORE_STYLE = {
  chip: "bg-gray-100 text-gray-400",
  soft: "bg-gray-50 text-gray-400 ring-1 ring-inset ring-gray-200",
  hex: "#d1d5db",
};

export function bandStyle(band: Band | null): BandStyle | null {
  return band ? BAND_STYLES[band] : null;
}
