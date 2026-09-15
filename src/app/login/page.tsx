import Link from "next/link";

import { BrandMark } from "@/components/BrandMark";
import { HeroPattern } from "@/components/HeroPattern";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — KPI Scorecard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <div className="relative isolate flex min-h-[calc(100vh-61px)] items-center justify-center overflow-hidden bg-blue-600 px-4 py-12">
      <HeroPattern className="top-1/2 right-[-60px] h-80 w-[560px] -translate-y-1/2" />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <BrandMark className="h-10 w-10" />
        <h1 className="mt-3 text-lg">KPI Scorecard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sign in with your username and password.
        </p>
        <LoginForm next={next} />
        <p className="mt-4 text-sm text-gray-600">
          No account yet?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
