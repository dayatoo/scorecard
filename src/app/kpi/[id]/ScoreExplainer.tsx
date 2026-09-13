"use client";

import {
  BANDS,
  BAND_BOUNDS,
  bandForScore,
  bandLabel,
  daysInMonth,
  monthOfFiscalYear,
  monthsBetween,
  phaseFraction,
  roundScore,
  scoreFixedTarget,
  scoreMonthCompletion,
  scoreRangeTarget,
  type Band,
  type Direction,
  type FixedTargetConfig,
  type RangeTargetConfig,
} from "@/lib/scoring";
import { formatDate, formatMonth } from "@/lib/dates";
import { formatPeriodLabel } from "@/lib/fiscal";
import type { KpiProps } from "./KpiDetailClient";

// BELTS brand reference (extracted from BELTS_Template_2026.potx). Scoped to
// this one panel — nothing else in the app uses these colors.
const NAVY = "#032853";
const CYAN = "#20B0EC";

export type SubKpiForExplainer = {
  id: string;
  code: string;
  name: string;
  weight: number;
  score: number | null;
  exactScore: number | null;
  scoredWeight: number;
};

/** Scores and ratios (0-5 scale, positions, weights) — fixed decimal places for consistent arithmetic. */
function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Raw metric values and targets (dollars, percentages, quantities, days) — the KPI's own numbers, shown at their real precision rather than rounded to a fixed number of decimals. */
function fmtValue(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Rule({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700">{children}</p>;
}

function Maths({ lines }: { lines: React.ReactNode[] }) {
  return (
    <div
      className="space-y-1 rounded border-l-4 bg-sky-50/60 px-3 py-2.5 font-mono text-xs text-gray-800"
      style={{ borderColor: CYAN }}
    >
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

/** Mirrors scoreFixedTarget's band walk, purely to narrate which band (if any) was reached. */
function reachedBandFixed(actual: number, config: FixedTargetConfig, direction: Direction): Band | null {
  const sign = direction === "HIGHER_BETTER" ? 1 : -1;
  const a = actual * sign;
  for (let i = BANDS.length - 1; i >= 1; i--) {
    const band = BANDS[i];
    if (a >= config[band] * sign) return band;
  }
  return null;
}

/** Mirrors scoreRangeTarget's window search, purely to narrate which window matched. */
function matchedBandRange(
  actual: number,
  config: RangeTargetConfig,
  direction: Direction
): { band: Band; lo: number; hi: number } | null {
  const ordered = direction === "HIGHER_BETTER" ? BANDS : [...BANDS].reverse();
  for (let i = 0; i < ordered.length; i++) {
    const band = ordered[i];
    const [a, b] = config[band];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const isLowest = i === 0;
    const isHighest = i === ordered.length - 1;
    const inWindow = (isLowest && actual <= hi) || (isHighest && actual >= lo) || (actual >= lo && actual <= hi);
    if (inWindow) return { band, lo, hi };
  }
  return null;
}

function phasingNote(kpi: KpiProps, period: string): string | null {
  if (!kpi.leaf?.prorated) return null;
  const fraction = phaseFraction(kpi.phasing, monthOfFiscalYear(period), kpi.phaseConfig);
  const monthLabel =
    kpi.phasing === "EVEN"
      ? `${monthOfFiscalYear(period)}/12 months into the fiscal year`
      : "this month's cumulative phase share";
  return `This target is phased (${kpi.phasing === "EVEN" ? "evenly across the year" : "custom monthly shares"}): by ${monthLabel}, ${(fraction * 100).toFixed(1)}% of the annual target applies.`;
}

function OverrideNotice({ override }: { override: NonNullable<KpiProps["leaf"]>["override"] }) {
  if (!override) return null;
  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <p className="font-medium">
        An admin calibrated this score to <strong>{fmt(override.score)}</strong>.
      </p>
      <p className="mt-1">
        {override.byUsername}, {formatDate(new Date(override.createdAt))}: &ldquo;{override.reason}&rdquo;
      </p>
      <p className="mt-2 text-xs text-amber-800">
        The explanation below is what the formula alone would have scored — the calibration
        doesn&rsquo;t hide the math, it sits alongside it.
      </p>
    </div>
  );
}

function DeadlineLayer({ kpi, period }: { kpi: KpiProps; period: string }) {
  const deadline = kpi.leaf?.deadline;
  if (!deadline || deadline.monthsLate <= 0) return null;

  return (
    <>
      <Rule>
        Its deadline was {formatPeriodLabel(kpi.deadlineMonth as string)}. As of{" "}
        {formatPeriodLabel(period)}, it is {deadline.monthsLate} month
        {deadline.monthsLate === 1 ? "" : "s"} late.
      </Rule>
      <Maths
        lines={
          deadline.frozen
            ? [
                `Score freezes at its deadline-month value.`,
                `Score = ${fmt(deadline.score)} (unchanged since ${formatPeriodLabel(kpi.deadlineMonth as string)}, whatever this month's figure turns out to be).`,
              ]
            : [
                `Raw score this month: ${fmt(deadline.rawScore)}`,
                `Cap for ${deadline.monthsLate} month${deadline.monthsLate === 1 ? "" : "s"} late: ${fmt(deadline.cap ?? 0)}`,
                `Score = min(${fmt(deadline.rawScore)}, ${fmt(deadline.cap ?? 0)}) = ${fmt(deadline.score)}`,
              ]
        }
      />
    </>
  );
}

function FixedNumericExplainer({ kpi, period }: { kpi: KpiProps; period: string }) {
  const leaf = kpi.leaf!;
  const value = leaf.value as number;
  const direction = kpi.direction as Direction;
  const unit = kpi.unit ? ` ${kpi.unit}` : "";
  const config = (leaf.prorated ? leaf.phasedTarget : kpi.targetConfig) as FixedTargetConfig;
  const note = phasingNote(kpi, period);

  const reached = reachedBandFixed(value, config, direction);
  const raw = scoreFixedTarget(value, config, direction);
  const rawRounded = roundScore(raw);

  const lines: React.ReactNode[] = [];
  if (reached) {
    lines.push(`Reached the ${bandLabel(reached)} target of ${fmtValue(config[reached])}${unit}.`);
    lines.push(`Score = top of ${bandLabel(reached)} = ${fmt(BAND_BOUNDS[reached].hi)}.`);
  } else {
    const poorTarget = config.POOR;
    if (direction === "HIGHER_BETTER") {
      lines.push(`Did not reach even the Poor target of ${fmtValue(poorTarget)}${unit}.`);
      lines.push(`Score = 2.4 × (${fmtValue(value)} ÷ ${fmtValue(poorTarget)}) = ${fmt(raw, 3)}`);
    } else {
      lines.push(`Overshot the Poor ceiling of ${fmtValue(poorTarget)}${unit}.`);
      lines.push(`Score = 2.4 × (${fmtValue(poorTarget)} ÷ ${fmtValue(value)}) = ${fmt(raw, 3)}`);
    }
  }
  lines.push(`Rounded: ${fmt(raw, 3)} → ${fmt(rawRounded)} (${bandLabel(bandForScore(rawRounded))})`);

  return (
    <>
      <Rule>
        {leaf.basis === "ESTIMATE" ? "An estimated" : "The reported"} year-to-date value for{" "}
        {formatPeriodLabel(period)} was <strong>{fmtValue(value)}{unit}</strong>. Reaching a band&rsquo;s
        target scores the top of that band; short of the Poor target, credit scales down
        proportionally.
      </Rule>
      {note && <Rule>{note}</Rule>}
      <Maths lines={lines} />
      <DeadlineLayer kpi={kpi} period={period} />
    </>
  );
}

function RangeNumericExplainer({ kpi, period }: { kpi: KpiProps; period: string }) {
  const leaf = kpi.leaf!;
  const value = leaf.value as number;
  const direction = kpi.direction as Direction;
  const unit = kpi.unit ? ` ${kpi.unit}` : "";
  const config = (leaf.prorated ? leaf.phasedTarget : kpi.targetConfig) as RangeTargetConfig;
  const note = phasingNote(kpi, period);

  const match = matchedBandRange(value, config, direction);
  const raw = scoreRangeTarget(value, config, direction);
  const rawRounded = roundScore(raw);

  const lines: React.ReactNode[] = [];
  if (match) {
    const { band, lo, hi } = match;
    const { lo: scoreLo, hi: scoreHi } = BAND_BOUNDS[band];
    lines.push(`Falls in the ${bandLabel(band)} window of ${fmtValue(lo)}–${fmtValue(hi)}${unit}.`);
    if (hi === lo) {
      lines.push(`That window is a single point, so it scores the band's top directly: ${fmt(scoreHi)}`);
    } else {
      const position = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
      lines.push(`Position in window = (${fmtValue(value)} − ${fmtValue(lo)}) ÷ (${fmtValue(hi)} − ${fmtValue(lo)}) = ${fmt(position, 3)}`);
      lines.push(
        direction === "HIGHER_BETTER"
          ? `Score = ${fmt(scoreLo)} + ${fmt(position, 3)} × (${fmt(scoreHi)} − ${fmt(scoreLo)}) = ${fmt(raw, 3)}`
          : `Score = ${fmt(scoreHi)} − ${fmt(position, 3)} × (${fmt(scoreHi)} − ${fmt(scoreLo)}) = ${fmt(raw, 3)}`
      );
    }
  } else {
    lines.push(`This value falls outside every configured window — scored at the scale's extreme.`);
  }
  lines.push(`Rounded: ${fmt(raw, 3)} → ${fmt(rawRounded)} (${bandLabel(bandForScore(rawRounded))})`);

  return (
    <>
      <Rule>
        {leaf.basis === "ESTIMATE" ? "An estimated" : "The reported"} year-to-date value for{" "}
        {formatPeriodLabel(period)} was <strong>{fmtValue(value)}{unit}</strong>. Each band owns a
        value window; the score interpolates linearly across the window the value falls in.
      </Rule>
      {note && <Rule>{note}</Rule>}
      <Maths lines={lines} />
      <DeadlineLayer kpi={kpi} period={period} />
    </>
  );
}

function MonthCompletionExplainer({
  kpi,
  period,
  completionDate,
  completionBasis,
}: {
  kpi: KpiProps;
  period: string;
  completionDate: string | null;
  completionBasis: "ACTUAL" | "ESTIMATE" | null;
}) {
  const targetMonth = (kpi.targetConfig as { targetMonth: string }).targetMonth;

  if (!completionDate) {
    // Overdue, not yet completed: scored as though completed on the last day
    // of this scorecard month — always the very bottom of whichever band
    // that lands in, and it keeps dropping every month it stays open.
    const [y, m] = period.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0));
    const raw = scoreMonthCompletion(lastDay, { targetMonth });
    const rounded = roundScore(raw);
    return (
      <>
        <Rule>
          Not yet completed. Its target month, {formatMonth(targetMonth)}, has already passed, so
          it is scored as though it will be completed on the last day of this month — it will
          keep dropping every month it remains open.
        </Rule>
        <Maths
          lines={[
            `Assumed completion: ${formatDate(lastDay)} (the last day of ${formatPeriodLabel(period)})`,
            `That is always the bottom of whichever band the month lands in.`,
            `Score = ${fmt(rounded)} (${bandLabel(bandForScore(rounded))})`,
          ]}
        />
      </>
    );
  }

  const completion = new Date(completionDate);
  const completionPeriod = completionDate.slice(0, 7);
  const delta = monthsBetween(targetMonth, completionPeriod);
  const raw = scoreMonthCompletion(completion, { targetMonth });
  const rounded = roundScore(raw);

  const deltaLabel =
    delta <= -3
      ? "3 or more months early — capped at the maximum"
      : delta === -2
        ? "2 months early — lands in Very Good"
        : delta === -1
          ? "1 month early — lands in Good"
          : delta === 0
            ? "on time — lands in Meet"
            : delta === 1
              ? "1 month late — lands in Improvement Needed"
              : delta === 2
                ? "2 months late — lands in Poor"
                : "3 or more months late — scores 0";

  const lines: React.ReactNode[] = [`Target month ${formatMonth(targetMonth)}; completed ${formatDate(completion)}: ${deltaLabel}.`];

  if (delta >= -2 && delta <= 2) {
    const band = bandForScore(rounded);
    const { lo, hi } = BAND_BOUNDS[band];
    const total = daysInMonth(completion.getUTCFullYear(), completion.getUTCMonth() + 1);
    const day = completion.getUTCDate();
    lines.push(`Within ${formatMonth(completionPeriod)}: day 1 scores ${fmt(hi)}, day ${total} scores ${fmt(lo)}.`);
    if (total > 1) {
      lines.push(`Score = ${fmt(hi)} − ((${day} − 1) ÷ (${total} − 1)) × (${fmt(hi)} − ${fmt(lo)}) = ${fmt(raw, 3)}`);
    }
  }
  lines.push(`Rounded: ${fmt(raw, 3)} → ${fmt(rounded)} (${bandLabel(bandForScore(rounded))})`);

  return (
    <>
      <Rule>
        Completing in the target month scores a Meet; each month early climbs a band, each month
        late drops one. Within the landing month, the score also scales by day — day 1 scores the
        top of the band, the last day scores the bottom.
        {completionBasis === "ESTIMATE" && " This completion date is an estimate, so the score is provisional."}
      </Rule>
      <Maths lines={lines} />
    </>
  );
}

function NoScoreExplainer({ kpi, period }: { kpi: KpiProps; period: string }) {
  const reason = kpi.leaf?.pendingReason;
  if (kpi.metricType === "MONTH_COMPLETION" && reason === "NOT_YET_DUE") {
    const targetMonth = (kpi.targetConfig as { targetMonth: string } | null)?.targetMonth;
    return (
      <Rule>
        {targetMonth ? (
          <>Its target month, {formatMonth(targetMonth)}, hasn&rsquo;t passed yet, so this milestone doesn&rsquo;t score until it&rsquo;s completed or overdue.</>
        ) : (
          <>No target month is set yet, so there is nothing to score.</>
        )}
      </Rule>
    );
  }
  if (reason === "NOT_YET_DUE") {
    return (
      <Rule>
        This KPI is reported {kpi.frequency.toLowerCase()}, and {formatPeriodLabel(period)} isn&rsquo;t
        one of its due months — nothing is scored, and it doesn&rsquo;t count as a reporting gap.
      </Rule>
    );
  }
  return (
    <Rule>
      No figure has been reported for {formatPeriodLabel(period)} yet, so there is nothing to
      score.
    </Rule>
  );
}

function RollupExplainer({ subKpis }: { subKpis: SubKpiForExplainer[] }) {
  const contributing = subKpis.filter((c) => c.exactScore !== null && c.scoredWeight > 0);
  const notContributing = subKpis.filter((c) => !(c.exactScore !== null && c.scoredWeight > 0));

  if (contributing.length === 0) {
    return (
      <Rule>
        None of this KPI&rsquo;s sub-KPIs have a score yet this month, so it has no score either.
      </Rule>
    );
  }

  const totalScoredWeight = contributing.reduce((sum, c) => sum + c.scoredWeight, 0);
  const weightedSum = contributing.reduce((sum, c) => sum + (c.exactScore as number) * c.scoredWeight, 0);
  const exact = weightedSum / totalScoredWeight;
  const rounded = roundScore(exact);

  const lines: React.ReactNode[] = contributing.map(
    (c) =>
      `${c.code} — scored weight ${fmt(c.scoredWeight)} × score ${fmt(c.exactScore as number, 3)} = ${fmt(c.scoredWeight * (c.exactScore as number), 3)}`
  );
  lines.push(`Sum of contributions ÷ sum of scored weight: ${fmt(weightedSum, 3)} ÷ ${fmt(totalScoredWeight)} = ${fmt(exact, 3)}`);
  lines.push(`Rounded: ${fmt(exact, 3)} → ${fmt(rounded)} (${bandLabel(bandForScore(rounded))})`);

  const hasNestedRollup = contributing.some((c) => c.scoredWeight !== c.weight);

  return (
    <>
      <Rule>
        A parent&rsquo;s score is the weighted average of its sub-KPIs&rsquo; scores — using only the ones
        scored this month, with weight renormalised over just those, so a half-reported group
        still scores meaningfully on the 0–5 scale.
      </Rule>
      <Maths lines={lines} />
      {hasNestedRollup && (
        <Rule>
          A sub-KPI that is itself a rollup contributes its own <em>scored</em> weight here — how
          much of its own branch is reported — rather than its nominal share shown in the table
          above, which is why the two numbers can differ.
        </Rule>
      )}
      {notContributing.length > 0 && (
        <Rule>
          {notContributing.map((c) => c.code).join(", ")}{" "}
          {notContributing.length === 1 ? "has" : "have"} no figure yet this month, so{" "}
          {notContributing.length === 1 ? "it is" : "they are"} excluded entirely — not counted in
          the average, and not counted in its weight.
        </Rule>
      )}
    </>
  );
}

export function ScoreExplainer({
  kpi,
  subKpis,
  period,
  completionDate,
  completionBasis,
}: {
  kpi: KpiProps;
  subKpis: SubKpiForExplainer[];
  period: string;
  /** Only meaningful for MONTH_COMPLETION leaves. */
  completionDate: string | null;
  completionBasis: "ACTUAL" | "ESTIMATE" | null;
}) {
  return (
    <details className="group overflow-hidden rounded-lg border">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-semibold text-white select-none"
        style={{ backgroundColor: NAVY }}
      >
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
        How was this score calculated?
      </summary>
      <div className="space-y-4 bg-white px-5 py-4">
        {kpi.leaf?.override && <OverrideNotice override={kpi.leaf.override} />}
        {!kpi.isLeaf ? (
          <RollupExplainer subKpis={subKpis} />
        ) : kpi.leaf?.pendingReason ||
          // A calibrated score clears pendingReason so it counts fully
          // toward coverage — but there's still no real formula to walk
          // through if nothing was ever reported (a milestone not yet due,
          // or a numeric KPI with no figure at all), so re-check the
          // underlying data directly rather than trust the cleared
          // pendingReason for those cases.
          (kpi.metricType === "MONTH_COMPLETION"
            ? !completionDate &&
              monthsBetween((kpi.targetConfig as { targetMonth: string } | null)?.targetMonth ?? period, period) > 0
            : kpi.leaf?.value === null) ? (
          <NoScoreExplainer kpi={kpi} period={period} />
        ) : kpi.metricType === "MONTH_COMPLETION" ? (
          <MonthCompletionExplainer
            kpi={kpi}
            period={period}
            completionDate={completionDate}
            completionBasis={completionBasis}
          />
        ) : kpi.targetMode === "RANGE" ? (
          <RangeNumericExplainer kpi={kpi} period={period} />
        ) : (
          <FixedNumericExplainer kpi={kpi} period={period} />
        )}
      </div>
    </details>
  );
}
