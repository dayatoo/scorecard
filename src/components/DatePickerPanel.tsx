import { MONTH_NAMES, calendarWeeks, isoDate } from "@/lib/dates";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** A Monday-first day grid for one month, floating below a DateField's input. */
export function DatePickerPanel({
  selectedIso, viewYear, viewMonth, onSelect, onNavigate,
}: {
  selectedIso: string | null;
  viewYear: number;
  /** 1-12 */
  viewMonth: number;
  onSelect: (iso: string) => void;
  onNavigate: (year: number, month: number) => void;
}) {
  const weeks = calendarWeeks(viewYear, viewMonth);
  const todayIso = isoDate(...todayParts());

  function shiftMonth(delta: number) {
    const total = viewYear * 12 + (viewMonth - 1) + delta;
    onNavigate(Math.floor(total / 12), (((total % 12) + 12) % 12) + 1);
  }

  return (
    <div className="w-64 rounded-md border border-gray-300 bg-white p-2 shadow-lg">
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100"
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <span className="text-sm font-medium text-gray-900">
          {MONTH_NAMES[viewMonth - 1]} {viewYear}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className="rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-100"
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
        {WEEKDAY_LABELS.map((day) => (
          <span key={day} className="py-0.5">{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((iso) => {
          const inMonth = iso.slice(0, 7) === `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
          const isSelected = iso === selectedIso;
          const isToday = iso === todayIso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`m-0.5 rounded py-1 text-sm ${
                isSelected
                  ? "bg-blue-600 text-white"
                  : inMonth
                    ? "text-gray-900 hover:bg-blue-50"
                    : "text-gray-300 hover:bg-gray-50"
              } ${isToday && !isSelected ? "font-semibold text-blue-600" : ""}`}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function todayParts(): [number, number, number] {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()];
}
