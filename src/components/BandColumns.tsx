// Shared rendering for the "show all 6 bands" expand/collapse toggle used on
// /kpis, the Dashboard's ScoreTree, and a KPI detail page's sub-KPI table —
// each already has a single Meet Target column driven by
// `describeBandTarget`; expanding swaps it for one of these per band.

import type { CSSProperties } from "react";

import { BAND_STYLES } from "@/lib/band-style";
import { BANDS, bandLabel, type Band, type MetricType } from "@/lib/scoring";

/** A light wash of a band's own color, for tinting its whole column. */
function bandColumnTint(band: Band): string {
  return `color-mix(in srgb, ${BAND_STYLES[band].hex} 14%, transparent)`;
}

export function BandTargetHeaderCells({ className }: { className: string }) {
  return (
    <>
      {BANDS.map((band) => (
        <th
          key={band}
          scope="col"
          className={className}
          style={{ backgroundColor: bandColumnTint(band), color: BAND_STYLES[band].hex }}
        >
          {bandLabel(band)}
        </th>
      ))}
    </>
  );
}

export function BandTargetCells({
  bandTargets,
  unit,
  metricType,
  className,
  cellStyle,
}: {
  bandTargets: Record<Band, string | null>;
  unit: string | null;
  metricType: MetricType | null;
  className: string;
  /** Extra inline styles merged onto every cell, e.g. a caller's own row-collapse animation. */
  cellStyle?: CSSProperties;
}) {
  return (
    <>
      {BANDS.map((band) => {
        const value = bandTargets[band];
        return (
          <td
            key={band}
            className={className}
            style={{ backgroundColor: bandColumnTint(band), ...cellStyle }}
          >

            {value === null ? (
              <span className="text-gray-300">—</span>
            ) : (
              <>
                {value}
                {metricType === "VARIANCE" ? (
                  <span className="ml-0.5 text-xs text-gray-400">%</span>
                ) : (
                  unit &&
                  metricType !== "MONTH_COMPLETION" && (
                    <span className="ml-0.5 text-xs text-gray-400">{unit}</span>
                  )
                )}
              </>
            )}
          </td>
        );
      })}
    </>
  );
}
