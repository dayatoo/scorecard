import { bandForScore, BAND_BOUNDS, type Band } from "./scoring";

export const BAND_COLORS: Record<Band, { bg: string; text: string; border: string }> = {
  POOR: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
  IMPROVEMENT_NEEDED: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  MEET: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  GOOD: { bg: "bg-lime-100", text: "text-lime-800", border: "border-lime-300" },
  VERY_GOOD: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  EXCELLENT: { bg: "bg-emerald-200", text: "text-emerald-900", border: "border-emerald-400" },
};

export function styleForScore(score: number | null) {
  if (score === null) return { bg: "bg-gray-100", text: "text-gray-400", border: "border-gray-200", label: "No data" };
  const band = bandForScore(score);
  return { ...BAND_COLORS[band], label: BAND_BOUNDS[band].label };
}
