import { NO_SCORE_STYLE, bandStyle } from "@/lib/band-style";
import type { Band } from "@/lib/scoring";

export type ScoreCellProps = {
  score: number | null;
  band: Band | null;
  /** Marks a score derived from an estimate rather than a settled actual. */
  provisional?: boolean;
  /** Marks a score derived from a phased (pro-rated) target. */
  prorated?: boolean;
  /** Marks a score an admin has manually calibrated, overriding the formula. */
  calibrated?: boolean;
  /** Marks a score synthesized by the "assume Meet, decaying" toggle rather than reported. */
  assumed?: boolean;
  /** Why there is no score, shown in place of one. */
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  showBandLabel?: boolean;
};

const SIZES = {
  sm: "text-xs px-1.5 py-0.5 min-w-11",
  md: "text-sm px-2 py-1 min-w-13",
  lg: "text-2xl px-3 py-1.5 min-w-20",
};

/**
 * The single way a score is rendered anywhere in the app: the number to one
 * decimal place, coloured by its band, with an "est." marker when the figure
 * behind it is a forecast.
 */
export function ScoreCell({
  score,
  band,
  provisional = false,
  prorated = false,
  calibrated = false,
  assumed = false,
  placeholder = "—",
  size = "md",
  showBandLabel = false,
}: ScoreCellProps) {
  const style = bandStyle(band);

  if (score === null || !style) {
    return (
      <span
        className={`tabular inline-flex items-center justify-center rounded font-medium ${NO_SCORE_STYLE.chip} ${SIZES[size]}`}
        title={placeholder}
      >
        {placeholder === "—" ? "—" : placeholder}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`tabular inline-flex items-center justify-center rounded font-semibold ${style.chip} ${SIZES[size]}`}
        title={`${style.label}${provisional ? " — provisional, scored from an estimate" : ""}${prorated ? " — pro-rated against a phased target" : ""}${calibrated ? " — manually calibrated by an admin" : ""}${assumed ? " — assumed, not yet reported" : ""}`}
      >
        {score.toFixed(1)}
        {provisional && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">est</sup>}
        {prorated && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">pro</sup>}
        {calibrated && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">cal</sup>}
        {assumed && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">asm</sup>}
      </span>
      {showBandLabel && (
        <span className="text-xs text-gray-600">{style.label}</span>
      )}
    </span>
  );
}

/** "3/4" — how many leaf KPIs in this branch have a figure recorded. */
export function CoverageBadge({
  scoredLeafCount,
  leafCount,
  provisionalShare = 0,
}: {
  /** How many leaf KPIs beneath this node have a figure recorded this period. */
  scoredLeafCount: number;
  /** Total leaf KPIs beneath this node. */
  leafCount: number;
  /** Share of weight whose figure is an estimate, 0..1 — only used for the "est" marker. */
  provisionalShare?: number;
}) {
  const ratio = leafCount > 0 ? scoredLeafCount / leafCount : 0;
  const tone = ratio >= 0.95 ? "text-gray-500" : ratio >= 0.6 ? "text-amber-700" : "text-rose-700";

  const title = [
    `${scoredLeafCount} of ${leafCount} KPI${leafCount === 1 ? "" : "s"} in this branch ${
      leafCount === 1 ? "has" : "have"
    } a figure recorded this month.`,
    provisionalShare > 0 ? `${Math.round(provisionalShare * 100)}% of the score is estimated.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={`tabular text-xs ${tone}`} title={title}>
      {scoredLeafCount}/{leafCount}
      {provisionalShare > 0 && <span className="ml-0.5 opacity-70">est</span>}
    </span>
  );
}
