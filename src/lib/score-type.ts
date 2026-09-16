// What kind of figure a score rests on. The data model carries two
// independent booleans (`provisional`/`prorated` on a ScoredNode); people
// reading the scorecard think in three tags, which is what these map to.

export type ScoreType = "ACTUAL" | "ESTIMATE" | "PRORATED";

export const SCORE_TYPES: ScoreType[] = ["ACTUAL", "ESTIMATE", "PRORATED"];

export const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  ACTUAL: "Actual",
  ESTIMATE: "Estimate",
  PRORATED: "Pro-rated",
};

/**
 * The score-type tags that apply to a row. Actual and Estimate are exclusive —
 * a figure is one or the other — while Pro-rated is an independent axis that
 * can accompany either. On a parent row these are rolled up from the leaves
 * beneath it, so the tags mean "contains", not "is".
 */
export function scoreTypesOf(row: { provisional: boolean; prorated: boolean }): ScoreType[] {
  const tags: ScoreType[] = [row.provisional ? "ESTIMATE" : "ACTUAL"];
  if (row.prorated) tags.push("PRORATED");
  return tags;
}
