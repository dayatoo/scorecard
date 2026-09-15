"use client";

import { useRef, useState } from "react";

import { CalendarIcon } from "@/components/CalendarIcon";
import { DatePickerPanel } from "@/components/DatePickerPanel";
import { DATE_PLACEHOLDER, autoFormatDateInput, formatDate, isValidDateInput, parseDate } from "@/lib/dates";
import { useClosePopover } from "@/lib/useClosePopover";

/**
 * A dd/mm/yyyy date field, typed or picked from a calendar popup.
 *
 * Deliberately a text input rather than <input type="date">, which Chromium
 * renders in each viewer's own OS language — so the same field would read
 * mm/dd/yyyy for some colleagues and dd/mm/yyyy for others. `value` and
 * `onChange` speak ISO (yyyy-mm-dd); only what is shown is dd/mm/yyyy. The
 * popup calendar is this app's own (`DatePickerPanel`), for the same reason.
 */
export function DateField({
  value,
  onChange,
  id,
  label,
  className = "",
  disabled,
}: {
  /** ISO yyyy-mm-dd, or "" for empty. */
  value: string;
  /** Called with ISO yyyy-mm-dd, or "" once the field is cleared. */
  onChange: (isoDate: string) => void;
  id?: string;
  /** Accessible name, when there is no visible <label> wrapping the field. */
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(() => formatDate(value));
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-seed when the value changes underneath us — a different month, or a
  // discard — but leave half-typed text alone. Adjusting state during render
  // rather than in an effect avoids rendering the stale value first.
  if (lastValue !== value) {
    setLastValue(value);
    if (parseDate(text) !== (value || null)) setText(formatDate(value));
  }

  const valid = isValidDateInput(text);
  const selectedIso = parseDate(text);
  const shown = selectedIso ? new Date(`${selectedIso}T00:00:00Z`) : new Date();
  const [view, setView] = useState(() => ({ year: shown.getUTCFullYear(), month: shown.getUTCMonth() + 1 }));

  useClosePopover(containerRef, open, () => setOpen(false));

  function selectDate(iso: string) {
    setText(formatDate(iso));
    onChange(iso);
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
          placeholder={DATE_PLACEHOLDER}
          className={className}
          style={{ paddingRight: "1.75rem" }}
          value={text}
          onChange={(event) => {
            const next = autoFormatDateInput(event.target.value);
            setText(next);
            const iso = parseDate(next);
            // Only report a change once the text is a whole, real date — or once
            // the field has been emptied, which clears it.
            if (iso) onChange(iso);
            else if (next.trim() === "") onChange("");
          }}
          onBlur={() => {
            // Tidy "9/3/2026" up to "09/03/2026" once they are done typing.
            const iso = parseDate(text);
            if (iso) setText(formatDate(iso));
          }}
        />
        {!disabled && (
          <button
            type="button"
            aria-label="Choose date"
            className="absolute inset-y-0 right-1.5 flex items-center text-gray-400 hover:text-gray-600"
            onClick={() => {
              const parsed = parseDate(text);
              const base = parsed ? new Date(`${parsed}T00:00:00Z`) : new Date();
              setView({ year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 });
              setOpen((o) => !o);
            }}
          >
            <CalendarIcon />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 mt-1">
          <DatePickerPanel
            selectedIso={selectedIso}
            viewYear={view.year}
            viewMonth={view.month}
            onSelect={selectDate}
            onNavigate={(year, month) => setView({ year, month })}
          />
        </div>
      )}
      {!valid && (
        <span className="mt-1 block text-xs font-medium text-rose-700">
          Enter the date as {DATE_PLACEHOLDER}.
        </span>
      )}
    </div>
  );
}
