"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { assertFiscalYearOpen, MAX_KPI_DEPTH } from "@/lib/validation";
import { attempt, type ActionResult } from "./result";

// Structural operations on the hierarchy — create, delete, move, re-order.
// These live apart from kpi.ts (attribute editing) since a hierarchy edit and
// a settings edit are different kinds of action: immediate, with
// confirmation on the destructive ones, rather than staged behind one Save.

async function depthOf(kpiId: string | null): Promise<number> {
  let depth = 0;
  let current = kpiId;
  while (current) {
    const kpi = await prisma.kpi.findUnique({ where: { id: current }, select: { parentId: true } });
    if (!kpi) break;
    depth++;
    current = kpi.parentId;
  }
  return depth;
}

/** How many levels the deepest descendant of `kpiId` sits below it (0 for a leaf). */
async function subtreeHeight(kpiId: string): Promise<number> {
  const children = await prisma.kpi.findMany({ where: { parentId: kpiId }, select: { id: true } });
  if (children.length === 0) return 0;
  const heights = await Promise.all(children.map((c) => subtreeHeight(c.id)));
  return 1 + Math.max(...heights);
}

async function isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
  let current: string | null = candidateId;
  while (current) {
    if (current === ancestorId) return true;
    const kpi: { parentId: string | null } | null = await prisma.kpi.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = kpi?.parentId ?? null;
  }
  return false;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  kpiId: string,
  field: string,
  label: string,
  from: string,
  to: string,
  author: string | null
) {
  await tx.kpiAudit.create({ data: { kpiId, field, label, from, to, author } });
}

export async function createKpi(input: {
  fiscalYearId: string;
  parentId: string | null;
  code: string;
  name: string;
}): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const user = await requireAdmin();

    const code = input.code.trim();
    const name = input.name.trim();
    if (!code) throw new Error("A KPI needs a code.");
    if (!name) throw new Error("A KPI needs a name.");

    const fiscalYear = await prisma.fiscalYear.findUnique({
      where: { id: input.fiscalYearId },
      select: { closedAt: true, label: true },
    });
    if (!fiscalYear) throw new Error("That fiscal year no longer exists.");
    assertFiscalYearOpen(fiscalYear);

    const clash = await prisma.kpi.findFirst({
      where: { fiscalYearId: input.fiscalYearId, code },
    });
    if (clash) throw new Error(`Code "${code}" is already used by "${clash.name}" in this year.`);

    if (input.parentId) {
      const parent = await prisma.kpi.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.fiscalYearId !== input.fiscalYearId) {
        throw new Error("That parent doesn't belong to this fiscal year.");
      }
      const newLevel = (await depthOf(input.parentId)) + 1;
      if (newLevel > MAX_KPI_DEPTH) {
        throw new Error(`The scorecard is limited to ${MAX_KPI_DEPTH} levels; this would be level ${newLevel}.`);
      }
    }

    const siblingCount = await prisma.kpi.count({
      where: { fiscalYearId: input.fiscalYearId, parentId: input.parentId },
    });

    const created = await prisma.$transaction(async (tx) => {
      const kpi = await tx.kpi.create({
        data: {
          fiscalYearId: input.fiscalYearId,
          parentId: input.parentId,
          code,
          name,
          sortOrder: siblingCount,
          weight: 0,
        },
      });
      const parentLabel = input.parentId
        ? ((await tx.kpi.findUnique({ where: { id: input.parentId }, select: { name: true } }))?.name ?? "the top level")
        : "the top level";
      await writeAudit(tx, kpi.id, "created", "Created", "—", `added under ${parentLabel}`, user.username);
      return kpi;
    });

    revalidatePath("/manage/hierarchy");
    revalidatePath("/");
    revalidatePath("/kpis");
    return { id: created.id };
  });
}

export async function deleteKpi(input: { kpiId: string }): Promise<ActionResult> {
  return attempt(async () => {
    const user = await requireAdmin();

    const kpi = await prisma.kpi.findUnique({
      where: { id: input.kpiId },
      include: {
        _count: { select: { children: true, values: true } },
        fiscalYear: { select: { closedAt: true, label: true } },
      },
    });
    if (!kpi) throw new Error("That KPI no longer exists.");
    assertFiscalYearOpen(kpi.fiscalYear);

    await prisma.$transaction(async (tx) => {
      if (kpi.parentId) {
        await writeAudit(
          tx,
          kpi.parentId,
          "deleted",
          "Sub-KPI deleted",
          `${kpi.code} — ${kpi.name}`,
          `deleted, along with ${kpi._count.values} recorded figure${kpi._count.values === 1 ? "" : "s"}`,
          user.username
        );
      }
      // Cascades to children, values and updates.
      await tx.kpi.delete({ where: { id: input.kpiId } });
    });

    revalidatePath("/manage/hierarchy");
    revalidatePath("/");
    revalidatePath("/kpis");
  });
}

