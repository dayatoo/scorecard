import { MONTH_ABBR } from "@/lib/dates";

/** A year-nav plus 12-month grid, floating below a MonthField's input. */
export function MonthPickerPanel({
  selectedYearMonth, viewYear, onSelect, onNavigate,
}: {
  selectedYearMonth: string | null;
  viewYear: number;
  onSelect: (yearMonth: string) => void;
  onNavigate: (year: number) => void;
}) {
  return (
    <div className="w-48 rounded-md border border-gray-300 bg-white p-2 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          className="rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100"
          onClick={() => onNavigate(viewYear - 1)}
        >
          ‹
        </button>
        <span className="text-sm font-medium text-gray-900">{viewYear}</span>
        <button
          type="button"
          aria-label="Next year"
          className="rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100"
          onClick={() => onNavigate(viewYear + 1)}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {MONTH_ABBR.map((label, i) => {
          const yearMonth = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
          const isSelected = yearMonth === selectedYearMonth;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(yearMonth)}
              className={`rounded py-1.5 text-sm ${
                isSelected ? "bg-blue-600 text-white" : "text-gray-900 hover:bg-blue-50"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
