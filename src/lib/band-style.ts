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
  /** Which text tone reads well directly on `hex` — light bands need dark text. */
  text: "light" | "dark";
};

export const BAND_STYLES: Record<Band, BandStyle> = {
  POOR: {
    label: BAND_BOUNDS.POOR.label,
    chip: "bg-[#ff0000] text-white",
    soft: "bg-red-50 text-red-900 ring-1 ring-inset ring-red-200",
    hex: "#ff0000",
    text: "light",
  },
  IMPROVEMENT_NEEDED: {
    label: BAND_BOUNDS.IMPROVEMENT_NEEDED.label,
    chip: "bg-[#ffc000] text-amber-950",
    soft: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    hex: "#ffc000",
    text: "dark",
  },
  MEET: {
    label: BAND_BOUNDS.MEET.label,
    chip: "bg-[#92d050] text-lime-950",
    soft: "bg-lime-50 text-lime-900 ring-1 ring-inset ring-lime-200",
    hex: "#92d050",
    text: "dark",
  },
  GOOD: {
    label: BAND_BOUNDS.GOOD.label,
    chip: "bg-[#00b050] text-white",
    soft: "bg-green-50 text-green-900 ring-1 ring-inset ring-green-200",
    hex: "#00b050",
    text: "light",
  },
  VERY_GOOD: {
    label: BAND_BOUNDS.VERY_GOOD.label,
    chip: "bg-[#00b0f0] text-white",
    soft: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200",
    hex: "#00b0f0",
    text: "light",
  },
  EXCELLENT: {
    label: BAND_BOUNDS.EXCELLENT.label,
    chip: "bg-[#0070c0] text-white",
    soft: "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-200",
    hex: "#0070c0",
    text: "light",
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
