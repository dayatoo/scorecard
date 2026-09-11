import { prisma } from "@/lib/prisma";
import { buildTree } from "@/lib/kpi-tree";
import ManageClient from "@/components/ManageClient";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const flat = await prisma.kpi.findMany();
  const tree = buildTree(flat);
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">Manage KPI Hierarchy</h1>
      <p className="text-sm text-gray-500 mb-6">
        Build your Strategic Goals down to leaf KPIs. A node with children automatically becomes a
        rollup (weighted average of its children); a node with no children is a leaf you enter
        monthly values for.
      </p>
      <ManageClient tree={tree} />
    </div>
  );
}
