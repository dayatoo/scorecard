"use client";

import { useLinkStatus } from "next/link";

/** Rendered inside a <Link>; shows a small pulse while that navigation is pending. */
export function NavLinkPendingDot() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600"
      aria-hidden
    />
  ) : null;
}
