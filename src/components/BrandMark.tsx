/**
 * Abstract hexagon-and-chevron mark, echoing the angular engineering-brand
 * language of the reference site without reproducing its actual logo.
 */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 1.5 29.5 9v14L16 30.5 2.5 23V9Z"
        fill="var(--color-blue-800)"
        stroke="var(--color-blue-300)"
        strokeWidth="1"
      />
      <path
        d="M9 21 18 10h6l-9 11z"
        fill="var(--color-blue-400)"
      />
    </svg>
  );
}
