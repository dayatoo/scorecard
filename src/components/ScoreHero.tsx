import Link from "next/link";

import { bandStyle, type BandStyle } from "@/lib/band-style";
import { formatPeriodLabel } from "@/lib/fiscal";
import { isKpiComplete, type ScoredNode } from "@/lib/kpi-tree";
import type { Band, Rollup } from "@/lib/scoring";

/**
 * The company-wide total, as a full-width band-colored banner — deliberately
 * unlike `SummaryCard` below it, so the total reads as the headline figure
 * rather than a third peer in the same grid. Shared by the real Dashboard and
 * the Simulation page, which feeds it a live-rebuilt `total`/`leaves` instead
 * of a saved scorecard's.
 */
export function TotalScoreHero({
  total,
  period,
  leaves,
}: {
  total: Rollup;
  period: string;
  leaves: ScoredNode[];
}) {
  const style = bandStyle(total.band);

  const proratedCount = leaves.filter((n) => n.prorated).length;
  const estimateCount = leaves.filter((n) => n.provisional).length;
  const completeCount = leaves.filter((n) => isKpiComplete(n, period)).length;
  const assumedCount = leaves.filter((n) => n.assumed).length;

  const lightText = style?.text !== "dark";
  const textClass = lightText ? "text-white" : "text-gray-900";
  const eyebrowClass = lightText ? "text-white/70" : "text-gray-900/60";

  const scoredLabel = `${total.scoredLeafCount}/${total.leafCount} KPIs scored`;
  const flagLabels = [
    proratedCount > 0 ? `${proratedCount} pro-rated` : null,
    estimateCount > 0 ? `${estimateCount} estimate${estimateCount === 1 ? "" : "s"}` : null,
    completeCount > 0 ? `${completeCount} complete` : null,
    assumedCount > 0 ? `${assumedCount} assumed` : null,
  ].filter((label): label is string => label !== null);

  return (
    <section
      className={`relative overflow-hidden rounded-2xl p-7 shadow-sm ${textClass}`}
      style={{
        background: style
          ? style.hex
          : "radial-gradient(480px 260px at 88% -20%, rgba(32,176,236,0.35), transparent 65%), " +
            "linear-gradient(155deg, #04336A 0%, #032853 55%, #021A38 100%)",
      }}
    >
      {/* A faint sheen over the flat band color, echoing the highlight the
          fixed navy gradient used to carry, so a solid color doesn't read as
          a plain paint swatch. */}
      {style && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(480px 260px at 88% -20%, rgba(255,255,255,${lightText ? 0.22 : 0.35}), transparent 65%)`,
          }}
        />
      )}
      <div className="relative">
        <div className={`text-xs font-bold tracking-widest uppercase ${eyebrowClass}`}>
          Total score — {formatPeriodLabel(period)}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-3.5">
          <span className="font-heading text-5xl font-extrabold">
            {total.score !== null ? total.score.toFixed(1) : "—"}
          </span>
          {style && <span className="text-3xl font-bold opacity-90">{style.label}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <HeroPill style={style}>{scoredLabel}</HeroPill>
          {flagLabels.length > 0 && (
            <span className={`mx-0.5 h-4 w-px ${lightText ? "bg-white/50" : "bg-gray-900/35"}`} />
          )}
          {flagLabels.map((label) => (
            <HeroPill key={label} style={style}>
              {label}
            </HeroPill>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A coverage-stat pill on the hero: tinted with the band's own color when
    there is one, or a plain translucent chip on the fallback navy gradient. */
function HeroPill({ style, children }: { style: BandStyle | null; children: React.ReactNode }) {
  if (!style) {
    return (
      <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/85">
        {children}
      </span>
    );
  }
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide text-gray-900"
      style={{ background: style.pillTint, borderColor: style.pillBorder }}
    >
      {children}
    </span>
  );
}

export function SummaryCard({
  label,
  score,
  band,
  provisional,
  prorated,
  assumed,
  footer,
  href,
}: {
  label: string;
  score: number | null;
  band: Band | null;
  provisional?: boolean;
  prorated?: boolean;
  assumed?: boolean;
  footer?: React.ReactNode;
  href?: string;
}) {
  const style = bandStyle(band);
  const lightText = style ? style.text !== "dark" : false;
  const textClass = !style ? "text-gray-400" : lightText ? "text-white" : "text-gray-900";
  const mutedClass = !style ? "text-gray-400" : lightText ? "text-white/80" : "text-gray-900/75";

  const inner = (
    <>
      <div className={`truncate text-xs font-medium ${mutedClass}`} title={label}>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tabular text-2xl font-semibold">
          {score !== null ? score.toFixed(1) : "—"}
          {provisional && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">est</sup>}
          {prorated && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">pro</sup>}
          {assumed && <sup className="ml-0.5 text-[0.6em] font-normal opacity-90">asm</sup>}
        </span>
        {style && <span className="text-sm font-bold">{style.label}</span>}
      </div>
      <div className={`mt-2 text-xs ${mutedClass}`}>{footer}</div>
    </>
  );

  const className = `rounded-lg px-4 py-3 ${!style ? "bg-gray-200" : ""} ${textClass}`;
  const bg = style ? { background: style.hex } : undefined;
  return href ? (
    <Link href={href} className={`${className} block hover:brightness-95`} style={bg}>
      {inner}
    </Link>
  ) : (
    <div className={className} style={bg}>
      {inner}
    </div>
  );
}
