/**
 * A clickable, `aria-sort`-labeled column header — the one way any sortable
 * table in the app toggles a column between ascending and descending.
 * Generic over the table's own sort-key union so each table keeps its own
 * narrow `SortKey` type while sharing this rendering.
 */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: K;
  sort: { key: K; direction: "asc" | "desc" };
  onSort: (key: K) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort.key === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 text-${align}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase hover:text-gray-900"
      >
        {label}
        <span aria-hidden className={active ? "text-gray-900" : "text-gray-300"}>
          {active && sort.direction === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}
