import { BAND_STYLES, NO_SCORE_STYLE } from "@/lib/band-style";
import { formatPeriodShort } from "@/lib/fiscal";
import { BANDS, BAND_BOUNDS, MAX_SCORE, bandLabel, type Band } from "@/lib/scoring";

// Charts are drawn in a fixed 480x240 coordinate space and scaled uniformly to
// the container. Uniform is the point: stretching a viewBox to fill the width
// (preserveAspectRatio="none") stretches the axis labels with it, which makes
// the text both distorted and liable to clip at the edges.
const W = 480;
const H = 240;

export type ChartPoint = {
  period: string;
  score: number | null;
  band: Band | null;
  provisional: boolean;
};

/** Breaks a series wherever a month has no value, so gaps are not bridged. */
function segmentsOf<T>(
  points: T[],
  valueOf: (point: T) => number | null
): { index: number; value: number }[][] {
  const out: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];

  points.forEach((point, index) => {
    const value = valueOf(point);
    if (value === null) {
      if (run.length > 0) out.push(run);
      run = [];
    } else {
      run.push({ index, value });
    }
  });
  if (run.length > 0) out.push(run);
  return out;
}

/**
 * Score over the fiscal year.
 *
 * The band ranges are laid in behind the line as tinted stripes so a reader can
 * see which band a month landed in without consulting a legend, and the y axis
 * is pinned to 0-5 so months stay comparable at a glance.
 */
export function ScoreChart({
  points,
  title,
}: {
  points: ChartPoint[];
  title: string;
}) {
  const scored = points.filter((p) => p.score !== null);
  if (scored.length === 0) {
    return (
      <figure className="rounded-lg border bg-white p-4">
        <figcaption className="mb-2 text-sm font-medium text-gray-700">{title}</figcaption>
        <p className="rounded border border-dashed px-4 py-10 text-center text-sm text-gray-500">
          No scores recorded yet.
        </p>
      </figure>
    );
  }

  const pad = { left: 26, right: 12, top: 12, bottom: 26 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const x = (index: number) =>
    pad.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (score: number) => pad.top + (1 - score / MAX_SCORE) * plotH;

  return (
    <figure className="rounded-lg border bg-white p-4">
      <figcaption className="mb-2 text-sm font-medium text-gray-700">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}. ${scored
          .map((p) => `${formatPeriodShort(p.period)} ${p.score?.toFixed(1)}`)
          .join(", ")}.`}
      >
        {BANDS.map((band) => {
          const { lo, hi } = BAND_BOUNDS[band];
          return (
            <rect
              key={band}
              x={pad.left}
              y={y(hi)}
              width={plotW}
              height={Math.max(0, y(lo) - y(hi))}
              fill={BAND_STYLES[band].hex}
              opacity={0.13}
            >
              <title>{`${bandLabel(band)} ${lo.toFixed(1)}-${hi.toFixed(1)}`}</title>
            </rect>
          );
        })}

        {[0, 1, 2, 3, 4, 5].map((value) => (
          <g key={value}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke="#9ca3af"
              strokeWidth={0.5}
            />
            <text
              x={pad.left - 6}
              y={y(value)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="#6b7280"
            >
              {value}
            </text>
          </g>
        ))}

        {segmentsOf(points, (p) => p.score).map((segment, index) => (
          <polyline
            key={index}
            points={segment.map((s) => `${x(s.index)},${y(s.value)}`).join(" ")}
            fill="none"
            stroke="#1f2937"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {points.map((point, index) =>
          point.score === null ? null : (
            <circle
              key={point.period}
              cx={x(index)}
              cy={y(point.score)}
              r={4}
              fill={point.band ? BAND_STYLES[point.band].hex : NO_SCORE_STYLE.hex}
              stroke="#ffffff"
              strokeWidth={1.5}
              // A faded centre marks a point resting on an estimate.
              fillOpacity={point.provisional ? 0.45 : 1}
            >
              <title>
                {formatPeriodShort(point.period)}: {point.score.toFixed(1)}
                {point.provisional ? " (estimated)" : ""}
              </title>
            </circle>
          )
        )}

        {points.map((point, index) => (
          <text
            key={`label-${point.period}`}
            x={x(index)}
            y={H - pad.bottom + 16}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7280"
          >
            {formatPeriodShort(point.period).split(" ")[0]}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/**
 * Year-to-date value against its band targets — the question behind the score
 * for a numeric KPI. Targets are drawn as labelled reference lines so the
 * distance still to travel is visible.
 */
export function ValueChart({
  points,
  targets,
  unit,
  title,
}: {
  points: { period: string; value: number | null; provisional: boolean }[];
  targets: { band: Band; value: number }[];
  unit: string | null;
  title: string;
}) {
  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length === 0 || targets.length === 0) return null;

  const targetValues = targets.map((t) => t.value);
  const min = Math.min(...values, ...targetValues);
  const max = Math.max(...values, ...targetValues);
  const span = max - min || Math.abs(max) || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;

  // Room on the right for the target labels, so they never overhang the plot.
  const pad = { left: 44, right: 62, top: 12, bottom: 26 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const x = (index: number) =>
    pad.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => pad.top + (1 - (value - lo) / (hi - lo)) * plotH;

  const compact = (value: number) =>
    Math.abs(value) >= 10_000
      ? value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })
      : String(Number(value.toFixed(2)));

  return (
    <figure className="rounded-lg border bg-white p-4">
      <figcaption className="mb-2 text-sm font-medium text-gray-700">
        {title}
        {unit && <span className="ml-1 font-normal text-gray-500">({unit})</span>}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${title}. ${points
          .filter((p) => p.value !== null)
          .map((p) => `${formatPeriodShort(p.period)} ${p.value}`)
          .join(", ")}.`}
      >
        {targets.map((target) => (
          <g key={target.band}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(target.value)}
              y2={y(target.value)}
              stroke={BAND_STYLES[target.band].hex}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={W - pad.right + 5}
              y={y(target.value)}
              dominantBaseline="middle"
              fontSize={10}
              fill={BAND_STYLES[target.band].hex}
            >
              {bandLabel(target.band).replace("Improvement Needed", "Improve")}
            </text>
            <text
              x={pad.left - 6}
              y={y(target.value)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#9ca3af"
            >
              {compact(target.value)}
            </text>
          </g>
        ))}

        {segmentsOf(points, (p) => p.value).map((segment, index) => (
          <polyline
            key={index}
            points={segment.map((s) => `${x(s.index)},${y(s.value)}`).join(" ")}
            fill="none"
            stroke="#1f2937"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {points.map((point, index) =>
          point.value === null ? null : (
            <circle
              key={point.period}
              cx={x(index)}
              cy={y(point.value)}
              r={4}
              fill="#1f2937"
              stroke="#ffffff"
              strokeWidth={1.5}
              fillOpacity={point.provisional ? 0.4 : 1}
            >
              <title>
                {formatPeriodShort(point.period)}: {point.value.toLocaleString()}
                {unit ? ` ${unit}` : ""}
                {point.provisional ? " (estimated)" : ""}
              </title>
            </circle>
          )
        )}

        {points.map((point, index) => (
          <text
            key={`label-${point.period}`}
            x={x(index)}
            y={H - pad.bottom + 16}
            textAnchor="middle"
            fontSize={11}
            fill="#6b7280"
          >
            {formatPeriodShort(point.period).split(" ")[0]}
          </text>
        ))}
      </svg>
    </figure>
  );
}
