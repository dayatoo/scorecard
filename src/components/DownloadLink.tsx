"use client";

import { useState } from "react";

/**
 * A download that fetches the file itself rather than letting the browser
 * navigate to it. A plain `<a href>` to a route works for a native download,
 * but a `next/link` `<Link>` to one is unreliable — Next's client router
 * intercepts the click and fetches the URL as a soft-navigation/RSC request
 * first, which can silently swallow a binary response instead of falling
 * through to a download. Doing the fetch ourselves sidesteps the router
 * entirely and lets the button show a spinner while the file is generated.
 *
 * Keeps a real `href` on the rendered `<a>` so it still exposes an accessible
 * `role="link"`, and still ends in a native browser download (via a
 * synthetic `<a download>` click on an object URL) so it behaves like any
 * other download as far as the browser — and Playwright's `download` event
 * — are concerned.
 */
export function DownloadLink({
  href,
  label,
  loadingLabel,
  className,
}: {
  href: string;
  label: string;
  loadingLabel?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        throw new Error((await res.text().catch(() => "")) || "Could not generate that file.");
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "download.xlsx";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Could not download that file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <a
        href={href}
        onClick={onClick}
        aria-disabled={loading}
        className={`${className ?? ""} inline-flex items-center gap-2 ${loading ? "pointer-events-none opacity-60" : ""}`}
      >
        {loading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        )}
        {loading ? (loadingLabel ?? "Downloading…") : label}
      </a>
      {error && <p className="text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}
