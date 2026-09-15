"use client";

/** Triggers the browser's own print dialog — with `@media print` rules on the
    report page, "Save as PDF" there produces the downloadable report. Kept as
    its own client component so the report page itself can stay a plain,
    fully server-rendered async component. */
export function ReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded bg-[#0d3b66] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <path d="M6 9V2h12v7" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </svg>
      Save as PDF
    </button>
  );
}
