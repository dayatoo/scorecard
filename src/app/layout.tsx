import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KPI Scorecard",
  description: "Company KPI tracking and scoring",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <nav className="border-b bg-white px-6 py-3 flex gap-6 text-sm font-medium">
          <a href="/" className="hover:text-blue-600">
            Dashboard
          </a>
          <a href="/manage" className="hover:text-blue-600">
            Manage KPIs
          </a>
          <a href="/entry" className="hover:text-blue-600">
            Enter Data
          </a>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
