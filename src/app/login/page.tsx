import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — KPI Scorecard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/";

  return (
    <div className="relative isolate flex min-h-[calc(100vh-61px)] items-center justify-center overflow-hidden bg-blue-600 px-4 py-12">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="https://www.belts.com.bn/wp-content/uploads/2024/05/Background-Video-Side.mp4"
      />
      <div className="absolute inset-0 bg-blue-950/50" aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <Image
          src="/brand/logomark-blue.png"
          alt=""
          width={384}
          height={335}
          className="h-10 w-auto"
        />
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
