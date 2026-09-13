"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { attempt, type ActionResult } from "./result";
import {
  commitKpiSettings,
  prepareKpiSettings,
  type SaveKpiSettingsInput,
} from "./kpi";

/**
 * Approves a pending proposal, applying it through the exact same write path
 * an admin's own direct save uses — the audit trail attributes the change to
 * the original proposer, not the approving admin, so it still reads as "who
 * changed the KPI," while the review record on the proposal says who signed
 * off on it.
 */
export async function approveProposal(id: string): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    const proposal = await prisma.kpiChangeProposal.findUnique({
      where: { id },
      include: { proposedBy: true },
    });
    if (!proposal) throw new Error("That proposal no longer exists.");
    if (proposal.status !== "PENDING") {
      throw new Error("That proposal has already been reviewed.");
    }

    const kpi = await prisma.kpi.findUnique({ where: { id: proposal.kpiId } });
    if (!kpi) throw new Error("That KPI no longer exists.");
    if (kpi.updatedAt.getTime() !== proposal.baseUpdatedAt.getTime()) {
      throw new Error(
        "This KPI changed since the proposal was submitted — review it again."
      );
    }

    const input: SaveKpiSettingsInput = JSON.parse(proposal.payload);
    const prepared = await prepareKpiSettings(input);
    await commitKpiSettings(input, prepared, proposal.proposedBy.username);

    await prisma.kpiChangeProposal.update({
      where: { id },
      data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date() },
    });

    revalidatePath("/manage/approvals");
    revalidatePath(`/kpi/${proposal.kpiId}`);
  });
}

export async function rejectProposal(id: string, note?: string | null): Promise<ActionResult> {
  return attempt(async () => {
    const admin = await requireAdmin();

    const proposal = await prisma.kpiChangeProposal.findUnique({ where: { id } });
    if (!proposal) throw new Error("That proposal no longer exists.");
    if (proposal.status !== "PENDING") {
      throw new Error("That proposal has already been reviewed.");
    }

    await prisma.kpiChangeProposal.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
        reviewNote: note?.trim() || null,
      },
    });

    revalidatePath("/manage/approvals");
    revalidatePath(`/kpi/${proposal.kpiId}`);
  });
}
