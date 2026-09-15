/**
 * Faint circuit/hex line-art, the technical motif from the reference site's
 * hero, rendered as a low-opacity decorative layer over a navy background.
 * Purely decorative — hidden from assistive tech, ignores pointer events.
 */
export function HeroPattern({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 320"
      aria-hidden="true"
      className={`pointer-events-none absolute text-blue-300 ${className}`}
      style={{ opacity: 0.22 }}
      fill="none"
    >
      <circle cx="470" cy="150" r="78" stroke="currentColor" strokeWidth="1" />
      <circle cx="470" cy="150" r="50" stroke="currentColor" strokeWidth="1" />
      <path d="M470 72v-20M470 228v20M392 150h-20M548 150h20" stroke="currentColor" strokeWidth="1" />
      <rect x="452" y="128" width="36" height="44" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M460 128v-10a10 10 0 0 1 20 0v10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M240 60h60l24 24v50" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
      <circle cx="300" cy="60" r="3" fill="currentColor" />
      <circle cx="324" cy="84" r="3" fill="currentColor" />
      <circle cx="324" cy="134" r="3" fill="currentColor" />
      <path d="M560 60h50v40" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" />
      <circle cx="610" cy="100" r="3" fill="currentColor" />
      <path
        d="M120 230h32l10-14h24l8 14h30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="150" cy="230" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="196" cy="230" r="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
