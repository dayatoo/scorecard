import type { Issue } from "@/lib/validation";

/**
 * Structural problems with the hierarchy — weights not summing to 100, targets
 * out of order. Shown as a banner rather than blocking the page, so a
 * part-built scorecard is still usable while it is being fixed.
 */
export function IssueBanner({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const tone = errors.length > 0
    ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <details className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      <summary className="cursor-pointer font-medium">
        {errors.length > 0 && `${errors.length} problem${errors.length === 1 ? "" : "s"}`}
        {errors.length > 0 && warnings.length > 0 && " and "}
        {warnings.length > 0 && `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
        {" "}with this scorecard&rsquo;s setup
      </summary>
      <ul className="mt-2 space-y-1 pl-1">
        {[...errors, ...warnings].map((issue, index) => (
          <li key={index} className="flex gap-2">
            <span aria-hidden className="opacity-60">
              {issue.severity === "error" ? "✕" : "!"}
            </span>
            <span>
              {issue.kpiCode && <span className="font-mono text-xs">{issue.kpiCode} </span>}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
