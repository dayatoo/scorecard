"use client";

import { useRef, useState } from "react";

import { CalendarIcon } from "@/components/CalendarIcon";
import { MonthPickerPanel } from "@/components/MonthPickerPanel";
import { MONTH_PLACEHOLDER, autoFormatMonthInput, formatMonth, isValidMonthInput, parseMonth } from "@/lib/dates";
import { useClosePopover } from "@/lib/useClosePopover";

/**
 * An mm/yyyy month field, typed or picked from a year/month popup, for a
 * milestone's target month or a KPI's deadline month — anywhere the app
 * needs a month with no day.
 *
 * Deliberately a text input rather than <input type="month">, which renders in
 * each viewer's own browser language (spelled-out "September ----" for one
 * person, a different order for another) and looks nothing like the rest of
 * the app's fields. `value` and `onChange` speak "YYYY-MM"; only what is shown
 * is mm/yyyy. The popup picker is this app's own (`MonthPickerPanel`), for the
 * same reason.
 */
export function MonthField({
  value,
  onChange,
  id,
  label,
  className = "",
  disabled,
}: {
  /** "YYYY-MM", or "" for empty. */
  value: string;
  /** Called with "YYYY-MM", or "" once the field is cleared. */
  onChange: (yearMonth: string) => void;
  id?: string;
  /** Accessible name, when there is no visible <label> wrapping the field. */
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatMonth(value));
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-seed when the value changes underneath us — a different KPI, or a
  // discard — but leave half-typed text alone. Adjusting state during render
  // rather than in an effect avoids rendering the stale value first.
  if (lastValue !== value) {
    setLastValue(value);
    if (parseMonth(text) !== (value || null)) setText(formatMonth(value));
  }

  const valid = isValidMonthInput(text);
  const selectedYearMonth = parseMonth(text);
  const [viewYear, setViewYear] = useState(
    () => Number((selectedYearMonth ?? String(new Date().getFullYear())).slice(0, 4))
  );

  useClosePopover(containerRef, open, () => setOpen(false));

  function selectMonth(yearMonth: string) {
    setText(formatMonth(yearMonth));
    onChange(yearMonth);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          aria-invalid={!valid}
          disabled={disabled}
          placeholder={MONTH_PLACEHOLDER}
          className={className}
          style={{ paddingRight: "1.75rem" }}
          value={text}
          onChange={(event) => {
            const next = autoFormatMonthInput(event.target.value);
            setText(next);
            const yearMonth = parseMonth(next);
            // Only report a change once the text is a whole, real month — or
            // once the field has been emptied, which clears it.
            if (yearMonth) onChange(yearMonth);
            else if (next.trim() === "") onChange("");
          }}
          onBlur={() => {
            // Tidy "9/2026" up to "09/2026" once they are done typing.
            const yearMonth = parseMonth(text);
            if (yearMonth) setText(formatMonth(yearMonth));
          }}
        />
        {!disabled && (
          <button
            type="button"
            aria-label="Choose month"
            className="absolute inset-y-0 right-1.5 flex items-center text-gray-400 hover:text-gray-600"
            onClick={() => {
              const parsed = parseMonth(text);
              setViewYear(Number((parsed ?? String(new Date().getFullYear())).slice(0, 4)));
              setOpen((o) => !o);
            }}
          >
            <CalendarIcon />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1">
          <MonthPickerPanel
            selectedYearMonth={selectedYearMonth}
            viewYear={viewYear}
            onSelect={selectMonth}
            onNavigate={setViewYear}
          />
        </div>
      )}
      {!valid && (
        <span className="mt-1 block text-xs font-medium text-rose-700">
          Enter the month as {MONTH_PLACEHOLDER}.
        </span>
      )}
    </div>
  );
}
