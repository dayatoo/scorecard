"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KpiNode } from "@/lib/kpi-tree";
import { createKpi, updateKpi, deleteKpi, type KpiInput } from "@/app/actions";
import KpiForm from "./KpiForm";

type EditTarget = { mode: "new"; parentId: string | null } | { mode: "edit"; node: KpiNode } | null;

export default function ManageClient({ tree }: { tree: KpiNode[] }) {
  const [editing, setEditing] = useState<EditTarget>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(input: KpiInput) {
    startTransition(async () => {
      if (editing?.mode === "edit") {
        await updateKpi(editing.node.id, input);
      } else {
        await createKpi(input);
      }
      setEditing(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this KPI and all its sub-KPIs and values? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteKpi(id);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <TreeList nodes={tree} depth={0} onAddChild={(pid) => setEditing({ mode: "new", parentId: pid })} onEdit={(n) => setEditing({ mode: "edit", node: n })} />
        <button
          className="mt-2 text-sm text-blue-600 hover:underline"
          onClick={() => setEditing({ mode: "new", parentId: null })}
        >
          + Add Strategic Goal
        </button>
      </div>

      {editing && (
        <KpiForm
          key={editing.mode === "edit" ? editing.node.id : `new-${editing.parentId}`}
          initial={editing.mode === "edit" ? editing.node : null}
          parentId={editing.mode === "new" ? editing.parentId : null}
          submitting={isPending}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
          onDelete={editing.mode === "edit" ? () => handleDelete(editing.node.id) : undefined}
        />
      )}
    </div>
  );
}

function TreeList({
  nodes,
  depth,
  onAddChild,
  onEdit,
}: {
  nodes: KpiNode[];
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (node: KpiNode) => void;
}) {
  return (
    <ul className={depth === 0 ? "space-y-1" : "space-y-1 border-l border-gray-200 ml-3 pl-3"}>
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="flex items-center gap-2 py-1 group">
            <span className="text-sm font-medium">{node.name}</span>
            <span className="text-xs text-gray-400">
              {node.children.length > 0 ? "group" : node.metricType?.toLowerCase().replace("_", " ")}
              {" · weight "}
              {node.weight}
            </span>
            <button
              className="text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100"
              onClick={() => onEdit(node)}
            >
              edit
            </button>
            <button
              className="text-xs text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100"
              onClick={() => onAddChild(node.id)}
            >
              + add sub-KPI
            </button>
          </div>
          {node.children.length > 0 && (
            <TreeList nodes={node.children} depth={depth + 1} onAddChild={onAddChild} onEdit={onEdit} />
          )}
        </li>
      ))}
    </ul>
  );
}
