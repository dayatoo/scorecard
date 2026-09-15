import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Source_Sans_3 } from "next/font/google";
import Link from "next/link";

import Image from "next/image";

import { HeroPattern } from "@/components/HeroPattern";
import { NavLinkPendingDot } from "@/components/NavLinkPendingDot";
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
        <header className="relative overflow-hidden bg-blue-600">
          <HeroPattern className="top-1/2 right-0 h-40 w-[420px] -translate-y-1/2" />
          <div className="relative mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center">
              <Image
                src="/brand/logo-horizontal-white.png"
                alt="KPI Scorecard"
                width={1080}
                height={335}
                priority
                className="h-8 w-auto"
              />
            </Link>
            {currentUser && (
              <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-semibold">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="text-white/75 transition-colors hover:text-blue-300"
                  >
                    {item.label}
                    <NavLinkPendingDot />
                  </Link>
                ))}
                {currentUser.role === "ADMIN" && (
                  <details className="group relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-white/75 transition-colors hover:text-blue-300 marker:content-none">
                      Manage KPIs
                      <span className="text-[10px] transition-transform group-open:rotate-180">▾</span>
                    </summary>
                    <div className="absolute left-0 z-10 mt-2 min-w-40 rounded-md border border-blue-100 bg-white py-1 shadow-lg">
                      {MANAGE_KPIS_NAV.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-50 hover:text-blue-600"
                        >
                          {item.label}
                          <NavLinkPendingDot />
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
                      className="text-white/75 transition-colors hover:text-blue-300"
                    >
                      {item.label}
                      <NavLinkPendingDot />
                    </Link>
                  ))}
              </nav>
            )}
            {currentUser && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-white/60">{currentUser.username}</span>
                <form action="/api/logout" method="post">
                  <button
                    type="submit"
                    className="rounded border border-white/30 px-3 py-1 text-sm font-semibold text-white/90 transition-colors hover:border-blue-300 hover:text-blue-300"
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
