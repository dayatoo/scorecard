"use client";

import { useState } from "react";

import { DATE_PLACEHOLDER, autoFormatDateInput, formatDate, isValidDateInput, parseDate } from "@/lib/dates";

/**
 * A dd/mm/yyyy date field.
 *
 * Deliberately a text input rather than <input type="date">, which Chromium
 * renders in each viewer's own OS language — so the same field would read
 * mm/dd/yyyy for some colleagues and dd/mm/yyyy for others. `value` and
 * `onChange` speak ISO (yyyy-mm-dd); only what is shown is dd/mm/yyyy.
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

  // Re-seed when the value changes underneath us — a different month, or a
  // discard — but leave half-typed text alone. Adjusting state during render
  // rather than in an effect avoids rendering the stale value first.
  if (lastValue !== value) {
    setLastValue(value);
    if (parseDate(text) !== (value || null)) setText(formatDate(value));
  }

  const valid = isValidDateInput(text);

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
        placeholder={DATE_PLACEHOLDER}
        className={className}
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
      {!valid && (
        <span className="mt-1 block text-xs font-medium text-rose-700">
          Enter the date as {DATE_PLACEHOLDER}.
        </span>
      )}
    </>
  );
}
