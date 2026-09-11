import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "KPI Scorecard",
  description: "Company KPI tracking and scoring",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/kpis", label: "KPIs" },
  { href: "/milestones", label: "Deadlines" },
  { href: "/entry", label: "Enter Data" },
  { href: "/manage", label: "Manage" },
  { href: "/import", label: "Import" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              KPI Scorecard
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-gray-600 hover:text-blue-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form action="/api/logout" method="post" className="ml-auto">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