export async function moveKpi(input: {
  kpiId: string;
  newParentId: string | null;
}): Promise<ActionResult> {
  return attempt(async () => {
    const user = await requireAdmin();

    const kpi = await prisma.kpi.findUnique({
      where: { id: input.kpiId },
      include: { fiscalYear: { select: { closedAt: true, label: true } } },
    });
    if (!kpi) throw new Error("That KPI no longer exists.");
    assertFiscalYearOpen(kpi.fiscalYear);
    if (input.newParentId === input.kpiId) throw new Error("A KPI cannot be its own parent.");

    if (input.newParentId) {
      const newParent = await prisma.kpi.findUnique({ where: { id: input.newParentId } });
      if (!newParent || newParent.fiscalYearId !== kpi.fiscalYearId) {
        throw new Error("That parent doesn't belong to this fiscal year.");
      }
      if (await isDescendant(input.newParentId, input.kpiId)) {
        throw new Error("That would move a KPI inside its own subtree.");
      }
    }

    const [newDepth, height] = await Promise.all([
      depthOf(input.newParentId).then((d) => d + 1),
      subtreeHeight(input.kpiId),
    ]);
    if (newDepth + height > MAX_KPI_DEPTH) {
      throw new Error(
        `Moving "${kpi.name}" there would put part of its subtree at level ${newDepth + height}, deeper than the ${MAX_KPI_DEPTH}-level limit.`
      );
    }

    const siblingCount = await prisma.kpi.count({
      where: { fiscalYearId: kpi.fiscalYearId, parentId: input.newParentId },
    });

    await prisma.$transaction(async (tx) => {
      const [oldParentName, newParentName] = await Promise.all([
        kpi.parentId
          ? tx.kpi.findUnique({ where: { id: kpi.parentId }, select: { name: true } }).then((p) => p?.name ?? "the top level")
          : Promise.resolve("the top level"),
        input.newParentId
          ? tx.kpi.findUnique({ where: { id: input.newParentId }, select: { name: true } }).then((p) => p?.name ?? "the top level")
          : Promise.resolve("the top level"),
      ]);

      await tx.kpi.update({
        where: { id: input.kpiId },
        data: { parentId: input.newParentId, sortOrder: siblingCount },
      });
      // A moved KPI keeps its code — codes are identities, the key a
      // re-import matches on, not a path — so no renumbering happens here.
      await writeAudit(tx, input.kpiId, "parentId", "Moved", oldParentName, newParentName, user.username);
    });

    revalidatePath("/manage/hierarchy");
    revalidatePath("/");
    revalidatePath("/kpis");
  });
}

export async function reorderKpi(input: {
  kpiId: string;
  direction: "up" | "down";
}): Promise<ActionResult> {
  return attempt(async () => {
    await requireAdmin();

    const kpi = await prisma.kpi.findUnique({
      where: { id: input.kpiId },
      include: { fiscalYear: { select: { closedAt: true, label: true } } },
    });
    if (!kpi) throw new Error("That KPI no longer exists.");
    assertFiscalYearOpen(kpi.fiscalYear);

    const siblings = await prisma.kpi.findMany({
      where: { fiscalYearId: kpi.fiscalYearId, parentId: kpi.parentId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    // Reordering only ever moves a KPI among siblings sharing its own
    // sub-group (including "no sub-group" as a group of its own) — the
    // Hierarchy page renders those as one visual cluster, so a move must
    // stay within it.
    const clusterSiblings = siblings.filter((s) => (s.subGroup ?? "") === (kpi.subGroup ?? ""));
    const index = clusterSiblings.findIndex((s) => s.id === kpi.id);
    const swapWith = input.direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= clusterSiblings.length) return; // already at an end, nothing to do

    const other = clusterSiblings[swapWith];
    await prisma.$transaction([
      prisma.kpi.update({ where: { id: kpi.id }, data: { sortOrder: other.sortOrder } }),
      prisma.kpi.update({ where: { id: other.id }, data: { sortOrder: kpi.sortOrder } }),
    ]);

    revalidatePath("/manage/hierarchy");
    revalidatePath("/");
    revalidatePath("/kpis");
  });
}
