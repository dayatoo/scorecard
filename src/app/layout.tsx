import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import Link from "next/link";

import { getCurrentUser } from "@/lib/session";
import "./globals.css";

// Manrope (headings), Source Sans 3 (body) and JetBrains Mono (figures) —
// the BELTS-palette "Executive Cards" design direction's type system.
// Self-hosted via next/font, exposed as CSS variables that globals.css'
// @theme block points --font-heading/--font-sans/--font-mono at.
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--next-font-heading" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600"], variable: "--next-font-body" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--next-font-mono" });

export const metadata: Metadata = {
  title: "KPI Scorecard",
  description: "Company KPI tracking and scoring",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/kpis", label: "KPIs" },
  { href: "/milestones", label: "Deadlines" },
  { href: "/entry", label: "Enter Data" },
];

const MANAGE_KPIS_NAV = [
  { href: "/manage", label: "Manage" },
  { href: "/manage/hierarchy", label: "Hierarchy" },
  { href: "/manage/hierarchy/weights", label: "Weights" },
  { href: "/import", label: "Import" },
];

const ADMIN_NAV = [
  { href: "/manage/users", label: "Users" },
  { href: "/manage/approvals", label: "Approvals" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const currentUser = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`h-full ${manrope.variable} ${sourceSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col text-gray-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link
              href="/"
              className="font-heading text-sm font-extrabold tracking-tight text-blue-600"
            >
              KPI Scorecard
            </Link>
            {currentUser && (
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
                {currentUser.role === "ADMIN" && (
                  <details className="group relative">
                    <summary className="cursor-pointer list-none text-gray-600 hover:text-blue-700 marker:content-none">
                      Manage KPIs
                    </summary>
                    <div className="absolute left-0 z-10 mt-1 min-w-40 rounded-md border bg-white py-1 shadow-lg">
                      {MANAGE_KPIS_NAV.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-700"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
                {currentUser.role === "ADMIN" &&
                  ADMIN_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="text-gray-600 hover:text-blue-700"
                    >
                      {item.label}
                    </Link>
                  ))}
              </nav>
            )}
            {currentUser && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-gray-600">{currentUser.username}</span>
                <form action="/api/logout" method="post">
                  <button
                    type="submit"
                    className="text-sm text-gray-500 hover:text-gray-900"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
