import { prisma } from "@/lib/prisma";
import { buildTree, flattenTree, type KpiNode } from "@/lib/kpi-tree";
import EntryClient from "@/components/EntryClient";

export const dynamic = "force-dynamic";

function leafPath(node: KpiNode, flat: KpiNode[]): string {
  const byId = new Map(flat.map((n) => [n.id, n]));
  const parts: string[] = [node.name];
  let current = node;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(" › ");
}

export default async function EntryPage() {
  const [flatKpis, values] = await Promise.all([
    prisma.kpi.findMany(),
    prisma.kpiValue.findMany({ orderBy: { period: "desc" } }),
  ]);
  const tree = buildTree(flatKpis);
  const flat = flattenTree(tree);
  const leaves = flat.filter((n) => n.children.length === 0 && n.metricType);
  const leavesWithPath = leaves.map((n) => ({ node: n, path: leafPath(n, flat) }));

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">Enter KPI Data</h1>
      <p className="text-sm text-gray-500 mb-6">
        Select a leaf KPI and a month, then enter its raw value. The scorecard computes the score
        automatically.
      </p>
      <EntryClient leaves={leavesWithPath} values={values} />
    </div>
  );
}
