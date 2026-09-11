import Link from "next/link";

/** Shown before any KPIs exist, so a fresh install explains itself. */
export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-white px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-gray-600">{description}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
