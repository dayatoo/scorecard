import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import {
  buildTree,
  buildValueLookup,
  scoreNodeForPeriod,
  recentPeriods,
  currentPeriod,
  type KpiNode,
} from "@/lib/kpi-tree";
import { rollupScores } from "@/lib/scoring";
import { styleForScore } from "@/lib/band-style";

export const dynamic = "force-dynamic";

function ScoreCell({ score }: { score: number | null }) {
  const style = styleForScore(score);
  return (
    <td className="px-2 py-1.5 text-center">
      <span
        className={`inline-block min-w-[3.5rem] rounded px-2 py-0.5 text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
        title={style.label}
      >
        {score === null ? "—" : score.toFixed(2)}
      </span>
    </td>
  );
}

function Rows({
  nodes,
  depth,
  periods,
  scores,
}: {
  nodes: KpiNode[];
  depth: number;
  periods: string[];
  scores: Map<string, Map<string, number | null>>;
}) {
  return (
    <>
      {nodes.map((node) => (
        <Fragment key={node.id}>
          <tr className="border-b border-gray-100 hover:bg-gray-50">
            <td className="py-1.5 pr-2" style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}>
              <span className={depth === 0 ? "font-semibold" : "text-sm"}>{node.name}</span>
              {node.children.length === 0 && (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                  {node.metricType?.replace("_", " ")}
                </span>
              )}
            </td>
            <td className="text-xs text-gray-400 text-center">{node.weight}</td>
            {periods.map((p) => (
              <ScoreCell key={p} score={scores.get(node.id)?.get(p) ?? null} />
            ))}
          </tr>
          {node.children.length > 0 && (
            <Rows nodes={node.children} depth={depth + 1} periods={periods} scores={scores} />
          )}
        </Fragment>
      ))}
    </>
  );
}

export default async function DashboardPage() {
  const [flatKpis, allValues] = await Promise.all([
    prisma.kpi.findMany(),
    prisma.kpiValue.findMany(),
  ]);
  const tree = buildTree(flatKpis);
  const lookup = buildValueLookup(allValues);
  const periods = recentPeriods(currentPeriod(), 4); // oldest -> newest, 4 = current + last 3

  const scores = new Map<string, Map<string, number | null>>();
  const collect = (nodes: KpiNode[]) => {
    for (const node of nodes) {
      const perPeriod = new Map<string, number | null>();
      for (const p of periods) {
        perPeriod.set(p, scoreNodeForPeriod(node, p, lookup));
      }
      scores.set(node.id, perPeriod);
      if (node.children.length > 0) collect(node.children);
    }
  };
  collect(tree);

  const totalByPeriod = new Map<string, number | null>();
  for (const p of periods) {
    totalByPeriod.set(
      p,
      rollupScores(tree.map((root) => ({ score: scores.get(root.id)?.get(p) ?? null, weight: root.weight })))
    );
  }

  if (tree.length === 0) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Company Scorecard</h1>
        <p className="text-gray-500">
          No KPIs defined yet.{" "}
          <a href="/manage" className="text-blue-600 hover:underline">
            Set up your KPI hierarchy
          </a>{" "}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">Company Scorecard</h1>
      <p className="text-sm text-gray-500 mb-6">
        Current month and trailing 3 months. Scores are on a 0–5 scale; each KPI rolls up into its
        parent as a weighted average.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-xs text-gray-500">
              <th className="text-left py-2 pl-2">KPI</th>
              <th className="text-center py-2">Weight</th>
              {periods.map((p, i) => (
                <th key={p} className="text-center py-2 px-2">
                  {p}
                  {i === periods.length - 1 && (
                    <div className="text-[10px] text-gray-400">current</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Rows nodes={tree} depth={0} periods={periods} scores={scores} />
            <tr className="border-t-2 border-gray-400 font-bold">
              <td className="py-2 pl-2">Total Combined Score</td>
              <td></td>
              {periods.map((p) => (
                <ScoreCell key={p} score={totalByPeriod.get(p) ?? null} />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        {[
          ["Poor", "bg-red-100 text-red-800 border-red-300"],
          ["Improvement Needed", "bg-orange-100 text-orange-800 border-orange-300"],
          ["Meet", "bg-amber-100 text-amber-800 border-amber-300"],
          ["Good", "bg-lime-100 text-lime-800 border-lime-300"],
          ["Very Good", "bg-green-100 text-green-800 border-green-300"],
          ["Excellent", "bg-emerald-200 text-emerald-900 border-emerald-400"],
        ].map(([label, cls]) => (
          <span key={label} className={`rounded px-2 py-0.5 border ${cls}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
