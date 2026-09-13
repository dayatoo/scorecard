import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — KPI Scorecard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">KPI Scorecard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sign in with your username and password.
        </p>
        <LoginForm next={next} />
        <p className="mt-4 text-sm text-gray-600">
          No account yet?{" "}
          <Link href="/register" className="text-blue-700 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
