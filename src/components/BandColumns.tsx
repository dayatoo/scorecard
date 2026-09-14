// Shared rendering for the "show all 6 bands" expand/collapse toggle used on
// /kpis, the Dashboard's ScoreTree, and a KPI detail page's sub-KPI table —
// each already has a single Meet Target column driven by
// `describeBandTarget`; expanding swaps it for one of these per band.

import { BAND_STYLES } from "@/lib/band-style";
import { BANDS, bandLabel, type Band, type MetricType } from "@/lib/scoring";

export function BandTargetHeaderCells({ className }: { className: string }) {
  return (
    <>
      {BANDS.map((band) => (
        <th key={band} scope="col" className={className}>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: BAND_STYLES[band].hex }}
            />
            {bandLabel(band)}
          </span>
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
}: {
  bandTargets: Record<Band, string | null>;
  unit: string | null;
  metricType: MetricType | null;
  className: string;
}) {
  return (
    <>
      {BANDS.map((band) => {
        const value = bandTargets[band];
        return (
          <td key={band} className={className}>
            {value === null ? (
              <span className="text-gray-300">—</span>
            ) : (
              <>
                {value}
                {unit && metricType !== "MONTH_COMPLETION" && (
                  <span className="ml-0.5 text-xs text-gray-400">{unit}</span>
                )}
              </>
            )}
          </td>
        );
      })}
    </>
  );
}
