"use client";

import { useState } from "react";

import { MONTH_PLACEHOLDER, formatMonth, isValidMonthInput, parseMonth } from "@/lib/dates";

/**
 * An mm/yyyy month field, for a milestone's target month or a KPI's deadline
 * month — anywhere the app needs a month with no day.
 *
 * Deliberately a text input rather than <input type="month">, which renders in
 * each viewer's own browser language (spelled-out "September ----" for one
 * person, a different order for another) and looks nothing like the rest of
 * the app's fields. `value` and `onChange` speak "YYYY-MM"; only what is shown
 * is mm/yyyy.
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

  // Re-seed when the value changes underneath us — a different KPI, or a
  // discard — but leave half-typed text alone. Adjusting state during render
  // rather than in an effect avoids rendering the stale value first.
  if (lastValue !== value) {
    setLastValue(value);
    if (parseMonth(text) !== (value || null)) setText(formatMonth(value));
  }

  const valid = isValidMonthInput(text);

  return (
    <>
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
        value={text}
        onChange={(event) => {
          const next = event.target.value;
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
      {!valid && (
        <span className="mt-1 block text-xs font-medium text-rose-700">
          Enter the month as {MONTH_PLACEHOLDER}.
        </span>
      )}
    </>
  );
}
